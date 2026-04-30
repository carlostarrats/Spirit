#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;

void main() {
  vec3 scene = texture(uScene, vUV).rgb;
  vec3 bloom = texture(uBloom, vUV).rgb;

  vec3 color = scene + bloom * 1.2;

  // vignette
  float vig = 1.0 - smoothstep(0.45, 1.5, length((vUV - 0.5) * 2.0));
  color *= vig;

  // soft tone mapping
  color = color / (color + 0.45);

  fragColor = vec4(color, 1.0);
}
