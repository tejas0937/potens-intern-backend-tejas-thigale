const pool = require('../db/index');
const { computeHash } = require('../utils/hash');
const pino = require('pino');

const logger = pino({ transport: { target: 'pino-pretty' } });

async function addLog(req, res) {
  const { name, action, payload } = req.body;

  if (!name || !action) {
    return res.status(400).json({ error: 'name and action are required' });
  }

  try {
    const lastEntry = await pool.query(
      'SELECT hash FROM logs ORDER BY id DESC LIMIT 1'
    );

    // first entry gets an empty string as prev hash, everything else chains from the last one
    const prevHash = lastEntry.rows.length > 0 ? lastEntry.rows[0].hash : '';
    const safePayload = payload || {};

    const hash = computeHash(prevHash, name, action, safePayload);

    const result = await pool.query(
      `INSERT INTO logs (name, action, payload, hash, prev_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, action, JSON.stringify(safePayload), hash, prevHash]
    );

    logger.info({ id: result.rows[0].id, action }, 'new log entry added to chain');
    return res.status(201).json(result.rows[0]);

  } catch (err) {
    logger.error(err, 'something went wrong while adding log entry');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getLog(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM logs WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    const entry = result.rows[0];

    // recompute and compare, if someone touched the row this will not match
    const expectedHash = computeHash(
      entry.prev_hash,
      entry.name,
      entry.action,
      entry.payload
    );

    return res.status(200).json({
      ...entry,
      chain_valid: expectedHash === entry.hash
    });

  } catch (err) {
    logger.error(err, 'something went wrong while fetching log entry');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function verifyChain(req, res) {
  try {
    const result = await pool.query('SELECT * FROM logs ORDER BY id ASC');
    const entries = result.rows;

    if (entries.length === 0) {
      return res.status(200).json({ status: 'pass', message: 'No entries yet' });
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      const expectedHash = computeHash(
        entry.prev_hash,
        entry.name,
        entry.action,
        entry.payload
      );

      // hash mismatch means the row data was edited after insert
      if (expectedHash !== entry.hash) {
        return res.status(200).json({
          status: 'fail',
          first_broken_entry_id: entry.id,
          message: `chain is broken at entry id ${entry.id}, data may have been tampered`
        });
      }

      // prev_hash must match the actual hash of the previous row
      if (i > 0 && entry.prev_hash !== entries[i - 1].hash) {
        return res.status(200).json({
          status: 'fail',
          first_broken_entry_id: entry.id,
          message: `chain link is broken at entry id ${entry.id}, prev_hash does not match`
        });
      }
    }

    return res.status(200).json({
      status: 'pass',
      total_entries: entries.length,
      message: 'all entries verified, chain is fully intact'
    });

  } catch (err) {
    logger.error(err, 'something went wrong during chain verification');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function exportLogs(req, res) {
  const { from, to, name } = req.query;

  try {
    // build query dynamically based on whatever filters are passed
    let query = 'SELECT * FROM logs WHERE 1=1';
    const params = [];

    if (from) {
      params.push(from);
      query += ` AND created_at >= $${params.length}`;
    }

    if (to) {
      params.push(to);
      query += ` AND created_at <= $${params.length}`;
    }

    if (name) {
      params.push(name);
      query += ` AND name = $${params.length}`;
    }

    query += ' ORDER BY id ASC';

    const result = await pool.query(query, params);

    return res.status(200).json({
      total: result.rows.length,
      entries: result.rows
    });

  } catch (err) {
    logger.error(err, 'something went wrong during log export');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { addLog, getLog, verifyChain, exportLogs };