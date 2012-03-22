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
var join = path.join;
var basename = path.basename;


function not(b) {
    return function(a) {
        return a !== b;
    }
}

function isDirectory(p) {
    return fs.statSync(p).isDirectory();
}

function url() {
    return Array.prototype.join.call(arguments, '/').replace(/\/\//g, '/');
}


var Repo = module.exports = function Repo(dir) {
    this.name = basename(dir);
    this.path = dir;
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
    // TODO: Remove moment dependency
    line = line.replace('Date:', '').trim();
    return moment(new Date(line)).from(new Date());
};

Repo.prototype._parseCommit = function _parseCommit(text) {
    var lines = text.split('\n');

    return {
        hash: this._hash(lines[0]),
        author: this._author(lines[1]),
        age: this._age(lines[2]),
        message: lines.splice(3).join('\n')
    };
};

Repo.prototype.head = function(path, file, cb) {
    this.commit(path, file, 1, 0, cb);
};

Repo.prototype.commit = function(path, file, maxcount, skip, cb) {
    if(path.indexOf('/') == 0) path = path.slice(1);
    if(file.indexOf('/') == 0)file = file.slice(1);

    var clonePath = join(this.clone.path, path, file),
        isDir = isDirectory(clonePath);

    maxcount = maxcount >= 1 ? '--max-count=' + maxcount : '';
    skip = skip > 0 ? '--skip' + skip : '';
    file += isDir && file != '' ? '/' : '';

    // TODO: Remove moment dependency
    exec(['git', 'log', maxcount, skip, '--', join(path, file)].join(' '), { cwd: this.clone.path },
        function(error, stdout) {
            if(error) {
                return cb(error);
            } else {
                //TODO: Parse more than one commit
                var commit = this._parseCommit(stdout);
                commit.name = basename(file);
                commit.type = isDir ? 'tree' : 'blob';
                if(path == '' && (file == '' || file.indexOf('./') == 0)) {
                    commit.url = url('', this.name, '');
                } else {
                    commit.url = url('', this.name, commit.type, path, file);
                }

                return cb(null, commit);
            }
        }.bind(this));
};

Repo.prototype.dirStat = function getFilesStat(path, fileList, cb) {
    var commits = [],
        expected = fileList.length;

    fileList.forEach(function(file, index) {
        this.head(path, file, function(err, commit) {
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

Repo.prototype.lastCommit = function(cb) {
    if(this.cache.has('lastCommit')) {
        console.log('lastCommit: in cache');
        return cb(null, this.cache.get('lastCommit'));
    }

    this.head('/', '.', function(err, lastCommit) {
        this.cache.store('lastCommit', lastCommit);
        console.log('lastCommit: not in cache');
        return cb(err, lastCommit);
    }.bind(this));
};

Repo.prototype.tree = function tree(path, cb) {
    var directories, files,
        clonePath = join(this.clone.path, path);

    console.log('LISTING', clonePath);

    fs.readdir(clonePath, function(err, entries) {
        if(err || !entries) {
            return cb(new OperationError('Failed to list ' + clonePath));
        }

        entries = entries.filter(not('.git'));
        directories = entries.filter(function(entry) {
            return isDirectory(join(clonePath, entry));
        });
        files = entries.filter(function(entry) {
            return !isDirectory(join(clonePath, entry));
        });

        directories.sort();
        files.sort();
        entries = directories.concat(files);

        this.dirStat(path, entries, function(err, tree) {
            if(err) throw err;
            this.branches(function(err, branches) {
                if(err) throw err;
                this.tags(function(err, tags) {
                    if(err) throw err;
                    this.lastCommit(function(err, lastCommit) {
                        if(err) throw err;
                        cb(tree, branches, tags, lastCommit);
                    }.bind(this));
                }.bind(this));
            }.bind(this));
        }.bind(this));
    }.bind(this));
};


Repo.prototype.blob = function blob(relativePath, cb) {
    var absolutePath = join(this.clone.path, relativePath),
        type = isDirectory(absolutePath) ? 'tree' : 'blob';

    console.log('DISPLAYING', absolutePath);

    fs.readFile(absolutePath, function(err, buf) {
        if(err) { return cb(err); }

        buf.url = url('', this.path, type, relativePath);
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
