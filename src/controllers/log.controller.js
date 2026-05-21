const pool = require('../db/index');
const { computeHash } = require('../utils/hash');
const { v4: uuidv4 } = require('uuid');
const pino = require('pino');

const logger = pino({ transport: { target: 'pino-pretty' } });

//fetch the last hash, computes a new one and inserts the row
async function addLog(req, res) {
  const { name, action, payload } = req.body;
  if (!name || !action) {
    return res.status(400).json({ error: 'name and action are required' });
  }

  try {
    // fetch the most recent entry so we can grab its hash as the previous hash
    const lastEntry = await pool.query(
      'SELECT hash FROM logs ORDER BY id DESC LIMIT 1'
    );

    // if this is the very first entry then prevHash is empty string
    const prevHash = lastEntry.rows.length > 0 ? lastEntry.rows[0].hash : '';

    // compute the new hash by combining prevHash with current entry data
    const hash = computeHash(prevHash, name, action, payload || {});

    const result = await pool.query(
      `INSERT INTO logs (name, action, payload, hash, prev_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, action, payload || {}, hash, prevHash]
    );

    logger.info({ id: result.rows[0].id, action }, 'new log entry added to chain');

    return res.status(201).json(result.rows[0]);

  } catch (err) {
    logger.error(err, 'something went wrong while adding log entry');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Also recomputes the hash on the fly to tell the caller if this entry is still valid
async function getLog(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM logs WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    const entry = result.rows[0];

    // recompute the hash from the stored data and compare it with what we saved
    const expectedHash = computeHash(
      entry.prev_hash,
      entry.name,
      entry.action,
      entry.payload
    );

    const isValid = expectedHash === entry.hash;

    // return the entry along with a chain_valid flag so caller knows the status
    return res.status(200).json({
      ...entry,
      chain_valid: isValid
    });

  } catch (err) {
    logger.error(err, 'something went wrong while fetching log entry');
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Verify the entire chain from first entry to last
async function verifyChain(req, res) {
  try {
    const result = await pool.query('SELECT * FROM logs ORDER BY id ASC');
    const entries = result.rows;

    if (entries.length === 0) {
      return res.status(200).json({ status: 'pass', message: 'No entries yet' });
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // recompute hash for this entry using its stored data
      const expectedHash = computeHash(
        entry.prev_hash,
        entry.name,
        entry.action,
        entry.payload
      );

      // if recomputed hash does not match stored hash, data was tampered
      if (expectedHash !== entry.hash) {
        return res.status(200).json({
          status: 'fail',
          first_broken_entry_id: entry.id,
          message: `chain is broken at entry id ${entry.id}, data may have been tampered`
        });
      }

      // check if the prev_hash of the current entry must exactly match the hash of the previous entry
      if (i > 0 && entry.prev_hash !== entries[i - 1].hash) {
        return res.status(200).json({
          status: 'fail',
          first_broken_entry_id: entry.id,
          message: `chain link is broken at entry id ${entry.id}, prev_hash does not match`
        });
      }
    }

    // if we reach here all entries passed verification
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

// Export logs with optional filters
// Supports filtering by date range and also by name by calling params
// All filters are optional so calling without any params returns everything
async function exportLogs(req, res) {
  const { from, to, name } = req.query;

  try {
    // start with a base query and dynamically append conditions as needed
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