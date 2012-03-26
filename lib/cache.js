var Cache = module.exports = function Cache() {
    this.storage = {};
};

Cache.prototype.has = function(key) {
    return this.storage.hasOwnProperty(key);
};

Cache.prototype.len = function() {
    return Object.keys(this.storage).length;
};

Cache.prototype.get = function(key) {
    return this.storage[key];
};

Cache.prototype.del = function(key) {
    this.storage[key] = null;
};

Cache.prototype.store = function(key, value) {
    this.storage[key] = value;
};
