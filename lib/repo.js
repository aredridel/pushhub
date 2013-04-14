"use strict";

var cp = require('child_process');
var fs = require('fs');

var Commits = require('./commits');
var utils = require('./utils');

var spawn = cp.spawn;
var basename = require('path').basename;
var join = require('path').join;
var debug = require('debug')('pushhub');


function sortByName(a, b) {
    if(a.name < b.name) return -1;
    if(a.name === b.name) return 0;
    if(a.name > b.name) return 1;
}

/**
 * Initialize a new `Repo` with the given `path`
 *
 * @param {String} path
 * @api public
 */

var Repo = module.exports = function Repo(path) {
    this.name = basename(path);
    this.path = path;
    this.bare = !utils.isDirectory(join(path, '.git'));
};

/**
 * Parse text coming from `git ls-tree` into an `Array` of `Object`s
 *
 * @param {String} text
 * @api private
 * @return {Array}
 */

Repo.prototype.parse = function parse(text) {
    text = text.toString();
    return text.split('\n').map(function(line) {
        var o = {
            'mode': line.slice(0, 6),
            'type': line.slice(7, 11),
            'hash': line.slice(12, 52),
            'path': line.slice(53)
        };
        // Useful to distinguish folders from revision/refs
        o.path += (o.type == 'tree') ? '/' : '';
        o.name = basename(o.path);
        return o;
    }, this);
};

/**
 * Proxy method to git commands, we don't use cp.exec here because the
 * stdout it returns is a `String` as it cause problems with binary
 * files
 *
 * @param {Array} commands
 * @param {Function} cb
 * @api private
 */

Repo.prototype.gitExec = function gitExec(commands, cb) {
    var child = spawn("git", commands, {cwd: this.path});
    var stdout = [], stderr = [];

    debug('[SPAWN] %s', "git " + commands.join(" "));
    child.stdout.on('data', function (text) {
        stdout[stdout.length] = text;
    });
    child.stderr.on('data', function (text) {
        stderr[stderr.length] = text;
    });
    child.on('close', function (code) {
        if (code > 0) {
            var err = new Error("git " + commands.join(" ") + "\n" + utils.bufferConcat(stderr, 'utf8'));
            cb(err);
            return;
        }
        cb(null, utils.bufferConcat(stdout));
    });
    child.stdin.end();
};

Repo.prototype.dirStat = function dirStat(ref, path, entries, cb) {
    var directories, files,
        commits = [],
        expected = entries.length;

    entries.forEach(function(entry) {
        this.stats(ref, entry, { maxcount: 1 }, function(err, commit) {
            if(err) throw err;
            commits.push(commit);

            if(commits.length == expected) {
                directories = commits.filter(function(a) {
                    return a.type == 'tree';
                });
                files = commits.filter(function(a) {
                    return a.type == 'blob';
                });
                directories.sort(sortByName);
                files.sort(sortByName);
                cb(null, directories.concat(files));
            }
        });
    }, this);
    return commits;
};

/**
 * If passed `str`, writes `str` to the repo description file, else reads the latter and returns it
 *
 * @param {String} str
 * @param {String} str
 * @api public
 * @return {String}
 */

Repo.prototype.description = function description(str) {
    var path = this.bare ? join(this.path, 'description') : join(this.path, '.git', 'description');
    if(str) {
        fs.writeFileSync(path, str);
    } else {
        return fs.readFileSync(path).toString();
    }
};

/**
 * Returns a Stat object for the given `entry` at the the given `ref`
 * Options are:
 *     - maxcount: Commit history to retrieve
 *     -
 *
 * @param {String} ref
 * @param {String, Object} entry
 * @param {Object} options
 * @api public
 */

Repo.prototype.stats = function stats(ref, entry, options /*, cb */) {
    options = options || { maxcount: -1, skip: 0 };

    if(typeof entry === 'string') entry = { path: entry };
    var cb  = (typeof options === 'function') ? options : arguments[3];

    this.gitExec(['log', ref,
        '--date=relative',
        '--max-count=' + (options.maxcount || -1),
        '--skip=' + (options.skip || 0), '--',entry.path
    ], function(err, stdout) {
        if(err) {
            return cb(err);
        } else {
            entry.commits = new Commits(stdout);
            entry.tip = entry.commits.tip();
            entry.url = utils.url('', this.name, entry.type, ref, entry.path);
            return cb(null, entry);
        }
    }.bind(this));
};

/**
 * Calls `cb` passing (err, list) where `list` is an array containing commit objects for
 * each `entry` in the folder described by `path` for `ref`.
 *
 * @param {String} ref
 * @param {String} path
 * @param {Function} cb
 * @api public
 */

Repo.prototype.tree = function tree(ref, path, cb) {
    var entries;

    debug('tree for path "%s"', path);
    this.gitExec(['ls-tree', ref, path], function(err, stdout) {
        if(err) { return cb(err); }

        entries = this.parse(stdout);
        this.dirStat(ref, path, entries, function(err, tree) {
            if(err) { return cb(err); }
            cb(null, tree);
        });
    }.bind(this));
};

/**
 * Calls `cb` passing (err, buf) where `buf` is a buffer which is the content
 * of the file match by `path` for `ref`.
 *
 * @param {String} ref
 * @param {String} path
 * @param {Function} cb
 * @api public
 */

Repo.prototype.blob = function blob(ref, path, cb) {
    debug('blob for path "%s"', path);
    this.gitExec(['show', ref + ':' + path], cb);
};

/**
 * Calls `cb` passing (err, buf) where `buf` is a `format` archive of `ref` at its current state
 *
 * @param {String} ref
 * @param {String} format
 * @param {Function} cb
 * @api public
 */

Repo.prototype.archive = function archive(ref, format, cb) {
    debug('archiving ref "%s" in %s format', ref, format);
    this.gitExec(['archive', ref, '--format=' + format], function(err, stdout) {
        if(err) {
            return cb(err);
        } else {
            return cb(null, stdout);
        }
    }.bind(this));
};

/**
 * Calls `cb` passing (err, list) where `list` is an array of the tags for this repo
 *
 * @param {Function} cb
 * @api public
 */

Repo.prototype.tags = function tags(cb) {
    var out;

    this.gitExec(['tag', '-l'], function(err, stdout) {
        if(err) {
            return cb(err);
        } else {
            out = stdout.toString().split('\n').filter(utils.not(''));
            return cb(null, out);
        }
    }.bind(this));
};

/**
 * Calls `cb` passing (err, list) where `list` is an array of the branches for this repo
 *
 * @param {Function} cb
 * @api public
 */

Repo.prototype.branches = function branches(cb) {
    var lines;

    this.gitExec(['branch'], function(err, stdout) {
        if(err) {
            return cb(err);
        } else {
            lines = stdout.toString().split('\n');
            lines.pop();
            lines = lines.map(function(line) {
                return line.replace(/^\*\s/, '').trim();
            });
            return cb(null, lines);
        }
    }.bind(this));
};

/**
 * Calls `cb` passing (err, obj) where `obj` is an hash, the last commit entry for `ref`
 *
 * @param {String} ref
 * @param {Function} cb
 * @api public
 */

Repo.prototype.tip = function tip(ref, cb) {
    var c;

    this.gitExec(['log', ref, '-n1', '--date=relative', '--', '.'], function(err, stdout) {
        if(err) {
            return cb(err);
        } else {
            c = new Commits(stdout);
            return cb(null, c.tip());
        }
    }.bind(this));
};


/**
 * Calls `cb` passing (err, num) where `num` is the number of commits in the given `ref`
 * `num` is 0 if something horrible happened
 *
 * @param {String} ref
 * @param {Function} cb
 * @api public
 */

Repo.prototype.total = function total(ref, cb) {
    var num = 0;
    var global = /^.*\((\d+)\)\:/gm;
    var number = /\((\d+)\)/;

    this.gitExec(['shortlog', ref, '--'], function(err, stdout) {
        if(err) {
            return cb(err);
        } else {
            var str = stdout.toString();
            var matches = str.match(global);
            if(matches) {
                num = matches.reduce(function(memo, value) {
                    var num = value.match(number);
                    return memo + parseInt(num[1], 10);
                }, 0);
            }
            return cb(null, num);
        }
    }.bind(this));
};

/**
 * Calls `cb` passing (err, date) where `date` is a Date instance
 *
 * @param {Function} cb
 * @api public
 */

Repo.prototype.mtime = function mtime(cb) {
    fs.stat(this.path, function(err, stat) {
        if(err) {
            return cb(err);
        } else {
            return cb(null, stat.mtime);
        }
    }.bind(this));
};
