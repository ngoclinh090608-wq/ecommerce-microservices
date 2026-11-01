const bcrypt = require('bcryptjs');
const config = require('../config');
const repo = require('../infrastructure/userRepository');

async function seedAccount({ username, password, email }, rolename) {
  if (!username || !password) return;

  if (await repo.findByUsername(username)) return;

  const role = await repo.findRoleByName(rolename);

  await repo.create({
    username,
    email: email || null,
    password: await bcrypt.hash(password, 10),
    roleid: role.roleid,
  });

  console.log(`[auth] seeded ${rolename} account:`, username);
}

async function bootstrap() {
  for (const name of ['admin', 'member', 'shipment_staff']) {
    await repo.upsertRole(name);
  }

  await seedAccount(config.admin, 'admin');
  await seedAccount(config.staff, 'shipment_staff');
}

module.exports = { bootstrap };