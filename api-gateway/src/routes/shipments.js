const router = require('express').Router();
const { rpc } = require('../clients/grpcClients');
const authorize = require('../middlewares/authorize');
const wrap = require('../lib/wrap');
const v = require('../lib/validate');

const pub = (s) => ({ shipid: s.shipid, oid: s.oid, status: s.status });

router.get('/:shipid', wrap(async (req, res) => {
  const shipid = v.intParam(req.params.shipid, 'shipid');
  const s = await rpc('shipment', 'GetShipment', { shipid });

  if (!['admin', 'shipment_staff'].includes(req.user.role)) {
    // Khách chỉ xem được shipment của đơn mình: Order Service trả 403 nếu không phải chủ đơn
    await rpc('order', 'GetOrder', {
      oid: s.oid,
      requester_uid: req.user.uid,
      requester_role: req.user.role,
    });
  }
  res.json(pub(s));
}));

router.patch('/:shipid/status', authorize('admin', 'shipment_staff'), wrap(async (req, res) => {
  const shipid = v.intParam(req.params.shipid, 'shipid');
  const b = v.body(req);
  const status = v.text(b.status, 'status', { min: 1, max: 20 });
  res.json(pub(await rpc('shipment', 'UpdateShipmentStatus', { shipid, status })));
}));

module.exports = router;