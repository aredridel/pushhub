"use strict";

var path = require('path');
var cp = require('child_process');
var util = require('util');

var OperationError = require('./errors');
var settings = require('../settings');

var spawn = cp.spawn;

var Clone = module.exports = function Clone(dir) {
    this.dir = dir;
    this.path = path.join(settings.GITROOT, '.clones', path.basename(this.dir));
};

Clone.prototype.create = function create(cb) {
    var clone = spawn('git', ['clone', path.join(settings.GITROOT, this.dir), this.path]);
    clone.on('exit', function(code) {
        util.log('Cloning ' + this.dir + ' exited with code: ' + code);
        if(cb) {
            var err = code ? new OperationError('Failed to create repository:' + clone) : null;
            cb(err);
        }
    });
};

Clone.prototype.update = function update(cb) {
    var pull = spawn('git', ['pull'], {'cwd': this.path});
    pull.on('exit', function(code) {
        util.log('Pulling in ' + this.dir + ' exited with code: ' + code);
        if(cb) {
            var err = code ? new OperationError('Failed to pull from repository to clone:' + code) : null;
            cb(err);
        }
    });
};

Clone.prototype.checkout = function checkout(ref, cb) {
    var checkout = spawn('git', ['checkout', ref], {'cwd': this.path});
    checkout.on('exit', function(code) {
        util.log('Checking out ' + ref + ' exited with code: ' + code);
        if(cb) {
            var err = code ? new OperationError('Failed to checkout `'+  ref + '`:' + code) : null;
            cb(err);
        }
    });

};
