 
const pool = require('./index');

async function migrate() {
  const query = `
    CREATE TABLE IF NOT EXISTS logs (
      id        SERIAL PRIMARY KEY,
      name      TEXT NOT NULL,
      action    TEXT NOT NULL,
      payload   JSONB,
      hash      TEXT NOT NULL,
      prev_hash TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    await pool.query(query);
    console.log('Migration done - logs table ready');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();