const mongoose = require('mongoose');
const config = require('../config');
const Shipment = require('./shipmentModel');

async function connect() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await Shipment.init(); // bảo đảm chỉ mục unique của shipid và oid đã được tạo
}

module.exports = { connect, disconnect: () => mongoose.disconnect() };