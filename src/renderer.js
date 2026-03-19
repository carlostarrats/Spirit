import { mat4 } from './math.js';

import quadVert from './shaders/quad.vert.glsl?raw';
import skyFrag from './shaders/sky.frag.glsl?raw';
import terrainVert from './shaders/terrain.vert.glsl?raw';
import terrainFrag from './shaders/terrain.frag.glsl?raw';
import branchVert from './shaders/branch.vert.glsl?raw';
import branchFrag from './shaders/branch.frag.glsl?raw';
import grassVert from './shaders/grass.vert.glsl?raw';
import grassFrag from './shaders/grass.frag.glsl?raw';
import particleVert from './shaders/particle.vert.glsl?raw';
import particleFrag from './shaders/particle.frag.glsl?raw';
import brightFrag from './shaders/bright.frag.glsl?raw';
import blurFrag from './shaders/blur.frag.glsl?raw';
import postFrag from './shaders/post.frag.glsl?raw';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;
    this.programs = {};
    this.uniforms = {};
    this.vaos = {};
    this.buffers = {};
    this.fbos = {};
    this.textures = {};
    this.width = 0;
    this.height = 0;
    this.terrainIdxCount = 0;
    this.initPrograms();
    this.initGeometry();
  }

  compile(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader:', gl.getShaderInfoLog(s)); return null;
    }
    return s;
  }

  link(vSrc, fSrc, name) {
    const gl = this.gl;
    const v = this.compile(gl.VERTEX_SHADER, vSrc);
    const f = this.compile(gl.FRAGMENT_SHADER, fSrc);
    if (!v || !f) return null;
    const p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('Link ' + name + ':', gl.getProgramInfoLog(p)); return null;
    }
    const u = {};
    const cnt = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < cnt; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    this.uniforms[name] = u;
    return p;
  }

  initPrograms() {
    const P = this.programs;
    P.sky = this.link(quadVert, skyFrag, 'sky');
    P.terrain = this.link(terrainVert, terrainFrag, 'terrain');
    P.branch = this.link(branchVert, branchFrag, 'branch');
    P.grass = this.link(grassVert, grassFrag, 'grass');
    P.particle = this.link(particleVert, particleFrag, 'particle');
    P.bright = this.link(quadVert, brightFrag, 'bright');
    P.blur = this.link(quadVert, blurFrag, 'blur');
    P.post = this.link(quadVert, postFrag, 'post');
  }

  initGeometry() {
    const gl = this.gl;

    // quad
    this.vaos.quad = gl.createVertexArray();
    gl.bindVertexArray(this.vaos.quad);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,1,1,-1,1]), gl.STATIC_DRAW);
    const qi = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, qi);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,0,2,3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // terrain
    this.vaos.terrain = gl.createVertexArray();
    gl.bindVertexArray(this.vaos.terrain);
    this.buffers.terrainV = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.terrainV);
    const tLoc = gl.getAttribLocation(this.programs.terrain, 'aPosition');
    gl.enableVertexAttribArray(tLoc);
    gl.vertexAttribPointer(tLoc, 3, gl.FLOAT, false, 0, 0);
    this.buffers.terrainI = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.terrainI);
    gl.bindVertexArray(null);

    // branches (x,y,z,bright per vertex)
    this.vaos.branch = gl.createVertexArray();
    gl.bindVertexArray(this.vaos.branch);
    this.buffers.branchV = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.branchV);
    const bpL = gl.getAttribLocation(this.programs.branch, 'aPosition');
    const bbL = gl.getAttribLocation(this.programs.branch, 'aBrightness');
    gl.enableVertexAttribArray(bpL);
    gl.vertexAttribPointer(bpL, 3, gl.FLOAT, false, 16, 0);
    if (bbL >= 0) { gl.enableVertexAttribArray(bbL); gl.vertexAttribPointer(bbL, 1, gl.FLOAT, false, 16, 12); }
    gl.bindVertexArray(null);

    // stones (same format as branches)
    this.vaos.stone = gl.createVertexArray();
    gl.bindVertexArray(this.vaos.stone);
    this.buffers.stoneV = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.stoneV);
    const spL = gl.getAttribLocation(this.programs.branch, 'aPosition');
    const sbL = gl.getAttribLocation(this.programs.branch, 'aBrightness');
    gl.enableVertexAttribArray(spL);
    gl.vertexAttribPointer(spL, 3, gl.FLOAT, false, 16, 0);
    if (sbL >= 0) { gl.enableVertexAttribArray(sbL); gl.vertexAttribPointer(sbL, 1, gl.FLOAT, false, 16, 12); }
    gl.bindVertexArray(null);

    // nodes
    this.vaos.nodes = gl.createVertexArray();
    gl.bindVertexArray(this.vaos.nodes);
    this.buffers.nodeV = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.nodeV);
    const npL = gl.getAttribLocation(this.programs.particle, 'aPosition');
    const nbL = gl.getAttribLocation(this.programs.particle, 'aBrightness');
    gl.enableVertexAttribArray(npL);
    gl.vertexAttribPointer(npL, 3, gl.FLOAT, false, 16, 0);
    if (nbL >= 0) { gl.enableVertexAttribArray(nbL); gl.vertexAttribPointer(nbL, 1, gl.FLOAT, false, 16, 12); }
    gl.bindVertexArray(null);

    // particles
    this.vaos.particle = gl.createVertexArray();
    gl.bindVertexArray(this.vaos.particle);
    this.buffers.particleD = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.particleD);
    const ppL = gl.getAttribLocation(this.programs.particle, 'aPosition');
    const pbL = gl.getAttribLocation(this.programs.particle, 'aBrightness');
    gl.enableVertexAttribArray(ppL);
    gl.vertexAttribPointer(ppL, 3, gl.FLOAT, false, 16, 0);
    if (pbL >= 0) { gl.enableVertexAttribArray(pbL); gl.vertexAttribPointer(pbL, 1, gl.FLOAT, false, 16, 12); }
    gl.bindVertexArray(null);

    // grass (6 floats per vertex: x, baseY, z, height, phase, vertexT)
    this.vaos.grass = gl.createVertexArray();
    gl.bindVertexArray(this.vaos.grass);
    this.buffers.grassV = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.grassV);
    const gProg = this.programs.grass;
    const attrs = ['aX', 'aBaseY', 'aZ', 'aHeight', 'aPhase', 'aVertexT'];
    for (let i = 0; i < attrs.length; i++) {
      const loc = gl.getAttribLocation(gProg, attrs[i]);
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 24, i * 4);
      }
    }
    gl.bindVertexArray(null);
  }

  resize(w, h) {
    if (w === this.width && h === this.height) return;
    this.width = w; this.height = h;
    this.canvas.width = w; this.canvas.height = h;
    this.initFBOs();
  }

  initFBOs() {
    const gl = this.gl, w = this.width, h = this.height;
    if (!w || !h) return;
    for (const k of Object.keys(this.fbos)) gl.deleteFramebuffer(this.fbos[k]);
    for (const k of Object.keys(this.textures)) gl.deleteTexture(this.textures[k]);
    if (this._depthRB) gl.deleteRenderbuffer(this._depthRB);
    this.makeFBO('scene', w, h, true);
    const qw = w >> 2, qh = h >> 2;
    this.makeFBO('bright', qw, qh, false);
    this.makeFBO('blur1', qw, qh, false);
    this.makeFBO('blur2', qw, qh, false);
  }

  makeFBO(name, w, h, depth) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.textures[name] = tex;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (depth) {
      const rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      this._depthRB = rb;
    }
    this.fbos[name] = fbo;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  uploadWorld(world) {
    const gl = this.gl;
    if (world.branchVerts?.length) { gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.branchV); gl.bufferData(gl.ARRAY_BUFFER, world.branchVerts, gl.STATIC_DRAW); }
    if (world.nodeVerts?.length) { gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.nodeV); gl.bufferData(gl.ARRAY_BUFFER, world.nodeVerts, gl.STATIC_DRAW); }
    if (world.stoneVerts?.length) { gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.stoneV); gl.bufferData(gl.ARRAY_BUFFER, world.stoneVerts, gl.STATIC_DRAW); }
  }

  uploadTerrain(world) {
    const gl = this.gl;
    if (world.terrainVerts) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.terrainV);
      gl.bufferData(gl.ARRAY_BUFFER, world.terrainVerts, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.terrainI);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, world.terrainIndices, gl.DYNAMIC_DRAW);
      this.terrainIdxCount = world.terrainIdxCount;
    }
  }

  uploadGrass(world) {
    const gl = this.gl;
    if (world.grassVerts?.length) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.grassV);
      gl.bufferData(gl.ARRAY_BUFFER, world.grassVerts, gl.DYNAMIC_DRAW);
    }
  }

  uploadParticles(data) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.particleD);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }

  render(camera, world, time) {
    const gl = this.gl, U = this.uniforms;

    const proj = mat4.create();
    mat4.perspective(proj, Math.PI / 3, this.width / this.height, 0.1, 250);
    const view = mat4.create();
    mat4.lookAt(view, camera.position, camera.target, [0, 1, 0]);
    const vp = mat4.create();
    mat4.multiply(vp, proj, view);

    // Render directly to screen — no FBOs
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0.0, 0.0, 0.008, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);

    // Sky
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(this.programs.sky);
    gl.bindVertexArray(this.vaos.quad);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.depthMask(true);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // Terrain
    if (this.terrainIdxCount > 0) {
      gl.useProgram(this.programs.terrain);
      gl.uniformMatrix4fv(U.terrain.uViewProj, false, vp);
      gl.uniform3fv(U.terrain.uCameraPos, camera.position);
      gl.bindVertexArray(this.vaos.terrain);
      gl.drawElements(gl.TRIANGLES, this.terrainIdxCount, gl.UNSIGNED_INT, 0);
    }

    // Grass
    if (world.grassVertCount > 0) {
      gl.useProgram(this.programs.grass);
      gl.uniformMatrix4fv(U.grass.uViewProj, false, vp);
      gl.uniform3fv(U.grass.uCameraPos, camera.position);
      gl.uniform1f(U.grass.uTime, time);
      gl.bindVertexArray(this.vaos.grass);
      gl.drawArrays(gl.LINES, 0, world.grassVertCount);
    }

    // Stones
    if (world.stoneVertCount > 0) {
      gl.useProgram(this.programs.branch);
      gl.uniformMatrix4fv(U.branch.uViewProj, false, vp);
      gl.uniform3fv(U.branch.uCameraPos, camera.position);
      gl.bindVertexArray(this.vaos.stone);
      gl.drawArrays(gl.LINES, 0, world.stoneVertCount);
    }

    // Branches
    if (world.branchCount > 0) {
      gl.useProgram(this.programs.branch);
      gl.uniformMatrix4fv(U.branch.uViewProj, false, vp);
      gl.uniform3fv(U.branch.uCameraPos, camera.position);
      gl.bindVertexArray(this.vaos.branch);
      gl.drawArrays(gl.LINES, 0, world.branchCount);
    }

    // Additive particles + nodes
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.depthMask(false);

    gl.useProgram(this.programs.particle);
    gl.uniformMatrix4fv(U.particle.uViewProj, false, vp);
    gl.uniform3fv(U.particle.uCameraPos, camera.position);

    if (world.nodeCount > 0) {
      gl.bindVertexArray(this.vaos.nodes);
      gl.drawArrays(gl.POINTS, 0, world.nodeCount);
    }
    if (world.maxParticles > 0) {
      gl.bindVertexArray(this.vaos.particle);
      gl.drawArrays(gl.POINTS, 0, world.maxParticles);
    }

    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }
}
