const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = value => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const pulse = (t, start, peak, end) =>
  smooth((t - start) / (peak - start)) * (1 - smooth((t - peak) / (end - peak)));
const neutral = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0, squash: 1, open: 1, gazeX: 0, gazeY: 0, glow: 1 };

// Positions are measured in voxels and rotations in radians. The body and
// face move together around the body's center.
const motions = {
  thinking: [3.4, (t, wave) => ({
    pitch: -0.18, roll: -0.12 + 0.045 * wave, yaw: 0.14 * wave,
    gazeX: 0.35 * wave, gazeY: 0.8, open: 0.83, glow: 1 + 0.15 * wave,
  })],
  scanning: [2.8, (t, wave) => ({
    yaw: 0.66 * wave, pitch: 0.08 * Math.cos(t * TAU), gazeX: wave, glow: 1.15,
  })],
  processing: [1.8, (t, wave) => ({
    yaw: 0.16 * wave, pitch: 0.07 * Math.cos(t * TAU), z: 0.28 * wave,
    squash: 1 + 0.055 * Math.sin(2 * TAU * t), glow: 1 + 0.32 * wave,
  })],
  bob: [1.25, (t, wave) => ({
    y: 0.26 * (1 - Math.cos(t * TAU)), pitch: 0.08 * wave, z: 0.12 * wave,
  })],
  jump: [1.7, t => {
    const jump = pulse(t, 0.16, 0.39, 0.66);
    return { y: jump * 1.35, z: jump * 0.65, pitch: jump * -0.2,
      squash: 1 + 0.08 * jump - 0.15 * pulse(t, 0.04, 0.15, 0.23) - 0.12 * pulse(t, 0.6, 0.7, 0.81) };
  }],
  walk: [1.65, (t, wave) => ({
    x: 0.72 * wave, z: 0.38 * Math.cos(t * TAU), yaw: 0.52 * wave,
    roll: -0.16 * wave, y: 0.62 * wave * wave, squash: 0.93 + 0.12 * wave * wave,
  })],
  pull: [2.4, t => {
    const reach = pulse(t, 0, 0.25, 0.48);
    const pull = pulse(t, 0.33, 0.61, 0.95);
    return { x: -0.62 * reach + 0.88 * pull, z: 0.58 * reach - 0.48 * pull,
      yaw: -0.51, roll: 0.17 * reach - 0.26 * pull, pitch: 0.1 * reach - 0.25 * pull,
      squash: 1 - 0.12 * pull, open: 1 - 0.52 * pull, gazeX: -0.8 };
  }],
  study: [3.6, t => {
    const glance = pulse(t, 0.7, 0.82, 0.98);
    const line = Math.sin(t * TAU * 2);
    return { pitch: 0.24 - 0.35 * glance, yaw: 0.13 * line, z: 0.4,
      gazeX: 0.85 * line, gazeY: -0.85 + 1.3 * glance, open: 0.82 + 0.18 * glance };
  }],
  float: [4.1, (t, wave) => ({
    y: 0.7 + 0.42 * (1 - Math.cos(t * TAU)), z: 0.45 * wave, pitch: -0.12,
    yaw: 0.3 * wave, roll: 0.12 * wave, squash: 1 + 0.04 * wave, open: 0.12, glow: 1.12,
  })],
  wiggle: [1.2, (t, wave) => ({
    yaw: 0.45 * wave, roll: 0.16 * Math.sin(t * TAU * 2), z: 0.22 * Math.cos(t * TAU),
    squash: 1 - 0.055 * wave * wave,
  })],
  droop: [3.4, t => {
    const sag = pulse(t, 0.06, 0.52, 1);
    return { pitch: 0.32 * sag, roll: 0.08 * sag, z: -0.38 * sag,
      squash: 1 - 0.16 * sag, gazeY: -sag, open: 1 - 0.55 * sag, glow: 1 - 0.25 * sag };
  }],
  excited: [1.35, t => {
    const hop = pulse(t, 0.04, 0.19, 0.38) + pulse(t, 0.47, 0.64, 0.86);
    return { y: 1.12 * hop, z: 0.55 * hop, pitch: -0.16 * hop,
      yaw: 0.24 * Math.sin(t * TAU), squash: 0.92 + 0.16 * hop, glow: 1 + 0.2 * hop };
  }],
  blink: [1.6, t => ({ open: 1 - 0.96 * pulse(t, 0.31, 0.4, 0.54) })],
  shake: [1.55, (t, wave) => ({ yaw: 0.6 * wave * Math.sin(Math.PI * t), roll: 0.06 * wave })],
  nod: [1.65, t => {
    const dip = pulse(t, 0.08, 0.24, 0.46) + 0.62 * pulse(t, 0.5, 0.63, 0.85);
    return { pitch: 0.49 * dip, z: 0.28 * dip, gazeY: -0.65 * dip };
  }],
  dance: [1.8, (t, wave) => ({
    yaw: 0.55 * wave, roll: 0.22 * wave, x: 0.6 * wave, z: 0.5 * Math.cos(t * TAU),
    y: 0.64 * wave * wave, squash: 0.9 + 0.15 * wave * wave,
  })],
  look: [2.45, t => {
    const eyes = pulse(t, 0.1, 0.37, 0.89);
    const turn = pulse(t, 0.24, 0.49, 0.96);
    return { gazeX: 1.7 * eyes - 0.7, gazeY: 0.45 * eyes, yaw: 0.52 * turn, roll: -0.1 * turn };
  }],
  sleep: [4.8, (t, wave) => ({
    pitch: 0.2 + 0.026 * wave, squash: 0.91 + 0.033 * wave,
    open: 0.04, glow: 0.58 + 0.08 * wave,
  })],
};

const pushes = {
  r: { x: 0.95, z: 0.24, yaw: 0.75, roll: -0.21, gazeX: 0.95 },
  l: { x: -0.95, z: 0.24, yaw: -0.75, roll: 0.21, gazeX: -0.95 },
  u: { y: 0.34, z: -0.8, pitch: -0.36, gazeY: 1 },
  d: { z: 0.88, pitch: 0.42, gazeY: -1 },
};

function pushPose(direction, phase) {
  return { ...neutral, ...pushes[direction], squash: 0.92 + 0.036 * Math.sin(phase * TAU), open: 0.58 };
}

export function motionPose3D(name, seconds) {
  if (name.startsWith("pushx-")) {
    const phase = (seconds % 3.4) / 3.4 * 4;
    const first = pushPose(name[6], phase);
    const second = pushPose(name[7], phase);
    const mix = phase < 2 ? smooth(phase - 1) : 1 - smooth(phase - 3);
    return Object.fromEntries(Object.keys(first).map(key => [key, first[key] + (second[key] - first[key]) * mix]));
  }
  if (name.startsWith("push-")) return pushPose(name[5], seconds / 0.95);
  const motion = motions[name];
  if (!motion) return null;
  const [period, sample] = motion;
  const phase = (seconds % period) / period;
  return { ...neutral, ...sample(phase, Math.sin(phase * TAU)) };
}
