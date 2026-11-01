const { invalid } = require('./errors');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function validName(pname) {
  const name = (pname || '').trim();
  if (name.length < 1 || name.length > 100) throw invalid('pname must be 1-100 characters');
  return name;
}

function validPrice(price) {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 99999999.99) {
    throw invalid('price must be a number between 0 and 99999999.99');
  }
  return round2(price);
}

function validQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 0) throw invalid('quantity must be an integer >= 0');
  return quantity;
}

function validateProductInput({ pname, price, quantity }) {
  return { pname: validName(pname), price: validPrice(price), quantity: validQuantity(quantity) };
}

const PATCHABLE = { pname: validName, price: validPrice, quantity: validQuantity };

// Chỉ kiểm tra và trả về các trường có trong mask
function validateProductPatch(input, mask) {
  const data = {};
  for (const field of mask) {
    if (!PATCHABLE[field]) throw invalid(`unknown field in update_mask: ${field}`);
    data[field] = PATCHABLE[field](input[field]);
  }
  return data;
}

// Kiểm tra và gộp các dòng trùng pid
function normalizeStockItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw invalid('items must not be empty');
  const merged = new Map();
  for (const it of items) {
    if (!Number.isInteger(it.pid) || it.pid < 1) throw invalid('invalid pid');
    if (!Number.isInteger(it.qty) || it.qty < 1) throw invalid('qty must be an integer >= 1');
    merged.set(it.pid, (merged.get(it.pid) || 0) + it.qty);
  }
  return [...merged].map(([pid, qty]) => ({ pid, qty }));
}

module.exports = { validateProductInput, validateProductPatch, normalizeStockItems };