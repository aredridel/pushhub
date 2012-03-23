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
    }
};
