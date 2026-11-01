const repo = require('../infrastructure/productRepository');
const { invalid, notFound, failedPrecondition } = require('../domain/errors');
const { validateProductInput, validateProductPatch, normalizeStockItems } = require('../domain/validation');
function requirePid(pid) {
  if (!Number.isInteger(pid) || pid < 1) throw invalid('invalid pid');
}

async function listProducts() {
  return { items: await repo.list() };
}

async function getProduct({ pid }) {
  requirePid(pid);
  const p = await repo.findByPid(pid);
  if (!p) throw notFound('Product not found');
  return p;
}

async function createProduct(input) {
  return repo.create(validateProductInput(input));
}

async function updateProduct({ pid, update_mask, ...rest }) {
  requirePid(pid);
  const mask = Array.isArray(update_mask) ? update_mask : [];
  const data = mask.length ? validateProductPatch(rest, mask) : validateProductInput(rest);
  const p = await repo.replace(pid, data);
  if (!p) throw notFound('Product not found');
  return { pid, message: 'Product updated successfully' };
}

async function deleteProduct({ pid }) {
  requirePid(pid);
  if (!(await repo.remove(pid))) throw notFound('Product not found');
  return { pid, message: 'Product deleted successfully' };
}

async function reserveStock({ items }) {
  const wanted = normalizeStockItems(items);
  const done = [];
  const reserved = [];
  try {
    for (const { pid, qty } of wanted) {
      const after = await repo.decrementIfEnough(pid, qty);
      if (!after) {
        if (!(await repo.findByPid(pid))) throw notFound(`Product ${pid} not found`);
        throw failedPrecondition(`Insufficient stock for product ${pid}`);
      }
      done.push({ pid, qty });
      reserved.push({ pid, qty, unit_price: after.price });
    }
    return { items: reserved };
  } catch (e) {
    // Bù trừ: hoàn lại những món đã trừ trước khi gặp lỗi
    for (const d of done) {
      try {
        await repo.increment(d.pid, d.qty);
      } catch (err) {
        console.error('[product] FAILED to roll back stock for pid', d.pid, 'qty', d.qty, err.message);
      }
    }
    throw e;
  }
}

async function releaseStock({ items }) {
  const wanted = normalizeStockItems(items);
  for (const { pid, qty } of wanted) {
    await repo.increment(pid, qty); // sản phẩm đã bị xóa thì bỏ qua (trả null)
  }
  return {};
}

module.exports = {
  listProducts, getProduct, createProduct, updateProduct, deleteProduct, reserveStock, releaseStock,
};