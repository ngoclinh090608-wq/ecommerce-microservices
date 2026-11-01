const { invalid } = require('./errors');

const MAX_LINES = 50;

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw invalid('items must not be empty');
  if (items.length > MAX_LINES) throw invalid(`an order can have at most ${MAX_LINES} lines`);
  const merged = new Map();
  for (const it of items) {
    if (!Number.isInteger(it.pid) || it.pid < 1) throw invalid('invalid pid');
    if (!Number.isInteger(it.qty) || it.qty < 1) throw invalid('qty must be an integer >= 1');
    merged.set(it.pid, (merged.get(it.pid) || 0) + it.qty);
  }
  return [...merged].map(([pid, qty]) => ({ pid, qty }));
}

module.exports = { normalizeItems };