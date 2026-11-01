const Product = require('./productModel');
const Counter = require('./counterModel');

const toPlain = (d) => (d ? { pid: d.pid, pname: d.pname, price: d.price, quantity: d.quantity } : null);

async function nextPid() {
  const c = await Counter.findOneAndUpdate(
    { _id: 'product' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  ).lean();
  return c.seq;
}

module.exports = {
  async list() {
    const docs = await Product.find().sort({ pid: 1 }).lean();
    return docs.map(toPlain);
  },

  async findByPid(pid) {
    return toPlain(await Product.findOne({ pid }).lean());
  },

  async create(data) {
    const pid = await nextPid();
    return toPlain(await Product.create({ pid, ...data }));
  },

  async replace(pid, data) {
    return toPlain(
      await Product.findOneAndUpdate({ pid }, { $set: data }, { returnDocument: 'after', runValidators: true }).lean()
    );
  },

  async remove(pid) {
    const r = await Product.deleteOne({ pid });
    return r.deletedCount > 0;
  },

  // Một thao tác nguyên tử: chỉ trừ khi còn đủ hàng, trả về bản ghi SAU khi trừ (hoặc null)
  async decrementIfEnough(pid, qty) {
    return toPlain(
      await Product.findOneAndUpdate(
        { pid, quantity: { $gte: qty } },
        { $inc: { quantity: -qty } },
        { returnDocument: 'after' }
      ).lean()
    );
  },

  async increment(pid, qty) {
    return toPlain(
      await Product.findOneAndUpdate({ pid }, { $inc: { quantity: qty } }, { returnDocument: 'after' }).lean()
    );
  },
};