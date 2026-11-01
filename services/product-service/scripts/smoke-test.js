
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { validateProductInput } = require('../src/domain/validation');

const def = protoLoader.loadSync(
  path.join(__dirname, '..', '..', '..', 'shared', 'proto', 'product.proto'),
  { keepCase: true, longs: Number, enums: String, defaults: true, oneofs: true }
);

const proto = grpc.loadPackageDefinition(def).ecommerce.product;
const client = new proto.ProductService('localhost:50053', grpc.credentials.createInsecure());
const call = (m, req) => new Promise((r) => client[m](req, (err, res) => r({ err, res })));
const code = (r) => r.err && r.err.code;

let failed = 0;

function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
  if (!cond) failed++;
}

(async () => {
  const tag = `smoke-${Date.now()}`;
  const created = [];

  // 1. CREATE PRODUCT
  let r = await call('CreateProduct', {
    pname: `${tag}-A`,
    price: 1500,
    quantity: 10
  });

  check('create product', !r.err && r.res.pid > 0 && r.res.quantity === 10);

  const A = r.res && r.res.pid;
  created.push(A);

  r = await call('CreateProduct', {
    pname: `${tag}-B`,
    price: 25,
    quantity: 5
  });

  const B = r.res && r.res.pid;
  created.push(B);

  check('pid auto-increments by 1', B === A + 1, `A=${A} B=${B}`);

  // 2. VALIDATION
  r = await call('CreateProduct', {
    pname: `${tag}-bad`,
    price: -1,
    quantity: 5
  });

  check('negative price -> INVALID_ARGUMENT',
    code(r) === grpc.status.INVALID_ARGUMENT);

  r = await call('CreateProduct', {
    pname: `${tag}-bad`,
    price: 10,
    quantity: -5
  });

  check('negative quantity -> INVALID_ARGUMENT',
    code(r) === grpc.status.INVALID_ARGUMENT);

  // Kiểm tra so thap phan truc tiep tai tang Domain
  // gRPC int32 co the chuyen 1.5 thanh 1 truoc khi gui
  let fractionalRejected = false;

  try {
    validateProductInput({
      pname: `${tag}-bad`,
      price: 10,
      quantity: 1.5
    });
  } catch (e) {
    fractionalRejected = e.code === grpc.status.INVALID_ARGUMENT;
  }

  check('fractional quantity rejected by domain validation',
    fractionalRejected);

  r = await call('CreateProduct', {
    pname: '   ',
    price: 10,
    quantity: 1
  });

  check('blank name -> INVALID_ARGUMENT',
    code(r) === grpc.status.INVALID_ARGUMENT);

  // 3. GET PRODUCT
  r = await call('GetProduct', { pid: A });

  check('TC-PRO-02 get product',
    !r.err && r.res.pname === `${tag}-A` && r.res.price === 1500);

  r = await call('GetProduct', { pid: 99999999 });

  check('TC-PRO-03 unknown product -> NOT_FOUND',
    code(r) === grpc.status.NOT_FOUND);

  // 4. LIST PRODUCTS
  r = await call('ListProducts', {});

  check('TC-PRO-01 list contains created products',
    !r.err && [A, B].every(
      (id) => r.res.items.some((p) => p.pid === id)
    )
  );

  // 5. UPDATE PRODUCT
  r = await call('UpdateProduct', {
    pid: A,
    pname: `${tag}-A`,
    price: 1500,
    quantity: 15
  });

  check('TC-PRO-05 update quantity', !r.err);

  r = await call('GetProduct', { pid: A });

  check('update persisted (quantity 15)',
    r.res && r.res.quantity === 15);

      r = await call('UpdateProduct', { pid: A, price: 1234.5, update_mask: ['price'] });
      check('partial update by mask succeeds', !r.err);
      r = await call('GetProduct', { pid: A });
      check('partial update changed only price', r.res && r.res.price === 1234.5 && r.res.quantity === 15 && r.res.pname === `${tag}-A`);
      r = await call('UpdateProduct', { pid: A, price: 1500, update_mask: ['price'] });
      r = await call('UpdateProduct', { pid: A, price: 1500, update_mask: ['colour'] });
      check('unknown field in update_mask -> INVALID_ARGUMENT', code(r) === grpc.status.INVALID_ARGUMENT);

  r = await call('UpdateProduct', {
    pid: 99999999,
    pname: 'x',
    price: 1,
    quantity: 1
  });

  check('update unknown -> NOT_FOUND',
    code(r) === grpc.status.NOT_FOUND);

  // 6. RESERVE STOCK
  r = await call('ReserveStock', {
    items: [{ pid: A, qty: 3 }]
  });

  check('reserve 3 -> returns unit_price',
    !r.err &&
    r.res.items[0].unit_price === 1500 &&
    r.res.items[0].qty === 3);

  r = await call('GetProduct', { pid: A });

  check('stock decreased 15 -> 12',
    r.res && r.res.quantity === 12);

  // 7. INSUFFICIENT STOCK
  r = await call('ReserveStock', {
    items: [{ pid: A, qty: 999 }]
  });

  check('TC-ORD-03 insufficient -> FAILED_PRECONDITION',
    code(r) === grpc.status.FAILED_PRECONDITION);

  r = await call('GetProduct', { pid: A });

  check('stock unchanged after failed reserve',
    r.res && r.res.quantity === 12);

  r = await call('ReserveStock', {
    items: [{ pid: 99999999, qty: 1 }]
  });

  check('reserve unknown -> NOT_FOUND',
    code(r) === grpc.status.NOT_FOUND);

  r = await call('ReserveStock', {
    items: [{ pid: A, qty: 0 }]
  });

  check('reserve qty 0 -> INVALID_ARGUMENT',
    code(r) === grpc.status.INVALID_ARGUMENT);

  // 8. ROLLBACK
  r = await call('ReserveStock', {
    items: [
      { pid: A, qty: 1 },
      { pid: B, qty: 9999 }
    ]
  });

  check('multi-item with one short -> FAILED_PRECONDITION',
    code(r) === grpc.status.FAILED_PRECONDITION);

  r = await call('GetProduct', { pid: A });

  check('rollback: first item stock restored (12)',
    r.res && r.res.quantity === 12);

  // 9. DUPLICATE PID
  r = await call('ReserveStock', {
    items: [
      { pid: A, qty: 1 },
      { pid: A, qty: 1 }
    ]
  });

  check('duplicate pid lines are merged',
    !r.err &&
    r.res.items.length === 1 &&
    r.res.items[0].qty === 2);

  r = await call('GetProduct', { pid: A });

  check('stock 12 -> 10 after merged reserve',
    r.res && r.res.quantity === 10);

  // 10. RELEASE STOCK
  r = await call('ReleaseStock', {
    items: [{ pid: A, qty: 5 }]
  });

  check('release stock', !r.err);

  r = await call('GetProduct', { pid: A });

  check('stock 10 -> 15 after release',
    r.res && r.res.quantity === 15);

  // 11. CONCURRENCY TEST
  // 10 nguoi cung mua 1 san pham, ton kho chi co 5
  r = await call('CreateProduct', {
    pname: `${tag}-race`,
    price: 10,
    quantity: 5
  });

  const R = r.res && r.res.pid;
  created.push(R);

  const results = await Promise.all(
    Array.from({ length: 10 }, () =>
      call('ReserveStock', {
        items: [{ pid: R, qty: 1 }]
      })
    )
  );

  const ok = results.filter((x) => !x.err).length;
  const rejected = results.filter(
    (x) => code(x) === grpc.status.FAILED_PRECONDITION
  ).length;

  check('concurrency: 10 buyers, stock 5 -> exactly 5 succeed',
    ok === 5 && rejected === 5,
    `ok=${ok} rejected=${rejected}`);

  r = await call('GetProduct', { pid: R });

  check('concurrency: final stock is 0, never negative',
    r.res && r.res.quantity === 0);

  // 12. DELETE PRODUCT
  r = await call('CreateProduct', {
    pname: `${tag}-del`,
    price: 1,
    quantity: 1
  });

  const D = r.res && r.res.pid;

  r = await call('DeleteProduct', { pid: D });

  check('delete product', !r.err);

  r = await call('GetProduct', { pid: D });

  check('deleted product -> NOT_FOUND',
    code(r) === grpc.status.NOT_FOUND);

  r = await call('DeleteProduct', { pid: D });

  check('delete again -> NOT_FOUND',
    code(r) === grpc.status.NOT_FOUND);

  // 13. CLEANUP
  for (const pid of created) {
    await call('DeleteProduct', { pid });
  }

  console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`);

  process.exit(failed === 0 ? 0 : 1);
})();
