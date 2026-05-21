const crypto = require('crypto');

function computeHash(prevHash, name, action, payload) {
  // sort the keys so JSON.stringify 
  const stablePayload = JSON.stringify(payload, Object.keys(payload).sort());
  const data = prevHash + name + action + stablePayload;
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = { computeHash };