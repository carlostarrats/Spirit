const p = new Uint8Array(512);

const BASE_PERM = [
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,
  69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,
  252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,
  168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,
  211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,
  216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,
  164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,
  126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,
  213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,
  253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,
  242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,
  192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
];

export function initNoise(seed) {
  const source = BASE_PERM.slice();
  let s = seed | 0;
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    const j = ((s >>> 0) % (i + 1));
    [source[i], source[j]] = [source[j], source[i]];
  }
  for (let i = 0; i < 256; i++) {
    p[i] = p[i + 256] = source[i];
  }
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }

function grad2(hash, x, y) {
  const h = hash & 3;
  return ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
}

export function noise2d(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  const u = fade(x);
  const v = fade(y);
  const A = p[X] + Y;
  const B = p[X + 1] + Y;
  return lerp(
    lerp(grad2(p[A], x, y), grad2(p[B], x - 1, y), u),
    lerp(grad2(p[A + 1], x, y - 1), grad2(p[B + 1], x - 1, y - 1), u),
    v
  );
}

function grad3(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

export function noise3d(x, y, z) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
  const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
  return lerp(
    lerp(
      lerp(grad3(p[AA], x, y, z), grad3(p[BA], x-1, y, z), u),
      lerp(grad3(p[AB], x, y-1, z), grad3(p[BB], x-1, y-1, z), u), v),
    lerp(
      lerp(grad3(p[AA+1], x, y, z-1), grad3(p[BA+1], x-1, y, z-1), u),
      lerp(grad3(p[AB+1], x, y-1, z-1), grad3(p[BB+1], x-1, y-1, z-1), u), v),
    w
  );
}

export function fbm2d(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let sum = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2d(x * freq, y * freq) * amp;
    max += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / max;
}

export function terrainHeight(x, z) {
  return fbm2d(x * 0.012, z * 0.012, 4) * 8.0
       + fbm2d(x * 0.04, z * 0.04, 3) * 2.5
       + fbm2d(x * 0.1, z * 0.1, 2) * 0.5;
}
