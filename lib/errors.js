var OperationError = function OperationError (message) {
  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  this.message = message;
  this.name = 'OperationError';
};

OperationError.prototype.__proto__ = Error.prototype;

module.exports = {
    OperationError: OperationError
};
