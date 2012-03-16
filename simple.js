var util = require('util');
var path = require('path');
var cp = require('child_process');

var pushover = require('pushover');
var express = require('express');

var Repo = require('./lib/repo');
var util = require('./lib/util');   

var spawn = cp.spawn;

const GITROOT = '.pushstack';
const GITURL = '/git/*';
const GITCLONESROOT = '.clones';

//Local clone management
function createLocalClone(dir) {
    var clone = spawn('git', [ 'clone', path.join(GITROOT, dir), util.getLocalClonePath(dir) ]);
    clone.on('exit', function(code) {
        console.log('clone exited with code: ' + code);
    });
}

//Local clone management
function updateLocalClone(dir) {
    var target = util.getLocalClonePath(dir);
    var pull = spawn('git', ['pull'], {'cwd': target});
    pull.on('exit', function(code) {
        console.log('pull exited with code: ' + code);
    });
}

//Local clone management
function checkoutLocalClone(dir, ref, cb) {
    var target = util.getLocalClonePath(dir);
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

    
var repos = pushover(path.join(__dirname, GITROOT));
repos.on('create', function create(dir) {
    util.createLocalClone(dir);
});
repos.on('push', function push(dir) {
    util.updateLocalClone(dir);
});

var app = express.createServer();
app.use(express.bodyParser());
app.use(express.favicon());
app.set('view options', {layout: false});

function proxyGitRequest(req, res) {
    req.url = util.truncateHead(req.url);
    repos.handle(req, res);
}

function checkoutRef(req, res) {
    var repo = new Repo(req.body.repo);
    repo.checkout(req.body.ref, function() {
        res.redirect('/' + req.body.repo + '/');
    });
}

function list(req, res) {
    var name = req.params.name || req.params[0],
        entry = req.params[1] || '',
        repo = new Repo(name);

    console.log(entry, name)

    repo.list(entry, function(items, branches, tags) {
        if(!items) {
            res.render('404.jade');
        }
        res.local('repo', name);
        res.local('items', items);
        res.local('branches', branches);
        res.local('tags', tags);
        res.render('list.jade', res.locals());
    });
}

function display(req, res) {
    var name = req.params[0],
        entry = req.params[1],
        repo = new Repo(name);

    repo.display(entry, function(content) {
        res.local('content', content);
        res.render('display.jade', res.locals())
    });
}

app.get('/:name/', list);
app.get(/\/(\w+)\/tree\/([\w\/]+)/, list);
app.get('/\/(\w+)\/blob\/([\w\/]+)/', display);
app.post('/checkout', checkoutRef);
app.all(GITURL, proxyGitRequest);

app.listen(7000);