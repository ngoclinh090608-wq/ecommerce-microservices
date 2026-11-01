const STATUSES = ['PENDING', 'SHIPPING', 'DELIVERED', 'CANCELLED'];

const NEXT = {
  PENDING: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

const isValidStatus = (s) => STATUSES.includes(s);
const canTransition = (from, to) => from === to || (NEXT[from] || []).includes(to);

module.exports = { STATUSES, isValidStatus, canTransition };