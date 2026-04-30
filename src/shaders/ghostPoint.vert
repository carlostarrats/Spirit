attribute float aIntensity;
#ifdef USE_RGB
attribute vec3 aColor;
varying vec3 vColor;
#endif

varying float vIntensity;
varying float vDepth;

uniform float uPointSize;
uniform float uPixelRatio;
uniform float uSizeScale;
uniform float uMinSize;
uniform float uMaxSize;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 clip = projectionMatrix * mv;
  gl_Position = clip;

  float dist = -mv.z;
  float size = uPointSize * uPixelRatio * uSizeScale / max(dist, 1.0);
  gl_PointSize = clamp(size, uMinSize, uMaxSize);

  vIntensity = aIntensity;
  vDepth = dist;
#ifdef USE_RGB
  vColor = aColor;
#endif
}
