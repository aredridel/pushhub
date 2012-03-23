"use strict";

var cp = require('child_process');
var fs = require('fs');
var path = require('path');

var mime = require('mime');

var Clone = require('./clone');
var Commits = require('./commits');
var Cache = require('./cache');
var OperationError = require('./errors').OperationError;
var utils = require('./utils');

var exec = cp.exec;
var join = path.join;
var basename = path.basename;


var Repo = module.exports = function Repo(dir) {
    this.name = basename(dir);
    this.path = dir;
    this.clone = new Clone(dir);
    this._cache = new Cache();

    this.cache();
};


Repo.prototype.head = function head(path, cb) {
    this.stats(path, 1, 0, cb);
};

Repo.prototype.stats = function stats(path) {
    var cb = utils.noop,
        maxcount = 0,
        skip = 0,
        len = arguments.length,
        clonePath = join(this.clone.path, path),
        isDir = utils.isDirectory(clonePath);

    if(path.indexOf('/') == 0) {
        path = path.replace('/', '');
    }

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

    path += isDir ? '/' : '';

    exec(['git', 'log', m, s, '--date=relative', '--', path].join(' '), { cwd: this.clone.path },
        function(error, stdout) {
            if(error) {
                return cb(error);
            } else {
                var entry = {};
                var commits = new Commits(stdout);
                entry.name = basename(path);
                entry.type = isDir ? 'tree' : 'blob'; //TODO: Should be extracted from git ls-tree
                entry.commits = commits;
                entry.head = commits.head();
                entry.url = path == './' ? utils.url('', this.name, '') : utils.url('', this.name, entry.type, path);
                return cb(null, entry);
            }
        }.bind(this));
};

Repo.prototype.dirStat = function dirStat(path, fileList, cb) {
    var commits = [],
        expected = fileList.length;

    fileList.forEach(function(file, index) {
        this.head(join(path, file), function(err, commit) {
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

    exec('git tag -l', { cwd: this.clone.path },
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

    exec('git branch', { cwd: this.clone.path },
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

    this.head('.', function(err, entry) {
        if(err) throw err;
        var last = entry.head;
        this._cache.store('last', last);
        return cb(err, last);
    }.bind(this));
};

Repo.prototype.tree = function tree(path, cb) {
    var directories, files,
        clonePath = join(this.clone.path, path);

    console.log('LISTING', clonePath);

    // TODO: use git ls-tree <branch>
    fs.readdir(clonePath, function(err, entries) {
        if(err || !entries) {
            return cb(new OperationError('Failed to list ' + clonePath));
        }

        entries = entries.filter(utils.not('.git'));
        directories = entries.filter(function(entry) {
            return utils.isDirectory(join(clonePath, entry));
        });
        files = entries.filter(function(entry) {
            return !utils.isDirectory(join(clonePath, entry));
        });

        directories.sort();
        files.sort();
        entries = directories.concat(files);

        this.dirStat(path, entries, function(err, tree) {
            cb(tree);
        });
    }.bind(this));
};


Repo.prototype.blob = function blob(relativePath, cb) {
    var absolutePath = join(this.clone.path, relativePath),
        type = utils.isDirectory(absolutePath) ? 'tree' : 'blob';

    console.log('DISPLAYING', absolutePath);

    fs.readFile(absolutePath, function(err, buf) {
        if(err) { return cb(err); }
        buf.url = utils.url('', this.path, type, relativePath);
        buf.mime = mime.lookup(absolutePath);
        cb(null, buf);
    }.bind(this));
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

// TODO: Remove this
Repo.prototype.create = function create(cb) {
    this.clone.create(cb);
};

// TODO: Remove this
Repo.prototype.update = function update(cb) {
    this.clone.update(cb);
};

// TODO: Remove this
Repo.prototype.checkout = function checkout(ref, cb) {
    this.clone.checkout(ref, cb);
};
