"use strict";

var path = require('path');

var express = require('express');
var mime = require('mime');
var pushover = require('pushover');

var Extensions = require('./lib/extensions');
var Repo = require('./lib/repo');
var utils = require('./lib/utils');

var join = path.join;
var extname = path.extname;
var debug = require('debug')('pushstack');


var app = module.exports = express.createServer();

// Middleware

function count(req, res, next) {
    var name = req.params.name,
        ref = req.params.ref || 'master',
        repo = repos[name];

    if(repo) {
        repo.total(ref, function(err, count) {
            if(err) { throw err; }
            res.local('count', count);
            next();
        });
    } else {
        res.render('404.jade');
    }
}


function tip(req, res, next) {
    var name = req.params.name,
        ref = req.params.ref || 'master',
        repo = repos[name];

    if(repo) {
        repo.tip(ref, function(err, tip) {
            if(err) { throw err; }
            res.local('commit', tip);
            next();
        });
    } else {
        res.render('404.jade');
    }
}

// Actions

function tree(req, res) {
    var name = req.params.name,
        ref = req.params.ref || 'master',
        path = req.params[0] || '.',
        repo = repos[name];

    if(repo) {
        repo.tree(ref, path, function(err, items) {
            if(err || !items.length) { return res.render('404.jade'); }
            res.render('tree.jade', {
                'view': 'tree',
                'repo': name,
                'ref': ref,
                'parents': utils.parents(name, ref, path),
                'items': items,
                'branches': repo.cache.get('branches'),
                'tags': repo.cache.get('tags')
            });
        });
    } else {
        res.render('404.jade');
    }
}

function blob(req, res) {
    var name = req.params.name,
        ref = req.params.ref || 'master',
        path = req.params[0],
        repo = repos[name];

    if(repo) {
        repo.blob(ref, path, function(err, data) {
            if(err) { throw err; }
            res.render('blob.jade', {
                'view': 'blob',
                'repo': name,
                'mime': mime.lookup(path),
                'parents': utils.parents(name, ref, path),
                'filetype': Extensions[extname(path)],
                'rawURL': req.url.replace('blob', 'raw'),
                'data': data
            });
        });
    } else {
        res.render('404.jade');
    }
}

function raw(req, res) {
    var name = req.params.name,
        ref = req.params.ref || 'master',
        path = req.params[0],
        repo = repos[name];

    if(repo) {
        repo.blob(ref, path, function(err, data) {
            if(err) { throw err; }
            var m = mime.lookup(path);
            if(m.indexOf('text') === 0) { m = 'text/plain'; }
            res.setHeader('content-type', m);
            res.end(data);
        });

    } else {
        res.render('404.jade');
    }
}

function history(req, res) {
    var name = req.params.name,
        ref = req.params.ref,
        page = parseInt(req.query['page'], 10),
        skip = 0,
        repo = repos[name],
        bypage = app.set('history by page');

    if(!isNaN(page)) {
        skip = (page - 1) * bypage;
    } else {
        page = 1;
    }

    var count = res.local('count');
    var next = page * bypage + bypage <= count ? page + 1 : null;
    var previous = page * bypage - bypage > 0 ? page - 1 : null;

    if(repo) {
        repo.stats(ref, '.', bypage, skip, function(err, entry) {
            if(err) { throw err; }
            res.render('history.jade', {
                'view': 'history',
                'repo': name,
                'ref': ref,
                'current': page,
                'pages': Math.floor(count / bypage),
                'next': next,
                'previous': previous,
                'history': entry.commits.asArray(),
                'branches': repo.cache.get('branches'),
                'tags': repo.cache.get('tags')
            });
        });
    } else {
        res.render('404.jade')
    }
}

function archive(req, res) {
    var name = req.params.name,
        ref = req.params.ref,
        format = req.params.format === 'zipball' ? 'zip' : 'tar.gz',
        repo = repos[name];

    if(repo) {
        repo.archive(ref, format, function(err, archive) {
            if(err) { throw err; }
            res.end(archive);
        });
    } else {
        res.render('404.jade');
    }
}

function __setup(parent) {
    var gitRoot = app.set('git root');
    var basepath = app.set('basepath') || '';

    // Setting up pushover
    gitServer = pushover(gitRoot);

    gitServer.list(function(err, dirs) {
        if(err) {throw err;}
        dirs.forEach(function(dir) {
            debug('Adding "%s" to known repositories', dir);
            repos[dir] = new Repo(join(gitRoot, dir));
        });
    });

    gitServer.on('create', function(dir) {
        debug('Creating "%s"', dir);
        repos[dir] = new Repo(join(gitRoot, dir));
    });

    gitServer.on('push', function(dir) {
        debug('Pushed to "%s", flushing cache', dir);
        repos[dir].flush();
        repos[dir].memoize();
    });

    // Making basepath available to the views.
    // This is necessary in order to serve static files properly if the app is mounted
    app.helpers({'basepath': basepath === '/' ? '' : basepath});
}

var gitServer;
var repos = {};

app.on('listening', __setup);
app.mounted(__setup);

app.use(express.bodyParser());
app.use(express.favicon());
app.use(express.static(join(__dirname, 'public')));

app.set('views', join(__dirname, 'views'));
app.set('view options', {layout: false});
app.set('git root', join(__dirname, ".pushstack"));
app.set('history by page', 10);

app.all(/^\/(.*)\.git/, function(req, res) {
    req.url = req.url.replace('.git', '');
    gitServer.handle(req, res);
});
app.get('/:name', tip, tree);
app.get('/:name/tree/:ref/', tip, tree);
app.get('/:name/tree/:ref/*', tip, tree);
app.get('/:name/blob/:ref/*', blob);
app.get('/:name/raw/:ref/*', raw);
app.get('/:name/commits/:ref', count, history);
app.get('/:name/:format/:ref', archive);
