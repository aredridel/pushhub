"use strict";

var path = require('path');

var pushover = require('pushover');
var express = require('express');

var Repo = require('./lib/repo');
var settings = require('./settings');

var format = require('util').format;


function makePreview(url, data) {
    var className = '',
        rawURL = url.replace('blob', 'raw');

    if(~data.type.indexOf('image/')) {
        return format('<div><img src="%s"></div>', rawURL);
    } else {
        return format('<pre class="%s">%s</pre>', className, data.toString());
    }
}

function handleGitRequest(req, res) {
    var parts = req.url.split('/');
    req.url = '/' + parts.slice(2).join('/');
    repos.handle(req, res);
}

function checkoutRef(req, res) {
    var repo = repos[req.body.repo];
    if(!repo) {
        return res.render('404.jade');
    }

    repo.checkout(req.body.ref, function() {
        res.redirect('/' + req.body.repo + '/');
    });
}

function tree(req, res) {
    var name = req.params.name || req.params[0],
        entry = req.params[1] || '',
        repo = repos[name];

    if(!repo) {
        return res.render('404.jade');
    }

    repo.tree(entry, function(items, branches, tags) {
        if(!items) { res.render('404.jade'); }
        res.local('repo', name);
        res.local('items', items);
        res.local('branches', branches);
        res.local('tags', tags);
        res.render('list.jade', res.locals());
    });
}

function blob(req, res) {
    var name = req.params[0],
        entry = req.params[1],
        repo = repos[name];

    if(!repo) {
        return res.render('404.jade');
    }

    repo.blob(entry, function(err, data) {
        if(err) { throw err; }
        res.local('repo', name);
        res.local('preview', makePreview(req.url, data));
        res.render('display.jade', res.locals());
    });
}

function raw(req, res) {
    var name = req.params[0],
        entry = req.params[1],
        repo = repos[name];

    if(!repo) {
        return res.render('404.jade');
    }

    repo.blob(entry, function(err, data) {
        if(err) { throw err; }
        res.setHeader('content-type', data.type);
        res.send(data);
        res.end();
    });
}

var repos = {};

var gitServer = pushover(settings.GITROOT, {'checkout': true});

gitServer.list(function(err, dirs) {
    if(err) {throw err;}
    dirs.forEach(function(dir) {
        repos[dir] = new Repo(dir);
    });
});

gitServer.on('create', function(dir) {
    repos[dir] = new Repo(dir);
});

gitServer.on('push', function(dir) {
    repos[dir].update();
});

var app = express.createServer();
app.use(express.bodyParser());
app.use(express.favicon());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view options', {layout: false});

app.get('/:name/', tree);
app.get(/\/(\w+)\/tree\/([\w\/\.]+)/, tree);
app.get(/\/(\w+)\/blob\/([\w\/\.]+)/, blob);
app.get(/\/(\w+)\/raw\/([\w\/\.]+)/, raw);
app.post('/checkout', checkoutRef);
app.all('/git/*', handleGitRequest);

app.listen(7000);
