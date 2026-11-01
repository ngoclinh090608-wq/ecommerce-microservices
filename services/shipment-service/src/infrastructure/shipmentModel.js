const mongoose = require('mongoose');
const { STATUSES } = require('../domain/statusPolicy');

const schema = new mongoose.Schema(
  {
    shipid: { type: Number, required: true, unique: true },
    oid: { type: Number, required: true, unique: true },
    status: { type: String, required: true, enum: STATUSES, default: 'PENDING' },
  },
  { collection: 'shipments', versionKey: false, timestamps: true }
);

module.exports = mongoose.model('Shipment', schema);