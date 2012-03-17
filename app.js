"use strict";

var path = require('path');

var pushover = require('pushover');
var express = require('express');

var Repo = require('./lib/repo');
var util = require('./lib/util');

var format = require('util').format;

var GITROOT = '.pushstack';

var repos = pushover(path.join(__dirname, GITROOT));
repos.on('create', util.createLocalClone.bind(util));
repos.on('push', util.updateLocalClone.bind(util));

var app = express.createServer();
app.use(express.bodyParser());
app.use(express.favicon());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view options', {layout: false});


function makePreview(url, data) {
    var className = '',
        rawURL = url.replace('blob', 'raw');
    //(~data.type.indexOf('text/'))

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
    var name = req.body.repo,
        repo = new Repo(name);

    repo.checkout(req.body.ref, function() {
        res.redirect('/' + name + '/');
    });
}

function tree(req, res) {
    var name = req.params.name || req.params[0],
        entry = req.params[1] || '',
        repo = new Repo(name);

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
        repo = new Repo(name);

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
        repo = new Repo(name);

    repo.blob(entry, function(err, data) {
        if(err) { throw err; }
        res.setHeader('content-type', data.type);
        res.send(data);
        res.end();
    });
}

app.get('/:name/', tree);
app.get(/\/(\w+)\/tree\/([\w\/\.]+)/, tree);
app.get(/\/(\w+)\/blob\/([\w\/\.]+)/, blob);
app.get(/\/(\w+)\/raw\/([\w\/\.]+)/, raw);
app.post('/checkout', checkoutRef);
app.all('/git/*', handleGitRequest);

app.listen(7000);
