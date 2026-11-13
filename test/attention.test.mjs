import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpeechAttention } from '../critter-attention.mjs';

const on = { enabled: true, speaking: true, steady: false };
const quiet = { enabled: true, speaking: false };

test('speech pauses progress through hold, acknowledgment, waiting and rest', () => {
  const attention = new SpeechAttention();
  attention.update(0, on);
  attention.update(1200, on);
  for (const [time, state] of [[1500, 'holding'], [2200, 'acknowledging'], [4200, 'waiting'], [8200, 'resting']]) {
    attention.update(time, quiet);
    assert.equal(attention.state, state);
  }
});

test('sustained sound gets a thoughtful response and returning speech interrupts rest smoothly', () => {
  const attention = new SpeechAttention();
  attention.update(0, on);
  attention.update(1400, { ...on, steady: true });
  assert.equal(attention.state, 'considering');
  for (let t = 1500; t < 15000; t += 16) attention.update(t, quiet);
  const before = { ...attention.pose };
  const after = attention.update(15000, on);
  assert.equal(attention.state, 'listening');
  assert.ok(Math.abs(after.pitch - before.pitch) < 0.2);
  assert.ok(after.open > 0.5);
});

test('quiet behavior varies, remains finite, and mic-off clears conversation history', () => {
  const attention = new SpeechAttention();
  const poses = new Set();
  for (let time = 0; time < 120000; time += 50) {
    const pose = attention.update(time, quiet);
    assert.ok(Object.values(pose).every(Number.isFinite));
    assert.ok(pose.squash > 0.8 && pose.squash < 1.2);
    poses.add(JSON.stringify(pose));
  }
  assert.ok(poses.size > 100);
  assert.equal(attention.update(120000, { enabled: false }), null);
  assert.equal(attention.state, 'off');
  assert.equal(attention.lastVoice, null);
});
