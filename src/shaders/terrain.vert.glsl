#version 300 es
in vec3 aPosition;
uniform mat4 uViewProj;
out vec3 vWorldPos;

void main() {
  vWorldPos = aPosition;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}
