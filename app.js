var path = require('path');

var pushover = require('pushover');
var express = require('express');

var Repo = require('./lib/repo');
var util = require('./lib/util');

const GITROOT = '.pushstack';
const GITURL = '/git/*';


var repos = pushover(path.join(__dirname, GITROOT));
repos.on('create', util.createLocalClone);
repos.on('push', util.updateLocalClone);

var app = express.createServer();
app.use(express.bodyParser());
app.use(express.favicon());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view options', {layout: false});


function proxyGitRequest(req, res) {
    //TODO: Should reverse the proxied URL
    req.url = util.truncateHead(req.url);
    repos.handle(req, res);
}

function checkoutRef(req, res) {
    var name = req.body.repo,
        repo = new Repo(name);

    repo.checkout(req.body.ref, function() {
        res.redirect('/' + name + '/');
    });
}

function list(req, res) {
    var name = req.params.name || req.params[0],
        entry = req.params[1] || '',
        repo = new Repo(name);

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
app.get(/\/(\w+)\/blob\/([\w\/]+)/, display);
app.post('/checkout', checkoutRef);
app.all(GITURL, proxyGitRequest);

app.listen(7000);
