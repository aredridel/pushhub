"use strict";

var EOL = '\n';
var INDENT = /^\s{4}/;

var Commits = module.exports = function Commits(source) {
    source = source.toString();
    this.entries = source.split(/^commit\s(\w{40})/gm);
    this.store = [];
    this.parse();
};

Commits.prototype.get = function get(index) {
    return this.store[index];
};

Commits.prototype.size = function size() {
    return this.store.length;
};

Commits.prototype.last = function last() {
    return this.get(this.size() - 1);
};

Commits.prototype.tip = function tip() {
    return this.get(0);
};

Commits.prototype.asArray = function asArray() {
    return this.store;
};

Commits.prototype.parse = function parse() {
    this.entries.shift(); //Eliminate blank due to split
    this.entries.forEach(function(text, index) {
        if(index % 2 === 0) {
            this.store.push({'hash': text});
        } else {
            var line,
                entry = this.last(),
                lines = text.split(EOL);

            lines.shift(); //Eliminate blank
            line = lines.shift();
            entry.author = this.author(line);
            line = lines.shift();
            entry.date = this.date(line);
            entry.message = lines
                .filter(function(line) {
                    return line.match(INDENT);
                })
                .map(function(line) {
                    return line.replace(INDENT, '');
                })
                .join(EOL);
        }
    }, this);
};

// -- Private methods

Commits.prototype.hash = function hash(line) {
    return line.trim();
};

Commits.prototype.author = function author(line) {
    var match,
        author = { name: '', email: '' };

    line = line.replace('Author:', '').trim();
    match = line.match(/(.*)\s\<(.*)\>/);

    if(match) {
        author.name = match[1];
        author.email = match[2];
    }
    return author;
};

Commits.prototype.date = function date(line) {
    return line.replace('Date:', '').trim();
};

Commits.prototype.message = function message(text) {
    return text;
};


