const crypto = require('crypto');

function computeHash(prevHash, name, action, payload) {
  const data = prevHash + name + action + JSON.stringify(payload);
  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = { computeHash };