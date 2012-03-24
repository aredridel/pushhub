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
    this._cache = new Cache();

    this.cache();
};

Repo.prototype.get = function get(key) {
    return this._cache.get(key);
};

Repo.prototype.head = function head(entry, cb) {
    this.stats(entry, 1, 0, cb);
};

Repo.prototype.stats = function stats(entry) {
    var cb = utils.noop,
        maxcount = 0,
        skip = 0,
        len = arguments.length;

    if(len === 2) {
        cb = arguments[1];
    }
    if(len === 3) {
        maxcount = arguments[1];
        cb = arguments[2];
    }
    if(len === 4) {
        maxcount = arguments[1];
        skip = arguments[2];
        cb = arguments[3];
    }

    var m = maxcount >= 1 ? '--max-count=' + maxcount : '',
        s = skip > 0 ? '--skip' + skip : '';

    exec(['git', 'log', m, s, '--date=relative', '--', entry.path].join(' '), { cwd: this.path },
        function(error, stdout) {
            if(error) {
                return cb(error);
            } else {
                var commits = new Commits(stdout);
                entry.commits = commits;
                entry.head = commits.head();
                return cb(null, entry);
            }
        }.bind(this));
};

Repo.prototype.dirStat = function dirStat(path, fileList, cb) {
    var commits = [],
        expected = fileList.length;

    fileList.forEach(function(entry, index) {
        this.stats(entry, 1, function(err, commit) {
            if(err) throw err;
            commits[index] = commit;
            if(commits.length == expected) {
                cb(null, commits);
            }
        });
    }, this);
    return commits;
};

Repo.prototype.tags = function tags(cb) {
    var out;

    if(this._cache.has('tags')) {
        return cb(null, this._cache.get('tags'));
    }

    exec('git tag -l', { cwd: this.path },
        function(error, stdout) {
            if(error) {
                return cb(error);
            } else {
                out = stdout.split('\n').filter(utils.not(''));
                this._cache.store('tags', out);
                return cb(null, out);
            }
        }.bind(this));
};

Repo.prototype.branches = function branches(cb) {
    var i, l, match, lines, line,
        out = { list: [], current: null };

    if(this._cache.has('branches')) {
        return cb(null, this._cache.get('branches'));
    }

    exec('git branch', { cwd: this.path },
        function(error, stdout) {
            if(error) {
                return cb(error);
            } else {
                lines = stdout.split('\n');
                for(i = 0, l = lines.length; i < l; i += 1) {
                    match = lines[i].match(/^\*\s(.*)/);
                    if(match) {
                        lines[i] = out.current = match[1];
                    }
                    line = lines[i].trim();
                    if(line.length) {
                        out.list.push(line);
                    }
                }
                this._cache.store('branches', out);
                return cb(null, out);
            }
        }.bind(this));
};

Repo.prototype.last = function last(cb) {
    if(this._cache.has('last')) {
        return cb(null, this._cache.get('last'));
    }
};

Repo.prototype.tree = function tree(path, cb) {
    var directories, files;
    var branch = 'master';

    console.log('LISTING', path);

    exec(['git','ls-tree', branch, path].join(' '), {cwd: this.path},
        function(err, stdout) {
            if(err) { throw err; }

            var entries = this.parse(stdout);
            directories = entries.filter(function(entry) {
                return entry.type == 'tree';
            });
            files = entries.filter(function(entry) {
                return entry.type == 'blob';
            });
            directories.sort();
            files.sort();
            entries = directories.concat(files);
        this.dirStat(path, entries, function(err, tree) {
            if(err) throw err;
            cb(tree);
        });
    }.bind(this));
};


Repo.prototype.blob = function blob(path, cb) {
    console.log('DISPLAYING', path);
    var branch = 'master';

    var buffers = [];
    var show = spawn('git',['show', branch + ':' + path], {cwd: this.path});
    show.stdout.on('data', function(buf) {
        buffers.push(buf);
    });
    show.stdout.on("end", function() {
      cb(null, utils.bufferConcat(buffers));
    });
};

Repo.prototype.parse = function parse(text) {
    return text.split('\n').map(function(line) {
        var o = {
            'mode': line.slice(0, 6),
            'type': line.slice(7, 11),
            'hash': line.slice(12, 52),
            'path': line.slice(53)
        };
        o.path += (o.type == 'tree') ? '/' : '';
        o.name = basename(o.path);
        o.url = utils.url('', this.name, o.type, o.path);
        return o;
    }, this);
};

Repo.prototype.cache = function cache() {
    //FIXME: Should probably fire an event when done
    this.tags(utils.noop);
    this.branches(utils.noop);
    this.last(utils.noop);
};

Repo.prototype.flush = function flush() {
    this._cache.flush('tags');
    this._cache.flush('branches');
    this._cache.flush('lastCommit');
};
