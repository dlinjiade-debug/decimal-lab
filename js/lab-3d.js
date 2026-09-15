/* ==========================================================================
 *  lab-3d.js —— 小数点实验室 · 三个 Three.js 3D 实验台
 *  ------------------------------------------------------------------
 *  1) areaLab   3D 面积积木台   小数乘法算理：0.3 × 0.2 = 6 格 = 0.06
 *  2) moverLab  3D 同步搬运轨道 小数除法转化：被除数 / 除数 同时右移小数点
 *  3) balanceLab 3D 天平        简易方程：等式性质（两边同加减乘除）
 *
 *  依赖：lib/three.min.js (r137) + lib/OrbitControls.js
 *  所有实验台返回一个 handle，页面通过 handle 操作场景。
 * ========================================================================== */
(function (root) {
  "use strict";

  if (!root.THREE) {
    root.Lab3D = { supported: false, reason: "three.js 未加载" };
    return;
  }
  var T = root.THREE;

  var PALETTE = {
    bg: 0x101a17,
    grid: 0x3a4a42,
    plate: 0x1e2a24,      // 未参与计算的格子：压暗，衬托彩色块
    /* 下面三组是「彩色粉笔」，直接上 3D 表面。
       注意：不要用 CSS 里那套浅粉笔色（浅青/浅粉），被光照一冲就都变白、分不出来。 */
    cyan: 0x2b9fc0,       // 因数的横条
    cyanE: 0x0e5f77,
    pink: 0xd1547a,       // 因数的竖条
    pinkE: 0x7a1f3d,
    green: 0x63c46a,      // 两条交叉出来的积
    greenE: 0x2c6b33
  };

  /* ======================= 通用：文字贴图 ======================= */
  function textTexture(text, o) {
    o = o || {};
    var w = o.w || 256, h = o.h || 256;
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var g = c.getContext("2d");
    if (o.bg) {
      g.fillStyle = o.bg;
      roundRect(g, 6, 6, w - 12, h - 12, o.radius == null ? 28 : o.radius);
      g.fill();
    }
    g.fillStyle = o.color || "#ffffff";
    var size = o.size || 150;
    g.font = (o.weight || 800) + " " + size + "px " + (o.font || '"Segoe UI", "Microsoft YaHei", system-ui, sans-serif');
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (o.shadow) { g.shadowColor = o.shadow; g.shadowBlur = 22; }
    g.fillText(text, w / 2, h / 2 + (o.dy || 0));
    var t = new T.CanvasTexture(c);
    t.anisotropy = 4;
    if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
    t.needsUpdate = true;
    return t;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* ======================= 通用：舞台 ======================= */
  function createStage(canvas, o) {
    o = o || {};
    var renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) { return null; }
    if (!renderer || !renderer.getContext()) return null;

    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    var scene = new T.Scene();
    scene.fog = new T.Fog(PALETTE.bg, 26, 52);

    var camera = new T.PerspectiveCamera(o.fov || 42, 1, 0.1, 200);
    var cam = o.cam || [11, 12, 14];
    camera.position.set(cam[0], cam[1], cam[2]);

    var controls = null;
    if (T.OrbitControls) {
      controls = new T.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.minDistance = o.minDist || 7;
      controls.maxDistance = o.maxDist || 40;
      controls.minPolarAngle = 0.12;
      controls.maxPolarAngle = o.maxPolar == null ? 1.44 : o.maxPolar;
      var tgt = o.target || [0, 0, 0];
      controls.target.set(tgt[0], tgt[1], tgt[2]);
      controls.autoRotate = !!o.autoRotate;
      controls.autoRotateSpeed = o.autoRotateSpeed || 0.55;
      controls.update();
    }

    // 灯光（粉笔教室：暖白主光 + 淡青轮廓光）
    scene.add(new T.HemisphereLight(0xdfe8d8, 0x101a17, 0.42));
    var key = new T.DirectionalLight(0xfff6e2, 0.88);
    key.position.set(9, 16, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1; key.shadow.camera.far = 60;
    key.shadow.camera.left = -16; key.shadow.camera.right = 16;
    key.shadow.camera.top = 16; key.shadow.camera.bottom = -16;
    key.shadow.bias = -0.0012;
    scene.add(key);
    var rim = new T.DirectionalLight(0x9fd8c8, 0.4);
    rim.position.set(-10, 8, -12);
    scene.add(rim);
    var fill = new T.PointLight(0xa6e79c, 0.3, 40);
    fill.position.set(0, 6, 8);
    scene.add(fill);

    var raf = null, visible = true, last = 0;
    var hooks = [];
    var lastRect = null;
    function loop(now) {
      raf = root.requestAnimationFrame(loop);
      if (!visible) return;
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      for (var i = 0; i < hooks.length; i++) hooks[i](dt);
      if (controls) controls.update();
      renderer.render(scene, camera);
    }

    function resize() {
      var p = canvas.parentElement || canvas;
      var w = Math.max(120, p.clientWidth || canvas.clientWidth || 600);
      var h = Math.max(160, o.height || canvas.clientHeight || 440);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (lastRect) fitRect(lastRect[0], lastRect[1], lastRect[2], lastRect[3], lastRect[4]);
    }

    /** 让一个矩形（世界坐标，中心对齐）刚好落在视野里 */
    function fitRect(x0, y0, w, h, margin) {
      margin = margin == null ? 1.12 : margin;
      lastRect = [x0, y0, w, h, margin];
      var vFov = camera.fov * Math.PI / 180;
      var aspect = camera.aspect || 1.6;
      var distH = (h * margin / 2) / Math.tan(vFov / 2);
      var hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      var distW = (w * margin / 2) / Math.tan(hFov / 2);
      var dist = Math.max(distH, distW, 4);
      var cx = x0 + w / 2, cy = y0 + h / 2;
      if (controls) {
        controls.target.set(cx, cy, 0);
        controls.minDistance = dist * 0.45;
        controls.maxDistance = dist * 2.6;
      }
      camera.position.set(cx + w * 0.015, cy + h * 0.035, dist);
      camera.lookAt(cx, cy, 0);
      if (controls) controls.update();
    }
    fitRect(-3, -4, 6, 8);
    resize();

    if (root.ResizeObserver) {
      var ro = new ResizeObserver(resize);
      ro.observe(canvas.parentElement || canvas);
    } else {
      root.addEventListener("resize", resize);
    }
    if (root.IntersectionObserver) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
      }, { threshold: 0.02 }).observe(canvas);
    }
    raf = root.requestAnimationFrame(loop);

    return {
      renderer: renderer, scene: scene, camera: camera, controls: controls,
      onFrame: function (f) { hooks.push(f); },
      resize: resize,
      fitRect: fitRect,
      setAutoRotate: function (b) { if (controls) controls.autoRotate = b; },
      dispose: function () { if (raf) cancelAnimationFrame(raf); renderer.dispose(); }
    };
  }

  function addGroundGrid(stage, size, y) {
    var gh = new T.GridHelper(size, size, PALETTE.grid, PALETTE.grid);
    gh.position.y = y == null ? -0.02 : y;
    gh.material.transparent = true;
    gh.material.opacity = 0.55;
    stage.scene.add(gh);
    return gh;
  }

  /* ======================= 1) 3D 面积积木台 ======================= */
  function areaLab(canvas, opts) {
    opts = opts || {};
    var stage = createStage(canvas, {
      cam: [10.5, 12.5, 13.5], target: [0, 0.4, 0], autoRotate: false,
      minDist: 9, maxDist: 34, fov: 40, height: 460
    });
    if (!stage) return null;
    addGroundGrid(stage, 16, -0.06);

    var N = 10;              // 10 × 10 格，整块 = 1
    var GAP = 0.1;           // 格子间隙
    var units = [];          // {mesh, c, r, baseY, targetY, kind}

    // 整块底板（衬托 1 的边界）
    var frameMat = new T.MeshStandardMaterial({ color: 0x1a2621, roughness: .9, metalness: .05, transparent: true, opacity: .85 });
    var frame = new T.Mesh(new T.BoxGeometry(N + 0.5, 0.22, N + 0.5), frameMat);
    frame.position.y = -0.14;
    frame.receiveShadow = true;
    stage.scene.add(frame);

    var geo = new T.BoxGeometry(1 - GAP, 1, 1 - GAP);
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var mat = new T.MeshStandardMaterial({ color: PALETTE.plate, roughness: .55, metalness: .18 });
        var m = new T.Mesh(geo, mat);
        m.position.set((c - (N - 1) / 2) * 1, 0.06, (r - (N - 1) / 2) * 1);
        m.castShadow = true;
        m.receiveShadow = true;
        stage.scene.add(m);
        units.push({ mesh: m, mat: mat, c: c, r: r, baseY: 0.06, targetY: 0.06 });
      }
    }

    var state = {
      a: opts.a || 3,   // 横向格数（宽）
      b: opts.b || 2,   // 纵向格数（高）
      aT: opts.a || 3,
      bT: opts.b || 2
    };

    function refresh() {
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        var inA = u.c < state.aT;                 // 宽条（青色）
        var inB = u.r < state.bT;                 // 高条（粉色）
        var overlap = inA && inB;                 // 重叠 = 乘出来的积（绿色）
        if (overlap) {
          u.mat.color.setHex(PALETTE.green); u.mat.emissive.setHex(PALETTE.greenE);
          u.mat.emissiveIntensity = 0.55;
          u.targetY = 0.62;
        } else if (inA) {
          u.mat.color.setHex(PALETTE.cyan); u.mat.emissive.setHex(PALETTE.cyanE);
          u.mat.emissiveIntensity = 0.28;
          u.targetY = 0.18;
        } else if (inB) {
          u.mat.color.setHex(PALETTE.pink); u.mat.emissive.setHex(PALETTE.pinkE);
          u.mat.emissiveIntensity = 0.28;
          u.targetY = 0.18;
        } else {
          u.mat.color.setHex(PALETTE.plate); u.mat.emissive.setHex(0x000000);
          u.mat.emissiveIntensity = 0;
          u.targetY = 0.06;
        }
      }
    }

    stage.onFrame(function (dt) {
      // 平滑插值：a/b 变化与积木升起都是缓动的
      state.a += (state.aT - state.a) * Math.min(1, dt * 9);
      state.b += (state.bT - state.b) * Math.min(1, dt * 9);
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        u.mesh.position.y += (u.targetY - u.mesh.position.y) * Math.min(1, dt * 8);
      }
    });

    refresh();

    return {
      setA: function (k) { state.aT = Math.max(1, Math.min(9, Math.round(k))); refresh(); },
      setB: function (k) { state.bT = Math.max(1, Math.min(9, Math.round(k))); refresh(); },
      get: function () { return { a: state.aT, b: state.bT }; },
      reset: function () { state.aT = 3; state.bT = 2; refresh(); },
      stage: stage
    };
  }

  /* ======================= 2) 3D 同步搬运轨道 ======================= */
  function layoutNumber(str) {
    var chars = String(str).split("");
    var GAP_D = 1.0, GAP_P = 0.52;
    var total = 0, widths = chars.map(function (ch) {
      var w = ch === "." ? GAP_P : GAP_D;
      total += w;
      return w;
    });
    var x = -total / 2;
    return chars.map(function (ch, i) {
      var w = widths[i], cx = x + w / 2;
      x += w;
      return { ch: ch, x: cx, isPoint: ch === "." };
    });
  }

  var DIGIT_MAT_CACHE = {};
  function digitBoxMaterial(ch) {
    if (DIGIT_MAT_CACHE[ch]) return DIGIT_MAT_CACHE[ch];
    var isPoint = ch === ".";
    var tex = textTexture(isPoint ? "·" : ch, {
      bg: "#22322b",
      color: isPoint ? "#f2a8bb" : "#eef2e6",
      size: isPoint ? 220 : 150
    });
    var side = new T.MeshStandardMaterial({ color: 0x22322b, roughness: .55, metalness: .18 });
    var face = new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: .5, metalness: .2 });
    DIGIT_MAT_CACHE[ch] = [side, side, side, side, face, side];
    return DIGIT_MAT_CACHE[ch];
  }

  function moverLab(canvas, opts) {
    var stage = createStage(canvas, {
      cam: [0, 3.0, 10.6], target: [0, -0.5, 0], autoRotate: false,
      minDist: 6.5, maxDist: 24, fov: 42, height: 380, maxPolar: 1.30
    });
    if (!stage) return null;
    addGroundGrid(stage, 20, -2.7);

    var world = new T.Group();
    stage.scene.add(world);

    var geo = new T.BoxGeometry(0.84, 1.12, 0.26);
    var geoDot = new T.BoxGeometry(0.34, 0.34, 0.26);
    var matDot = new T.MeshStandardMaterial({ color: 0xfca5a5, emissive: 0xdc2626, emissiveIntensity: .95, roughness: .35, metalness: .15 });
    var popList = [];

    /** 行首的「被除数 / 除数」标牌 */
    function rowLabel(text, color) {
      var tex = textTexture(text, { color: color, size: 92, w: 512, h: 160 });
      return new T.Mesh(new T.PlaneGeometry(2.5, 0.78),
        new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: .95, side: T.DoubleSide, depthWrite: false }));
    }

    function makeRow(y, labelText, accent, labelColor) {
      var g = new T.Group();
      g.position.y = y;
      world.add(g);
      // 发光轨道
      var railMat = new T.MeshStandardMaterial({ color: 0x1c2a24, emissive: accent, emissiveIntensity: .38, roughness: .35, metalness: .45 });
      var rail = new T.Mesh(new T.BoxGeometry(16.5, 0.08, 0.86), railMat);
      rail.position.set(0, -0.82, 0);
      rail.receiveShadow = true;
      g.add(rail);
      var glow = new T.Mesh(new T.PlaneGeometry(16.5, 1.2),
        new T.MeshBasicMaterial({ color: accent, transparent: true, opacity: .1, side: T.DoubleSide, depthWrite: false }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(0, -0.76, 0);
      g.add(glow);
      var lab = rowLabel(labelText, labelColor);
      lab.position.set(-7.4, 0.04, 0);
      g.add(lab);
      return { group: g, railMat: railMat, items: [], value: "", accent: accent };
    }

    var rowTop = makeRow(1.35, "被除数", 0x0ea5e9, "#7dd3fc");
    var rowBot = makeRow(-1.35, "除数", 0xf59e0b, "#fcd34d");

    function fillRow(row, str, accent) {
      // 清空（材质走缓存，几何共享，这里只从场景移除）
      row.items.forEach(function (it) { row.group.remove(it.mesh); });
      row.items = [];
      var list = layoutNumber(str);
      list.forEach(function (item) {
        var m = new T.Mesh(item.isPoint ? geoDot : geo, item.isPoint ? matDot : digitBoxMaterial(item.ch));
        // 小数点画在数字的基线上，一眼就能认出是小数点
        m.position.set(item.x, item.isPoint ? -0.46 : 0, 0);
        m.castShadow = !item.isPoint;
        m.userData.sx = 1;
        m.scale.set(0.01, 0.01, 0.01);
        m.userData.pop = 0;
        popList.push(m);
        row.group.add(m);
        row.items.push({ mesh: m, ch: item.ch, isPoint: item.isPoint, x: item.x });
      });
      row.value = str;
      row.accent = accent;
      row.railMat.emissive.setHex(accent);
    }

    stage.onFrame(function (dt) {
      for (var i = popList.length - 1; i >= 0; i--) {
        var m = popList[i];
        if (m.userData.pop >= 1) { popList.splice(i, 1); continue; }
        m.userData.pop = Math.min(1, m.userData.pop + dt * 4.2);
        var t = m.userData.pop;
        var s = 0.6 + 0.4 * t + 0.18 * Math.sin(t * Math.PI);
        m.scale.set(s, s, s);
        m.position.z = (1 - t) * -1.1;
      }
      // 整排数字从左侧滑入 —— 读作「小数点向右搬了一格」
      world.position.x += (0 - world.position.x) * Math.min(1, dt * 7);
      // 整体轻微呼吸
      world.rotation.y = Math.sin(performance.now() / 4200) * 0.03;
    });

    function setBoth(dividend, divisor, accent) {
      world.position.x = -1.7;
      fillRow(rowTop, dividend, accent);
      fillRow(rowBot, divisor, accent);
    }

    return {
      render: function (dividend, divisor, accent) { setBoth(dividend, divisor, accent || 0x0ea5e9); },
      flash: function (hex) {
        [rowTop, rowBot].forEach(function (row) {
          row.railMat.emissive.setHex(hex);
          row.items.forEach(function (it) {
            if (it.mesh.material && it.mesh.material[4]) {
              it.mesh.material[4].emissiveIntensity = 1.1;
            }
          });
        });
        var t0 = performance.now();
        var tick = function () {
          var k = Math.max(0, 1 - (performance.now() - t0) / 900);
          [rowTop, rowBot].forEach(function (row) {
            row.items.forEach(function (it) {
              if (it.mesh.material && it.mesh.material[4]) it.mesh.material[4].emissiveIntensity = 0.22 + k * 0.9;
            });
          });
          if (k > 0) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      stage: stage
    };
  }

  /* ======================= 3) 3D 天平 ======================= */
  function balanceLab(canvas, opts) {
    var stage = createStage(canvas, {
      cam: [0, 4.9, 11.8], target: [0, 2.5, 0], autoRotate: false,
      minDist: 7.5, maxDist: 22, fov: 40, height: 460, maxPolar: 1.42
    });
    if (!stage) return null;
    // 整台天平（含横梁、吊盘、盘上砝码）一次取景装进去
    stage.fitRect(-6.4, -1.0, 12.8, 6.9, 1.1);
    addGroundGrid(stage, 26, -0.02);

    var world = new T.Group();
    stage.scene.add(world);

    // 底座 + 立柱
    var baseMat = new T.MeshStandardMaterial({ color: 0x6d4a2c, roughness: .7, metalness: .1 });
    var base = new T.Mesh(new T.CylinderGeometry(2.1, 2.4, 0.42, 40), baseMat);
    base.position.y = 0.21;
    base.receiveShadow = true; base.castShadow = true;
    world.add(base);

    var pillar = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 4.6, 20), baseMat);
    pillar.position.y = 2.6;
    pillar.castShadow = true;
    world.add(pillar);

    var PIVOT_Y = 4.8, ARM = 4.3;

    // 横梁（挂在枢轴上，绕 z 旋转）
    var beamPivot = new T.Group();
    beamPivot.position.set(0, PIVOT_Y, 0);
    world.add(beamPivot);
    var beamMat = new T.MeshStandardMaterial({ color: 0xd8c9a8, roughness: .45, metalness: .35 });
    var beam = new T.Mesh(new T.BoxGeometry(ARM * 2 + 0.5, 0.26, 0.42), beamMat);
    beam.castShadow = true;
    beamPivot.add(beam);
    var hub = new T.Mesh(new T.SphereGeometry(0.3, 24, 16), new T.MeshStandardMaterial({ color: 0xf0d264, emissive: 0x9a7a2c, emissiveIntensity: .55, roughness: .35, metalness: .4 }));
    beamPivot.add(hub);

    // 两侧吊盘（独立于横梁，保持水平）
    function makePan() {
      var g = new T.Group();
      var disc = new T.Mesh(new T.CylinderGeometry(1.62, 1.42, 0.16, 44),
        new T.MeshStandardMaterial({ color: 0xe4dcc8, roughness: .5, metalness: .2 }));
      disc.castShadow = true; disc.receiveShadow = true;
      g.add(disc);
      var ring = new T.Mesh(new T.TorusGeometry(1.62, 0.05, 8, 48),
        new T.MeshStandardMaterial({ color: 0x8fd8e8, emissive: 0x3d7f8c, emissiveIntensity: .6, roughness: .3 }));
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      var items = new T.Group();
      g.add(items);
      world.add(g);
      var wire = new T.Mesh(new T.BoxGeometry(0.055, 1, 0.055),
        new T.MeshStandardMaterial({ color: 0xb3c0b0, roughness: .5, metalness: .3 }));
      world.add(wire);
      return { group: g, items: items, wire: wire, blocks: [], x: 0, y: 0 };
    }
    var panL = makePan(), panR = makePan();

    var blockGeo = new T.BoxGeometry(0.88, 0.88, 0.88);
    var matX = (function () {
      var tex = textTexture("x", { bg: "#3b2a4a", color: "#d9b3f0", size: 170, shadow: "rgba(217,179,240,.75)" });
      var f = new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .5, roughness: .35, metalness: .25 });
      var s = new T.MeshStandardMaterial({ color: 0x4a3557, emissive: 0x3b2a4a, emissiveIntensity: .35, roughness: .5 });
      return [s, s, s, s, f, s];
    })();
    function numMat(v) {
      var tex = textTexture(String(v), { bg: "#4a3a1c", color: "#f0d264", size: 130, shadow: "rgba(240,210,100,.7)" });
      var f = new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .4, roughness: .35, metalness: .25 });
      var s = new T.MeshStandardMaterial({ color: 0x6b5628, roughness: .5 });
      return [s, s, s, s, f, s];
    }

    function arrange(pan) {
      var n = pan.blocks.length;
      if (!n) return;
      var perRow = n > 3 ? Math.ceil(n / 2) : n;
      pan.blocks.forEach(function (b, i) {
        var row = Math.floor(i / perRow);
        var col = i % perRow;
        var inRow = Math.min(perRow, n - row * perRow);
        var x = (col - (inRow - 1) / 2) * 0.95;
        b.mesh.position.set(x, 0.48 + row * 0.94, 0);
      });
    }

    function syncBlocks(pan, list) {
      // list: [{kind:'x'} | {kind:'num', v:20}]
      while (pan.blocks.length > list.length) {
        var rm = pan.blocks.pop();
        pan.items.remove(rm.mesh);
      }
      list.forEach(function (spec, i) {
        var b = pan.blocks[i];
        var key = spec.kind === "x" ? "x" : "n" + spec.v;
        if (b && b.key !== key) {
          pan.items.remove(b.mesh);
          b = null;
        }
        if (!b) {
          var mat = spec.kind === "x" ? matX : numMat(spec.v);
          var mesh = new T.Mesh(blockGeo, mat);
          mesh.castShadow = true; mesh.receiveShadow = true;
          mesh.scale.setScalar(0.01);
          pan.items.add(mesh);
          b = { key: key, mesh: mesh, cur: 0.01, want: 1 };
          pan.blocks[i] = b;
        }
        b.want = 1;
      });
      pan.blocks.length = list.length;
      arrange(pan);
    }

    var state = {
      left: [], right: [], xValue: 0,
      tilt: 0, tiltT: 0
    };

    function weight(list) {
      var s = 0;
      list.forEach(function (b) { s += b.kind === "x" ? state.xValue : b.v; });
      return s;
    }
    function retilt(instant) {
      var L = weight(state.left), R = weight(state.right);
      var d = L - R;
      state.tiltT = Math.max(-0.16, Math.min(0.16, d * 0.006));
      if (instant) state.tilt = state.tiltT;
    }

    stage.onFrame(function (dt) {
      state.tilt += (state.tiltT - state.tilt) * Math.min(1, dt * 5);
      beamPivot.rotation.z = state.tilt;

      var ct = Math.cos(state.tilt), st = Math.sin(state.tilt);
      var lx = -ARM * ct, ly = -ARM * st;
      var rx = ARM * ct, ry = ARM * st;

      [[panL, lx, ly], [panR, rx, ry]].forEach(function (p) {
        var pan = p[0], ex = p[1], ey = p[2];
        var panY = PIVOT_Y + ey - 1.5;
        pan.x = ex; pan.y = panY;
        pan.group.position.set(ex, panY, 0);
        var midY = (PIVOT_Y + ey + panY + 0.1) / 2;
        var len = Math.max(0.2, PIVOT_Y + ey - (panY + 0.1));
        pan.wire.position.set(ex, midY, 0);
        pan.wire.scale.y = len;
        pan.blocks.forEach(function (b) {
          b.cur += (b.want - b.cur) * Math.min(1, dt * 9);
          b.mesh.scale.setScalar(Math.max(0.01, b.cur));
        });
      });
      world.rotation.y = Math.sin(performance.now() / 5200) * 0.05;
    });

    syncBlocks(panL, []); syncBlocks(panR, []);
    retilt(true);

    return {
      /** 载入一个场景 */
      load: function (sc) {
        state.xValue = sc.x;
        state.left = sc.left.map(function (s) { return { kind: s.kind, v: s.v }; });
        state.right = sc.right.map(function (s) { return { kind: s.kind, v: s.v }; });
        syncBlocks(panL, state.left);
        syncBlocks(panR, state.right);
        retilt(true);
      },
      /** 两边同时施加同一操作（正确做法） */
      step: function (op) {
        if (op.left) applyOps(state.left, op.left);
        if (op.right) applyOps(state.right, op.right);
        syncBlocks(panL, state.left);
        syncBlocks(panR, state.right);
        retilt(false);
      },
      /** 只作用在左边 —— 反例，天平会失衡 */
      wrongStep: function (op) {
        applyOps(state.left, op);
        syncBlocks(panL, state.left);
        retilt(false);
        return { left: weight(state.left), right: weight(state.right) };
      },
      loadRaw: function (left, right) {
        state.left = left.slice();
        state.right = right.slice();
        syncBlocks(panL, state.left);
        syncBlocks(panR, state.right);
        retilt(true);
      },
      weights: function () { return { left: weight(state.left), right: weight(state.right), x: state.xValue }; },
      /** 当前两边方块的快照（页面用来生成算式文字） */
      blocks: function () {
        return {
          left: state.left.map(function (b) { return { kind: b.kind, v: b.v }; }),
          right: state.right.map(function (b) { return { kind: b.kind, v: b.v }; })
        };
      },
      stage: stage
    };
  }

/** 对一组方块执行操作：{subNum, addNum, divNum, setNum} */
function applyOps(list, op) {
    if (op.subNum != null) {
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].kind === "num" && list[i].v === op.subNum) { list.splice(i, 1); return list; }
      }
      // 没有刚好匹配的砝码：把一个砝码换成其差值
      for (var j = 0; j < list.length; j++) {
        if (list[j].kind === "num" && list[j].v >= op.subNum) { list[j].v -= op.subNum; return list; }
      }
      return list;
    }
    if (op.addNum != null) {
      // 抵消负数砝码：−15 + 15 → 0（直接移走）
      for (var m = list.length - 1; m >= 0; m--) {
        if (list[m].kind === "num" && list[m].v === -op.addNum) { list.splice(m, 1); return list; }
      }
      for (var n = 0; n < list.length; n++) {
        if (list[n].kind === "num") { list[n].v += op.addNum; return list; }
      }
      return list;
    }
    if (op.divNum != null) {
      // 语义：把这一侧所有东西都除以 divNum。
      // 3x → x（x 的块数变为原来的 1/divNum）；60 → 20
      var xs = list.filter(function (b) { return b.kind === "x"; });
      var nums = list.filter(function (b) { return b.kind === "num"; });
      list.length = 0;
      var nx = xs.length ? Math.max(1, Math.round(xs.length / op.divNum)) : 0;
      for (var k = 0; k < nx; k++) list.push({ kind: "x", v: 1 });
      nums.forEach(function (n) { list.push({ kind: "num", v: n.v / op.divNum }); });
      return list;
    }
    if (op.setNum != null) { list.length = 0; list.push({ kind: "num", v: op.setNum }); return list; }
    return list;
  }

  /* ==========================================================================
   *  4) 3D 铅笔板书 —— 小助手手持铅笔，一笔一划把竖式写到黑板上
   *  ------------------------------------------------------------------
   *  几何来源：直接采样 handwrite / vertical-calc 引擎渲染出来的 SVG 笔画。
   *  每个笔画 = 一条 3D 管（TubeGeometry），用 setDrawRange 从 0 逐段"画"出来，
   *  笔尖位置 = 曲线在当前进度处的采样点，小助手和铅笔整体跟着笔尖走。
   * ========================================================================== */

  /** 把一段隐藏 DOM 里的所有 svg 笔画采样成统一板面坐标 */
  function sampleBoard(container) {
    var svgs = Array.prototype.slice.call(container.querySelectorAll("svg"));
    var blocks = [], maxW = 0, totalH = 0, GAP = 14;
    svgs.forEach(function (svg) {
      var vb = svg.viewBox && svg.viewBox.baseVal;
      var W = (vb && vb.width) || (svg.width && svg.width.baseVal.value) || 320;
      var H = (vb && vb.height) || (svg.height && svg.height.baseVal.value) || 220;
      var strokes = [];
      Array.prototype.forEach.call(svg.querySelectorAll("path,line,circle"), function (el) {
        var cls = el.getAttribute("class") || "";
        if (cls.indexOf("hhot") >= 0) return;          // 高亮底色不参与书写
        var anim = el.getAttribute("data-anim") === "1";
        var m = el.getCTM();
        if (!m) return;
        function tf(x, y) { return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; }
        var tag = el.tagName.toLowerCase();
        if (tag === "circle") {
          var c = tf(Number(el.getAttribute("cx")), Number(el.getAttribute("cy")));
          strokes.push({ kind: "dot", pts: [c], r: Number(el.getAttribute("r")) || 5, cls: cls, anim: anim });
        } else if (tag === "line") {
          strokes.push({
            kind: "line", anim: anim, cls: cls,
            pts: [tf(Number(el.getAttribute("x1")), Number(el.getAttribute("y1"))),
                  tf(Number(el.getAttribute("x2")), Number(el.getAttribute("y2")))]
          });
        } else {
          var len = 60;
          try { len = el.getTotalLength(); } catch (e) { len = 60; }
          var n = Math.max(6, Math.min(72, Math.ceil(len / 4.5)));
          var pts = [];
          for (var i = 0; i <= n; i++) {
            var p = el.getPointAtLength(len * i / n);
            pts.push(tf(p.x, p.y));
          }
          strokes.push({ kind: "path", pts: pts, anim: anim, cls: cls, arc: len });
        }
      });
      blocks.push({ W: W, H: H, strokes: strokes });
      maxW = Math.max(maxW, W);
      totalH += H + GAP;
    });
    totalH = Math.max(1, totalH - GAP);
    var out = [], yOff = 0;
    blocks.forEach(function (b) {
      var dx = (maxW - b.W) / 2;
      b.strokes.forEach(function (s) {
        s.pts = s.pts.map(function (p) { return [p[0] + dx, p[1] + yOff]; });
        out.push(s);
      });
      yOff += b.H + GAP;
    });
    return { strokes: out, W: maxW, H: totalH };
  }

  /** 笔画颜色：沿用竖式引擎的 vs-* 语义色 */
  function strokeColor(cls) {
    if ((cls || "").indexOf("vs-red") >= 0) return 0xf08a80;
    if ((cls || "").indexOf("vs-blue") >= 0) return 0x8fd8e8;
    if ((cls || "").indexOf("vs-green") >= 0) return 0xa6e79c;
    if ((cls || "").indexOf("vs-op") >= 0) return 0xc9d4c6;
    if ((cls || "").indexOf("vp") >= 0) return 0xf2a8bb;
    return 0xeef2e6;
  }

  function writeLab(canvas, opts) {
    opts = opts || {};
    var stage = createStage(canvas, {
      cam: [0, 0.4, 13], target: [0, 0, 0], autoRotate: false,
      minDist: 6, maxDist: 30, fov: 38, height: opts.height || 560,
      maxPolar: 1.62, minPolar: 0.7, autoRotateSpeed: 0
    });
    if (!stage) return null;
    stage.scene.fog = null;
    // 板书场景不要那盏会闪烁的青色补光，改成两盏柔光
    stage.scene.add(new T.AmbientLight(0xcfe0d0, 0.14));

    var world = new T.Group();
    stage.scene.add(world);

    /* ---------- 黑板 ---------- */
    var boardGroup = new T.Group();
    world.add(boardGroup);
    var boardMesh = null;

    function boardTexture(aspect) {
      var cw = 720, ch = Math.max(240, Math.round(720 / aspect));
      var c = document.createElement("canvas");
      c.width = cw; c.height = ch;
      var g = c.getContext("2d");
      var grad = g.createLinearGradient(0, 0, cw, ch);
      grad.addColorStop(0, "#23342c");
      grad.addColorStop(1, "#16241e");
      g.fillStyle = grad;
      roundRect(g, 8, 8, cw - 16, ch - 16, 34);
      g.fill();
      g.strokeStyle = "rgba(226,236,218,.34)";
      g.lineWidth = 3;
      roundRect(g, 8, 8, cw - 16, ch - 16, 34);
      g.stroke();
      // 淡格线
      g.strokeStyle = "rgba(226,236,218,.07)";
      g.lineWidth = 1;
      var step = 46;
      for (var x = step; x < cw; x += step) { g.beginPath(); g.moveTo(x, 12); g.lineTo(x, ch - 12); g.stroke(); }
      for (var y = step; y < ch; y += step) { g.beginPath(); g.moveTo(12, y); g.lineTo(cw - 12, y); g.stroke(); }
      var t = new T.CanvasTexture(c);
      if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
      return t;
    }

    /* ---------- 笔画层 ---------- */
    var inkGroup = new T.Group();
    boardGroup.add(inkGroup);
    var live = [];          // 已投放的笔画对象
    var queue = [];          // 待书写的笔画对象
    var boardW = 6, boardH = 8, scale = 1, xOff = 0;

    function clearInk() {
      live.forEach(function (o) { inkGroup.remove(o.mesh); });
      live = []; queue = [];
    }

    /* ---------- 小助手 + 铅笔 ---------- */
    var cursor = new T.Group();       // 笔尖所在的位置
    world.add(cursor);

    var helper = new T.Group();
    var matWhite = new T.MeshStandardMaterial({ color: 0xeef2e6, roughness: .5, metalness: .08 });
    var matAccent = new T.MeshStandardMaterial({ color: 0xd9b3f0, emissive: 0x7a4f96, emissiveIntensity: .5, roughness: .45 });
    var matCyan = new T.MeshStandardMaterial({ color: 0x8fd8e8, emissive: 0x3d7f8c, emissiveIntensity: .7, roughness: .35 });
    var matAmber = new T.MeshStandardMaterial({ color: 0xf0d264, emissive: 0x9a7a2c, emissiveIntensity: .3, roughness: .5 });

    var headR = 0.44;
    var body = new T.Mesh(new T.CylinderGeometry(0.30, 0.35, 0.62, 26), matWhite);
    body.position.y = 0.0;
    body.castShadow = true;
    helper.add(body);
    var head = new T.Mesh(new T.SphereGeometry(headR, 30, 22), matWhite);
    head.position.y = 0.66;
    head.castShadow = true;
    helper.add(head);
    // 面罩 + 发光眼睛
    var faceTex = (function () {
      var c = document.createElement("canvas");
      c.width = 256; c.height = 150;
      var g = c.getContext("2d");
      g.fillStyle = "#0b1730";
      roundRect(g, 6, 6, 244, 138, 62); g.fill();
      g.fillStyle = "#5eead4";
      g.shadowColor = "#22d3ee"; g.shadowBlur = 18;
      g.beginPath(); g.ellipse(86, 70, 17, 22, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(170, 70, 17, 22, 0, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = "#67e8f9"; g.lineWidth = 6; g.lineCap = "round";
      g.beginPath(); g.arc(128, 96, 22, 0.22 * Math.PI, 0.78 * Math.PI); g.stroke();
      var t = new T.CanvasTexture(c);
      if (T.sRGBEncoding) t.encoding = T.sRGBEncoding;
      return t;
    })();
    var face = new T.Mesh(new T.PlaneGeometry(0.56, 0.33),
      new T.MeshBasicMaterial({ map: faceTex, transparent: true }));
    face.position.set(0, 0.68, headR * 0.93);
    helper.add(face);
    // 头顶漂浮的小数点
    var cap = new T.Mesh(new T.SphereGeometry(0.11, 18, 14), matAccent);
    cap.position.set(0, 1.26, 0);
    helper.add(cap);
    // 悬浮光环
    var ring = new T.Mesh(new T.TorusGeometry(0.42, 0.035, 8, 40), matCyan);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.5;
    helper.add(ring);
    // 左臂（自然垂下）
    var armL = new T.Mesh(new T.CylinderGeometry(0.075, 0.07, 0.5, 12), matWhite);
    armL.position.set(-0.4, 0.02, 0.03);
    armL.rotation.z = 0.22;
    helper.add(armL);
    var handL = new T.Mesh(new T.SphereGeometry(0.1, 14, 12), matWhite);
    handL.position.set(-0.47, -0.22, 0.03);
    helper.add(handL);
    // 右臂（举起来握笔）—— 手固定在局部 (0.44, 0.30, 0.16)
    var HAND = new T.Vector3(0.44, 0.30, 0.16);
    var armR = new T.Mesh(new T.CylinderGeometry(0.078, 0.072, 0.62, 12), matWhite);
    armR.position.set(0.30, 0.12, 0.09);
    armR.rotation.z = -0.62;
    armR.rotation.x = -0.34;
    helper.add(armR);
    var handR = new T.Mesh(new T.SphereGeometry(0.115, 16, 12), matWhite);
    handR.position.copy(HAND);
    helper.add(handR);
    world.add(helper);          // 注意：小助手站在黑板右侧，不跟着笔尖跑（免得挡住板书）

    /* ---------- 长杆铅笔：笔尖在 cursor，笔杆连到手上，长度自适应 ---------- */
    var pencil = new T.Group();
    world.add(pencil);
    var cone = new T.Mesh(new T.ConeGeometry(0.07, 0.26, 14),
      new T.MeshStandardMaterial({ color: 0x1f2937, roughness: .6 }));
    cone.position.y = 0.13;
    cone.rotation.x = Math.PI;                  // 笔尖朝下，正好落在 cursor 原点
    pencil.add(cone);
    var shaftGroup = new T.Group();
    pencil.add(shaftGroup);
    var shaft = new T.Mesh(new T.CylinderGeometry(0.056, 0.07, 1, 14), matAmber);
    shaft.position.y = 0.5;                     // 单位长圆柱，靠 scale.y 拉长
    shaft.castShadow = true;
    shaftGroup.add(shaft);
    var eraser = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.13, 14),
      new T.MeshStandardMaterial({ color: 0xf472b6, roughness: .6 }));
    pencil.add(eraser);

    // 笔尖柔光
    var tipLight = new T.PointLight(0xd8f2e2, 0.9, 3.2);
    tipLight.position.set(0, 0, 0.18);
    cursor.add(tipLight);
    var helperY = 0;
    var UPV = new T.Vector3(0, 1, 0);

    /* ---------- 书写时间轴（按绝对时间求值，掉帧也不会卡住） ---------- */
    var BASE_SPEED = 1.45;     // 笔尖在世界坐标里的书写速度（单位 / 秒）
    var tl = null;             // {segments, total, base, markAt, speed, running}
    var doneCb = null;
    var reduce = false;

    function makeCurve(pts3) {
      var v = pts3.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); });
      if (v.length === 2) return new T.LineCurve3(v[0], v[1]);
      return new T.CatmullRomCurve3(v, false, "catmullrom", 0.2);
    }

    function buildStroke3D(s) {
      // 采样坐标（SVG px，左上为原点）→ 板面世界坐标（中心为原点，y 向上）
      var pts = s.pts.map(function (p) {
        return [(p[0] + xOff) * scale - boardW / 2, boardH / 2 - p[1] * scale, 0.035];
      });
      var col = strokeColor(s.cls);
      if (s.kind === "dot") {
        var r = Math.max(0.05, s.r * scale * 0.95);
        var m = new T.Mesh(new T.SphereGeometry(r, 16, 12),
          new T.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .7, roughness: .35, transparent: true, opacity: 0 }));
        m.position.set(pts[0][0], pts[0][1], pts[0][2]);
        m.userData.kind = "dot";
        return m;
      }
      var curve = makeCurve(pts);
      var len3 = curve.getLength();
      var segs = Math.max(8, Math.min(120, Math.round(len3 / 0.05)));
      var geo = new T.TubeGeometry(curve, segs, Math.max(0.026, boardH * 0.0052), 7, false);
      var mat = new T.MeshStandardMaterial({
        color: col, emissive: col, emissiveIntensity: .5,
        roughness: .35, metalness: .1, transparent: true, opacity: 0
      });
      var mesh = new T.Mesh(geo, mat);
      mesh.userData = { kind: "tube", curve: curve, segs: segs, radial: 7, len3: len3 };
      return mesh;
    }

    /** 显示一帧：非 anim 笔画直接出现，anim 笔画排队等铅笔写 */
    function load(frame, cfg) {
      cfg = cfg || {};
      reduce = (root.document.body || {}).classList && root.document.body.classList.contains("reduce-motion");
      clearInk();
      var fixed = cfg.fixed;          // 整道题的最大板面：用来锁定缩放（字号一致）
      xOff = 0;
      if (fixed && fixed.W && fixed.H) {
        scale = Math.min(8.8 / fixed.W, 6.9 / fixed.H);
        boardW = Math.max(1, fixed.W * scale);
        boardH = Math.max(0.6, frame.H * scale);      // 高度随内容向下生长，不留空白
        xOff = (fixed.W - frame.W) / 2;               // 窄的一步水平居中
      } else {
        var aspect = (frame.W && frame.H) ? frame.W / frame.H : 1;
        boardH = cfg.boardH || 6.6;
        boardW = boardH * aspect;
        var MAXW = 8.6;
        if (boardW > MAXW) { boardW = MAXW; boardH = boardW / aspect; }
        scale = boardH / frame.H;
      }

      // 黑板
      if (boardMesh) { boardGroup.remove(boardMesh); boardMesh.geometry.dispose(); }
      var pad = 0.55;
      boardMesh = new T.Mesh(new T.PlaneGeometry(boardW + pad * 2, boardH + pad * 2),
        new T.MeshStandardMaterial({ map: boardTexture((boardW + pad * 2) / (boardH + pad * 2)), roughness: .85, metalness: .05 }));
      boardMesh.receiveShadow = true;
      boardGroup.add(boardMesh);
      boardGroup.position.z = 0;

      var anims = 0;
      frame.strokes.forEach(function (s) {
        var m = buildStroke3D(s);
        inkGroup.add(m);
        live.push({ mesh: m });
        if (s.anim && !reduce) {
          m.material.opacity = 0;
          queue.push(m);
          anims++;
        } else {
          m.material.opacity = 1;
          if (m.userData.kind === "tube") {
            m.geometry.setDrawRange(0, Infinity);
          } else {
            m.userData.shown = 1;
          }
        }
      });
      // 相机构图：给底部字幕条和右侧的小助手都留位置
      stage.fitRect(-boardW / 2 - 0.6, -boardH / 2 - 1.9, boardW + 3.6, boardH + 2.6);
      // 笔先停在黑板右下角待命，再飞向第一笔
      cursor.position.set(boardW * 0.5 - 0.2, -boardH * 0.5 + 0.5, 0.35);
      helperY = cursor.position.y;
      hidePencil(false);
      buildTimeline();
      return anims;
    }

    function strokeStart(m) {
      if (m.userData.kind === "dot") return m.position.clone();
      return m.userData.curve.getPointAt(0);
    }
    function strokeEnd(m) {
      if (m.userData.kind === "dot") return m.position.clone();
      return m.userData.curve.getPointAt(1);
    }
    function hidePencil(hide) {
      pencil.visible = !hide;
      helper.visible = !hide;
      tipLight.intensity = hide ? 0 : 0.9;
    }

    /* ---------- 时间轴：抬笔 → 写字 → 抬笔 → … ---------- */
    function buildTimeline() {
      var segs = [], cur = cursor.position.clone(), t = 0;
      queue.forEach(function (m) {
        var to = strokeStart(m);
        var d = cur.distanceTo(to);
        var lift = d > 0.03 ? Math.min(0.5, 0.1 + d * 0.1) : 0.07;
        segs.push({ kind: "lift", from: cur.clone(), to: to.clone(), t0: t, t1: t + lift });
        t += lift;
        if (m.userData.kind === "dot") {
          segs.push({ kind: "dot", mesh: m, to: strokeEnd(m), t0: t, t1: t + 0.18 });
          t += 0.18;
        } else {
          var wd = Math.max(0.32, m.userData.len3 / BASE_SPEED);
          segs.push({ kind: "write", mesh: m, to: strokeEnd(m), t0: t, t1: t + wd });
          t += wd;
        }
        cur = strokeEnd(m);
      });
      tl = { segments: segs, total: t, base: 0, markAt: 0, speed: 1, running: false };
      return tl;
    }
    function segProgress(s, el) {
      return Math.max(0, Math.min(1, (el - s.t0) / Math.max(0.0001, s.t1 - s.t0)));
    }
    function segComplete(s) {
      if (s.kind === "lift") return;
      var m = s.mesh;
      m.material.opacity = 1;
      if (s.kind === "dot") { m.scale.setScalar(1); return; }
      m.material.emissiveIntensity = 0.5;
      m.geometry.setDrawRange(0, Infinity);
    }
    function segPartial(s, k) {
      var m = s.mesh;
      if (s.kind === "lift") {
        var p = new T.Vector3().lerpVectors(s.from, s.to, k);
        p.z += Math.sin(Math.PI * k) * 0.42;      // 抬笔弧线
        cursor.position.copy(p);
        return;
      }
      if (s.kind === "dot") {
        m.material.opacity = k;
        m.scale.setScalar(0.4 + 0.6 * k + 0.25 * Math.sin(k * Math.PI));
        cursor.position.copy(m.position);
        return;
      }
      var seg = Math.max(1, Math.round(m.userData.segs * k));
      m.material.opacity = 1;
      m.material.emissiveIntensity = 0.5 + (1 - k) * 1.0;   // 刚写出来的部分更亮
      m.geometry.setDrawRange(0, seg * m.userData.radial * 6);
      cursor.position.copy(m.userData.curve.getPointAt(k));
    }
    /** 把某一时刻的画面状态算出来（幂等，与帧率无关） */
    function applyAt(el) {
      if (!tl || !tl.segments.length) return;
      var segs = tl.segments, i = 0;
      while (i < segs.length - 1 && el >= segs[i].t1) i++;
      for (var j = 0; j < i; j++) segComplete(segs[j]);
      var s = segs[i];
      if (el >= s.t1) {
        segComplete(s);
        cursor.position.copy(s.to);
      } else {
        segPartial(s, segProgress(s, el));
      }
    }
    function completeAll() {
      if (!tl || !tl.segments.length) return;
      tl.segments.forEach(segComplete);
      cursor.position.copy(tl.segments[tl.segments.length - 1].to);
    }

    stage.onFrame(function (dt) {
      var now = performance.now();
      // 小助手始终站在黑板右侧，永远不当住板书；纵向跟着笔尖走
      var wantY = Math.max(-boardH / 2 + 0.35, Math.min(boardH / 2 - 0.55, cursor.position.y));
      helperY += (wantY - helperY) * Math.min(1, Math.max(0.001, dt) * 4.5);
      helper.position.set(boardW / 2 + 1.55, helperY + Math.sin(now / 620) * 0.05, 0.85);
      helper.rotation.z = Math.sin(now / 900) * 0.03;
      ring.scale.setScalar(1 + Math.sin(now / 700) * 0.07);
      cap.position.y = 1.26 + Math.sin(now / 430) * 0.05;

      // 铅笔：笔尖钉在 cursor，笔杆连到手上，长度自适应
      var hand = HAND.clone().applyEuler(helper.rotation).add(helper.position);
      var d = hand.clone().sub(cursor.position);
      var k = Math.max(0.7, d.length());
      d.normalize();
      pencil.position.copy(cursor.position);
      pencil.quaternion.setFromUnitVectors(UPV, d);
      shaftGroup.scale.y = k;
      eraser.position.y = k + 0.07;

      if (!tl || !tl.running) return;
      var el = tl.base + (now - tl.markAt) / 1000 * tl.speed;
      if (el >= tl.total) {
        completeAll();
        tl.running = false;
        if (doneCb) { var f = doneCb; doneCb = null; f(); }
        return;
      }
      applyAt(el);
    });

    return {
      load: load,
      /** 开始写字；speed 为倍速 */
      play: function (speed) {
        if (!tl) return;
        if (!queue.length) { if (doneCb) { var f = doneCb; doneCb = null; f(); } return; }
        if (speed) tl.speed = speed;
        tl.base = 0;
        tl.markAt = performance.now();
        tl.running = true;
        applyAt(0);
      },
      isWriting: function () { return !!(tl && tl.running); },
      onDone: function (cb) { doneCb = cb; },
      setSpeed: function (k) {
        if (!tl) return;
        if (tl.running) {
          var now = performance.now();
          tl.base += (now - tl.markAt) / 1000 * tl.speed;   // 变速不跳帧
          tl.markAt = now;
        }
        tl.speed = k;
      },
      stage: stage
    };
  }

  /* ======================= 导出 ======================= */
  root.Lab3D = {
    supported: !!(root.WebGLRenderingContext || root.WebGL2RenderingContext),
    palette: PALETTE,
    textTexture: textTexture,
    area: areaLab,
    mover: moverLab,
    balance: balanceLab,
    sampleBoard: sampleBoard,
    applyOps: applyOps,          // 纯函数：无 WebGL 时页面用它推演等式变化
    write: writeLab
  };
})(window);
