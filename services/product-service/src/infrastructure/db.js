const mongoose = require('mongoose');
const config = require('../config');
const Product = require('./productModel');

async function connect() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await Product.init(); // bảo đảm chỉ mục unique của pid đã được tạo
}

module.exports = { connect, disconnect: () => mongoose.disconnect() };