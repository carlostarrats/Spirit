#version 300 es
in float aX;
in float aBaseY;
in float aZ;
in float aHeight;
in float aPhase;
in float aVertexT;

uniform mat4 uViewProj;
uniform float uTime;
uniform vec3 uCameraPos;

out float vBright;
out vec3 vWorldPos;

void main() {
  vec3 pos = vec3(aX, aBaseY, aZ);

  if (aVertexT > 0.5) {
    // large rolling waves (Nebraska grain field)
    float wave1 = sin(uTime * 1.0 + aX * 0.06 + aZ * 0.10) * 0.5 + 0.5;
    float wave2 = sin(uTime * 0.7 + aX * 0.04 - aZ * 0.08) * 0.5 + 0.5;
    float bigWave = wave1 * wave2;

    // small turbulence per blade
    float turb = sin(uTime * 2.8 + aPhase + aX * 0.5 + aZ * 0.35);

    pos.x += (bigWave * 0.22 + turb * 0.06) * aHeight;
    pos.z += (wave2 * 0.12 + turb * 0.03) * aHeight;
    pos.y += aHeight;
  }

  vWorldPos = pos;

  float dist = length(pos.xz - uCameraPos.xz);
  float fog = exp(-dist * 0.022);
  vBright = mix(0.012, 0.08, aVertexT) * fog;

  gl_Position = uViewProj * vec4(pos, 1.0);
}
