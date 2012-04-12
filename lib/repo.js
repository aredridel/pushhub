"use strict";

var cp = require('child_process');
var fs = require('fs');

var Commits = require('./commits');
var Cache = require('./cache');
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
    this.cache = new Cache();
    this.bare = !utils.isDirectory(join(path, '.git'));

    //TODO: Remove this
    this.memoize();
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
 * stdout it returns is a `String` and it cause problems with binary
 * files
 *
 * @param {Array} commands
 * @param {Function} cb
 * @api private
 */

Repo.prototype.gitExec = function gitExec(commands, cb) {
    var child = spawn("git", commands, {cwd: this.path});
    var stdout = [], stderr = [];
    debug('running: %s', "git " + commands.join(" "));
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

/**
 * Initialize a new `HTTPServer` with optional `middleware`.
 *
 * @param {Array} middleware
 * @api private
 */

Repo.prototype.dirStat = function dirStat(ref, path, entries, cb) {
    var directories, files,
        commits = [],
        expected = entries.length;

    entries.forEach(function(entry) {
        this.stats(ref, entry, 1, function(err, commit) {
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
 * Initialize a new `HTTPServer` with optional `middleware`.
 *
 * @param {Array} middleware
 * @api private
 */

//TODO: Remove this
Repo.prototype.memoize = function memoize() {
    debug('cache: building');
    this.branches(utils.noop);
    this.tags(utils.noop);
    this.mtime(utils.noop);
};

/**
 * Initialize a new `HTTPServer` with optional `middleware`.
 *
 * @param {Array} middleware
 * @api private
 */

//TODO: Remove this
Repo.prototype.flush = function flush() {
    debug('cache: flush');
    this.cache.del('branches');
    this.cache.del('tags');
    this.cache.del('mtime');
};

/**
 * Calls `cb` passing (err, num) where `num` is the number of commits in the given `ref`
 *
 * @param {String} ref
 * @param {Function} cb
 * @api public
 */

Repo.prototype.total = function total(ref, cb) {
    var num;
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
            } else {
                // TODO: Error
            }
            return cb(null, num);
        }
    });
};

/**
 * ?
 *
 * @param {String} ref
 * @param {String, Object} entry
 * @api public
 */

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
            entry.url = utils.url('', this.name, entry.type, ref, entry.path);
            return cb(null, entry);
        }
    }.bind(this));
};

/**
 * Initialize a new `HTTPServer` with optional `middleware`.
 *
 * @param {Array} middleware
 * @api public
 */

Repo.prototype.tip = function tip(ref, cb) {
    var c;

    debug('tip for ref "%s"', ref);
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
 * Initialize a new `HTTPServer` with optional `middleware`.
 *
 * @param {Array} middleware
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
 * Initialize a new `HTTPServer` with optional `middleware`.
 *
 * @param {Array} middleware
 * @api public
 */


Repo.prototype.blob = function blob(ref, path, cb) {
    debug('blob for path "%s"', path);
    this.gitExec(['show', ref + ':' + path], cb);
};

/**
 * Initialize a new `HTTPServer` with optional `middleware`.
 *
 * @param {Array} middleware
 * @api public
 */


Repo.prototype.tags = function tags(cb) {
    var out;

    if(this.cache.has('tags')) {
        debug('tags: fetching from cache');
        return cb(null, this.cache.get('tags'));
    }

    this.gitExec(['tag', '-l'], function(err, stdout) {
        if(err) {
            return cb(err);
        } else {
            out = stdout.toString().split('\n').filter(utils.not(''));
            debug('tags: storing in cache, [%s]', out.join());
            this.cache.store('tags', out);
            return cb(null, out);
        }
    }.bind(this));
};

/**
 * Initialize a new `HTTPServer` with optional `middleware`.
 *
 * @param {Array} middleware
 * @api public
 */

Repo.prototype.branches = function branches(cb) {
    var lines;

    if(this.cache.has('branches')) {
        debug('branches: fetching from cache');
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
            debug('branches: storing in cache, [%s]', lines.join());
            this.cache.store('branches', lines);
            return cb(null, lines);
        }
    }.bind(this));
};

/**
 * Initialize a new `HTTPServer` with optional `middleware`.
 *
 * @param {Array} middleware
 * @api public
 */

Repo.prototype.mtime = function mtime(cb) {
    if(this.cache.has('mtime')) {
        debug('mtime: fetching from cache');
        return cb(null, this.cache.get('mtime'));
    }

    fs.stat(this.path, function(err, stat) {
        if(err) {
            return cb(err);
        } else {
            debug('mtime: storing in cache');
            this.cache.store('mtime', stat.mtime);
            return cb(null, stat.mtime);
        }
    }.bind(this));
};

/**
 * Initialize a new `HTTPServer` with optional `middleware`.
 *
 * @param {Array} middleware
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
 * Initialize a new `HTTPServer` with optional `middleware`.
 *
 * @param {Array} middleware
 * @api public
 */

Repo.prototype.description = function description(str) {
    var path = this.bare ? join(this.path, '.git', 'description') : join(this.path, 'description');
    if(str) {
        fs.writeFileSync(path, str);
    } else {
        return fs.readFileSync(path).toString();
    }
};
