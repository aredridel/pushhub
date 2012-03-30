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

    parents: function parents(root, ref, path) {
        var parts = path.split('/');
        parts = parts.map(function(part, index) {
            return {
                'label': part,
                'url': this.url('', root, 'tree', ref, parts.slice(0, index + 1).join('/'))
            };
        }.bind(this));
        parts[parts.length - 1].isLast = true;
        return parts;
    },

    bufferConcat: function bufferConcat(bufs, encoding) {
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
    }
};
