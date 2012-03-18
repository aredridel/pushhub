"use strict";

var cp = require('child_process');
var fs = require('fs');
var path = require('path');
var util = require('util');

var OperationError = require('./errors');
var settings = require('../settings');

var spawn = cp.spawn;
var exec = cp.exec;

var Clone = module.exports = function Clone(dir) {
    this.dir = dir;
    this.remote = path.join(settings.GITROOT, dir);
    this.path = path.join(settings.GITROOT, '.clones', path.basename(dir));
};

Clone.prototype.create = function create(cb) {
    var clone = spawn('git', ['clone', this.remote, this.path]);
    clone.on('exit', function(code) {
        util.log('Cloning `' + this.dir + '` exited with code: ' + code);
        if(cb) {
            var err = code ? new OperationError('Failed to create repository:' + clone) : null;
            cb(err);
        }
    }.bind(this));
};

Clone.prototype.update = function update(cb) {
    var self = this,
        refs = fs.readdirSync(path.join(this.remote, 'refs', 'heads'));

    exec('git pull', { cwd: this.path },
        function(error, stdout, stderr) {
            if(error) { throw error; }
            refs.forEach(function(ref) {
                var pull = spawn('git', ['branch', '--track', ref, 'origin/' + ref], {'cwd': self.path});
                pull.on('exit', function(code) {
                    util.log('Tracking `' + ref + '` exited with code: ' + code);
                    if(cb) {
                        var err = code ? new OperationError('Failed to pull from repository to clone:' + code) : null;
                        cb(err);
                    }
                });
            });
        });
};

Clone.prototype.checkout = function checkout(ref, cb) {
    var checkout = spawn('git', ['checkout', ref], {'cwd': this.path});
    checkout.on('exit', function(code) {
        util.log('Checking out `' + ref + '` exited with code: ' + code);
        if(cb) {
            var err = code ? new OperationError('Failed to checkout `'+  ref + '`:' + code) : null;
            cb(err);
        }
    }.bind(this));

};
