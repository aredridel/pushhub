"use strict";

var path = require('path');
var fs = require('fs');

var express = require('express');
var mime = require('mime');
var pushover = require('pushover');
var async = require('async');

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
  function mtime(key, cb) {
    var repo = repos[key];
    repo.mtime(function(err, date) {
      repo.last_updated = date;
      cb(err, repo);
    });
  }

  async.map(Object.keys(repos), mtime, function(err, repos) {
    res.render('home.jade',  { repos: repos });
  });
}

function tree(req, res) {
  var name = req.params.name
    , ref  = req.params.ref || 'master'
    , path = req.params[0] || '.'
    , repo = repos[name]
    , parents = utils.parents(name, ref, path);

  var branches = repo.branches.bind(repo)
    , tags = repo.tags.bind(repo)
    , tip = repo.tip.bind(repo, ref);

  if(repo) {
    async.parallel([branches, tags, tip], function(err, results) {
      if(err) { throw err; }

      repo.tree(ref, path, function(err, items) {
        if(err) { throw err; }

        if(items.length === 0) {
          res.status(404).render('404.jade');
        } else {
          res.render('tree.jade', {
              view: 'tree'
            , repo: name
            , ref: ref
            , parents: parents
            , items: items
            , description: repo.description()
            , branches: results[0]
            , tags: results[1]
            , commit: results[2]
          });
        }
      });
    });
  } else {
    res.status(404).render('404.jade');
  }
}

function blob(req, res) {
  var name = req.params.name
    , ref = req.params.ref || 'master'
    , path = req.params[0]
    , repo = repos[name]
    , parents = utils.parents(name, ref, path)
    , rawURL = req.url.replace('blob', 'raw')
    , filetype = Extensions[extname(path)];

  var branches = repo.branches.bind(repo)
    , tags = repo.tags.bind(repo);

  function fof() {
    res.status(404).render('404.jade');
  }

  if(repo) {
    async.parallel([branches, tags], function(err, results) {
      if(err) { throw err; }

      repo.blob(ref, path, function(err, data) {
        if(err) { return fof(); }

        res.render('blob.jade', {
            view: 'blob'
          , repo: name
          , ref: ref
          , parents: parents
          , data: data
          , filetype: filetype
          , rawURL: rawURL
          , mime: mime.lookup(path)
          , description: repo.description()
          , branches: results[0]
          , tags: results[1]
        });
      });
    });
  } else {
    fof()
  }
}

function raw(req, res) {
  var name = req.params.name
    , ref = req.params.ref || 'master'
    , path = req.params[0]
    , repo = repos[name];

  if(repo) {
    repo.blob(ref, path, function(err, data) {
      if(err) { throw err; }

      var m = mime.lookup(path);
      if(m.indexOf('text') === 0) { m = 'text/plain'; }
      res.setHeader('content-type', m);
      res.end(data);
    });
  } else {
    res.status(404).render('404.jade');
  }
}

function history(req, res) {
  var name = req.params.name
    , ref = req.params.ref
    , page = Number(req.query.page || 1)
    , bypage = app.get('history by page')
    , skip = (page - 1) * bypage
    , repo = repos[name];

  var branches = repo.branches.bind(repo)
    , tags = repo.tags.bind(repo)
    , total = repo.total.bind(repo, ref);

  if(repo) {
    async.parallel([branches, tags, total], function(err, results) {
      if(err) { throw err; }

      var count = results[2]
        , next = page * bypage + bypage <= count ? page + 1 : null
        , previous = page * bypage - bypage > 0 ? page - 1 : null;

      repo.stats(ref, '.', { maxcount: bypage, skip: skip}, function(err, entry) {
        if(err) { throw err; }
        res.render('history.jade', {
          view: 'history',
          repo: name,
          ref: ref,
          current: page,
          pages: Math.floor(count / bypage),
          next: next,
          previous: previous,
          description: repo.description(),
          history: entry.commits.asArray(),
          branches: results[0],
          tags: results[1]
        });
      });
    });
  } else {
    res.status(404).render('404.jade')
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

      if(!repos[dir] && utils.isGitDir(p)) {
        debug('Registering "%s"', dir);
        repos[dir] = new Repo(p);
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