import { wallpaperBackgroundFromBase } from "./colorUtils";
import { RenderPass, computeGaussianWeights, hexToVec3 } from "./glUtils";
import { QUALITY_LEVELS } from "./pillRenderer";
import {
  VERTEX_SRC,
  BG_FRAG_SRC,
  VBLUR_FRAG_SRC,
  HBLUR_FRAG_SRC,
  MAIN_FRAG_SRC,
} from "./liquidGlassShaders";

/**
 * Most glass slider values are defined as if `min(canvasW, canvasH) === this` (1080p tier short side).
 * Scale those to the actual framebuffer so blur/dispersion/shadow stay consistent when resolution
 * changes. Refraction thickness is stored as % of pill short side and is converted to pixels at
 * render time from geometry.
 */
export const GLASS_PARAMS_REF_MIN_SIDE = QUALITY_LEVELS[0].base;

export interface GlassParams {
  /** Refraction edge band width as 0–100% of pill short side (`2 * min(halfW, halfH)`). */
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
  glareAngle: number; // degrees
  blurRadius: number;
  blurEdge: boolean;
  shadowExpand: number;
  shadowFactor: number;
  shadowX: number;
  shadowY: number;
}

/** Scale stored glass params from reference short-side to target canvas (same formula for preview + export). */
export function scaleGlassParamsToCanvas(
  params: GlassParams,
  canvasW: number,
  canvasH: number,
  refMinSide: number = GLASS_PARAMS_REF_MIN_SIDE,
): GlassParams {
  const minSide = Math.max(1, Math.min(canvasW, canvasH));
  const ref = Math.max(1, refMinSide);
  const s = minSide / ref;
  if (Math.abs(s - 1) < 1e-6) return params;
  return {
    ...params,
    refDispersion: params.refDispersion * s,
    blurRadius: Math.max(1, Math.round(params.blurRadius * s)),
    refFresnelRange: params.refFresnelRange * s,
    glareRange: params.glareRange * s,
    shadowExpand: params.shadowExpand * s,
    shadowX: params.shadowX * s,
    shadowY: params.shadowY * s,
  };
}

export const GLASS_DEFAULTS: GlassParams = {
  refThickness: 32,
  refFactor: 2,
  refDispersion: 20,
  refFresnelRange: 100,
  refFresnelFactor: 60,
  refFresnelHardness: 0,
  glareRange: 50,
  glareHardness: 0,
  glareConvergence: 100,
  glareOppositeFactor: 80,
  glareFactor: 120,
  glareAngle: -45,
  blurRadius: 15,
  blurEdge: true,
  shadowExpand: 50,
  shadowFactor: 15,
  shadowX: 0,
  shadowY: 0,
};

export interface PillGeometry {
  centers: Array<[number, number]>; // screen px, canvas coords (y=0 at top)
  halfW: number;
  halfH: number;
  colors: string[];
  /** 0–1, applied to all pills */
  pillOpacity: number;
  bgColor: string;
  mode: "dark" | "light";
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
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 not supported");
    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) throw new Error("EXT_color_buffer_float required");
    this.gl = gl;

    const vert = VERTEX_SRC;
    this.bgPass = new RenderPass(
      gl,
      { vertex: vert, fragment: BG_FRAG_SRC },
      false,
    );
    this.vblurPass = new RenderPass(
      gl,
      { vertex: vert, fragment: VBLUR_FRAG_SRC },
      false,
    );
    this.hblurPass = new RenderPass(
      gl,
      { vertex: vert, fragment: HBLUR_FRAG_SRC },
      false,
    );
    this.mainPass = new RenderPass(
      gl,
      { vertex: vert, fragment: MAIN_FRAG_SRC },
      true,
    );

    this.resize(canvas.width, canvas.height);
  }

  resize(w: number, h: number) {
    if (this.w === w && this.h === h) return;
    this.w = w;
    this.h = h;
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
    const pillShortPx = 2 * Math.min(geo.halfW, geo.halfH);
    const refThicknessPx = Math.max(
      1e-3,
      (Math.max(0, Math.min(100, params.refThickness)) / 100) * pillShortPx,
    );
    this.mainPass.render({
      ...sharedUniforms,
      u_bg: bgTex,
      u_blurredBg: this.hblurPass.outputTexture!,
      u_refThickness: refThicknessPx,
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
  stackDirection: "horizontal" | "vertical",
  overlapRatio: number,
  pillMainRatio: number,
  pillCrossRatio: number,
  mode: "dark" | "light",
  baseColor: string,
  backgroundTint: number,
  backgroundBrightness: number,
  pillStagger: number,
): PillGeometry {
  const centers: Array<[number, number]> = [];
  let halfW = 0,
    halfH = 0;
  const stagger = Math.max(-0.35, Math.min(0.35, pillStagger));

  if (stackDirection === "horizontal") {
    const pillH = height * pillMainRatio;
    const pillW = pillH * pillCrossRatio;
    const step = pillW * (1 - overlapRatio);
    const totalW = pillW + step * (pillCount - 1);
    const startX = (width - totalW) / 2;
    const baseY = height * 0.5 - pillH / 2;
    halfW = pillW / 2;
    halfH = pillH / 2;
    for (let i = 0; i < pillCount; i++) {
      const alt = i % 2 === 0 ? 1 : -1;
      const y = baseY + alt * stagger * pillH;
      centers.push([startX + i * step + halfW, y + halfH]);
    }
  } else {
    const pillW = width * pillMainRatio;
    const pillH = pillW * pillCrossRatio;
    const step = pillH * (1 - overlapRatio);
    const totalH = pillH + step * (pillCount - 1);
    const startY = (height - totalH) / 2;
    const baseX = width * 0.5 - pillW / 2;
    halfW = pillW / 2;
    halfH = pillH / 2;
    for (let i = 0; i < pillCount; i++) {
      const alt = i % 2 === 0 ? 1 : -1;
      const x = baseX + alt * stagger * pillW;
      centers.push([x + halfW, startY + i * step + halfH]);
    }
  }

  const bgColor = wallpaperBackgroundFromBase(
    baseColor,
    mode,
    backgroundTint,
    backgroundBrightness,
  );
  const o = Math.min(1, Math.max(0, pillOpacity));
  return { centers, halfW, halfH, colors, pillOpacity: o, bgColor, mode };
}
