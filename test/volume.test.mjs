import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeVolume, VOLUME_FORMS } from '../critter-volume.mjs';
import { loadEngine } from './_engine.mjs';
const S = loadEngine();

test('native volumes are deterministic, deep, and vary along depth', () => {
  const forms = new Set();
  for (let i = 0; i < 60; i++) {
    const spec = S.generate(`volume-${i}`), eyes = S.rasterize(spec);
    const original = JSON.stringify({ spec, eyes });
    const volume = nativeVolume(spec, eyes);
    assert.deepEqual(volume, nativeVolume(spec, eyes));
    assert.equal(JSON.stringify({ spec, eyes }), original, 'pixel spec and grid stay unchanged');
    forms.add(volume.form);
    const slices = Array.from({ length: 8 }, (_, layer) => volume.masks.flat().map(mask => Number(Boolean(mask & (1 << layer)))).join(''));
    assert.ok(new Set(slices).size > 2, 'cross sections change through depth');
    assert.ok(slices.filter(slice => slice.includes('1')).length >= 6, 'solid body has real depth');
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const mask = volume.masks[row][col];
      assert.ok(Number.isInteger(mask) && mask >= 0 && mask <= 255);
      assert.equal(Boolean(volume.grid[row][col]), Boolean(mask));
      if (eyes[row][col] >= 2) {
        assert.equal(volume.grid[row][col], eyes[row][col]);
        assert.ok(mask & 128, 'eye retains a solid front backing');
      }
    }
  }
  assert.equal(forms.size, VOLUME_FORMS.length);
});

test('every body form is distinct and shape overrides modify the solid', () => {
  const spec = S.generate('native-shapes');
  const shapes = VOLUME_FORMS.map(form => JSON.stringify(nativeVolume(spec, S.rasterize(spec), form).masks));
  assert.equal(new Set(shapes).size, VOLUME_FORMS.length);
  for (const [key, values] of [['top', ['ears', 'notch']], ['bottom', ['legs', 'flat']], ['waist', ['straight', 'narrow']]]) {
    const masks = values.map(value => { const next = {...spec, [key]: value}; return JSON.stringify(nativeVolume(next, S.rasterize(next), 'orb').masks); });
    assert.notEqual(masks[0], masks[1], key);
  }
});
