const repo = require('../infrastructure/customerRepository');

const TIERS = [
  ['Standard', 0],
  ['Silver', 100],
  ['Gold', 500],
  ['Platinum', 1000],
];

async function bootstrap() {
  for (const [name, score] of TIERS) {
    await repo.upsertMembership(name, score);
  }
}

module.exports = { bootstrap };