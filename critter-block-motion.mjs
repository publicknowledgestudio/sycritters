// Independent 3-D clips. All samples are offsets from immutable rest positions.
const TAU = Math.PI * 2;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const pulse = (t, a, b, c) => smooth((t - a) / (b - a)) * (1 - smooth((t - b) / (c - b)));
export const BLOCK_MOTIONS = [
  { name: 'ripple', label: 'Ripple', period: 1.6 },
  { name: 'reassemble', label: 'Explode & reassemble', period: 2.4 },
  { name: 'shuffle', label: 'Block shuffle', period: 1.8 },
  { name: 'peek', label: 'Telescoping peek', period: 1.9 },
  { name: 'steps', label: 'Stepping blocks', period: 1.2 },
  { name: 'burst', label: 'Celebration burst', period: 1.6 },
  { name: 'power-down', label: 'Power-down stack', period: 3 },
];
export function blockMotion3D(name, seconds, x, y, z, face = false) {
  const clip = BLOCK_MOTIONS.find(clip => clip.name === name);
  if (!clip) return null;
  const t = ((seconds % clip.period) + clip.period) % clip.period / clip.period;
  const envelope = Math.sin(Math.PI * t) ** 2;
  const out = { x: 0, y: 0, z: 0, turn: 0 };
  // Keep the eye-bearing columns intact so the face remains readable.
  if (name === 'ripple' && !face) {
    const wave = Math.sin(TAU * (t * 2 - (z + 1.5) / 7 - y / 24)) * envelope;
    out.x = Math.sign(x) * 0.28 * wave;
    out.z = 0.38 * wave;
  } else if (name === 'reassemble' && !face) {
    const spread = pulse(t, 0.06, 0.38, 0.94);
    out.x = x * 0.32 * spread;
    out.y = (y - 4) * 0.28 * spread;
    out.z = (z * 0.6 - 0.35) * spread;
    out.turn = Math.sign(x) * 0.65 * spread;
  } else if (name === 'shuffle' && !face && (Math.round(x + y + z) % 3 === 0)) {
    const pop = pulse(t, 0.08 + (y % 3) * 0.07, 0.45, 0.92);
    out.x = Math.sign(x) * 0.65 * pop;
    out.z = Math.sign(z) * 0.65 * pop;
    out.turn = Math.PI / 2 * smooth(pop);
  } else if (name === 'peek') {
    out.z = (z + 2) / 3.5 * 1.1 * pulse(t, 0.05, 0.42, 0.95);
  } else if (name === 'steps' && y < 2.1) {
    const step = Math.sin(TAU * t + (x < 0 ? 0 : Math.PI));
    out.y = Math.max(0, step) * 0.65 * envelope;
    out.z = Math.cos(TAU * t + (x < 0 ? 0 : Math.PI)) * 0.45 * envelope;
  } else if (name === 'burst' && !face) {
    const fan = pulse(t, 0.2, 0.43, 0.76);
    out.x = x * 0.2 * fan;
    out.y = Math.max(0, y - 4) * 0.18 * fan;
    out.z = z * 0.3 * fan;
    out.turn = Math.sign(x) * 0.3 * fan;
  } else if (name === 'power-down' && !face) {
    const settle = pulse(t, 0.04 + (8 - y) * 0.025, 0.48, 0.98);
    out.y = -Math.max(0, y - 0.5) * 0.08 * settle;
  }
  return out;
}
export function blockPose3D(name, seconds) {
  const clip = BLOCK_MOTIONS.find(clip => clip.name === name);
  if (!clip) return null;
  const t = ((seconds % clip.period) + clip.period) % clip.period / clip.period;
  const pose = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, squash: 1, open: 1, gazeX: 0, gazeY: 0, glow: 1 };
  if (name === 'peek') {
    const reach = pulse(t, 0.05, 0.42, 0.95);
    pose.faceDepth = 1.1 * reach;
    pose.gazeX = 0.6 * reach;
  }
  if (name === 'steps') pose.roll = 0.08 * Math.sin(TAU * t) * Math.sin(Math.PI * t) ** 2;
  if (name === 'burst') {
    pose.y = 1.15 * pulse(t, 0.18, 0.43, 0.76);
    pose.squash = 1 - 0.13 * pulse(t, 0.02, 0.15, 0.24) - 0.1 * pulse(t, 0.7, 0.79, 0.94);
  }
  if (name === 'power-down') {
    const sleep = pulse(t, 0.04, 0.48, 0.98);
    pose.squash = 1 - 0.28 * sleep;
    pose.open = 1 - sleep;
    pose.glow = 1 - 0.45 * sleep;
  }
  return pose;
}
