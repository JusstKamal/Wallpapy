/* eslint-disable @typescript-eslint/no-explicit-any */
type GL = WebGL2RenderingContext;

interface ShaderSource { vertex: string; fragment: string }
interface RenderPassConfig { name: string; shader: ShaderSource; outputToScreen?: boolean }

export class ShaderProgram {
  private gl: GL;
  private program: WebGLProgram;
  private uniforms = new Map<string, { location: WebGLUniformLocation; type: number; isArray: boolean }>();

  constructor(gl: GL, source: ShaderSource) {
    this.gl = gl;
    this.program = this.compile(source);
    this.detectUniforms();
  }

  private compile(source: ShaderSource): WebGLProgram {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, source.vertex);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
      throw new Error('VS: ' + gl.getShaderInfoLog(vs));

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, source.fragment);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
      throw new Error('FS: ' + gl.getShaderInfoLog(fs));

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error('Link: ' + gl.getProgramInfoLog(prog));
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  private detectUniforms() {
    const gl = this.gl;
    const n = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(this.program, i);
      if (!info) continue;
      const loc = gl.getUniformLocation(this.program, info.name);
      if (!loc) continue;
      const isArray = /\[\d+\]$/.test(info.name);
      const baseName = info.name.replace(/\[\d+\]$/, '');
      this.uniforms.set(baseName, { location: loc, type: info.type, isArray });
    }
  }

  use() { this.gl.useProgram(this.program); }

  set(name: string, value: any) {
    const gl = this.gl;
    const u = this.uniforms.get(name);
    if (!u) return;
    const loc = u.location;
    if (u.isArray && Array.isArray(value)) {
      if (u.type === gl.FLOAT) gl.uniform1fv(loc, value);
      else if (u.type === gl.FLOAT_VEC2) gl.uniform2fv(loc, value);
      else if (u.type === gl.FLOAT_VEC3) gl.uniform3fv(loc, value);
      else if (u.type === gl.FLOAT_VEC4) gl.uniform4fv(loc, value);
    } else {
      switch (u.type) {
        case gl.FLOAT: gl.uniform1f(loc, value); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(loc, value); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(loc, value); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(loc, value); break;
        case gl.INT: case gl.BOOL: case gl.SAMPLER_2D: gl.uniform1i(loc, value); break;
      }
    }
  }

  attribLoc(name: string) { return this.gl.getAttribLocation(this.program, name); }
  dispose() { this.gl.deleteProgram(this.program); }
}

export class FrameBuffer {
  private gl: GL;
  private fbo: WebGLFramebuffer;
  public texture: WebGLTexture;
  private w: number; private h: number;

  constructor(gl: GL, w: number, h: number) {
    this.gl = gl; this.w = w; this.h = h;
    const { fbo, texture } = this.create(w, h);
    this.fbo = fbo; this.texture = texture;
  }

  private create(w: number, h: number) {
    const gl = this.gl;
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { fbo, texture };
  }

  bind() { this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo); }
  unbind() { this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); }

  resize(w: number, h: number) {
    const gl = this.gl; this.w = w; this.h = h;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  dispose() { this.gl.deleteFramebuffer(this.fbo); this.gl.deleteTexture(this.texture); }
  get width() { return this.w; }
  get height() { return this.h; }
}

export class RenderPass {
  private gl: GL;
  public program: ShaderProgram;
  private fb: FrameBuffer | null;
  private vao: WebGLVertexArrayObject;

  constructor(gl: GL, source: ShaderSource, toScreen = false) {
    this.gl = gl;
    this.program = new ShaderProgram(gl, source);
    this.fb = toScreen ? null : new FrameBuffer(gl, gl.canvas.width, gl.canvas.height);
    this.vao = this.buildVAO();
  }

  private buildVAO() {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = this.program.attribLoc('a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  render(uniforms: Record<string, any> = {}) {
    const gl = this.gl;
    if (this.fb) this.fb.bind(); else gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.program.use();
    let texUnit = 0;
    for (const [name, val] of Object.entries(uniforms)) {
      if (val instanceof WebGLTexture) {
        gl.activeTexture(gl.TEXTURE0 + texUnit);
        gl.bindTexture(gl.TEXTURE_2D, val);
        this.program.set(name, texUnit++);
      } else {
        this.program.set(name, val);
      }
    }
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    if (this.fb) this.fb.unbind();
  }

  get outputTexture() { return this.fb?.texture ?? null; }

  resize(w: number, h: number) { this.fb?.resize(w, h); }

  dispose() {
    this.fb?.dispose();
    this.program.dispose();
    this.gl.deleteVertexArray(this.vao);
  }
}

export function computeGaussianWeights(radius: number): number[] {
  const sigma = radius / 3.0;
  const kernel: number[] = [];
  let sum = 0;
  for (let i = 0; i <= radius; i++) {
    const w = Math.exp(-0.5 * i * i / (sigma * sigma));
    kernel.push(w);
    sum += i === 0 ? w : w * 2;
  }
  return kernel.map(w => w / sum);
}

export function hexToVec3(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return [r, g, b];
}
