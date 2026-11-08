'use strict';

const express = require('express');
const path = require('node:path');
const { createAuthRouter } = require('./routes/auth');
const { createBookingsRouter } = require('./routes/bookings');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function createApp({ db, now = () => new Date(), authRateLimit }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'self'; frame-ancestors 'none'"
    );
    next();
  });

  app.use(express.json({ limit: '32kb' }));

  // CSRF defense: mutating API requests must be same-origin JSON (with SameSite=Lax cookies).
  app.use('/api', (req, res, next) => {
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (mutating && !String(req.headers['content-type'] || '').includes('application/json')) {
      return res.status(415).json({
        error: {
          code: 'unsupported_media_type',
          message: 'Content-Type must be application/json for this request.',
        },
      });
    }
    next();
  });

  app.use('/api/auth', createAuthRouter({ db, now, authRateLimit }));
  app.use('/api', createBookingsRouter({ db, now }));

  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Endpoint not found.' } });
  });

  app.get('/favicon.ico', (req, res) => res.status(204).end());

  app.use(express.static(PUBLIC_DIR, { extensions: ['html'], index: 'index.html' }));

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } });
    }
    res.status(404).type('text/plain').send('Not found');
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({
        error: { code: 'invalid_json', message: 'Request body is not valid JSON.' },
      });
    }
    const status = err.status || 500;
    if (status >= 500) {
      console.error('[server error]', err);
    }
    const body = {
      error: {
        code: err.code || 'internal_error',
        message: status >= 500 ? 'Internal server error.' : err.message,
      },
    };
    if (err.fields) body.error.fields = err.fields;
    res.status(status).json(body);
  });

  return app;
}

module.exports = { createApp };
