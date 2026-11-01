const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const repo = require('../infrastructure/userRepository');
const events = require('../infrastructure/eventPublisher');
const { validateRegister } = require('../domain/validation');
const { invalid, unauthenticated, conflict } = require('../domain/errors');

const BCRYPT_COST = 10;
// hash giả để thời gian phản hồi không lộ việc username có tồn tại hay không
const DUMMY_HASH = bcrypt.hashSync('dummy-password-1', BCRYPT_COST);

async function register(input) {
  validateRegister(input);
  const role = await repo.findRoleByName('member');
  if (!role) throw new Error('role "member" is missing, bootstrap did not run');

  const hash = await bcrypt.hash(input.password, BCRYPT_COST);
  let user;
  try {
    user = await repo.create({
      username: input.username,
      email: input.email || null,
      phone: input.phone || null,
      password: hash,
      roleid: role.roleid,
    });
  } catch (e) {
    if (e.code === 'P2002') throw conflict('username or email already exists');
    throw e;
  }

  try {
    await events.publishUserRegistered({ uid: user.uid, username: user.username });
  } catch (e) {
    // Giới hạn đã biết của MVP: ghi DB và gửi event không cùng transaction
    console.error('[auth] failed to publish user-registered for uid', user.uid, e.message);
  }

  return { uid: user.uid, message: 'User registered successfully' };
}

async function login({ username, password }) {
  if (!username || !password) throw invalid('username and password are required');
  const user = await repo.findByUsername(username);
  const ok = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) throw unauthenticated('Invalid username or password');

  const token = jwt.sign({ sub: String(user.uid), role: user.role.rolename }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn,
  });
  return { access_token: token, token_type: 'Bearer', expires_in: config.jwtExpiresIn };
}

function verifyToken({ token }) {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return { valid: true, uid: Number(payload.sub), role: payload.role };
  } catch {
    return { valid: false, uid: 0, role: '' };
  }
}

module.exports = { register, login, verifyToken };