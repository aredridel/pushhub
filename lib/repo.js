"use strict";

var cp = require('child_process');
var path = require('path');

var Commits = require('./commits');
var Cache = require('./cache');
var utils = require('./utils');

var spawn = cp.spawn;
var basename = path.basename;


var Repo = module.exports = function Repo(dir) {
    this.name = basename(dir);
    this.path = dir;
    this.cache = new Cache();

    this.memoize();
};

Repo.prototype.parse = function parse(text, ref) {
    text = text.toString();
    return text.split('\n').map(function(line) {
        var o = {
            'mode': line.slice(0, 6),
            'type': line.slice(7, 11),
            'hash': line.slice(12, 52),
            'path': line.slice(53)
        };
        o.path += (o.type == 'tree') ? '/' : '';
        o.name = basename(o.path);
        //TODO: Doesn't belong here
        o.url = utils.url('', this.name, o.type, ref, o.path);
        return o;
    }, this);
};

Repo.prototype.dirStat = function dirStat(ref ,path, fileList, cb) {
    var commits = [],
        expected = fileList.length;

    fileList.forEach(function(entry, index) {
        this.stats(ref, entry, 1, function(err, commit) {
            if(err) throw err;
            commits[index] = commit;
            if(commits.length == expected) {
                cb(null, commits);
            }
        });
    }, this);
    return commits;
};

Repo.prototype.memoize = function memoize() {
    this.branches(utils.noop);
    this.tags(utils.noop);
};

Repo.prototype.flush = function flush() {
    this.cache.del('branches');
    this.cache.del('tags');
};

// https://github.com/creationix/node-git/blob/master/lib/git-fs.js
Repo.prototype.gitExec = function gitExec(commands, cb) {
    commands.unshift('--git-dir=' + this.path);
    var child = spawn("git", commands);
    var stdout = [], stderr = [];
    child.stdout.addListener('data', function (text) {
        stdout[stdout.length] = text;
    });
    child.stderr.addListener('data', function (text) {
        stderr[stderr.length] = text;
    });
    child.addListener('exit', function (code) {
        if (code > 0) {
            var err = new Error("git " + commands.join(" ") + "\n" + utils.bufferConcat(stderr, 'utf8'));
            cb(err);
            return;
        }
        cb(null, utils.bufferConcat(stdout));
    });
    child.stdin.end();
};

Repo.prototype.stats = function stats(ref, entry) {
    var cb = utils.noop,
        maxcount = 0,
        skip = 0,
        len = arguments.length,
        args = ['log', ref, '--date=relative'];

    if(typeof entry === 'string') {
        entry = { path: entry };
    }
    if(len === 3) {
        cb = arguments[2];
    }
    if(len === 4) {
        maxcount = arguments[2];
        cb = arguments[3];
    }
    if(len === 5) {
        maxcount = arguments[2];
        skip = arguments[3];
        cb = arguments[4];
    }
    if(maxcount >= 1) {
        args.push('--max-count=' + maxcount);
    }
    if(skip > 0) {
        args.push('--skip=' + skip);
    }

    args.push('--', entry.path);

    this.gitExec(args, function(err, stdout) {
        if(err) {
            return cb(err);
        } else {
            entry.commits = new Commits(stdout);
            entry.tip = entry.commits.tip();
            return cb(null, entry);
        }
    }.bind(this));
};

Repo.prototype.tip = function tip(ref, cb) {
    this.gitExec(['log', ref, '-n1', '--date=relative', '--', '.'], function(err, stdout) {
        if(err) {
            return cb(err);
        } else {
            var c = new Commits(stdout);
            return cb(null, c.tip());
        }
    }.bind(this));
};

Repo.prototype.tree = function tree(ref, path, cb) {
    var directories, files;

    console.log('LISTING', path);

    this.gitExec(['ls-tree', ref, path], function(err, stdout) {
        if(err) { cb(err); }

        var entries = this.parse(stdout, ref);
        directories = entries.filter(function(entry) {
            return entry.type == 'tree';
        });
        files = entries.filter(function(entry) {
            return entry.type == 'blob';
        });
        directories.sort();
        files.sort();
        entries = directories.concat(files);

        this.dirStat(ref, path, entries, function(err, tree) {
            if(err) { return cb(err); }
            cb(null, tree);
        });
    }.bind(this));
};


Repo.prototype.blob = function blob(ref, path, cb) {
    console.log('DISPLAYING', path);
    this.gitExec(['show', ref + ':' + path], cb);
};


Repo.prototype.tags = function tags(cb) {
    var out;

    if(this.cache.has('tags')) {
        return cb(null, this.cache.get('tags'));
    }

    this.gitExec(['tag', '-l'], function(err, stdout) {
        if(err) {
            return cb(err);
        } else {
            out = stdout.toString().split('\n').filter(utils.not(''));
            this.cache.store('tags', out);
            return cb(null, out);
        }
    }.bind(this));
};

Repo.prototype.branches = function branches(cb) {
    var lines;

    if(this.cache.has('branches')) {
        return cb(null, this.cache.get('branches'));
    }

    this.gitExec(['branch'], function(err, stdout) {
        if(err) {
            return cb(err);
        } else {
            lines = stdout.toString().split('\n');
            lines.pop();
            lines = lines.map(function(line) {
                return line.replace(/^\*\s/, '').trim();
            });
            this.cache.store('branches', lines);
            return cb(null, lines);
        }
    }.bind(this));
};
