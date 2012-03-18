"use strict";

var path = require('path');
var cp = require('child_process');
var util = require('util');

var settings = require('../settings');

var spawn = cp.spawn;

var Clone = module.exports = function Clone(dir) {
    this.dir = dir;
    this.path = path.join(settings.GITROOT, '.clones', path.basename(this.dir));
};

Clone.prototype.create = function create(cb) {
    var clone = spawn('git', ['clone', path.join(settings.GITROOT, this.dir), this.path()]);
    clone.on('exit', function(code) {
        util.log('clone exited with code: ' + code);
        if(cb) {
            if(!code) {
                cb(null);
            } else {
                // TODO: Use a typed Exception
                cb('OUPS');
            }
        }
    });
};

Clone.prototype.update = function update(cb) {
    var pull = spawn('git', ['pull'], {'cwd': this.path()});
    pull.on('exit', function(code) {
        util.log('pull exited with code: ' + code);
        if(cb) {
            if(!code) {
                cb(null);
            } else {
                // TODO: Use a typed Exception
                cb('OUPS');
            }
        }
    });
};

Clone.prototype.checkout = function checkout(ref, cb) {
    var checkout = spawn('git', ['checkout', ref], {'cwd': this.path()});
    checkout.on('exit', function(code) {
        util.log('checkout exited with code: ' + code);
        if(cb) {
            if(!code) {
                cb(null);
            } else {
                // TODO: Use a typed Exception
                cb('OUPS');
            }
        }
    });

};
