"use strict";

var path = require('path');

var express = require('express');
var pushover = require('pushover');

var Repo = require('./lib/repo');
var settings = require('./settings');


function parents(root, p) {
    var parts = p.split('/');
    parts = parts.map(function(part, index) {
        return {
            'label': part,
            'url': '/' + root + '/' + 'tree' + '/'  + parts.slice(0, index + 1).join('/')
        };
    });
    parts[parts.length - 1].isLast = true;
    return parts;
}

function handleGitRequest(req, res) {
    var parts = req.url.split('/');
    req.url = '/' + parts.slice(2).join('/');
    gitServer.handle(req, res);
}

// TODO: this must die
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

    repo.tree(entry, function(items, branches, tags, last) {
        if(!items) { res.render('404.jade'); }
        //TODO: Use Locals
        res.local('repo', name);
        res.local('parents', parents(name, entry));
        res.local('items', items);
        res.local('branches', branches);
        res.local('tags', tags);
        res.local('commit', last);
        res.render('tree.jade', res.locals());
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
        //TODO: Use Locals
        res.local('repo', name);
        res.local('parents', parents(name, entry));
        res.local('extension', path.extname(req.url));
        res.local('rawURL', req.url.replace('blob', 'raw'));
        res.local('data', data);
        res.render('blob.jade', res.locals());
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
        // TODO: Refactor this
        res.setHeader('content-type', data.mime);
        res.send(data);
        res.end();
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

    // TODO: Change API, make max and skip optional
    repo.history('/', '.', history.maxpage, skip, function(err, entry) {
        //TODO: Use Locals
        res.local('repo', name);
        res.local('history', entry.history.asArray());
        res.render('history.jade', res.locals());
    });
}
history.bypage = 10;
history.maxpage = 100000;

var repos = {};

var gitServer = pushover(settings.GITROOT);

gitServer.list(function(err, dirs) {
    if(err) {throw err;}
    dirs.forEach(function(dir) {
        repos[dir] = new Repo(dir);
    });
});

gitServer.on('create', function(dir) {
    repos[dir] = new Repo(dir);
    repos[dir].create();
});

gitServer.on('push', function(dir) {
    repos[dir].update();
    repos[dir].cache.flush('tags');
    repos[dir].cache.flush('branches');
    repos[dir].cache.flush('lastCommit');
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
app.post('/checkout', checkoutRef);
app.all('/git/*', handleGitRequest);

app.listen(7000);
