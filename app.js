"use strict";

var path = require('path');

var express = require('express');
var mime = require('mime');
var pushover = require('pushover');

var Repo = require('./lib/repo');
var utils = require('./lib/utils');

var GITROOT = path.join(__dirname, ".pushstack");


function handleGitRequest(req, res) {
    var parts = req.url.split('/');
    req.url = '/' + parts.slice(2).join('/');
    gitServer.handle(req, res);
}

function tree(req, res) {
    var name = req.params.name || req.params[0],
        entry = req.params[1] || '',
        repo = repos[name];

    if(!repo) {
        return res.render('404.jade');
    }

    repo.tree(entry, function(items) {
        if(!items) { res.render('404.jade'); }
        res.render('tree.jade', {
            'repo': name,
            'parents': utils.parents(name, entry),
            'items': items,
            'branches': repo.get('branches'),
            'tags': repo.get('tags'),
            'commit': repo.get('commit')
        });
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
        res.render('blob.jade', {
            'repo': name,
            'mime': mime.lookup(entry),
            'parents': utils.parents(name, entry),
            'extension': path.extname(req.url),
            'rawURL': req.url.replace('blob', 'raw'),
            'data': data
        });
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
        var m = mime.lookup(entry);
        if(m.indexOf('text') === 0) { m = 'text/plain'; }
        res.setHeader('content-type', m);
        res.end(data);
    });
}

function history(req, res) {
    var name = req.params.name,
        page = req.query['page'] | 0,
        skip = 0,
        repo = repos[name];

    if(page > 0 && page < history.maxpage) {
      skip = (page - 1) * history.bypage;
    }

    if(!repo) {
        return res.render('404.jade');
    }

    repo.stats('.', history.maxpage, skip, function(err, entry) {
        res.render('history.jade', {
            'repo': name,
            'history': entry.commits.asArray()
        });
    });
}
history.bypage = 10;
history.maxpage = 100000;

var repos = {};

var gitServer = pushover(GITROOT);

gitServer.list(function(err, dirs) {
    if(err) {throw err;}
    dirs.forEach(function(dir) {
        repos[dir] = new Repo(path.join(GITROOT, dir));
    });
});

gitServer.on('create', function(dir) {
    repos[dir] = new Repo(path.join(GITROOT, dir));
});

gitServer.on('push', function(dir) {
    repos[dir].flush();
    repos[dir].cache();
});

var app = express.createServer();
app.use(express.bodyParser());
app.use(express.favicon());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view options', {layout: false});

app.get('/:name/', tree);
app.get(/\/(\w+)\/tree\/([\w\-\/\.]+)/, tree);
app.get(/\/(\w+)\/blob\/([\w\-\/\.]+)/, blob);
app.get(/\/(\w+)\/raw\/([\w\-\/\.]+)/, raw);
app.get('/:name/commits', history);
app.all('/git/*', handleGitRequest);

app.listen(7000);
