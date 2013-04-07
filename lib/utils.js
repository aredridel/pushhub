var fs = require('fs');

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