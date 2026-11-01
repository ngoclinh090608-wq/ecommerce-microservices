const { HttpError } = require('./errors');

const bad = (message) => new HttpError(400, message);

function body(req) {
  const b = req.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw bad('Request body must be a JSON object');
  return b;
}

function text(value, field, { min = 1, max = 255 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) {
    throw bad(`${field} must be a string of ${min}-${max} characters`);
  }
  return value;
}

function optionalText(value, field, max = 255) {
  if (value === undefined || value === null) return '';
  return text(value, field, { min: 1, max });
}

function posInt(value, field) {
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) throw bad(`${field} must be a positive integer`);
  return value;
}

function intParam(value, field) {
  if (!/^[1-9][0-9]{0,9}$/.test(String(value)) || Number(value) > 2147483647) {
    throw bad(`${field} must be a positive integer`);
  }
  return Number(value);
}

function productName(value) {
  return text(value, 'pname', { min: 1, max: 100 }).trim();
}

function price(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 99999999.99) {
    throw bad('price must be a number between 0 and 99999999.99');
  }
  return value;
}

function quantity(value) {
  if (!Number.isInteger(value) || value < 0 || value > 2147483647) throw bad('quantity must be an integer >= 0');
  return value;
}

module.exports = { bad, body, text, optionalText, posInt, intParam, productName, price, quantity };