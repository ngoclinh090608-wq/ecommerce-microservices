const toCents = (n) => Math.round(Number(n) * 100);
const fromCents = (c) => c / 100;

function computeTotals(lines, discountPercent) {
  const gross = lines.reduce((sum, l) => sum + toCents(l.unit_price) * l.qty, 0);
  const net = Math.round((gross * (100 - discountPercent)) / 100);
  return { gross: fromCents(gross), total_amount: fromCents(net) };
}

module.exports = { computeTotals };