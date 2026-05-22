const express = require('express');
const dotenv = require('dotenv');
const pino = require('pino');
const pool = require('./src/db/index');
const logRoutes = require('./src/routes/log.routes');

dotenv.config();

const app = express();
const logger = pino({ transport: { target: 'pino-pretty' } });

app.use(express.json());
app.use(logRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  logger.error(err, 'unhandled error');
  res.status(500).json({ error: 'Something went wrong' });
});

async function startServer() {
  let retries = 5;

  while (retries > 0) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS logs (
          id         SERIAL PRIMARY KEY,
          name       TEXT NOT NULL,
          action     TEXT NOT NULL,
          payload    JSONB,
          hash       TEXT NOT NULL,
          prev_hash  TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      logger.info('database migration complete');

      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        logger.info(`server is running on port ${PORT}`);
      });

      break;

    } catch (err) {
      retries -= 1;
      logger.warn(`database not ready, retrying in 3 seconds, attempts left: ${retries}`);

      if (retries === 0) {
        logger.error(err, 'failed to start server after all retries');
        process.exit(1);
      }

      await new Promise(res => setTimeout(res, 3000));
    }
  }
}

startServer();