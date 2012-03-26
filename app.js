"use strict";

var path = require('path');

var express = require('express');
var mime = require('mime');
var pushover = require('pushover');

var Repo = require('./lib/repo');
var utils = require('./lib/utils');

var join = path.join;
var extname = path.extname;
var debug = require('debug')('pushstack');

var GITROOT = join(__dirname, ".pushstack");


function handleGitRequest(req, res) {
    var parts = req.url.split('/');
    req.url = '/' + parts.slice(2).join('/');
    gitServer.handle(req, res);
}


function tip(req, res, next) {
    var name = req.params.name,
        ref = req.params.ref || 'master',
        repo = repos[name];

    if(repo) {
        repo.tip(ref, function(err, tip) {
            if(err) throw err;
            res.local('commit', tip);
            next();
        });
    }
}

function tree(req, res) {
    var name = req.params.name,
        ref = req.params.ref || 'master',
        path = req.params[0] || '.',
        repo = repos[name];

    if(!repo) {
        return res.render('404.jade');
    }

    repo.tree(ref, path, function(err, items) {
        if(err || !items) { return res.render('404.jade'); }
        res.render('tree.jade', {
            'repo': name,
            'ref': ref,
            'parents': utils.parents(name, path),
            'items': items,
            'branches': repo.cache.get('branches'),
            'tags': repo.cache.get('tags')
        });
    });
}

function blob(req, res) {
    var name = req.params.name,
        ref = req.params.ref || 'master',
        path = req.params[0],
        repo = repos[name];

    if(!repo) {
        return res.render('404.jade');
    }

    repo.blob(ref, path, function(err, data) {
        if(err) { throw err; }
        res.render('blob.jade', {
            'repo': name,
            'mime': mime.lookup(path),
            'parents': utils.parents(name, path),
            'extension': extname(req.url),
            'rawURL': req.url.replace('blob', 'raw'),
            'data': data
        });
    });
}

function raw(req, res) {
    var name = req.params.name,
        ref = req.params.ref || 'master',
        path = req.params[0],
        repo = repos[name];

    if(!repo) {
        return res.render('404.jade');
    }

    repo.blob(ref, path, function(err, data) {
        if(err) { throw err; }
        var m = mime.lookup(path);
        if(m.indexOf('text') === 0) { m = 'text/plain'; }
        res.setHeader('content-type', m);
        res.end(data);
    });
}

function history(req, res) {
    var name = req.params.name,
        ref = req.params.ref,
        page = req.query['page'] | 0,
        skip = 0,
        repo = repos[name];

    if(page > 0 && page < history.maxpage) {
      skip = (page - 1) * history.bypage;
    }

    if(!repo) {
        return res.render('404.jade');
    }

    repo.stats(ref, '.', history.bypage, skip, function(err, entry) {
        if(err) { throw err; }
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
        debug('Adding "%s" to known repositories', dir);
        repos[dir] = new Repo(join(GITROOT, dir));
    });
});

gitServer.on('create', function(dir) {
    debug('Creating "%s"', dir);
    repos[dir] = new Repo(join(GITROOT, dir));
});

gitServer.on('push', function(dir) {
    debug('Pushed to "%s", flushing cache', dir);
    repos[dir].flush();
    repos[dir].memoize();
});

var app = express.createServer();
app.use(express.bodyParser());
app.use(express.favicon());
app.use(express.static(join(__dirname, 'public')));
app.set('view options', {layout: false});


app.get('/:name', tip, tree);
app.get('/:name/tree/:ref/', tip, tree);
app.get('/:name/tree/:ref/*', tip, tree);
app.get('/:name/blob/:ref/*', blob);
app.get('/:name/raw/:ref/*', raw);
app.get('/:name/commits/:ref', history);


app.all('/git/*', handleGitRequest);
app.listen(7000);
