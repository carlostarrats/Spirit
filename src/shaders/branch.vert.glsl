#version 300 es
in vec3 aPosition;
in float aBrightness;
uniform mat4 uViewProj;
out float vBright;
out vec3 vWorldPos;

void main() {
  vBright = aBrightness;
  vWorldPos = aPosition;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}
