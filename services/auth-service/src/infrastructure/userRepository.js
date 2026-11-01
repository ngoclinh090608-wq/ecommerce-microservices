const prisma = require('./prisma');

module.exports = {
  findByUsername: (username) =>
    prisma.user.findUnique({ where: { username }, include: { role: true } }),

  findRoleByName: (rolename) => prisma.role.findUnique({ where: { rolename } }),

  create: (data) => prisma.user.create({ data }),

  upsertRole: (rolename) =>
    prisma.role.upsert({ where: { rolename }, update: {}, create: { rolename } }),
};