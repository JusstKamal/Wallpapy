export const VERTEX_SRC = /* glsl */`#version 300 es
in vec4 a_position;
out vec2 v_uv;
void main() {
  v_uv = (a_position.xy + 1.0) * 0.5;
  gl_Position = a_position;
}`;

export const BG_FRAG_SRC = /* glsl */`#version 300 es
precision highp float;
#define MAX_PILLS 20

in vec2 v_uv;
out vec4 fragColor;

uniform vec2  u_resolution;
uniform float u_dpr;
uniform vec3  u_bgColor;
uniform int   u_pillCount;
uniform vec2  u_pillCenters[MAX_PILLS];
uniform float u_pillHalfW;
uniform float u_pillHalfH;
uniform vec3  u_pillColors[MAX_PILLS];
uniform float u_pillOpacity;
uniform float u_shadowExpand;
uniform float u_shadowFactor;
uniform vec2  u_shadowPosition;

// Returns SDF normalized by u_resolution.y (negative inside, positive outside)
float pillSDF(vec2 frag, vec2 center, float hw, float hh) {
  vec2 p = frag - center;
  float r = min(hw, hh);
  vec2 q = abs(p) - vec2(hw - r, hh - r);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  return d / u_resolution.y;
}

float allPillsSDF(vec2 frag) {
  float d = 1e10;
  for (int i = 0; i < MAX_PILLS; i++) {
    if (i >= u_pillCount) break;
    d = min(d, pillSDF(frag, u_pillCenters[i], u_pillHalfW, u_pillHalfH));
  }
  return d;
}

void main() {
  vec2 res1x = u_resolution / u_dpr;
  vec3 col = u_bgColor;

  // Paint pills back-to-front so later pills overdraw earlier ones
  for (int i = 0; i < MAX_PILLS; i++) {
    if (i >= u_pillCount) break;
    float d_norm = pillSDF(gl_FragCoord.xy, u_pillCenters[i], u_pillHalfW, u_pillHalfH);
    float d_px = d_norm * u_resolution.y;
    float mask = 1.0 - smoothstep(-0.8, 0.8, d_px);
    col = mix(col, u_pillColors[i], mask * u_pillOpacity);
  }

  // Shadow: evaluate shape shifted by shadow offset
  vec2 shadowOffset = u_shadowPosition * u_dpr;
  float sdf = allPillsSDF(gl_FragCoord.xy - shadowOffset);
  float shadow = exp(-1.0 / u_shadowExpand * abs(sdf) * res1x.y) * 0.6 * u_shadowFactor;

  fragColor = vec4(col - vec3(shadow), 1.0);
}`;

export const VBLUR_FRAG_SRC = /* glsl */`#version 300 es
precision highp float;
#define MAX_BLUR_RADIUS 200
in vec2 v_uv;
uniform sampler2D u_prevPassTexture;
uniform vec2 u_resolution;
uniform int u_blurRadius;
uniform float u_blurWeights[MAX_BLUR_RADIUS + 1];
out vec4 fragColor;
void main() {
  vec2 texel = 1.0 / u_resolution;
  vec4 col = texture(u_prevPassTexture, v_uv) * u_blurWeights[0];
  for (int i = 1; i <= MAX_BLUR_RADIUS; i++) {
    if (i > u_blurRadius) break;
    float w = u_blurWeights[i];
    col += texture(u_prevPassTexture, v_uv + vec2(float(i) * texel.x, 0.0)) * w;
    col += texture(u_prevPassTexture, v_uv - vec2(float(i) * texel.x, 0.0)) * w;
  }
  fragColor = col;
}`;

export const HBLUR_FRAG_SRC = /* glsl */`#version 300 es
precision highp float;
#define MAX_BLUR_RADIUS 200
in vec2 v_uv;
uniform sampler2D u_prevPassTexture;
uniform vec2 u_resolution;
uniform int u_blurRadius;
uniform float u_blurWeights[MAX_BLUR_RADIUS + 1];
out vec4 fragColor;
void main() {
  vec2 texel = 1.0 / u_resolution;
  vec4 col = texture(u_prevPassTexture, v_uv) * u_blurWeights[0];
  for (int i = 1; i <= MAX_BLUR_RADIUS; i++) {
    if (i > u_blurRadius) break;
    float w = u_blurWeights[i];
    col += texture(u_prevPassTexture, v_uv + vec2(0.0, float(i) * texel.y)) * w;
    col += texture(u_prevPassTexture, v_uv - vec2(0.0, float(i) * texel.y)) * w;
  }
  fragColor = col;
}`;

export const MAIN_FRAG_SRC = /* glsl */`#version 300 es
precision highp float;
#define PI 3.14159265359
#define MAX_PILLS 20
const float N_R = 1.0 - 0.02;
const float N_G = 1.0;
const float N_B = 1.0 + 0.02;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_bg;
uniform sampler2D u_blurredBg;
uniform vec2  u_resolution;
uniform float u_dpr;

// Pills
uniform int   u_pillCount;
uniform vec2  u_pillCenters[MAX_PILLS];
uniform float u_pillHalfW;
uniform float u_pillHalfH;

// Refraction
uniform float u_refThickness;
uniform float u_refFactor;
uniform float u_refDispersion;
uniform float u_refFresnelRange;
uniform float u_refFresnelFactor;
uniform float u_refFresnelHardness;

// Glare
uniform float u_glareRange;
uniform float u_glareHardness;
uniform float u_glareConvergence;
uniform float u_glareOppositeFactor;
uniform float u_glareFactor;
uniform float u_glareAngle;

// Blur/tint
uniform int   u_blurEdge;
uniform vec4  u_tint;

// ---------- SDF ----------
float pillSDF(vec2 frag, vec2 center, float hw, float hh) {
  vec2 p = frag - center;
  float r = min(hw, hh);
  vec2 q = abs(p) - vec2(hw - r, hh - r);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  return d / u_resolution.y;
}

float mainSDF(vec2 frag) {
  float d = 1e10;
  for (int i = 0; i < MAX_PILLS; i++) {
    if (i >= u_pillCount) break;
    d = min(d, pillSDF(frag, u_pillCenters[i], u_pillHalfW, u_pillHalfH));
  }
  return d;
}

vec2 getNormal(vec2 p) {
  vec2 h = vec2(max(abs(dFdx(p.x)), 0.0001), max(abs(dFdy(p.y)), 0.0001));
  vec2 grad = vec2(
    mainSDF(p + vec2(h.x, 0.0)) - mainSDF(p - vec2(h.x, 0.0)),
    mainSDF(p + vec2(0.0, h.y)) - mainSDF(p - vec2(0.0, h.y))
  ) / (2.0 * h);
  return grad * 1.414213562 * 1000.0;
}

// ---------- Color space (from liquid-glass-studio) ----------
const vec3 D65_WHITE = vec3(0.95045592705, 1.0, 1.08905775076);
vec3 WHITE = D65_WHITE;
const mat3 RGB_TO_XYZ_M = mat3(0.4124,0.3576,0.1805, 0.2126,0.7152,0.0722, 0.0193,0.1192,0.9505);
const mat3 XYZ_TO_RGB_M = mat3(3.2406255,-1.537208,-0.4986286, -0.9689307,1.8757561,0.0415175, 0.0557101,-0.2040211,1.0569959);
float UNCOMPAND(float a) { return a>0.04045 ? pow((a+0.055)/1.055,2.4) : a/12.92; }
float COMPAND(float a)   { return a<=0.0031308 ? 12.92*a : 1.055*pow(a,0.41666666)-0.055; }
vec3 SRGB_TO_RGB(vec3 s) { return vec3(UNCOMPAND(s.x),UNCOMPAND(s.y),UNCOMPAND(s.z)); }
vec3 RGB_TO_SRGB(vec3 r) { return vec3(COMPAND(r.x),COMPAND(r.y),COMPAND(r.z)); }
float XYZ_TO_LAB_F(float x) { return x>0.00885645167 ? pow(x,0.333333333) : 7.78703703704*x+0.13793103448; }
vec3 XYZ_TO_LAB(vec3 xyz) {
  vec3 s=xyz/WHITE;
  s=vec3(XYZ_TO_LAB_F(s.x),XYZ_TO_LAB_F(s.y),XYZ_TO_LAB_F(s.z));
  return vec3(116.0*s.y-16.0, 500.0*(s.x-s.y), 200.0*(s.y-s.z));
}
vec3 SRGB_TO_LCH(vec3 srgb) {
  vec3 rgb=SRGB_TO_RGB(srgb);
  vec3 xyz=rgb*RGB_TO_XYZ_M;
  vec3 lab=XYZ_TO_LAB(xyz);
  return vec3(lab.x, sqrt(dot(lab.yz,lab.yz)), atan(lab.z,lab.y)*57.2957795131);
}
float LAB_TO_XYZ_F(float x) { return x>0.206897 ? x*x*x : 0.12841854934*(x-0.137931034); }
vec3 LCH_TO_LAB(vec3 lch) { return vec3(lch.x, lch.y*cos(lch.z*0.01745329251), lch.y*sin(lch.z*0.01745329251)); }
vec3 LAB_TO_XYZ(vec3 lab) {
  float w=(lab.x+16.0)/116.0;
  return WHITE*vec3(LAB_TO_XYZ_F(w+lab.y/500.0),LAB_TO_XYZ_F(w),LAB_TO_XYZ_F(w-lab.z/200.0));
}
vec3 LCH_TO_SRGB(vec3 lch) { return RGB_TO_SRGB((LAB_TO_XYZ(LCH_TO_LAB(lch)))*XYZ_TO_RGB_M); }

float vec2ToAngle(vec2 v) { float a=atan(v.y,v.x); return a<0.0 ? a+2.0*PI : a; }

// Chromatic aberration sampling
vec4 sampleDispersion(sampler2D tex1, sampler2D tex2, float mixRate, vec2 offset, float factor) {
  float bgR  = texture(tex1, v_uv + offset*(1.0-(N_R-1.0)*factor)).r;
  float bgG  = texture(tex1, v_uv + offset*(1.0-(N_G-1.0)*factor)).g;
  float bgB  = texture(tex1, v_uv + offset*(1.0-(N_B-1.0)*factor)).b;
  float blR  = texture(tex2, v_uv + offset*(1.0-(N_R-1.0)*factor)).r;
  float blG  = texture(tex2, v_uv + offset*(1.0-(N_G-1.0)*factor)).g;
  float blB  = texture(tex2, v_uv + offset*(1.0-(N_B-1.0)*factor)).b;
  return vec4(mix(bgR,blR,mixRate), mix(bgG,blG,mixRate), mix(bgB,blB,mixRate), 1.0);
}

// ---------- Main ----------
void main() {
  vec2 res1x = u_resolution / u_dpr;
  float merged = mainSDF(gl_FragCoord.xy);

  if (merged >= 0.005) {
    fragColor = texture(u_bg, v_uv);
    return;
  }

  float nmerged = -merged * res1x.y; // positive pixels inside shape

  // Refraction edge factor (Snell's law)
  float x_R_ratio = 1.0 - nmerged / u_refThickness;
  float thetaI = asin(clamp(pow(x_R_ratio, 2.0), -1.0, 1.0));
  float thetaT = asin(clamp(1.0 / u_refFactor * sin(thetaI), -1.0, 1.0));
  float edgeFactor = nmerged < u_refThickness ? -1.0 * tan(thetaT - thetaI) : 0.0;

  if (edgeFactor <= 0.0) {
    // Interior of glass — blurred + tinted
    vec4 col = texture(u_blurredBg, v_uv);
    col = mix(col, vec4(u_tint.rgb, 1.0), u_tint.a * 0.8);
    fragColor = mix(col, texture(u_bg, v_uv), smoothstep(-0.001, 0.001, merged));
    return;
  }

  // Edge region — refraction + fresnel + glare
  float edgeH = nmerged / u_refThickness;
  vec2 normal = getNormal(gl_FragCoord.xy);
  vec2 refOffset = -normal * edgeFactor * 0.05 * u_dpr *
    vec2(u_resolution.y / (res1x.x * u_dpr), 1.0);

  vec4 blurredPixel = sampleDispersion(
    u_bg, u_blurredBg,
    u_blurEdge > 0 ? 1.0 : edgeH,
    refOffset, u_refDispersion
  );

  // Tint
  vec4 col = mix(blurredPixel, vec4(u_tint.rgb, 1.0), u_tint.a * 0.8);

  // Fresnel
  float fresnelFactor = clamp(
    pow(1.0 + merged * res1x.y / 1500.0 * pow(500.0 / u_refFresnelRange, 2.0) + u_refFresnelHardness, 5.0),
    0.0, 1.0
  );
  vec3 fresnelLCH = SRGB_TO_LCH(mix(vec3(1.0), u_tint.rgb, u_tint.a * 0.5));
  fresnelLCH.x += 20.0 * fresnelFactor * u_refFresnelFactor;
  fresnelLCH.x = clamp(fresnelLCH.x, 0.0, 100.0);
  col = mix(col, vec4(LCH_TO_SRGB(fresnelLCH), 1.0), fresnelFactor * u_refFresnelFactor * 0.7 * length(normal));

  // Glare
  float glareGeoFactor = clamp(
    pow(1.0 + merged * res1x.y / 1500.0 * pow(500.0 / u_glareRange, 2.0) + u_glareHardness, 5.0),
    0.0, 1.0
  );
  float ga = (vec2ToAngle(normalize(normal)) - PI / 4.0 + u_glareAngle) * 2.0;
  int farside = (ga > PI*(2.0-0.5) && ga < PI*(4.0-0.5)) || ga < PI*(0.0-0.5) ? 1 : 0;
  float glareAngleFactor =
    (0.5 + sin(ga) * 0.5) *
    (farside == 1 ? 1.2 * u_glareOppositeFactor : 1.2) *
    u_glareFactor;
  glareAngleFactor = clamp(pow(glareAngleFactor, 0.1 + u_glareConvergence * 2.0), 0.0, 1.0);
  vec3 glareLCH = SRGB_TO_LCH(mix(blurredPixel.rgb, u_tint.rgb, u_tint.a * 0.5));
  glareLCH.x += 150.0 * glareAngleFactor * glareGeoFactor;
  glareLCH.y += 30.0 * glareAngleFactor * glareGeoFactor;
  glareLCH.x = clamp(glareLCH.x, 0.0, 120.0);
  col = mix(col, vec4(LCH_TO_SRGB(glareLCH), 1.0), glareAngleFactor * glareGeoFactor * length(normal));

  // Smooth edge blend
  col = mix(col, texture(u_bg, v_uv), smoothstep(-0.001, 0.001, merged));
  fragColor = col;
}`;
