import { wallpaperBackgroundFromBase } from './colorUtils';
import { RenderPass, computeGaussianWeights, hexToVec3 } from './glUtils';
import { VERTEX_SRC, BG_FRAG_SRC, VBLUR_FRAG_SRC, HBLUR_FRAG_SRC, MAIN_FRAG_SRC } from './liquidGlassShaders';

export interface GlassParams {
  refThickness: number;
  refFactor: number;
  refDispersion: number;
  refFresnelRange: number;
  refFresnelFactor: number;
  refFresnelHardness: number;
  glareRange: number;
  glareHardness: number;
  glareConvergence: number;
  glareOppositeFactor: number;
  glareFactor: number;
  glareAngle: number;   // degrees
  blurRadius: number;
  blurEdge: boolean;
  tint: { r: number; g: number; b: number; a: number };
  shadowExpand: number;
  shadowFactor: number;
  shadowX: number;
  shadowY: number;
}

export const GLASS_DEFAULTS: GlassParams = {
  refThickness: 20,
  refFactor: 1.4,
  refDispersion: 7,
  refFresnelRange: 30,
  refFresnelFactor: 20,
  refFresnelHardness: 20,
  glareRange: 30,
  glareHardness: 20,
  glareConvergence: 50,
  glareOppositeFactor: 80,
  glareFactor: 90,
  glareAngle: -45,
  blurRadius: 12,
  blurEdge: true,
  tint: { r: 1, g: 1, b: 1, a: 0 },
  shadowExpand: 25,
  shadowFactor: 15,
  shadowX: 0,
  shadowY: -10,
};

export interface PillGeometry {
  centers: Array<[number, number]>;  // screen px, canvas coords (y=0 at top)
  halfW: number;
  halfH: number;
  colors: string[];
  /** 0–1, applied to all pills */
  pillOpacity: number;
  bgColor: string;
  mode: 'dark' | 'light';
}

export class LiquidGlassRenderer {
  private gl: WebGL2RenderingContext;
  private bgPass: RenderPass;
  private vblurPass: RenderPass;
  private hblurPass: RenderPass;
  private mainPass: RenderPass;
  private w = 0;
  private h = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 not supported');
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) throw new Error('EXT_color_buffer_float required');
    this.gl = gl;

    const vert = VERTEX_SRC;
    this.bgPass    = new RenderPass(gl, { vertex: vert, fragment: BG_FRAG_SRC },    false);
    this.vblurPass = new RenderPass(gl, { vertex: vert, fragment: VBLUR_FRAG_SRC }, false);
    this.hblurPass = new RenderPass(gl, { vertex: vert, fragment: HBLUR_FRAG_SRC }, false);
    this.mainPass  = new RenderPass(gl, { vertex: vert, fragment: MAIN_FRAG_SRC },  true);

    this.resize(canvas.width, canvas.height);
  }

  resize(w: number, h: number) {
    if (this.w === w && this.h === h) return;
    this.w = w; this.h = h;
    const gl = this.gl;
    gl.viewport(0, 0, w, h);
    this.bgPass.resize(w, h);
    this.vblurPass.resize(w, h);
    this.hblurPass.resize(w, h);
  }

  render(geo: PillGeometry, params: GlassParams, dpr = 1) {
    const gl = this.gl;
    const { w, h } = this;
    const res = [w, h];

    // Flatten pill data into GL arrays
    // WebGL coords: y=0 at BOTTOM — flip from canvas coords (y=0 at top)
    const centers: number[] = [];
    const colors: number[] = [];
    const MAX = 20;
    for (let i = 0; i < Math.min(geo.centers.length, MAX); i++) {
      centers.push(geo.centers[i][0], h - geo.centers[i][1]);
      const c = hexToVec3(geo.colors[i]);
      colors.push(...c);
    }
    // Pad to MAX_PILLS
    while (centers.length < MAX * 2) centers.push(0, 0);
    while (colors.length < MAX * 3) colors.push(0, 0, 0);

    const bgVec = hexToVec3(geo.bgColor);
    const blurWeights = computeGaussianWeights(params.blurRadius);
    // Pad weights to MAX_BLUR_RADIUS+1 = 201
    while (blurWeights.length < 201) blurWeights.push(0);

    const sharedUniforms = {
      u_resolution: res,
      u_dpr: dpr,
      u_pillCount: geo.centers.length,
      u_pillCenters: centers,
      u_pillHalfW: geo.halfW,
      u_pillHalfH: geo.halfH,
    };

    // Pass 1: background + pills painted flat
    this.bgPass.render({
      ...sharedUniforms,
      u_bgColor: bgVec,
      u_pillColors: colors,
      u_pillOpacity: Math.min(1, Math.max(0, geo.pillOpacity)),
      u_shadowExpand: params.shadowExpand,
      u_shadowFactor: params.shadowFactor / 100,
      u_shadowPosition: [params.shadowX, params.shadowY],
    });

    const bgTex = this.bgPass.outputTexture!;

    // Pass 2 & 3: separable Gaussian blur
    this.vblurPass.render({
      u_prevPassTexture: bgTex,
      u_resolution: res,
      u_blurRadius: params.blurRadius,
      u_blurWeights: blurWeights,
    });
    this.hblurPass.render({
      u_prevPassTexture: this.vblurPass.outputTexture!,
      u_resolution: res,
      u_blurRadius: params.blurRadius,
      u_blurWeights: blurWeights,
    });

    // Pass 4: glass composition
    gl.viewport(0, 0, w, h);
    this.mainPass.render({
      ...sharedUniforms,
      u_bg: bgTex,
      u_blurredBg: this.hblurPass.outputTexture!,
      u_refThickness: params.refThickness,
      u_refFactor: params.refFactor,
      u_refDispersion: params.refDispersion,
      u_refFresnelRange: params.refFresnelRange,
      u_refFresnelFactor: params.refFresnelFactor / 100,
      u_refFresnelHardness: params.refFresnelHardness / 100,
      u_glareRange: params.glareRange,
      u_glareHardness: params.glareHardness / 100,
      u_glareConvergence: params.glareConvergence / 100,
      u_glareOppositeFactor: params.glareOppositeFactor / 100,
      u_glareFactor: params.glareFactor / 100,
      u_glareAngle: (params.glareAngle * Math.PI) / 180,
      u_blurEdge: params.blurEdge ? 1 : 0,
      u_tint: [params.tint.r, params.tint.g, params.tint.b, params.tint.a],
    });
  }

  dispose() {
    this.bgPass.dispose();
    this.vblurPass.dispose();
    this.hblurPass.dispose();
    this.mainPass.dispose();
  }
}

/** Compute pill geometry from WallpaperConfig values */
export function computePillGeometry(
  width: number,
  height: number,
  pillCount: number,
  colors: string[],
  pillOpacity: number,
  stackDirection: 'horizontal' | 'vertical',
  overlapRatio: number,
  pillMainRatio: number,
  pillCrossRatio: number,
  mode: 'dark' | 'light',
  baseColor: string,
): PillGeometry {
  const centers: Array<[number, number]> = [];
  let halfW = 0, halfH = 0;

  if (stackDirection === 'horizontal') {
    const pillH = height * pillMainRatio;
    const pillW = pillH * pillCrossRatio;
    const step = pillW * (1 - overlapRatio);
    const totalW = pillW + step * (pillCount - 1);
    const startX = (width - totalW) / 2;
    const startY = height * 0.5 - pillH / 2;
    halfW = pillW / 2; halfH = pillH / 2;
    for (let i = 0; i < pillCount; i++) {
      centers.push([startX + i * step + halfW, startY + halfH]);
    }
  } else {
    const pillW = width * pillMainRatio;
    const pillH = pillW * pillCrossRatio;
    const step = pillH * (1 - overlapRatio);
    const totalH = pillH + step * (pillCount - 1);
    const startY = (height - totalH) / 2;
    const startX = width * 0.5 - pillW / 2;
    halfW = pillW / 2; halfH = pillH / 2;
    for (let i = 0; i < pillCount; i++) {
      centers.push([startX + halfW, startY + i * step + halfH]);
    }
  }

  const bgColor = wallpaperBackgroundFromBase(baseColor, mode);
  const o = Math.min(1, Math.max(0, pillOpacity));
  return { centers, halfW, halfH, colors, pillOpacity: o, bgColor, mode };
}
