var util = require('util');
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var pushover = require('pushover');
var express = require('express');
var moment = require('moment');

var spawn = cp.spawn;
var exec = cp.exec;

const GITROOT = '.pushstack';
const GITURL = '/git/*';
const GITCLONESROOT = '.clones';

//Utils
function truncateHead(url) {
    var parts = url.split('/');
    return '/' + parts.slice(2).join('/');
}
//Utils
function proxyGitRequest(req, res) {
    req.url = truncateHead(req.url);
    repos.handle(req, res);
}
//Utils
function getLocalClonePath(dir) {
    return path.join(GITROOT, GITCLONESROOT, path.basename(dir));
}

//Local clone management
function createLocalClone(dir) {
    var clone = spawn('git', [ 'clone', path.join(GITROOT, dir), getLocalClonePath(dir) ]);
    clone.on('exit', function(code) {
        console.log('clone exited with code: ' + code);
    });
}

//Local clone management
function updateLocalClone(dir) {
    var target = getLocalClonePath(dir);
    var pull = spawn('git', ['pull'], {'cwd': target});
    pull.on('exit', function(code) {
        console.log('pull exited with code: ' + code);
    });
}

//Local clone management
function checkoutRefLocalClone(dir, ref, cb) {
    var target = getLocalClonePath(dir);
    console.log('git checkout', ref, '| in ', target)
    var checkout = spawn('git', [ 'checkout', ref ], {'cwd': target});
    checkout.on('exit', function(code) {
        console.log('checkout exited with code: ' + code);
        if(!code) {
            cb(null);
        } else {
            cb('OUPS');
        }
    });
}

// Repo browsing
function Repo(dir) {
    this.dir = dir; 
    this.clonedir = getLocalClonePath(dir);
}

//Dummy
Repo.prototype.name = function name() {
    return this.dir;
}

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

//file stat
Repo.prototype.getFileStat = function getFileStat(entry, cb) {
    var err = '';
    var out = '';
    var log = spawn('git', ['log', entry], {'cwd': this.clonedir});

    log.stderr.on('data', function(buf) {
        err += buf;
    });

    log.stdout.on('data', function(buf) {
        out += buf;
    });

    log.on('exit', function logExit(code) {
        if(code) {
            //TODO: Provide a properly typed error
            cb(err);
        } else {
            var line;
            var commit = {};
            var lines = out.split('\n');
            commit.name = entry;
            commit.hash = this._commit(lines[0]);
            commit.author = this._author(lines[1]);
            commit.age = this._age(lines[2]);
            commit.message = lines.splice(3).join('\n');

            cb(null, commit);
        }
    }.bind(this));

    return entry;
};

//dir stat
Repo.prototype.getFilesStat = function getFilesStat(fileList, cb) {
    var commits = [];
    var expected = fileList.length;
    fileList.forEach(function(file, index) {
        this.getFileStat(file, function(err, commit) {
            if(err) {
                cb(err);
            } else {
                commits[index] = commit;
                if(commits.length == expected) {
                    cb(null, commits);
                }
            }
        });
    }, this);
    return commits;
};

Repo.prototype.list = function list(p, cb) {
    p = path.join(this.clonedir, p);

    fs.readdir(p, function(err, entries) {
        if(!entries) {
            return cb('OUPS');
        }
        entries = entries.filter(function(entry) {
            return entry != '.git';
        });

        this.getFilesStat(entries, cb);
    }.bind(this));
};

// TODO: Change this to heads, probably tags is a different matter
Repo.prototype.tags = function() {
    return fs.readdirSync(path.join(GITROOT, this.dir, 'refs', 'heads'));
};

Repo.prototype.checkout = function(ref, cb) {
    checkoutRefLocalClone(this.dir, ref, cb);
};
    
var repos = pushover(path.join(__dirname, GITROOT));

/**
 * We create a local clone of the repo in order to 
 * ease some other commands
 */
repos.on('create', function(dir) {
    createLocalClone(dir);
});

/**
 * Update the local clone when we get a push
 */
repos.on('push', function (dir) {
    updateLocalClone(dir);
});

var app = express.createServer();
app.use(express.bodyParser());
app.set('view options', {layout: false});

app.get(GITURL, proxyGitRequest);
app.post(GITURL, proxyGitRequest);

// how do I get the rest?
app.get('/:repo/*', function(req, res) {
    var repo = new Repo(req.params.repo);

    res.local('repo', repo.name());
    repo.list('/', function(err, items) {
        console.log('repo', err, items)
        if(err) {
            res.render('404.jade');
        } else {
            res.locals({'items': items, 'tags': repo.tags()});
            res.render('list.jade', res.locals());
        }
    });
});
app.post('/checkout', function(req, res) {
    var repo = new Repo(req.body.repo);
    repo.checkout(req.body.ref, function() {
        res.redirect('/' + req.body.repo + '/');
    });
});

app.listen(7000);