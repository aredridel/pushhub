var assert = require('assert');

var Repo = require('../lib/repo');

var repo = 'fail';
var r = new Repo(__dirname + '/sandbox/' + repo);

describe(__filename, function() {
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
       r.stats('master', '.', 2, function(err, entry) {
           assert.ifError(err);
           assert.equal(entry.commits.size(), 2);
           done();
       });
    });

    it('should stat 5 commits and skip 2', function(done) {
       r.stats('master', '.', 5, 2, function(err, entry) {
           //TODO: Fix this test
           assert.ifError(err);
           assert.equal(entry.commits.size(), 5);
           done();
       });
    });
});
