#version 300 es
precision highp float;
in float vBright;
in vec3 vWorldPos;
out vec4 fragColor;

void main() {
  fragColor = vec4(vBright * 0.65, vBright * 0.78, vBright, 1.0);
}
