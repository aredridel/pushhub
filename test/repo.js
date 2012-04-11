var assert = require('assert');

var Repo = require('../lib/repo');

var r = new Repo(__dirname + '/sandbox/fail');

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
});
