import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK_MOTIONS, blockMotion3D, blockPose3D } from '../critter-block-motion.mjs';

test('all seven block clips loop at rest, remain finite and move actual blocks', () => {
  assert.equal(BLOCK_MOTIONS.length, 7);
  for (const { name, period } of BLOCK_MOTIONS) {
    let moved = false;
    for (const [x, y, z] of [[-3.5, 7.5, -1.5], [2.5, 0.5, 1.5], [1.5, 5.5, 0.5]]) {
      const rest = blockMotion3D(name, 0, x, y, z);
      assert.ok(Object.values(rest).every(value => Math.abs(value) < 1e-10), name);
      assert.deepEqual(blockMotion3D(name, period, x, y, z), rest, name);
      for (let i = 0; i <= 100; i++) {
        const offset = blockMotion3D(name, period * i / 100, x, y, z);
        for (const value of Object.values(offset)) assert.ok(Number.isFinite(value), name);
        moved ||= Object.values(offset).some(value => Math.abs(value) > 0.01);
        const pose = blockPose3D(name, period * i / 100);
        assert.ok(pose.squash > 0 && pose.open >= 0, name);
      }
    }
    assert.ok(moved, `${name} must animate blocks`);
  }
});

test('face columns stay intact and telescoping eyes follow the front surface', () => {
  for (const { name, period } of BLOCK_MOTIONS) {
    for (let i = 0; i < 100; i++) {
      const seconds = period * i / 100;
      const offset = blockMotion3D(name, seconds, 1.5, 4.5, 1.5, true);
      if (name === 'peek') assert.equal(offset.z, blockPose3D(name, seconds).faceDepth);
      else assert.deepEqual(offset, { x: 0, y: 0, z: 0, turn: 0 });
    }
  }
  assert.equal(blockMotion3D('none', 1, 0, 0, 0), null);
  assert.equal(blockPose3D('none', 1), null);
});
