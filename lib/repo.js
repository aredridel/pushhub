"use strict";

var cp = require('child_process');
var fs = require('fs');
var path = require('path');

var mime = require('mime');

var Clone = require('./clone');
var Commits = require('./commits');
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


Repo.prototype.head = function(path, file, cb) {
    this.history(path, file, 1, 0, cb);
};

// TODO: Change API, make max and skip optional
Repo.prototype.history = function(path, file, maxcount, skip, cb) {
    if(path.indexOf('/') == 0) path = path.slice(1);
    if(file.indexOf('/') == 0)file = file.slice(1);

    var clonePath = join(this.clone.path, path, file),
        isDir = isDirectory(clonePath),
        m = maxcount >= 1 ? '--max-count=' + maxcount : '',
        s = skip > 0 ? '--skip' + skip : '';

    file += isDir && file != '' ? '/' : '';

    exec(['git', 'log', m, s, '--date=relative', '--', join(path, file)].join(' '), { cwd: this.clone.path },
        function(error, stdout) {
            if(error) {
                return cb(error);
            } else {
                var entry = {};
                var history = new Commits(stdout);
                entry.name = basename(file);
                entry.type = isDir ? 'tree' : 'blob'; //TODO: Should be extracted from git ls-tree
                entry.history = history;
                entry.head = history.head();

                if(path == '' && (file == '' || file.indexOf('./') == 0)) {
                    entry.url = url('', this.name, '');
                } else {
                    entry.url = url('', this.name, entry.type, path, file);
                }

                return cb(null, entry);
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

Repo.prototype.last = function(cb) {
    if(this.cache.has('last')) {
        console.log('last: in cache');
        return cb(null, this.cache.get('last'));
    }

    this.head('/', '.', function(err, entry) {
        var last = entry.head;
        this.cache.store('last', last);
        console.log('last: not in cache');
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
                    this.last(function(err, commits) {
                        if(err) throw err;
                        cb(tree, branches, tags, commits);
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
