const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = path.join(__dirname, '../services/customer-service/src');
const repoPath = require.resolve(path.join(base, 'infrastructure/customerRepository'));
let row = null;
let writes = 0;
require.cache[repoPath] = { id: repoPath, filename: repoPath, loaded: true, exports: {
  findByUid: async () => row,
  createIfAbsent: async () => { writes++; },
} };
const { getMembership } = require(path.join(base, 'application/customerService'));
test('missing membership returns NOT_FOUND without creating a profile', async () => {
  row = null;
  await assert.rejects(getMembership({ uid: 123 }), (e) => e.code === 5);
  assert.equal(writes, 0);
});
test('existing Gold membership is returned unchanged', async () => {
  row = { uid: 123, mid: 9, membership: { mname: 'Gold', score: 500 } };
  assert.deepEqual(await getMembership({ uid: 123 }), { uid: 123, mid: 9, mname: 'Gold', score: 500 });
});
