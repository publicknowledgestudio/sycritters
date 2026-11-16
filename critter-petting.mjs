export const PET_DURATION = 1100;
// Two gentle strokes, easing back to the exact resting pose.
export function petPose(elapsed) {
  if (elapsed < 0 || elapsed >= PET_DURATION) return null;
  const t = elapsed / PET_DURATION;
  const weight = Math.sin(Math.PI * t) ** 2;
  return {
    weight,
    roll: 0.09 * Math.sin(t * Math.PI * 4) * weight,
    squash: 1 - 0.055 * weight,
    open: 1 - 0.7 * weight,
    lift: 0.12 * weight,
  };
}
