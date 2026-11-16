import test from 'node:test';
import assert from 'node:assert/strict';
import { CURATED_CRITTERS, CURATED_TEMPLATES, curatedVolume } from '../critter-curated.mjs';
import { nativeVolume } from '../critter-volume.mjs';

test('eleven curated critters have unique, deterministic, depth-varying geometry', () => {
  assert.equal(CURATED_CRITTERS.length, 11);
  const signatures = new Set();
  for (const {id} of CURATED_CRITTERS) {
    const volume = curatedVolume(id);
    assert.deepEqual(volume, curatedVolume(id));
    assert.deepEqual(nativeVolume({}, [], `curated:${id}`), volume);
    signatures.add(JSON.stringify(volume.masks));
    const slices = Array.from({length:8},(_,i)=>volume.masks.flat().map(mask=>Number(Boolean(mask & (1<<i)))).join(''));
    assert.ok(new Set(slices).size >= (["ember", "minty", "pillar"].includes(id) ? 2 : 3), id);
    const eyeRow = volume.grid.findIndex(row=>row.includes(2));
    assert.ok(eyeRow >= 0);
    assert.equal(volume.grid[eyeRow].filter(cell=>cell===2).length, 4);
    for(let row=0;row<8;row++) for(let col=0;col<8;col++) {
      assert.equal(Boolean(volume.grid[row][col]), Boolean(volume.masks[row][col]), id);
      if(volume.grid[row][col]===2) assert.ok(volume.masks[row][col] & 128);
    }
  }
  assert.equal(signatures.size, 11);
});
test('new curated bodies are large solids without tiny appendages', () => {
  for(const id of ['loaf','barrel','wedge','boulder','pillar','duo','step','cushion']) {
    const {masks}=curatedVolume(id);
    const count=masks.flat().reduce((sum,mask)=>sum+mask.toString(2).replaceAll('0','').length,0);
    assert.ok(count>=240, `${id} occupies enough of the 512-cell volume: ${count}`);
    const rows=masks.filter(row=>row.some(Boolean));
    assert.ok(rows.length>=6,id);
    assert.ok(rows.every(row=>row.filter(Boolean).length>=4),id);
  }
  for(const id of ['sprout','snail','manta','mushroom','arch','bunny','crab','teapot','octopus','crescent','cloud','dino']) {
    assert.throws(()=>curatedVolume(id));
  }
});

test('reference-inspired critters preserve every front silhouette cell', () => {
  for (const [id, {rows, gap}] of Object.entries(CURATED_TEMPLATES)) {
    const {masks, grid} = curatedVolume(id);
    for(let row=0;row<8;row++) for(let col=0;col<8;col++) {
      assert.equal(Boolean(masks[row][col] & 128), rows[row][col]==='1', `${id} ${row},${col}`);
    }
    assert.equal(grid[3][1], 2);
    assert.equal(grid[3][3+gap], 2);
  }
});

for (const [id, depth] of [['ember', 6], ['minty', 5]]) test(`${id} has the same outline on every occupied depth layer`, () => {
  const {masks}=curatedVolume(id);
  if (id === "minty") {
    assert.equal(masks[0][0], 128);
    assert.equal(masks[0][7], 128);
    masks[0][0] = masks[0][7] = 0;
  }
  const slices=Array.from({length:8},(_,layer)=>masks.flat().map(mask=>Number(Boolean(mask & (1<<layer)))).join('')).filter(slice=>slice.includes('1'));
  assert.equal(slices.length,depth);
  assert.equal(new Set(slices).size,1);
});

test('Cross has broad arms and empty corners', () => {
  const {masks}=curatedVolume('pillar');
  for(const row of [0,1,6,7]) {
    for(const col of [0,1,6,7]) assert.equal(masks[row][col],0);
    for(const col of [2,3,4,5]) assert.ok(masks[row][col]);
  }
  for(const row of [2,3,4,5]) assert.ok(masks[row].every(Boolean));
});

test('Loaf has four cut front corners with the body retained behind them', () => {
  const {masks}=curatedVolume('loaf');
  for(const row of [1,6]) for(const col of [1,6]) {
    assert.equal(masks[row][col] & 128,0);
    assert.ok(masks[row][col] & 64);
  }
  assert.ok(masks[1][3] & 128);
  assert.ok(masks[3][1] & 128);
});
