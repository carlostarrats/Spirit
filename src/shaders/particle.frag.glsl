#version 300 es
precision highp float;
in float vBright;
out vec4 fragColor;

void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  float glow = exp(-r * r * 3.0) * vBright;
  fragColor = vec4(glow * 0.8, glow * 0.88, glow, glow);
}
