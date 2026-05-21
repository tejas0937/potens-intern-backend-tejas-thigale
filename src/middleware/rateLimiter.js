 const rateLimit = require('express-rate-limit');

const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests !' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = postLimiter;