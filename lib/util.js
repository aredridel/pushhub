const GITROOT = '.pushstack';
const GITURL = '/git/*';
const GITCLONESROOT = '.clones';

var path = require('path');

module.exports = {

    truncateHead: function truncateHead(url) {
        var parts = url.split('/');
        return '/' + parts.slice(2).join('/');
    },

    getLocalClonePath: function getLocalClonePath(dir) {
        return path.join(GITROOT, GITCLONESROOT, path.basename(dir));
    }

};