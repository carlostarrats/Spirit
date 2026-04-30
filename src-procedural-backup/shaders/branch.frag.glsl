#version 300 es
precision highp float;
in float vBright;
in vec3 vWorldPos;
out vec4 fragColor;
uniform vec3 uCameraPos;

void main() {
  float dist = length(vWorldPos - uCameraPos);
  float fog = exp(-dist * 0.022);
  float b = vBright * fog;
  fragColor = vec4(b * 0.75, b * 0.82, b, 1.0);
}
