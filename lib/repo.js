"use fix";

var cp = require('child_process');
var fs = require('fs');
var path = require('path');

var moment = require('moment');

var util = require('./util');

var exec = cp.exec;

module.exports = Repo = function Repo(dir) {
    this.dir = dir;
    this.clonedir = util.getLocalClonePath(dir);
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


Repo.prototype.getFileStat = function getFileStat(entry, fullPath, relativePath, cb) {
    exec('git log ' + path.join(relativePath, entry), { cwd: this.clonedir },
        function(error, stdout, stderr) {
            if(error) {
                cb(error);
            } else {
                var line;
                var commit = {};
                var lines = stdout.split('\n');
                var stats = fs.statSync(path.join(fullPath, entry));

                // TODO: Refactor the commit information extraction

                // I/O bound
                commit.type = stats.isDirectory() ? 'tree' : 'blob';
                commit.url = path.join('/', this.dir, commit.type, relativePath, entry);
                commit.name = entry;

                // Parsed
                commit.hash = this._commit(lines[0]);
                commit.author = this._author(lines[1]);
                commit.age = this._age(lines[2]);
                commit.message = lines.splice(3).join('\n');

                cb(null, commit);
            }
        }.bind(this));
};

//dir stat
Repo.prototype.getFilesStat = function getFilesStat(fileList, fullPath, relativePath, cb) {
    var commits = [];
    var expected = fileList.length;
    fileList.forEach(function(file, index) {
        this.getFileStat(file, fullPath, relativePath, function(err, commit) {
            if(err) throw err;

            commits[index] = commit;
            if(commits.length == expected) {
                cb(null, commits);
            }
        });
    }, this);
    return commits;
};

Repo.prototype.list = function list(relativePath, cb) {
    fullPath = path.join(this.clonedir, relativePath);
    console.log('LISTING', fullPath);

    fs.readdir(fullPath, function(err, entries) {
        if(!entries) {
            return cb('OUPS', null);
        }

        entries = entries.filter(function(entry) {
            return entry != '.git';
        });

        this.getFilesStat(entries, fullPath, relativePath, function(err, tree) {
            this.branches(function(err, branches) {
                console.log('BRANCHES', branches);
                this.tags(function(err, tags) {
                    console.log('TAGS', tags);
                    cb(tree, branches, tags);
                }.bind(this));
            }.bind(this));
        }.bind(this));
    }.bind(this));
};

Repo.prototype.tags = function tags(cb) {
    var out;

    exec('git tag -l', { cwd: this.clonedir },
        function(error, stdout, stderr) {
            if(error) {
                cb(error);
            } else {
                out = stdout.split('\n').filter(function(line) {
                    return line != '';
                });
                cb(null, out);
            }
        });
};

Repo.prototype.branches = function tags(cb) {
    var i, l, match, lines, line;
    var out = { list: [], current: null };

    exec('git branch', { cwd: this.clonedir },
        function(error, stdout, stderr) {
            if(error) {
                cb(error);
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
            }
            cb(null, out);
        });
};

Repo.prototype.checkout = function checkout(ref, cb) {
    util.checkoutLocalClone(this.dir, ref, cb);
};
