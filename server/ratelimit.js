'use strict';

function tooMany(res) {
  return res.status(429).json({
    error: { code: 'rate_limited', message: 'Too many attempts. Please try again in a minute.' },
  });
}

function rateLimit({ windowMs = 60000, max = 30 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'unknown';
    let entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (hits.size > 10000) {
      for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
    }
    if (entry.count > max) return tooMany(res);
    next();
  };
}

module.exports = { rateLimit };
