// The Flash Electric: hero lightning bolt.
// Reads the supplied glTF's binary buffer directly (positions, normals, indices) and draws it with raw WebGL.
// No library. Falls back to the poster image when WebGL or the model is unavailable.
const host = document.getElementById('bolt');
if (host) boot(host).catch(() => {});

async function boot(host) {
  const canvas = host.querySelector('canvas');
  const posterMode = new URLSearchParams(location.search).has('poster');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: posterMode });
  if (!gl) return;

  const buf = await (await fetch(host.dataset.model)).arrayBuffer();
  // accessor layout from scene.gltf: indices u32 @0 (1080), uv @4320, positions f32x3 @7248 (366), normals f32x3 @7248+4392 (366)
  const COUNT = 366, IDX = 1080, POS_OFF = 7248, NRM_OFF = 7248 + 4392;
  const rawP = new Float32Array(buf, POS_OFF, COUNT * 3), rawN = new Float32Array(buf, NRM_OFF, COUNT * 3);
  const indices = new Uint32Array(buf.slice(0, IDX * 4));

  // the bolt lies in the model's X/Z plane and is extruded along Y: stand it up (v = -z) and exaggerate depth a little
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < COUNT; i++) { const x = rawP[i * 3], z = rawP[i * 3 + 2]; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, s = 2 / (maxZ - minZ), DEPTH = 1.9;
  const P = new Float32Array(COUNT * 3), N = new Float32Array(COUNT * 3), H = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    P[i * 3] = (rawP[i * 3] - cx) * s;
    P[i * 3 + 1] = -(rawP[i * 3 + 2] - cz) * s;
    P[i * 3 + 2] = rawP[i * 3 + 1] * s * DEPTH;
    N[i * 3] = rawN[i * 3]; N[i * 3 + 1] = -rawN[i * 3 + 2]; N[i * 3 + 2] = rawN[i * 3 + 1];
    H[i] = (P[i * 3 + 1] + 1) / 2;
  }

  const vs = `attribute vec3 aPos; attribute vec3 aNrm; attribute float aH;
  uniform mat3 uRot; uniform float uAspect; varying vec3 vN; varying float vH; varying vec3 vP;
  void main(){ vec3 p = uRot * aPos; vN = uRot * aNrm; vH = aH; vP = p;
    float cam = 3.2; float w = cam - p.z; float f = 2.2;
    gl_Position = vec4(p.x * f / uAspect, p.y * f, (p.z + 3.0) * 0.1, w); }`;
  const fs = `precision mediump float; varying vec3 vN; varying float vH; varying vec3 vP;
  uniform vec3 uLight; uniform float uFlash;
  void main(){ vec3 n = normalize(vN);
    vec3 amber = vec3(1.0, 0.58, 0.03); vec3 ember = vec3(0.79, 0.25, 0.09); vec3 hot = vec3(1.0, 0.94, 0.80);
    vec3 base = mix(ember, amber, smoothstep(0.0, 1.0, vH));
    float diff = max(dot(n, normalize(uLight)), 0.0);
    float fres = pow(1.0 - abs(n.z), 2.2);
    float face = pow(abs(n.z), 5.0);
    vec3 h = normalize(normalize(uLight) + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, h), 0.0), 40.0);
    vec3 col = base * (0.95 + 0.45 * diff) * (0.85 + 0.35 * face) + hot * (fres * 0.75 + face * 0.12 + spec * 0.7);
    col *= 1.0 + uFlash * 0.9;
    gl_FragColor = vec4(min(col, vec3(1.0)), 1.0); }`;

  const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
  gl.useProgram(prog);
  const attr = (name, data, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); };
  attr('aPos', P, 3); attr('aNrm', N, 3); attr('aH', H, 1);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  let idxType = gl.UNSIGNED_INT, idxData = indices;
  if (!gl.getExtension('OES_element_index_uint')) { idxType = gl.UNSIGNED_SHORT; idxData = new Uint16Array(indices); }
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);
  const uRot = gl.getUniformLocation(prog, 'uRot'), uAspect = gl.getUniformLocation(prog, 'uAspect'), uLight = gl.getUniformLocation(prog, 'uLight'), uFlash = gl.getUniformLocation(prog, 'uFlash');
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 0);

  let W = 0, Hh = 0;
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2), r = host.getBoundingClientRect();
    const w = posterMode ? 900 : Math.max(2, Math.round(r.width * dpr)), h = posterMode ? 1100 : Math.max(2, Math.round(r.height * dpr));
    if (w !== W || h !== Hh) { W = w; Hh = h; canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  };
  const mat = (yaw, pitch) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // R = Ry(yaw) * Rx(pitch); GL wants column-major
    const r00 = cy, r01 = sy * sp, r02 = sy * cp, r10 = 0, r11 = cp, r12 = -sp, r20 = -sy, r21 = cy * sp, r22 = cy * cp;
    return new Float32Array([r00, r10, r20, r01, r11, r21, r02, r12, r22]);
  };
  const draw = (yaw, pitch, flash) => {
    size(); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix3fv(uRot, false, mat(yaw, pitch)); gl.uniform1f(uAspect, W / Hh);
    gl.uniform3f(uLight, -0.5 + Math.sin(yaw) * 0.8, 0.7, 0.9); gl.uniform1f(uFlash, flash);
    gl.drawElements(gl.TRIANGLES, idxData.length, idxType, 0);
  };

  if (posterMode) { window.__bolt = { draw, png: (y, p) => { draw(y, p, 0); return canvas.toDataURL('image/png'); } }; return; }

  let px = 0, py = 0, tx = 0, ty = 0, flash = 0, nextFlash = performance.now() + 3500, running = false, raf = 0;
  addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  const frame = (t) => {
    px += (tx - px) * 0.06; py += (ty - py) * 0.06;
    if (t > nextFlash) { flash = 1; nextFlash = t + 6000 + Math.random() * 5000; document.getElementById('flash')?.classList.remove('is-on'); void document.getElementById('flash')?.offsetWidth; document.getElementById('flash')?.classList.add('is-on'); }
    flash *= 0.9;
    draw(t / 1000 * 1.05 + px * 0.5, py * 0.2 - 0.05, flash);
    if (running) raf = requestAnimationFrame(frame);
  };
  draw(0.35, -0.04, 0);
  host.classList.add('is-live');
  if (reduce) return;
  const io = new IntersectionObserver(([en]) => { if (en.isIntersecting && !running) { running = true; raf = requestAnimationFrame(frame); } else if (!en.isIntersecting) { running = false; cancelAnimationFrame(raf); } });
  io.observe(host);
  addEventListener('resize', () => draw(0.35, -0.04, 0));
}
