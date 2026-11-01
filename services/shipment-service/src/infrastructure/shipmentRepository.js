const Shipment = require('./shipmentModel');
const Counter = require('./counterModel');
const InvalidEvent = require('./invalidEventModel');

const toPlain = (d) => (d ? { shipid: d.shipid, oid: d.oid, status: d.status } : null);

async function nextShipid() {
  const c = await Counter.findOneAndUpdate(
    { _id: 'shipment' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  ).lean();
  return c.seq;
}

module.exports = {
  async findById(shipid) {
    return toPlain(await Shipment.findOne({ shipid }).lean());
  },

  async findByOid(oid) {
    return toPlain(await Shipment.findOne({ oid }).lean());
  },

  // Idempotent: mỗi oid chỉ có một shipment
  async createForOrder(oid) {
    const existing = await Shipment.findOne({ oid }).lean();
    if (existing) return { created: false, shipment: toPlain(existing) };
    const shipid = await nextShipid();
    try {
      const doc = await Shipment.create({ shipid, oid, status: 'PENDING' });
      return { created: true, shipment: toPlain(doc) };
    } catch (e) {
      if (e.code === 11000) {
        return { created: false, shipment: toPlain(await Shipment.findOne({ oid }).lean()) };
      }
      throw e;
    }
  },

  // Chỉ cập nhật nếu trạng thái vẫn là fromStatus (chống ghi đè khi cập nhật đồng thời)
  async updateStatusIf(shipid, fromStatus, toStatus) {
    return toPlain(
      await Shipment.findOneAndUpdate(
        { shipid, status: fromStatus },
        { $set: { status: toStatus } },
        { returnDocument: 'after' }
      ).lean()
    );
  },

  recordInvalidEvent: (data) => InvalidEvent.create(data),
};