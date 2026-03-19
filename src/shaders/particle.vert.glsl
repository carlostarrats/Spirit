#version 300 es
in vec3 aPosition;
in float aBrightness;
uniform mat4 uViewProj;
uniform vec3 uCameraPos;
out float vBright;

void main() {
  vBright = aBrightness;
  float dist = length(aPosition - uCameraPos);
  float fog = exp(-dist * 0.025);
  vBright *= fog;
  gl_PointSize = max(1.0, aBrightness * 8.0 / max(dist, 0.5));
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}
