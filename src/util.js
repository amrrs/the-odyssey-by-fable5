// Small math + helpers shared everywhere
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
// deterministic rng
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// cheap 2d value-ish noise (sum of sines) — deterministic
export function n2(x, z) {
  return (
    Math.sin(x * 0.13 + 7.1) * Math.cos(z * 0.11 + 3.3) +
    0.55 * Math.sin(x * 0.31 + 1.7) * Math.cos(z * 0.27 + 9.2) +
    0.3 * Math.sin(x * 0.71 + 4.2) * Math.cos(z * 0.63 + 2.8)
  );
}
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
