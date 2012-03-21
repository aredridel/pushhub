"use strict";

var cp = require('child_process');
var fs = require('fs');
var path = require('path');

var moment = require('moment');
var mime = require('mime');

var Clone = require('./clone');
var Cache = require('./cache');
var OperationError = require('./errors').OperationError;


var exec = cp.exec;


function not(b) {
    return function(a) {
        return a !== b;
    }
}

function isDirectory(p) {
    return fs.statSync(p).isDirectory();
}

function url() {
    return Array.prototype.join.call(arguments, '/').replace('//', '/');
}


var Repo = module.exports = function Repo(dir) {
    this.dir = dir;
    this.clone = new Clone(dir);
    this.cache = new Cache();
};


Repo.prototype._hash = function _hash(line) {
    return line.replace('commit ', '');
};

Repo.prototype._author = function _author(line) {
    var match,
        author = { name: '', email: '' };

    line = line.replace('Author:', '').trim();
    match = line.match(/(.*)\s\<(.*)\>/);

    if(match) {
        author.name = match[1];
        author.email = match[2];
    }
    return author;
};

Repo.prototype._age = function _age(line) {
    line = line.replace('Date:', '').trim();
    return moment(new Date(line)).from(new Date());
};

Repo.prototype._commitStats = function _commitStats(text) {
    var lines = text.split('\n');

    return {
        hash: this._hash(lines[0]),
        author: this._author(lines[1]),
        age: this._age(lines[2]),
        message: lines.splice(3).join('\n')
    };
};

Repo.prototype.getLastCommit = function(cb) {
    exec('git log -n 1 ', { cwd: this.clone.path },
        function(error, stdout, stderr) {
            if(error) {
                return cb(error);
            } else {
                var commit = this._commitStats(stdout);
                return cb(null, commit);
            }
        }.bind(this));
};

Repo.prototype.getFileStat = function getFileStat(entry, absolutePath, relativePath, cb) {
    var target = path.join(relativePath, entry),
        isDir = isDirectory(path.join(absolutePath, entry));

    // Avoid confusing git between folder and revisions (branches, tags, etc...)
    target += isDir ? '/' : '';

    exec('git log -n 1 ' + target, { cwd: this.clone.path },
        function(error, stdout, stderr) {
            if(error) {
                return cb(error);
            } else {
                var commit = this._commitStats(stdout);
                commit.name = entry;
                commit.type = isDir ? 'tree' : 'blob';
                commit.url = url('', this.dir, commit.type, relativePath, entry);

                return cb(null, commit);
            }
        }.bind(this));
};

//dir stat
Repo.prototype.getFilesStat = function getFilesStat(fileList, absolutePath, relativePath, cb) {
    var commits = [],
        expected = fileList.length;

    fileList.forEach(function(file, index) {
        this.getFileStat(file, absolutePath, relativePath, function(err, commit) {
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

    if(this.cache.has('tags')) {
        console.log('tags: in cache');
        return cb(null, this.cache.get('tags'));
    }

    exec('git tag -l', { cwd: this.clone.path },
        function(error, stdout, stderr) {
            if(error) {
                return cb(error);
            } else {
                out = stdout.split('\n').filter(not(''));
                this.cache.store('tags', out);
                console.log('tags: not in cache');
                return cb(null, out);
            }
        }.bind(this));
};

Repo.prototype.branches = function branches(cb) {
    var i, l, match, lines, line,
        out = { list: [], current: null };

    if(this.cache.has('branches')) {
        console.log('branches: in cache');
        return cb(null, this.cache.get('branches'));
    }

    exec('git branch', { cwd: this.clone.path },
        function(error, stdout, stderr) {
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
                this.cache.store('branches', out);
                console.log('branches: not in cache');
                return cb(null, out);
            }
        }.bind(this));
};

Repo.prototype.tree = function tree(relativePath, cb) {
    var directories, files,
        absolutePath = path.join(this.clone.path, relativePath);

    console.log('LISTING', absolutePath);

    fs.readdir(absolutePath, function(err, entries) {
        if(err || !entries) {
            return cb(new OperationError('Failed to list ' + absolutePath));
        }

        entries = entries.filter(not('.git'));
        directories = entries.filter(function(entry) {
            return isDirectory(path.join(absolutePath, entry));
        });
        files = entries.filter(function(entry) {
            return !isDirectory(path.join(absolutePath, entry));
        });

        directories.sort();
        files.sort();
        entries = directories.concat(files);

        this.getFilesStat(entries, absolutePath, relativePath, function(err, tree) {
            if(err) throw err;
            this.branches(function(err, branches) {
                if(err) throw err;
                this.tags(function(err, tags) {
                    if(err) throw err;
                    cb(tree, branches, tags);
                }.bind(this));
            }.bind(this));
        }.bind(this));
    }.bind(this));
};


Repo.prototype.blob = function blob(relativePath, cb) {
    var absolutePath = path.join(this.clone.path, relativePath),
        type = isDirectory(absolutePath) ? 'tree' : 'blob';

    console.log('DISPLAYING', absolutePath);

    fs.readFile(absolutePath, function(err, buf) {
        if(err) { return cb(err); }

        buf.url = url('', this.dir, type, relativePath);
        buf.mime = mime.lookup(absolutePath);
        cb(null, buf);
    }.bind(this));

};

Repo.prototype.create = function create(cb) {
    this.clone.create(cb);
};

Repo.prototype.update = function update(cb) {
    this.clone.update(cb);
};

Repo.prototype.checkout = function checkout(ref, cb) {
    this.clone.checkout(ref, cb);
};
