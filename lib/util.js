var path = require('path');
var cp = require('child_process');

var spawn = cp.spawn;

const GITROOT = '.pushstack';
const GITCLONESROOT = '.clones';


module.exports = {

    truncateHead: function truncateHead(url) {
        var parts = url.split('/');
        return '/' + parts.slice(2).join('/');
    },

    getLocalClonePath: function getLocalClonePath(dir) {
        return path.join(GITROOT, GITCLONESROOT, path.basename(dir));
    },

    createLocalClone: function createLocalClone(dir) {
        var clone = spawn('git', [ 'clone', path.join(GITROOT, dir), util.getLocalClonePath(dir) ]);
        clone.on('exit', function(code) {
            console.log('clone exited with code: ' + code);
        });
    },

    updateLocalClone: function updateLocalClone(dir) {
        var target = util.getLocalClonePath(dir);
        var pull = spawn('git', ['pull'], {'cwd': target});
        pull.on('exit', function(code) {
            console.log('pull exited with code: ' + code);
        });
    },

    checkoutLocalClone: function checkoutLocalClone(dir, ref, cb) {
        var target = util.getLocalClonePath(dir);
        var checkout = spawn('git', [ 'checkout', ref ], {'cwd': target});
        checkout.on('exit', function(code) {
            console.log('checkout exited with code: ' + code);
            if(!code) {
                cb(null);
            } else {
                cb('OUPS');
            }
        });
    }

};
