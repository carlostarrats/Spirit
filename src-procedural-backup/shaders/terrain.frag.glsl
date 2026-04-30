#version 300 es
precision highp float;
in vec3 vWorldPos;
out vec4 fragColor;
uniform vec3 uCameraPos;

void main() {
  vec3 dx = dFdx(vWorldPos);
  vec3 dz = dFdy(vWorldPos);
  vec3 normal = normalize(cross(dz, dx));
  float slope = 1.0 - abs(normal.y);

  float brightness = 0.012 + slope * 0.025;

  float dist = length(vWorldPos.xz - uCameraPos.xz);
  float fog = exp(-dist * 0.018);
  brightness *= fog;

  fragColor = vec4(brightness * 0.5, brightness * 0.6, brightness * 0.85, 1.0);
}
