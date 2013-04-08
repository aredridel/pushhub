var url = require('url');

function refs(req) {
  if (req.method !== 'GET') return false;

  var u = url.parse(req.url);
  return !!(u.pathname.match(/\/(.+)\/info\/refs$/));
}

function head(req) {
  if (req.method !== 'GET') return false;

  var u = url.parse(req.url);
  return !!(u.pathname.match(/^\/(.+)\/HEAD$/));
}

function push(req) {
  if (req.method !== 'POST') return false;

  return !!(req.url.match(/\/(.+)\/git-(.+)/));
}

module.exports = function(server) {
  return function(req, res, next) {
    if([refs, head, push].some(function(fn) { return fn(req);})) {
      server.handle(req, res);
    } else {
      next();
    }
  }
};