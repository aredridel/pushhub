"use strict";

var processors = ['author', 'date'];
var EOL = '\n';

var Commits = module.exports = function Commits(source) {
    this.entries = source.split(/^commit\s(\w{40})/gm);
    this.store = [];
    this.parse();
};

Commits.prototype.get = function get(index) {
    return this.store[index];
};

Commits.prototype.len = function length() {
    return this.store.length;
};

Commits.prototype.last = function last() {
    return this.get(this.len() - 1);
};

Commits.prototype.head = function head() {
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
            var entry = this.last(),
                lines = text.split(EOL);
            lines.shift(); //Eliminate blank
            processors.forEach(function(processor) {
                var line = lines.shift();
                entry[processor] = this[processor](line);
            }, this);
            //TODO: Use four space parsing
            entry['message'] = lines.join('\n');
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


