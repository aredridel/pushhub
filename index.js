"use strict";

var path = require('path');
var fs = require('fs');

var express = require('express');
var mime = require('mime');
var pushover = require('pushover');

var Extensions = require('./lib/extensions');
var Repo = require('./lib/repo');
var utils = require('./lib/utils');
var middleware = require('./lib/middleware.js');

var join = path.join;
var extname = path.extname;
var debug = require('debug')('pushhub');

var gitServer;
var repos = {};
var app = module.exports = express();

// Actions

function home(req, res) {
  var repo, date;

  for (var entry in repos) {
    repo = repos[entry];
    date = repo.cache.get('mtime').toString().split(' ');

    repo.mtime = date.slice(1, -2).join(' ');

    repos[entry] = repo;
  }
  res.render('home.jade',  { repos: repos });
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
                'view': 'tree',
                'repo': name,
                'description': repo.description(),
                'ref': ref,
                'commit': repo.cache.get('tip:' + ref),
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
                'description': repo.description(),
                'ref': ref,
                'mime': mime.lookup(path),
                'parents': utils.parents(name, ref, path),
                'filetype': Extensions[extname(path)],
                'rawURL': req.url.replace('blob', 'raw'),
                'data': data,
                'branches': repo.cache.get('branches'),
                'tags': repo.cache.get('tags')
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
        bypage = app.get('history by page');

    if(!isNaN(page)) {
        skip = (page - 1) * bypage;
    } else {
        page = 1;
    }

    var count = repo.cache.get('total:' + ref);
    var next = page * bypage + bypage <= count ? page + 1 : null;
    var previous = page * bypage - bypage > 0 ? page - 1 : null;

    if(repo) {
        repo.stats(ref, '.', { maxcount: bypage, skip: skip}, function(err, entry) {
            if(err) { throw err; }
            res.render('history.jade', {
                'view': 'history',
                'repo': name,
                'ref': ref,
                'description': repo.description(),
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

function description(req, res) {
    var name = req.params.name,
        repo = repos[name],
        method = req.method,
        description = req.body.description;

    if(method == 'POST') {
        if(!description) {
            return res.send(400);
        }
        repo.description(description);
        return res.json({ok: true});
    } else {
        res.json({'description': repo.description()});
    }
}

function setup(parent) {
  app.locals.app = parent || app;

  // Setting up pushover
  var gitRoot = app.get('git root');
  gitServer = pushover(gitRoot);

  function register() {
    fs.readdirSync(gitRoot).forEach(function(dir) {
      var p = join(gitRoot, dir);

      if(!utils.isGitDir(p)) { return; }

      if(!repos[dir]) {
        debug('Registering "%s"', dir);
        repos[dir] = new Repo(p);
        cache(repos[dir]);
      }
    });
  }

  gitServer.on('create', function(dir) {
    if(!repos[dir]) {
      debug('Creating "%s"', dir);
      register(dir);
    }
  });

  gitServer.on('push', function(push) {
    debug('Pushed to "%s", flushing cache', push.repo);
    push.accept();
  });

  fs.watch(gitRoot, register);
  register();

  app.use(express.bodyParser());
  app.use(express.favicon());
  app.use(express.static(join(__dirname, 'public')));
  app.use(express.logger('dev'));
  app.use(middleware(gitServer));


  app.get('/', home);
  app.get('/:name', tree);
  app.get('/:name/tree/:ref/', tree);
  app.get('/:name/tree/:ref/*', tree);
  app.get('/:name/blob/:ref/*', blob);
  app.get('/:name/raw/:ref/*', raw);
  app.get('/:name/commits/:ref', history);
  app.get('/:name/:format/:ref', archive);
  app.get('/:name/description', description);
  app.post('/:name/description', description);
}

app.set('views', join(__dirname, 'views'));
app.set('view options', {layout: false});
app.set('git root', process.cwd());
app.set('history by page', 10);

app._listen = app.listen;

app.listen = function listen() {
  app.emit('listening');
  app._listen.apply(app, arguments);
};

app.on('listening', setup);
app.on('mount', setup);