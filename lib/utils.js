var fs = require('fs');
var join = require('path').join;
var pushover = require('pushover');

exports.noop = function noop() {

};

exports.not = function(b) {
  return function(a) {
    return a !== b;
  }
};

exports.isDirectory = function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch(e) {
    return false;
  }
};

exports.isGitDir = function isGitDir(p) {
  var isDir = exports.isDirectory(p);

  if(isDir) {
    return fs.readdirSync(p).some(function(entry) {
      return entry == '.git';
    });
  }
  return false;
};

exports.url = function url() {
  return Array.prototype.join.call(arguments, '/').replace(/\/\//g, '/');
};

exports.parents = function parents(root, ref, path) {
  var parts = path.split('/');
  parts = parts.map(function(part, index) {
    return {
      'label': part,
      'url': this.url('', root, 'tree', ref, parts.slice(0, index + 1).join('/'))
    };
  }.bind(this));
  parts[parts.length - 1].isLast = true;
  return parts;
};

exports.bufferConcat = function bufferConcat(bufs, encoding) {
  // https://github.com/creationix/node-git/blob/master/lib/tools.js
  var result, index = 0, length;
  length = bufs.reduce(function(l, b) {
    return l + b.length;
  }, 0);
  result = new Buffer(length);
  bufs.forEach(function(b) {
    b.copy(result, index);
    index += b.length;
  });
  if (encoding) {
    return result.toString(encoding);
  }
  return result;
};

/**
 * Returns a patched version of pushover that emits a 'create' event
 *
 * @param {String} dir
 * @param {Object} events
 * @returns {Object} pushover
 */

exports.pushover = function(dir, events) {
  var server = pushover(dir);

  function listRepos() {
    fs.readdirSync(dir).forEach(function(entry) {
      var p = join(dir, entry);
      if(exports.isGitDir(p)) {
        server.emit('create', entry);
      }
    });
  }

  ['create', 'push', 'tag', 'fetch', 'info', 'head'].forEach(function(event) {
    if(events[event]) {
      //Adding unused events may break git-service
      server.on(event, events[event]);
    }
  });

  listRepos();
  fs.watch(dir, listRepos);

  return server;
};