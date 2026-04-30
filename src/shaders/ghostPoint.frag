precision highp float;

#ifdef USE_RGB
varying vec3 vColor;
#endif
varying float vIntensity;
varying float vDepth;

uniform float uOpacity;
uniform vec3 uColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uColorMix;  // 0 = pure ivory, 1 = pure RGB (only honored when USE_RGB)

void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = dot(d, d);
  if (r > 0.25) discard;
  float falloff = 1.0 - smoothstep(0.0, 0.25, r);

  float fog = 1.0 - smoothstep(uFogNear, uFogFar, vDepth);

  vec3 col = uColor;
#ifdef USE_RGB
  // desaturate slightly for the ghost look — fully saturated LIDAR RGB looks too "real"
  vec3 desat = mix(vec3(dot(vColor, vec3(0.3, 0.59, 0.11))), vColor, 0.55);
  col = mix(uColor, desat, uColorMix);
#endif

  float a = uOpacity * vIntensity * falloff * fog;
  gl_FragColor = vec4(col, a);
}
