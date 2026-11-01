const { HttpError } = require('../lib/errors');

module.exports = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Forbidden'));