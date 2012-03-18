"use strict";

var cp = require('child_process');
var fs = require('fs');
var path = require('path');

var moment = require('moment');
var mime = require('mime');

var Clone = require('./clone');
var OperationError = require('./errors');

var exec = cp.exec;


function not(b) {
    return function(a) {
        return a !== b;
    }
}

function isDirectory(p) {
    return fs.statSync(p).isDirectory();
}


var Repo = module.exports = function Repo(dir) {
    this.dir = dir;
    this.clone = new Clone(dir);
};

Repo.prototype._commit = function _commit(line) {
    return line.replace('commit ', '');
};

Repo.prototype._author = function _author(line) {
    var match;
    var author = { name: '', email: '' };
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

Repo.prototype.getFileStat = function getFileStat(entry, absolutePath, relativePath, cb) {
    var target = path.join(relativePath, entry),
        isDir = isDirectory(path.join(absolutePath, entry));

    // Avoid confusing git between folder and revisions (branches, tags, etc...)
    target += isDir ? '/' : '';

    exec('git log ' + target, { cwd: this.clone.path },
        function(error, stdout, stderr) {
            if(error) {
                return cb(error);
            } else {
                var commit = {};
                var lines = stdout.split('\n');

                // TODO: Refactor the commit information extraction
                commit.type = isDir ? 'tree' : 'blob';
                commit.url = ['', this.dir, commit.type, relativePath, entry].join('/').replace('//', '/');
                commit.name = entry;
                commit.hash = this._commit(lines[0]);
                commit.author = this._author(lines[1]);
                commit.age = this._age(lines[2]);
                commit.message = lines.splice(3).join('\n');

                return cb(null, commit);
            }
        }.bind(this));
};

//dir stat
Repo.prototype.getFilesStat = function getFilesStat(fileList, absolutePath, relativePath, cb) {
    var commits = [];
    var expected = fileList.length;

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

    exec('git tag -l', { cwd: this.clone.path },
        function(error, stdout, stderr) {
            if(error) {
                return cb(error);
            } else {
                out = stdout.split('\n').filter(not(''));
                return cb(null, out);
            }
        });
};

Repo.prototype.branches = function branches(cb) {
    var i, l, match, lines, line;
    var out = { list: [], current: null };

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
                return cb(null, out);
            }
        });
};

Repo.prototype.tree = function tree(relativePath, cb) {
    var directories,
        files,
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
    var absolutePath = path.join(this.clone.path, relativePath);
    console.log('DISPLAYING', absolutePath);

    // TODO: Also return the raw url
    fs.readFile(absolutePath, function(err, buf) {
        if(err) { return cb(err); }

        buf.type = mime.lookup(absolutePath);
        cb(null, buf);
    });

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
