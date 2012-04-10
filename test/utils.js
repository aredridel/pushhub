var assert = require('assert');

var Utils = require('../lib/utils');

describe(__filename, function() {
    it('should create a `not` function and return it', function() {
        var notNull = Utils.not(null);
        assert.equal([1, 2, null, 4, 5].filter(notNull).length, 4);
        assert.equal([1, 2, undefined, 4, 5].filter(notNull).length, 5);
    });

    it('should check if an entry is a directory or not', function() {
        assert.equal(Utils.isDirectory(__dirname), true);
    });

    it('should create a clean url with the given arguments', function() {
        assert.equal(Utils.url('', '', ''), '/');
        assert.equal(Utils.url('', 'foo', ''), '/foo/');
        assert.equal(Utils.url('', 'foo', 'bar'), '/foo/bar');
    });

    it('should concatenate the given buffers', function() {
        var b1 = new Buffer(5);
        var b2 = new Buffer(5);
        b1.fill('a');
        b2.fill('b');
        var c = Utils.bufferConcat([b1, b2]);
        assert.equal(c.length, 10);
        assert.equal(c.toString(), 'aaaaabbbbb');
    });

    it('should build a breadcrumb given ', function() {
        var p = Utils.parents('node', 'master', '/deps/v8');
        assert.equal(p[0].url, '/node/tree/master/');
        assert.equal(p[1].url, '/node/tree/master/deps');
        assert.equal(p[2].url, '/node/tree/master/deps/v8');
    })
});
