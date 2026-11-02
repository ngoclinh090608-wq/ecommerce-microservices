const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.join(__dirname, '..');
const { config } = require('../api-gateway/node_modules/dotenv');
config({ path: path.join(root, '.env'), quiet: true });
const suites = [
  ['auth', 'services/auth-service', []],
  ['customer', 'services/customer-service', []],
  ['product', 'services/product-service', []],
  ['order', 'services/order-service', []],
  ['shipment', 'services/shipment-service', ['--e2e']],
  ['gateway', 'api-gateway', []],
];
const rows = [];
for (const [name, dir, args] of suites) {
  console.log(`Running ${name}...`);
  const result = spawnSync(process.execPath, ['scripts/smoke-test.js', ...args], {
    cwd: path.join(root, dir), encoding: 'utf8', env: process.env, timeout: 180000,
  });
  const output = (result.stdout || '') + (result.stderr || '');
  process.stdout.write(output);
  if (result.error) console.error(result.error.message);
  const passed = (output.match(/^PASS  /gm) || []).length;
  const failed = (output.match(/^FAIL  /gm) || []).length;
  rows.push({ suite: name, passed, failed, exitCode: result.status, signal: result.signal });
}
console.table(rows);
if (rows.some((r) => r.exitCode !== 0 || r.failed > 0 || r.passed === 0)) process.exitCode = 1;
