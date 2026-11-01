const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    reason: String,
    raw: String,
    topic: String,
    partition: Number,
    offset: String,
  },
  { collection: 'invalid_events', versionKey: false, timestamps: true }
);

module.exports = mongoose.model('InvalidEvent', schema);