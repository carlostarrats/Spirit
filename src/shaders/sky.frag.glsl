#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  float y = vUV.y;
  float base = 0.003 + y * 0.012;

  // stars
  vec2 grid = floor(vUV * 400.0);
  float star = hash(grid);
  float twinkle = hash(grid + 0.5);
  if (star > 0.9975) {
    base += twinkle * 0.4;
  }

  fragColor = vec4(base * 0.55, base * 0.65, base * 0.9, 1.0);
}
