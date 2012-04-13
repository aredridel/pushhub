var assert = require('assert');

var Repo = require('../lib/repo');
var repo = 'pushhub-test';

var r = new Repo(__dirname + '/sandbox/' + repo);

// These tests are meant to fix the API, they don't go in depth for now

describe("Repo API: ", function() {
    it('should distinguish bare repo from full repository', function() {
        assert.equal(r.bare, false);
    });

    it('should count commits on the `master` branch', function(done) {
        r.total('master', function(err, count) {
            assert.ifError(err);
            assert.ok(count > 0);
            done();
        });
    });

    it('should stat the given path', function(done) {
       r.stats('master', '.', function(err, entry) {
           assert.ifError(err);
           assert.equal(entry.url, '/' + repo + '/master/.');
           assert.ok(entry.commits.size() > 0);
           done();
       });
    });

    it('should stat 2 commits', function(done) {
       r.stats('master', '.', { maxcount: 2 }, function(err, entry) {
           assert.ifError(err);
           assert.equal(entry.commits.size(), 2);
           done();
       });
    });

    it('should stat 5 commits and skip 2', function(done) {
       r.stats('master', '.', { maxcount: 5, skip: 2 }, function(err, entry) {
           //TODO: Fix this test
           assert.ifError(err);
           assert.equal(entry.commits.size(), 5);
           done();
       });
    });

    it('should list objects at the root of master branch', function(done) {
       r.tree('master', '.', function(err, list) {
           assert.ifError(err);
           assert.ok(Array.isArray(list));
           done();
       });
    });

    it('should return the content of the given file', function(done) {
       r.blob('master', 'fu.py', function(err, buf) {
           assert.ifError(err);
           assert.ok(buf.toString().indexOf('#!/usr/bin/python') == 0);
           done();
       });
    });

    it('should return a compressed archive', function(done) {
       r.archive('master', 'zip', function(err, buf) {
           assert.ifError(err);
           assert.ok(buf instanceof Buffer);
           done();
       });
    });

    it('should set the description to the given argument', function() {
        var time = (new Date).getTime();
        r.description(time);
        assert.equal(r.description(), time);
    });
});


describe("Cacheable resources: ", function() {

    it('should return the tip of the master branch', function(done) {
       r.tip('master', function(err, commit) {
           assert.ifError(err);
           assert.ok(commit.date != undefined);
           done();
       });
    });

    it('should fetch the tip for master from the cache', function() {
        assert.ok(r.cache.get('tip:master') !== undefined);
    });

    it('should return the number of commit against the master branch', function(done) {
       r.total('master', function(err, num) {
           assert.ifError(err);
           assert.ok(typeof num === 'number');
           done();
       });
    });

    it('should fetch the number of commit against master from the cache', function() {
        assert.ok(r.cache.get('total:master') !== undefined);
    });

    it('should return the mtime of the repo', function(done) {
       r.mtime(function(err, date) {
           assert.ifError(err);
           assert.ok(date instanceof Date);
           done();
       });
    });

    it('should fetch the mtime from the cache', function() {
        assert.ok(r.cache.get('mtime') !== undefined);
    });

    it('should return the tags', function(done) {
       r.tags(function(err, list) {
           assert.ifError(err);
           assert.ok(Array.isArray(list));
           done();
       });
    });

    it('should fetch the tags from the cache', function() {
        assert.ok(r.cache.get('tags') !== undefined);
    });

    it('should return the branches', function(done) {
       r.branches(function(err, list) {
           assert.ifError(err);
           assert.ok(Array.isArray(list));

           assert.ok(r.cache.get('branches') !== undefined);
           done();
       });
    });

    it('should fetch the branches from the cache', function() {
        assert.ok(r.cache.get('branches') !== undefined);
    });
});
