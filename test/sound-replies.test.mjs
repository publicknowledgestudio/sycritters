import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function microphone() {
  const listening = html.slice(html.indexOf('  function setListening('), html.indexOf('  function stopMic('));
  const sampling = html.slice(html.indexOf('  function sampleMic('), html.indexOf('  micButton.addEventListener("click", startMic)'));
  const state = vm.createContext({
    listening: false, voiceStartedAt: null, volume: .03,
    micSession: { context: { state: 'running' }, samples: new Float32Array(64), lastVoice: -Infinity, onset: null, noiseFloor: .0015 },
    micButton: { dataset: {} }, micStatus: {}, micLevel: {},
    soundPreview: { paused: true }, soundGuardUntil: -Infinity,
    spokenReplies: { checked: true }, replies: [], sounds: [],
    sayReply(automatic, time) { state.replies.push({ automatic, time }); },
    autoSound(name) { state.sounds.push(name); },
  });
  state.micSession.analyser = { getFloatTimeDomainData(samples) { samples.fill(state.volume); } };
  vm.runInContext(listening + sampling, state);
  return state;
}
function speak(state) { for (let time = 0; time <= 1000; time += 50) state.sampleMic(time); state.volume = 0; }
test('a sustained utterance produces one reply after a pause, never repeatedly in silence', () => {
  const state = microphone();
  speak(state);
  state.sampleMic(1500);
  assert.equal(state.replies.length, 0);
  state.sampleMic(1950);
  state.sampleMic(5000);
  assert.equal(state.replies.length, 1);
  assert.equal(state.replies[0].automatic, true);
});
test('short sounds and the critter’s own speech do not trigger replies', () => {
  const state = microphone();
  state.sampleMic(0); state.sampleMic(60); state.volume = 0; state.sampleMic(1000);
  assert.equal(state.replies.length, 0);
  state.soundPreview.paused = false; state.volume = .04;
  for (let time = 1100; time < 4000; time += 100) state.sampleMic(time);
  assert.equal(state.listening, false);
  assert.equal(state.replies.length, 0);
});
test('disabling spoken replies preserves creature-noise acknowledgments', () => {
  const state = microphone(); state.spokenReplies.checked = false;
  speak(state); state.sampleMic(1950);
  assert.equal(state.replies.length, 0);
  assert.equal(state.sounds.length, 1);
});
test('all six new sound controls reference valid nonempty PCM WAV files', () => {
  const names = [...html.matchAll(/data-sound="([^"]+)" data-format="wav"/g)].map(match => match[1]);
  assert.equal(names.length, 6);
  for (const name of names) {
    const audio = readFileSync(new URL(`../sounds/${name}.wav`, import.meta.url));
    assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
    assert.equal(audio.toString('ascii', 8, 12), 'WAVE');
    assert.ok(audio.length > 1000);
  }
});

test('all five bundled spoken replies are valid audio files', () => {
  for (let index = 0; index < 5; index++) {
    const audio = readFileSync(new URL(`../sounds/reply-${index}.wav`, import.meta.url));
    assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
    assert.ok(audio.length > 10000);
  }
});
