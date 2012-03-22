var assert = require('assert');

var Repo = require('../lib/repo');
var r = new Repo(__dirname + '/../.pushstack/fail');

describe('Repository management:', function() {
    it('should return the last commit of given path', function(done) {
        r.last(function(err) {
            if(err) throw err;
            done();
        });
    });

    it('should properly set the url for a given path', function(done) {
        r.head('/', 'fichier.css', function(err, commit) {
            if(err) throw err;
            assert.equal(commit.url, '/fail/blob/fichier.css');
            done();
        });
    });

    it('should properly set the url for a given path', function(done) {
        r.head('/', 'fichier.css', function(err, commit) {
            if(err) throw err;
            assert.equal(commit.url, '/fail/blob/fichier.css');
            done();
        });
    });

    it('should properly set the url for the git repository root (dot)', function(done) {
        r.head('/', '.', function(err, commit) {
            if(err) throw err;
            assert.equal(commit.url, '/fail/');
            done();
        });
    });


    it('should properly set the url for the git repository root (slash)', function(done) {
        r.head('/', '/', function(err, commit) {
            if(err) throw err;
            assert.equal(commit.url, '/fail/');
            done();
        });
    });

    it('should properly set the url for the git repository root (empty string)', function(done) {
        r.head('/', '', function(err, commit) {
            if(err) throw err;
            assert.equal(commit.url, '/fail/');
            done();
        });
    });

    it('should properly set the url for the git repository root (dotslash)', function(done) {
        r.head('/', './', function(err, commit) {
            if(err) throw err;
            assert.equal(commit.url, '/fail/');
            done();
        });
    });

    it('should properly set the url for a nested dir', function(done) {
        r.head('/abort/every', '/', function(err, commit) {
            if(err) throw err;
            assert.equal(commit.url, '/fail/tree/abort/every/');
            done();
        });
    });

    it('should properly set the url for a file in a nested dir', function(done) {
        r.head('/abort/every', 'thing.txt', function(err, commit) {
            if(err) throw err;
            assert.equal(commit.url, '/fail/blob/abort/every/thing.txt');
            done();
        });
    });
});
