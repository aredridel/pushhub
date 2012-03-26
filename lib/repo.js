"use strict";

var cp = require('child_process');
var path = require('path');

var Commits = require('./commits');
var Cache = require('./cache');
var utils = require('./utils');

var exec = cp.exec;
var spawn = cp.spawn;
var basename = path.basename;


var Repo = module.exports = function Repo(dir) {
    this.name = basename(dir);
    this.path = dir;
    this.cache = new Cache();

    this.memoize();
};

Repo.prototype.parse = function parse(text, ref) {
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

Repo.prototype.stats = function stats(ref, entry) {
    var cb = utils.noop,
        maxcount = 0,
        skip = 0,
        len = arguments.length;

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

    var m = maxcount >= 1 ? '--max-count=' + maxcount : '',
        s = skip > 0 ? '--skip=' + skip : '';

    exec(['git', 'log', m, s, '--date=relative', '--', entry.path].join(' '), { cwd: this.path },
        function(error, stdout) {
            if(error) {
                return cb(error);
            } else {
                entry.commits = new Commits(stdout);
                entry.tip = entry.commits.tip();
                return cb(null, entry);
            }
        }.bind(this));
};

Repo.prototype.memoize = function memoize() {
    this.branches(utils.noop);
    this.tags(utils.noop);
};

Repo.prototype.flush = function flush() {
    this.cache.del('branches');
    this.cache.del('tags');
};

Repo.prototype.tip = function tip(ref, cb) {
    exec(['git', 'log', ref, '-n1', '--date=relative', '--', '.'].join(' '), { cwd: this.path },
        function(error, stdout) {
            if(error) {
                return cb(error);
            } else {
                var c = new Commits(stdout);
                return cb(null, c.tip());
            }
        }.bind(this));
};

Repo.prototype.tree = function tree(ref, path, cb) {
    var directories, files;

    console.log('LISTING', path);

    exec(['git','ls-tree', ref, path].join(' '), {cwd: this.path},
        function(err, stdout) {
            if(err) { throw err; }

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

    var buffers = [];
    var show = spawn('git',['show', ref + ':' + path], {cwd: this.path});
    show.stdout.on('data', function(buf) {
        buffers.push(buf);
    });
    show.stdout.on("end", function() {
      cb(null, utils.bufferConcat(buffers));
    });
};


Repo.prototype.tags = function tags(cb) {
    var out;

    if(this.cache.has('tags')) {
        return cb(null, this.cache.get('tags'));
    }

    exec('git tag -l', { cwd: this.path },
        function(error, stdout) {
            if(error) {
                return cb(error);
            } else {
                out = stdout.split('\n').filter(utils.not(''));
                this.cache.store('tags', out);
                return cb(null, out);
            }
        }.bind(this));
};

Repo.prototype.branches = function branches(cb) {
    if(this.cache.has('branches')) {
        return cb(null, this.cache.get('branches'));
    }

    exec('git branch', { cwd: this.path },
        function(error, stdout) {
            if(error) {
                return cb(error);
            } else {
                var lines = stdout.split('\n');
                lines.pop();
                lines = lines.map(function(line) {
                    return line.replace(/^\*\s/, '').trim();
                });
                this.cache.store('branches', lines);
                return cb(null, lines);
            }
        }.bind(this));
};
