var assert = require('assert');

var Commits = require('../lib/commits');

var text = "commit b5bfdc9c45ea5a825ac7498268b723d59c110fbd\n" +
        "Author: Samori Gorse <samorigorse@gmail.com>\n" +
        "Date:   7 hours ago\n" +
        "\n" +
        "    Added commit pagination\n" +
        "\n" +
        "commit b5bfdc9c45ea5a825ac7498268b723d59c110fbd\n" +
        "Author: Samori Gorse <samorigorse@gmail.com>\n" +
        "Date:   3 hours ago\n" +
        "\n" +
        "    Added commit pagination\n" +
        "\n" +
        "commit d5fbf37ee152ef6bd7f17b7ec5a224adf143cb96\n" +
        "Author: Samori Gorse <samorigorse@gmail.com>\n" +
        "Date:   Thu Mar 22 02:45:30 2012 +0100\n" +
        "\n" +
        "    Refactoring\n" +
        "\n";

var c = new Commits(text);

describe(__filename, function() {
    describe('commit parsing:', function() {

        it('should return the hash', function() {
            assert.equal(c.get(0).hash, 'b5bfdc9c45ea5a825ac7498268b723d59c110fbd');
        });

        it('should return the author', function() {
            var author = c.get(2).author;
            assert.equal(author.name, 'Samori Gorse');
            assert.equal(author.email, 'samorigorse@gmail.com');
        });

        it('should return the date', function() {
            assert.equal(c.get(1).date, '3 hours ago');
        });

        it('should return the message', function() {
            assert.ok(c.get(2).message.indexOf('Refactoring') != -1);
        });
    });

    describe('methods:', function() {
        it('should get the commit by index', function() {
            assert.equal(c.get(3), undefined);
            assert.notEqual(c.get(1), undefined);
        });

        it('should return the number of parsed commit entries', function() {
            assert.equal(c.len(), 3);
        });

        it('should return the last element', function() {
            assert.equal(c.last(), c.store[c.store.length - 1]);
        });

        it('should return the first element', function() {
            assert.equal(c.tip(), c.store[0]);
        });
    });
});
