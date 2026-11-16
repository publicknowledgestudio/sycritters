import test from 'node:test';
import assert from 'node:assert/strict';
import { PET_DURATION, petPose } from '../critter-petting.mjs';

test('petting eases in and out, stays gentle, and terminates', () => {
  const start = petPose(0);
  assert.equal(start.open, 1);
  assert.equal(start.squash, 1);
  assert.equal(start.roll, 0);
  assert.equal(petPose(-1), null);
  assert.equal(petPose(PET_DURATION), null);
  let left = false, right = false;
  for (let elapsed = 0; elapsed < PET_DURATION; elapsed += 10) {
    const pose = petPose(elapsed);
    assert.ok(pose.open >= .29 && pose.open <= 1);
    assert.ok(pose.squash >= .94 && pose.squash <= 1);
    assert.ok(Math.abs(pose.roll) <= .1);
    left ||= pose.roll < -.01;
    right ||= pose.roll > .01;
  }
  assert.ok(left && right, 'reaction follows both strokes');
  const end = petPose(PET_DURATION - .001);
  assert.ok(Math.abs(end.squash - 1) < 1e-8);
  assert.ok(Math.abs(end.open - 1) < 1e-8);
});
