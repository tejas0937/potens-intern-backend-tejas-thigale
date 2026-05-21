 
const express = require('express');
const dotenv = require('dotenv');
const pino = require('pino');
const logRoutes = require('./src/routes/log.routes');

dotenv.config();

const app = express();
const logger = pino({ transport: { target: 'pino-pretty' } });

// parse incoming JSON request bodies
app.json());

// all our log routes are mounted here
app.use('/', logRoutes);

// handle routes that dont exist
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// global error handler, catches anything unexpected
app.use((err, req, res, next) => {
  logger.error(err, 'unhandled error');
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`server is running on port ${PORT}`);
});