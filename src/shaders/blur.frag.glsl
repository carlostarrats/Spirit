#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uInput;
uniform vec2 uDirection;

void main() {
  vec2 texel = 1.0 / vec2(textureSize(uInput, 0));
  float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

  vec3 result = texture(uInput, vUV).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    vec2 off = uDirection * texel * float(i) * 1.5;
    result += texture(uInput, vUV + off).rgb * w[i];
    result += texture(uInput, vUV - off).rgb * w[i];
  }
  fragColor = vec4(result, 1.0);
}
