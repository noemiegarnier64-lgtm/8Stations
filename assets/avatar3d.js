/* 8Stations – avatars 3D réalistes
   Corps : MakeHuman (base mesh, cibles de morphologie et poids du squelette, licence CC0).
   Rendu : three.js r128 (global THREE). Les vêtements sont peints sur le corps par zones
   pré-calculées (assets/avatar.bin), les shorts amples et les chaussures sont légèrement gonflés. */
(function(){
  "use strict";
  const A = {};
  let data = null, loading = null;
  const BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*$/, "")) || "assets/";

  /* ---------- Données ---------- */
  function load(){
    if (data) return Promise.resolve(data);
    if (loading) return loading;
    loading = (async () => {
      const meta = await (await fetch(BASE + "avatar.json")).json();
      const buf = await (await fetch(BASE + "avatar.bin")).arrayBuffer();
      const T = {float32: Float32Array, int16: Int16Array, int8: Int8Array, uint16: Uint16Array, uint32: Uint32Array, uint8: Uint8Array};
      const arr = {};
      for (const a of meta.arrays) arr[a.name] = new T[a.type](buf, a.offset, a.length);
      data = {meta, arr, nV: meta.nV, bit: Object.fromEntries(meta.pieces.map((p, i) => [p, 1 << i]))};
      return data;
    })();
    loading.catch(() => { loading = null; });
    return loading;
  }

  /* ---------- Morphologie, pose, vêtements ---------- */
  function morph(sex, m){
    const g = sex === "F" ? "female" : "male", a = data.arr, n3 = data.nV * 3;
    const P = new Float32Array(a[g + ".pos"]);
    const add = (k, w) => { if (!w) return; const d = a[g + "." + k]; const f = w / 2000; for (let i = 0; i < n3; i++) P[i] += d[i] * f; };
    const bip = (k, v) => { if (v > 0) add(k + "+", v); else if (v < 0) add(k + "-", -v); };
    bip("muscle", m.muscle || 0); bip("weight", m.weight || 0); bip("height", m.height || 0);
    return P;
  }
  function centroid(P, idx){ let x = 0, y = 0, z = 0; for (const i of idx){ x += P[3*i]; y += P[3*i+1]; z += P[3*i+2]; } const n = idx.length; return [x/n, y/n, z/n]; }
  const rotZ = (x, y, pv, c, s) => [pv[0] + (x - pv[0]) * c - (y - pv[1]) * s, pv[1] + (x - pv[0]) * s + (y - pv[1]) * c];
  function poseArms(P, armDeg, foreDeg){
    const a = data.arr, n = data.nV, W = a.armW, F = a.foreW;
    for (const side of ["l", "r"]){
      const sg = side === "l" ? 1 : -1;
      const sh = centroid(P, a["anchor." + side + "-shoulder"]), el0 = centroid(P, a["anchor." + side + "-elbow"]);
      const t1 = -sg * armDeg * Math.PI / 180, c1 = Math.cos(t1), s1 = Math.sin(t1);
      const el = rotZ(el0[0], el0[1], sh, c1, s1);
      const t2 = -sg * foreDeg * Math.PI / 180, c2 = Math.cos(t2), s2 = Math.sin(t2);
      const pa = 30 * Math.PI / 180, cp = Math.cos(pa), sp = Math.sin(pa);
      for (let i = 0; i < n; i++){
        const x = P[3*i], y = P[3*i+1];
        if (sg * x <= 0) continue;
        const w = W[i] / 255; if (!w) continue;
        const wf = Math.min(w, F[i] / 255);
        const r1 = rotZ(x, y, sh, c1, s1);
        const r2 = wf ? rotZ(r1[0], r1[1], el, c2, s2) : r1;
        let r3 = r2, z3 = P[3*i+2];
        if (wf){ const dy = r2[1] - el[1], dz = P[3*i+2] - el0[2]; r3 = [r2[0], el[1] + dy * cp - dz * sp]; z3 = el0[2] + dy * sp + dz * cp; }
        P[3*i]   = (1 - w) * x + (w - wf) * r1[0] + wf * r3[0];
        P[3*i+1] = (1 - w) * y + (w - wf) * r1[1] + wf * r3[1];
        P[3*i+2] = (1 - wf) * P[3*i+2] + wf * z3;
      }
    }
  }
  function normals(P, idx){
    const N = new Float32Array(P.length);
    for (let k = 0; k < idx.length; k += 3){
      const a = idx[k]*3, b = idx[k+1]*3, c = idx[k+2]*3;
      const ux = P[b]-P[a], uy = P[b+1]-P[a+1], uz = P[b+2]-P[a+2], vx = P[c]-P[a], vy = P[c+1]-P[a+1], vz = P[c+2]-P[a+2];
      const nx = uy*vz-uz*vy, ny = uz*vx-ux*vz, nz = ux*vy-uy*vx;
      for (const o of [a, b, c]){ N[o] += nx; N[o+1] += ny; N[o+2] += nz; }
    }
    for (let i = 0; i < N.length; i += 3){ const l = Math.hypot(N[i], N[i+1], N[i+2]) || 1; N[i] /= l; N[i+1] /= l; N[i+2] /= l; }
    return N;
  }
  const col = hex => new THREE.Color(hex).convertSRGBToLinear();
  const TOPS = {F: {brassiere: "brassiere", crop: "crop", debardeur: "fdeb"}, H: {debardeur: "mdeb", tshirt: "tshirt", none: null}};
  const BOTTOMS = {F: {cycliste: "cycliste", legging: "legging", short: "fshort"}, H: {short: "mshort"}};

  function adjacency(){
    if (data.adj) return data.adj;
    const idx = data.arr["idx.body"], n = data.nV, sets = Array.from({length: n}, () => new Set());
    for (let k = 0; k < idx.length; k += 3){ const a = idx[k], b = idx[k+1], c = idx[k+2]; sets[a].add(b).add(c); sets[b].add(a).add(c); sets[c].add(a).add(b); }
    const off = new Uint32Array(n + 1); for (let i = 0; i < n; i++) off[i+1] = off[i] + sets[i].size;
    const nb = new Uint16Array(off[n]); for (let i = 0; i < n; i++){ let k = off[i]; for (const j of sets[i]) nb[k++] = j; }
    return (data.adj = {off, nb});
  }
  const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const NONE = new Float32Array(0);
  function margin(name){ if (!name) return null; const m = data.arr["m." + name], f = new Float32Array(m.length); for (let i = 0; i < m.length; i++) f[i] = m[i] / 100; return f; }

  function buildAvatar(cfg){
    const a = data.arr, n = data.nV, loose = a.loose, body = a["idx.body"];
    const P = morph(cfg.sex, cfg.morph || {});
    poseArms(P, cfg.sex === "F" ? 31 : 30, 8);
    const topK = TOPS[cfg.sex][cfg.top.t] || null, botK = BOTTOMS[cfg.sex][cfg.bottom.t] || (cfg.sex === "F" ? "cycliste" : "mshort");
    const minus = new Float32Array(n).fill(-1);
    const mTop = margin(topK) || minus, mBot = margin(botK), mShoe = margin("shoes"), mBrow = margin("brows"), mLip = margin("lips"), mScalp = margin(cfg.sex === "F" ? "scalpF" : "scalpH");
    // 1) le tissu lisse le relief du corps
    const {off, nb} = adjacency(), wS = new Float32Array(n);
    for (let i = 0; i < n; i++) wS[i] = Math.max(sstep(-0.05, 0.15, mTop[i]), sstep(-0.05, 0.15, mBot[i]), sstep(-0.05, 0.15, mShoe[i]) );
    const Q = new Float32Array(P.length);
    for (let it = 0; it < 4; it++){
      Q.set(P);
      for (let i = 0; i < n; i++){ const w = wS[i] * 0.6; if (!w || off[i+1] === off[i]) continue;
        let sx = 0, sy = 0, sz = 0; const k0 = off[i], k1 = off[i+1];
        for (let k = k0; k < k1; k++){ const j = nb[k]; sx += Q[3*j]; sy += Q[3*j+1]; sz += Q[3*j+2]; }
        const c = k1 - k0; if (!c) continue; P[3*i] += (sx / c - Q[3*i]) * w; P[3*i+1] += (sy / c - Q[3*i+1]) * w; P[3*i+2] += (sz / c - Q[3*i+2]) * w; }
    }
    // 2) épaisseur des vêtements, fondue au bord
    const N0 = normals(P, body);
    for (let i = 0; i < n; i++){
      const s = sstep(0, 0.12, mShoe[i]), t = sstep(0, 0.12, mTop[i]), b = sstep(0, 0.12, mBot[i]);
      let d = s * 0.08;
      if (!s) d = Math.max(t * (topK === "tshirt" ? 0.07 : 0.03), b * (botK === "mshort" ? 0.04 + 0.3 * loose[i] / 255 : botK === "fshort" ? 0.05 : 0.025));
      if (d){ P[3*i] += N0[3*i] * d; P[3*i+1] += N0[3*i+1] * d; P[3*i+2] += N0[3*i+2] * d; }
    }
    const N = normals(P, body);
    const skin = col(cfg.skin), cTop = col(cfg.top.c), cBot = col(cfg.bottom.c), cHair = col(cfg.hair || "#2B1E16");
    const cShoe = col(cfg.shoe || "#F1F1F4"), cLip = skin.clone().lerp(col("#A0464E"), 0.4);
    const group = new THREE.Group();
    const pos = new THREE.BufferAttribute(P, 3), nor = new THREE.BufferAttribute(N, 3);
    // 3) couleurs calculées au pixel : frontières nettes
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", pos); g.setAttribute("normal", nor); g.setIndex(new THREE.BufferAttribute(body, 1));
    for (const [k, v] of [["mTop", mTop], ["mBot", mBot], ["mShoe", mShoe], ["mBrow", mBrow], ["mLip", mLip], ["mScalp", mScalp]]) g.setAttribute(k, new THREE.BufferAttribute(v, 1));
    const mat = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.6, metalness: 0});
    mat.extensions = {derivatives: true};
    let minY0 = 1e9; for (let i = 1; i < P.length; i += 3) if (P[i] < minY0) minY0 = P[i];
    const U = {uSole: {value: minY0 + 0.22}, uSkin: {value: skin}, uTop: {value: cTop}, uBot: {value: cBot}, uShoe: {value: cShoe}, uHair: {value: cHair}, uLip: {value: cLip}};
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = "attribute float mTop,mBot,mShoe,mBrow,mLip,mScalp;\nvarying float vTop,vBot,vShoe,vBrow,vLip,vScalp,vY;\n" +
        sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvTop=mTop;vBot=mBot;vShoe=mShoe;vBrow=mBrow;vLip=mLip;vScalp=mScalp;vY=position.y;");
      sh.fragmentShader = "varying float vTop,vBot,vShoe,vBrow,vLip,vScalp,vY;\nuniform float uSole;\nuniform vec3 uSkin,uTop,uBot,uShoe,uHair,uLip;\nfloat cov(float m){float w=fwidth(m)*0.8+1e-4;return smoothstep(-w,w,m);}\n" +
        sh.fragmentShader
          .replace("#include <color_fragment>", `#include <color_fragment>
            vec3 cc=uSkin; float cRough=0.55;
            cc=mix(cc,uLip,cov(vLip)*0.8);
            cc=mix(cc,uHair,cov(vBrow)*0.75);
            float kb=cov(vBot); cc=mix(cc,uBot,kb); cRough=mix(cRough,0.82,kb);
            float kt=cov(vTop); cc=mix(cc,uTop,kt); cRough=mix(cRough,0.8,kt);
            float ks=cov(vShoe); cc=mix(cc,uShoe,ks); cRough=mix(cRough,0.45,ks); cc=mix(cc,vec3(0.05,0.05,0.06),ks*smoothstep(uSole+0.03,uSole-0.03,vY)); cc=mix(cc,uTop,ks*smoothstep(0.05,0.0,abs(vY-uSole-0.32))*0.9);
            float kh=cov(vScalp); cc=mix(cc,uHair,kh); cRough=mix(cRough,0.5,kh);
            diffuseColor.rgb=cc;`)
          .replace("float roughnessFactor = roughness;", "float roughnessFactor = cRough;");
    };
    const bodyMesh = new THREE.Mesh(g, mat); bodyMesh.castShadow = true; group.add(bodyMesh);
    // cheveux : coque sur le crâne, amincie jusqu'à la ligne du front
    const hairMat = new THREE.MeshStandardMaterial({color: cHair, roughness: 0.5, metalness: 0});
    const th = cfg.sex === "F" ? 0.17 : 0.07, HP = new Float32Array(P), hIdx = [];
    for (let i = 0; i < n; i++){ const k = sstep(0, 0.3, mScalp[i]) * th; if (k){ HP[3*i] += N[3*i] * k; HP[3*i+1] += N[3*i+1] * k; HP[3*i+2] += N[3*i+2] * k; } }
    for (let k = 0; k < body.length; k += 3){ if (mScalp[body[k]] > 0 && mScalp[body[k+1]] > 0 && mScalp[body[k+2]] > 0) hIdx.push(body[k], body[k+1], body[k+2]); }
    const hg = new THREE.BufferGeometry(); hg.setAttribute("position", new THREE.BufferAttribute(HP, 3)); hg.setIndex(hIdx); hg.computeVertexNormals();
    const hair = new THREE.Mesh(hg, hairMat); hair.castShadow = true; group.add(hair);
    if (cfg.sex === "F"){ // queue de cheval
      let top = -1e9, back = 1e9;
      for (let i = 0; i < n; i++) if (mScalp[i] > 0){ top = Math.max(top, HP[3*i+1]); back = Math.min(back, HP[3*i+2]); }
      // queue de cheval haute : attache sur le haut de l'arrière du crâne, tombe dans le dos
      const prof = [[0, 0.25], [0.3, 0.12], [0.5, -0.5], [0.52, -1.4], [0.4, -2.4], [0.2, -3.3], [0.05, -3.8], [0, -3.85]].map(q => new THREE.Vector2(q[0], q[1]));
      const tail = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), hairMat);
      const ty = top - 0.55, tz = back + 0.25;
      tail.position.set(0, ty, tz - 0.15); tail.rotation.x = 0.42; tail.scale.set(1, 1, 0.8); tail.castShadow = true; group.add(tail);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 10, 24), new THREE.MeshStandardMaterial({color: cTop, roughness: 0.6}));
      tie.position.set(0, ty + 0.05, tz - 0.12); tie.rotation.x = Math.PI / 2 + 0.42; group.add(tie);
    }
    // yeux
    for (const e of ["helper-l-eye", "helper-r-eye"]){
      const idx = a["idx." + e], vs = [...new Set(idx)], c = centroid(P, vs);
      let rad = 0; for (const i of vs) rad = Math.max(rad, Math.hypot(P[3*i]-c[0], P[3*i+1]-c[1], P[3*i+2]-c[2]));
      const EC = new Float32Array(P.length), iris = col(cfg.eyes || "#4A3424"), white = col("#EDE8E2"), pupil = col("#0A0A0A");
      for (const i of vs){ const f = (P[3*i+2] - c[2]) / rad, ce = f > 0.93 ? pupil : f > 0.78 ? iris : white; EC[3*i] = ce.r; EC[3*i+1] = ce.g; EC[3*i+2] = ce.b; }
      const eg = new THREE.BufferGeometry(); eg.setAttribute("position", pos); eg.setAttribute("color", new THREE.BufferAttribute(EC, 3)); eg.setIndex(new THREE.BufferAttribute(idx, 1)); eg.computeVertexNormals();
      group.add(new THREE.Mesh(eg, new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.15})));
    }
    let minY = 1e9; for (let i = 1; i < P.length; i += 3) if (P[i] < minY) minY = P[i];
    group.position.y = -minY;
    return group;
  }

  /* ---------- Scène ---------- */
  let renderer, scene, camera, root, el, rotY = 0, raf = 0;
  function ensure(container){
    if (renderer && el === container) return true;
    try {
      renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
    } catch (e) { return false; }
    el = container;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab";
    container.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(26, 1, 1, 400);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2440, 0.6));
    const key = new THREE.DirectionalLight(0xfff6ee, 1.15); key.position.set(-14, 26, 30); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, {left: -16, right: 16, top: 22, bottom: -4, near: 1, far: 90}); key.shadow.bias = -0.0008;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(20, 10, 18); scene.add(fill);
    const rimP = new THREE.DirectionalLight(0xff2e88, 0.75); rimP.position.set(-22, 12, -20); scene.add(rimP);
    const rimB = new THREE.DirectionalLight(0x2ec5ff, 0.75); rimB.position.set(22, 12, -20); scene.add(rimB);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({opacity: 0.35}));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    root = new THREE.Group(); scene.add(root);
    // rotation au doigt / à la souris
    let drag = null;
    const cv = renderer.domElement;
    cv.addEventListener("pointerdown", e => { drag = {x: e.clientX, r: rotY}; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; });
    cv.addEventListener("pointermove", e => { if (!drag) return; rotY = drag.r + (e.clientX - drag.x) * 0.012; applyRot(); draw(); });
    const end = () => { drag = null; cv.style.cursor = "grab"; };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    new ResizeObserver(() => { size(); draw(); }).observe(container);
    size();
    return true;
  }
  function applyRot(){ if (root) root.children.forEach(c => c.rotation.y = rotY); }
  function size(){
    if (!renderer) return;
    const w = el.clientWidth || 300, h = el.clientHeight || 400;
    renderer.setSize(w, h, false); camera.aspect = w / h; frame();
  }
  function frame(){
    const n = root ? root.children.length : 1, halfW = n > 1 ? 7.4 : 4.2, bottom = -2.6;
    let top = 18.4; if (root && root.children.length){ const bb = new THREE.Box3().setFromObject(root); if (isFinite(bb.max.y)) top = bb.max.y + 0.5; }
    const vH = top - bottom, fov = camera.fov * Math.PI / 180;
    const dV = (vH / 2) / Math.tan(fov / 2), dW = halfW / (Math.tan(fov / 2) * camera.aspect);
    const d = Math.max(dV, dW) * 1.04;
    camera.position.set(0, (top + bottom) / 2 + 1.2, d); camera.lookAt(0, (top + bottom) / 2, 0); camera.updateProjectionMatrix();
  }
  function draw(){ if (!renderer) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => renderer.render(scene, camera)); }

  A.supported = function(){ try { const c = document.createElement("canvas"); return !!(window.THREE && (c.getContext("webgl2") || c.getContext("webgl"))); } catch (e) { return false; } };
  A.show = async function(container, cast){
    if (!A.supported() || !ensure(container)) throw new Error("webgl");
    await load();
    root.children.slice().forEach(ch => { root.remove(ch); ch.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); });
    const gap = 7.0;
    cast.forEach((c, i) => { const g = buildAvatar(c); g.position.x = (i - (cast.length - 1) / 2) * gap; root.add(g); });
    applyRot(); frame(); draw();
  };
  A.resetView = function(){ rotY = 0; applyRot(); draw(); };
  A.setRotation = function(r){ rotY = r; applyRot(); draw(); };
  window.Avatar3D = A;
})();
