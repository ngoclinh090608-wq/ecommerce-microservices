const { invalid } = require('./errors');

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,50}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s]{9,20}$/;

function validateRegister({ username, password, email, phone }) {
  if (!username || !password) throw invalid('username and password are required');
  if (!USERNAME_RE.test(username)) throw invalid('username must be 3-50 chars: letters, digits, . _ -');
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw invalid('password must be 8-72 chars and contain letters and digits');
  }
  if (email && (email.length > 100 || !EMAIL_RE.test(email))) throw invalid('invalid email');
  if (phone && !PHONE_RE.test(phone)) throw invalid('invalid phone');
}

module.exports = { validateRegister };