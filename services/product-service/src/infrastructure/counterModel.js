const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  { _id: String, seq: { type: Number, default: 0 } },
  { collection: 'counters', versionKey: false }
);

module.exports = mongoose.model('Counter', counterSchema);