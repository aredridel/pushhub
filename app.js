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


//TODO: Make this configurable
var GITROOT = join(__dirname, ".pushstack");
var HISTORY_BY_PAGE = 10;
var HISTORY_MAX_PAGE = 100000;


var ExtensionMap = {
    '': 'plaintext',
    '.js': 'javascript',
    '.css': 'css',
    '.php': 'php',
    '.java': 'java',
    '.html': 'xml',
    '.xml': 'xml',
    '.rb': 'ruby',
    '.sh': 'bash',
    '.py': 'python'
};

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
    } else {
        res.render('404.jade');
    }
}

function tree(req, res) {
    var name = req.params.name,
        ref = req.params.ref || 'master',
        path = req.params[0] || '.',
        repo = repos[name];

    if(repo) {
        repo.tree(ref, path, function(err, items) {
            if(err || !items.length) { return res.render('404.jade'); }
            res.render('tree.jade', {
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
                'repo': name,
                'mime': mime.lookup(path),
                'parents': utils.parents(name, ref, path),
                'filetype': ExtensionMap[extname(path)],
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
        page = req.query['page'] | 0,
        skip = 0,
        repo = repos[name];

    if(page > 0 && page < HISTORY_MAX_PAGE) {
      skip = (page - 1) * HISTORY_BY_PAGE;
    }

    if(repo) {
        repo.stats(ref, '.', HISTORY_BY_PAGE, skip, function(err, entry) {
            if(err) { throw err; }
            res.render('history.jade', {
                'repo': name,
                'history': entry.commits.asArray()
            });
        });
    } else {
        res.render('404.jade')
    }
}

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

var app = module.exports = express.createServer();
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

app.all('/git/*', function(req, res) {
    req.url = req.url.replace(/\^[\/]*/, '');
    gitServer.handle(req, res);
});
