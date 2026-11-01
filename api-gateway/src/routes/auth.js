const router = require('express').Router();
const { rpc } = require('../clients/grpcClients');
const wrap = require('../lib/wrap');
const v = require('../lib/validate');

router.post('/register', wrap(async (req, res) => {
  const b = v.body(req);
  const r = await rpc('auth', 'Register', {
    username: v.text(b.username, 'username', { min: 3, max: 50 }),
    password: v.text(b.password, 'password', { min: 1, max: 72 }),
    email: v.optionalText(b.email, 'email', 100),
    phone: v.optionalText(b.phone, 'phone', 20),
  });
  res.status(201).json({ message: r.message, uid: r.uid });
}));

router.post('/login', wrap(async (req, res) => {
  const b = v.body(req);
  const r = await rpc('auth', 'Login', {
    username: v.text(b.username, 'username', { min: 1, max: 50 }),
    password: v.text(b.password, 'password', { min: 1, max: 72 }),
  });
  res.json({ accessToken: r.access_token, tokenType: r.token_type, expiresIn: r.expires_in });
}));

module.exports = router;