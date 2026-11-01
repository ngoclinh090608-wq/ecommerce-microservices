const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const config = require('../config');
const { client } = require('../lib/redis');
const { HttpError } = require('../lib/errors');

function make(prefix, limit, extra = {}) {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    passOnStoreError: true, // Redis lỗi thì cho qua (fail-open)
    store: new RedisStore({ sendCommand: (...args) => client.sendCommand(args), prefix }),
    handler: (req, res, next, options) => {
      res.setHeader('Retry-After', String(Math.ceil(options.windowMs / 1000)));
      next(new HttpError(429, 'Too many requests, please try again later'));
    },
    ...extra,
  });
}

module.exports = {
  createGlobalLimiter: () =>
    make('rl:global:', config.rateLimit.globalMax, {
      skip: (req) => req.originalUrl.startsWith('/api/health'),
    }),
  createAuthLimiter: () => make('rl:auth:', config.rateLimit.authMax),
};