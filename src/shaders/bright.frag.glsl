#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uScene;

void main() {
  vec3 color = texture(uScene, vUV).rgb;
  float brightness = dot(color, vec3(0.299, 0.587, 0.114));
  float mask = smoothstep(0.08, 0.25, brightness);
  fragColor = vec4(color * mask, 1.0);
}
