import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultLayout, makePrimary, reconcileLayout, GRID_COLS, GRID_ROWS } from './layout.ts';

const ids = (n: number) => Array.from({ length: n }, (_, k) => `c${k}`);

test('default layout fits the grid and does not overlap', () => {
  for (let n = 1; n <= 9; n++) {
    const layout = defaultLayout(ids(n));
    assert.equal(layout.length, n);
    const cells = new Set<string>();
    for (const it of layout) {
      assert.ok(it.x + it.w <= GRID_COLS, `n=${n} ${it.i} exceeds cols`);
      assert.ok(it.y + it.h <= GRID_ROWS, `n=${n} ${it.i} exceeds rows`);
      for (let x = it.x; x < it.x + it.w; x++)
        for (let y = it.y; y < it.y + it.h; y++) {
          const key = `${x},${y}`;
          assert.ok(!cells.has(key), `n=${n} overlap at ${key}`);
          cells.add(key);
        }
    }
  }
});

test('first camera is primary in 3-camera layout', () => {
  const [a, b, c] = defaultLayout(ids(3));
  assert.ok(a!.w * a!.h > b!.w * b!.h && a!.w * a!.h > c!.w * c!.h);
});

test('makePrimary swaps with the biggest tile', () => {
  const layout = defaultLayout(ids(3));
  const swapped = makePrimary(layout, 'c2');
  const c2 = swapped.find((it) => it.i === 'c2')!;
  const c0 = swapped.find((it) => it.i === 'c0')!;
  assert.deepEqual({ ...c2, i: 'x' }, { ...layout[0]!, i: 'x' });
  assert.deepEqual({ ...c0, i: 'x' }, { ...layout[2]!, i: 'x' });
});

test('reconcile drops removed cameras, resets when cameras are added', () => {
  const saved = makePrimary(defaultLayout(ids(3)), 'c1');
  assert.deepEqual(reconcileLayout(saved, ['c0', 'c1']).map((i) => i.i).sort(), ['c0', 'c1']);
  assert.deepEqual(reconcileLayout(saved, ids(4)), defaultLayout(ids(4)));
  assert.deepEqual(reconcileLayout(undefined, ids(2)), defaultLayout(ids(2)));
});
