var Cache = module.exports = function Cache() {
    this.storage = {};
};

Cache.prototype.has = function(key) {
    return !!this.storage[key];
};

Cache.prototype.get = function(key) {
    return this.storage[key];
};

Cache.prototype.flush = function(key) {
    this.storage[key] = null;
};

Cache.prototype.store = function(key, value) {
    this.storage[key] = value;
};
