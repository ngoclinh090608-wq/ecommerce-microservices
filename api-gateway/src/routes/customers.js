const router = require('express').Router();
const { rpc } = require('../clients/grpcClients');
const { HttpError } = require('../lib/errors');
const wrap = require('../lib/wrap');
const v = require('../lib/validate');

function selfOrAdmin(user, uid) {
  if (user.role !== 'admin' && user.uid !== uid) throw new HttpError(403, 'Forbidden');
}

router.get('/:uid', wrap(async (req, res) => {
  const uid = v.intParam(req.params.uid, 'uid');
  selfOrAdmin(req.user, uid);
  const c = await rpc('customer', 'GetCustomer', { uid });
  res.json({ uid: c.uid, fullname: c.fullname, mid: c.mid, mname: c.mname, score: c.score });
}));

router.put('/:uid', wrap(async (req, res) => {
  const uid = v.intParam(req.params.uid, 'uid');
  selfOrAdmin(req.user, uid);
  const b = v.body(req);
  const fullname = b.fullname === undefined ? '' : v.text(b.fullname, 'fullname', { min: 1, max: 100 }).trim();
  const mid = b.mid === undefined ? 0 : v.posInt(b.mid, 'mid');
  if (!fullname && !mid) throw v.bad('Provide fullname and/or mid');
  const r = await rpc('customer', 'UpdateCustomer', {
    uid, fullname, mid,
    requester_uid: req.user.uid,
    requester_role: req.user.role,
  });
  res.json({ message: r.message, uid: r.uid });
}));

module.exports = router;