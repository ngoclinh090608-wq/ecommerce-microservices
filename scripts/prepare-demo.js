const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.join(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PRODUCT_NAME = 'Prompt 3 Demo - 100';

function apiClient(base) {
  return async (method, route, { token, body } = {}) => {
    const response = await fetch(base + route, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(`${method} ${route}: HTTP ${response.status} ${data.message || ''}`);
      error.status = response.status;
      throw error;
    }
    return data;
  };
}

async function prepareDemo({ api, admin, demo, goldMid, resetStock = false, pause = sleep }) {
  const adminLogin = await api('POST', '/api/auth/login', { body: admin });
  const token = adminLogin.accessToken;
  try {
    await api('POST', '/api/auth/register', { body: demo });
  } catch (error) {
    if (error.status !== 409) throw error;
  }
  // Login verifies that an existing account is really ours; never reset its password.
  const memberLogin = await api('POST', '/api/auth/login', { body: demo });
  const uid = Number(JSON.parse(Buffer.from(memberLogin.accessToken.split('.')[1], 'base64url')).sub);
  if (!Number.isInteger(uid) || uid < 1) throw new Error('Login returned an invalid user ID');
  let customer;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { customer = await api('GET', `/api/customers/${uid}`, { token }); break; }
    catch (error) { if (error.status !== 404) throw error; }
    await pause(1000);
  }
  if (!customer) throw new Error('Customer profile not created within 30s; inspect user-registered Kafka delivery.');
  // Allow the Gold ID to be configured for an existing database; verify its name/score.
  if (customer.mname !== 'Gold' || customer.score !== 500) {
    if (!Number.isInteger(goldMid) || goldMid < 1) throw new Error('Set DEMO_GOLD_MID to the Gold membership ID (fresh database: 3).');
    await api('PUT', `/api/customers/${uid}`, { token, body: { mid: goldMid } });
    customer = await api('GET', `/api/customers/${uid}`, { token });
  }
  if (customer.mname !== 'Gold' || customer.score !== 500) throw new Error('Selected membership is not Gold with score 500');
  const products = await api('GET', '/api/products', { token });
  const matches = products.items.filter((p) => p.pname === PRODUCT_NAME);
  if (matches.length > 1) throw new Error('Multiple demo products found; resolve duplicate names before preparing the demo.');
  let product = matches[0];
  if (!product) product = await api('POST', '/api/products', { token, body: { pname: PRODUCT_NAME, price: 100, quantity: 20 } });
  else if (resetStock || product.price !== 100) {
    await api('PUT', `/api/products/${product.pid}`, { token, body: { price: 100, ...(resetStock ? { quantity: 20 } : {}) } });
    product = await api('GET', `/api/products/${product.pid}`, { token });
  }
  if (product.quantity < 3) throw new Error('Demo stock below 3. Run again with --reset-stock only when no concurrent orders are running.');
  return { uid, pid: product.pid, quantity: product.quantity };
}

async function main() {
  require('../api-gateway/node_modules/dotenv').config({ path: path.join(root, '.env'), quiet: true });
  if (!process.env.ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD is required in the root .env or process environment');
  const base = process.env.GATEWAY_URL || 'http://localhost:3000';
  const result = await prepareDemo({
    api: apiClient(base),
    admin: { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD },
    demo: { username: process.env.DEMO_USERNAME || 'demo_gold', password: process.env.DEMO_PASSWORD || 'Demo@12345' },
    goldMid: Number(process.env.DEMO_GOLD_MID || 3),
    resetStock: process.argv.includes('--reset-stock'),
  });
  const environment = { name: 'Prompt 3 local (generated IDs)', values: Object.entries({ baseUrl: base, demoUid: result.uid, demoPid: result.pid }).map(([key, value]) => ({ key, value: String(value), enabled: true })), _postman_variable_scope: 'environment' };
  await fs.writeFile(path.join(root, 'postman/demo.local.postman_environment.json'), JSON.stringify(environment, null, 2) + '\n');
  console.log(`Demo ready: Customer uid=${result.uid}, Gold score=500; Product pid=${result.pid}, price=100, quantity=${result.quantity}.`);
  console.log('Import postman/prompt3.postman_collection.json and postman/demo.local.postman_environment.json. No tokens were saved.');
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { apiClient, prepareDemo };
