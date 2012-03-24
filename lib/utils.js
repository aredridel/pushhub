var fs = require('fs');

module.exports = {
    noop: function noop(){
    },

    not: function not(b) {
        return function(a) {
            return a !== b;
        }
    },

    isDirectory: function isDirectory(p) {
        return fs.statSync(p).isDirectory();
    },

    url: function url() {
        return Array.prototype.join.call(arguments, '/').replace(/\/\//g, '/');
    },

    parents: function parents(root, p) {
        var parts = p.split('/');
        parts = parts.map(function(part, index) {
            return {
                'label': part,
                'url': '/' + root + '/' + 'tree' + '/'  + parts.slice(0, index + 1).join('/')
            };
        });
        parts[parts.length - 1].isLast = true;
        return parts;
    },

    bufferConcat: function bufferConcat(bufs) {
        // https://raw.github.com/coolaj86/node-bufferjs/master/bufferjs/concat.js
        if (!Array.isArray(bufs)) {
          bufs = Array.prototype.slice.call(arguments);
        }

        var bufsToConcat = [], length = 0;
        bufs.forEach(function (buf) {
          if (buf) {
            if (!Buffer.isBuffer(buf)) {
              buf = new Buffer(buf);
            }
            length += buf.length;
            bufsToConcat.push(buf);
          }
        });

        var concatBuf = new Buffer(length), index = 0;
        bufsToConcat.forEach(function (buf) {
          buf.copy(concatBuf, index, 0, buf.length);
          index += buf.length;
        });

        return concatBuf;
      }
};
