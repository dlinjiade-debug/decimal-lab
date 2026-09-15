/* ==========================================================================
 *  lab-teach.js —— 3D 铅笔板书驱动（三章共用）
 *  ------------------------------------------------------------------
 *  几何来源仍然是 handwrite / vertical-calc 渲染出来的 SVG 笔画，
 *  做法：把每一步「隐藏渲染」一次 → 采样所有笔画 → 交给 Lab3D.write 用 3D 铅笔写出来。
 *
 *  为什么每步都要重采样：竖式引擎每一步都是「整张重建」（去小数点那一步甚至会减少笔画），
 *  所以不能只取末步几何做叠加，必须按步取该步的完整板面。
 *
 *  对外： LabTeach.init(config)
 * ========================================================================== */
(function (root) {
  "use strict";
  var Lab = root.Lab, L3 = root.Lab3D;

  /* ---------------- 元素局部变换（元素 user space → svg 用户坐标） ---------------- */
  function localMatrix(el, svg) {
    var m = null, node = el;
    while (node && node !== svg) {
      var list = node.transform && node.transform.baseVal;
      var cm = (list && list.numberOfItems) ? list.consolidate().matrix : null;
      if (cm) m = m ? cm.multiply(m) : cm;
      node = node.parentNode;
    }
    return m;
  }

  /* ---------------- 采样一个容器里的全部笔画 ---------------- */
  function sample(container) {
    var svgs = Array.prototype.slice.call(container.querySelectorAll("svg"));
    var blocks = [], maxW = 0, totalH = 0, GAP = 16;
    svgs.forEach(function (svg) {
      var vb = svg.viewBox && svg.viewBox.baseVal;
      var W = (vb && vb.width) || (svg.width && svg.width.baseVal.value) || 320;
      var H = (vb && vb.height) || (svg.height && svg.height.baseVal.value) || 220;
      var strokes = [];
      Array.prototype.forEach.call(svg.querySelectorAll("path,line,circle"), function (el) {
        var cls = el.getAttribute("class") || "";
        if (cls.indexOf("hhot") >= 0) return;               // 高亮底色不是笔画
        if (el.closest && el.closest(".shift-card")) return; // 说明卡不进板书
        var m = localMatrix(el, svg);
        function tf(x, y) {
          return m ? [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f] : [x, y];
        }
        var anim = el.getAttribute("data-anim") === "1";
        var tag = el.tagName.toLowerCase();
        if (tag === "circle") {
          strokes.push({
            kind: "dot", anim: anim, cls: cls,
            r: Number(el.getAttribute("r")) || 5,
            pts: [tf(Number(el.getAttribute("cx")), Number(el.getAttribute("cy")))]
          });
        } else if (tag === "line") {
          strokes.push({
            kind: "line", anim: anim, cls: cls,
            pts: [tf(Number(el.getAttribute("x1")), Number(el.getAttribute("y1"))),
                  tf(Number(el.getAttribute("x2")), Number(el.getAttribute("y2")))]
          });
        } else {
          var len = 60;
          try { len = el.getTotalLength(); } catch (e) { len = 60; }
          var n = Math.max(6, Math.min(80, Math.ceil(len / 4)));
          var pts = [];
          for (var i = 0; i <= n; i++) {
            var p = el.getPointAtLength(len * i / n);
            pts.push(tf(p.x, p.y));
          }
          strokes.push({ kind: "path", anim: anim, cls: cls, pts: pts, arc: len });
        }
      });
      if (!strokes.length) return;
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

  /* ======================================================================== */
  function init(cfg) {
    var probe = null;
    function makeProbe() {
      probe = document.createElement("div");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText = "position:fixed;left:-30000px;top:0;width:2000px;opacity:0;pointer-events:none;z-index:-1";
      document.body.appendChild(probe);
      return probe;
    }

    var $ = Lab.$, $$ = Lab.$$;
    var box = $(cfg.canvas);
    var captionEl = $(cfg.caption);
    var stepNoEl = $(cfg.stepNo);
    var playBtn = cfg.play ? $(cfg.play) : null;
    var prevBtn = cfg.prev ? $(cfg.prev) : null;
    var nextBtn = cfg.next ? $(cfg.next) : null;
    var replayBtn = cfg.replay ? $(cfg.replay) : null;
    var speedEl = cfg.speed ? $(cfg.speed) : null;
    var demoBox = cfg.mount ? $(cfg.mount) : null;

    var lab = (L3 && L3.supported && box) ? L3.write(box, { height: cfg.height || 560 }) : null;
    var fallbackEl = null;
    if (!lab && cfg.fallback) {
      fallbackEl = $(cfg.fallback);
      if (fallbackEl) fallbackEl.hidden = false;
      if (box && box.parentElement) box.parentElement.style.display = "none";
      /* 3D 不可用：把「拖动换视角」这类只对 3D 成立的说明换掉，别误导 */
      var card = box && box.closest ? box.closest(".stage-card") : null;
      var hint = card ? card.querySelector(".stage-hint") : null;
      if (hint) hint.textContent = "本机不支持 WebGL · 已切换为 2D 手写分步";
      var badge = card ? card.querySelector(".badge3d") : null;
      if (badge) badge.textContent = "2D";
    }

    /* ---------- 当前例题 ---------- */
    var cur = { steps: null, frames: null, idx: -1 };
    var auto = false, autoTimer = null, speed = 1, busy = false;

    function chip(label, tag) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.innerHTML = label + (tag ? '<i class="tag">' + tag + "</i>" : "");
      return b;
    }

    function buildFrames(steps) {
      if (!probe) makeProbe();
      var frames = [];
      steps.forEach(function (s) {
        probe.innerHTML = "";
        var host = document.createElement("div");
        probe.appendChild(host);
        try { s.render(host); } catch (e) { /* 单步渲染失败不影响其它步 */ }
        frames.push(sample(host));
      });
      probe.innerHTML = "";
      return frames;
    }

    function selectDemo(demo, btn) {
      stopAuto();
      if (demoBox) $$("button", demoBox).forEach(function (x) { x.classList.remove("is-on"); });
      if (btn) btn.classList.add("is-on");
      var steps = demo.build();
      cur.steps = steps;
      cur.frames = buildFrames(steps);
      // 整道题共用一块黑板：取所有步里最大的板面，避免每步重新取景
      cur.fixed = { W: 0, H: 0 };
      cur.frames.forEach(function (f) {
        cur.fixed.W = Math.max(cur.fixed.W, f.W || 0);
        cur.fixed.H = Math.max(cur.fixed.H, f.H || 0);
      });
      cur.idx = 0;
      showStep(0, true);
    }

    function showStep(i, autoplay) {
      if (!cur.steps) return;
      i = Math.max(0, Math.min(cur.steps.length - 1, i));
      cur.idx = i;
      var s = cur.steps[i];
      setCaption(s.explain || "");
      if (stepNoEl) stepNoEl.textContent = "第 " + (i + 1) + " / " + cur.steps.length + " 步";
      if (prevBtn) prevBtn.disabled = (i === 0);
      if (nextBtn) nextBtn.disabled = (i === cur.steps.length - 1);

      if (lab) {
        var frame = cur.frames[i];
        var anims = lab.load(frame, { fixed: cur.fixed, boardH: cfg.boardH || 6.7 });
        var delay = frame.strokes.length ? 260 : 0;
        busy = true;
        setTimeout(function () {
          if (!lab) return;
          lab.setSpeed(speed);
          lab.onDone(function () {
            busy = false;
            if (i === cur.steps.length - 1 && Lab.mark(cfg.chapter, "teach")) {
              Lab.toast("✍️ 这一题全写完了");
            }
            if (auto) autoTimer = setTimeout(function () { advance(1); }, 1500 / speed);
          });
          lab.play(speed);
        }, anims === 0 ? 0 : delay);
      } else if (fallbackEl) {
        fallbackEl.innerHTML = "";
        var host = document.createElement("div");
        host.className = "vstage";
        fallbackEl.appendChild(host);
        s.render(host);
        var ex = document.createElement("div");
        ex.className = "explain";
        ex.innerHTML = s.explain || "";
        host.appendChild(ex);
        if (root.HW && HW.animateStrokes) {
          HW.animateStrokes(host.querySelectorAll("[data-hw]"),
            { sequential: true, per: 0.45, delay: 0.3, dur: 0.32, strokePause: 0.14 });
        }
        if (i === cur.steps.length - 1 && Lab.mark(cfg.chapter, "teach")) Lab.toast("✍️ 这一题全看完了");
      }
    }

    function setCaption(html) {
      if (!captionEl) return;
      captionEl.innerHTML = html;
      captionEl.classList.remove("pop");
      void captionEl.offsetWidth;
      captionEl.classList.add("pop");
    }

    function advance(dir) {
      if (!cur.steps) return;
      var n = cur.idx + dir;
      if (n < 0 || n >= cur.steps.length) { stopAuto(); return; }
      showStep(n, true);
    }

    function startAuto() {
      auto = true;
      if (playBtn) {
        playBtn.classList.add("is-on");
        playBtn.textContent = "⏸ 暂停讲解";
      }
      if (cur.idx < 0) return;
      if (busy) return;
      if (cur.idx >= cur.steps.length - 1) { showStep(0); return; }
      advance(1);
    }
    function stopAuto() {
      auto = false;
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      if (playBtn) {
        playBtn.classList.remove("is-on");
        playBtn.textContent = "▶ 自动讲解";
      }
    }

    /* ---------- 例题按钮 ---------- */
    (cfg.demos || []).forEach(function (d) {
      var b = chip(d.label, d.tag);
      b.addEventListener("click", function () { selectDemo(d, b); });
      if (demoBox) demoBox.appendChild(b);
    });

    /* ---------- 控制条 ---------- */
    if (playBtn) playBtn.addEventListener("click", function () { if (auto) stopAuto(); else startAuto(); });
    if (prevBtn) prevBtn.addEventListener("click", function () { stopAuto(); advance(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { stopAuto(); advance(1); });
    if (replayBtn) replayBtn.addEventListener("click", function () { stopAuto(); showStep(cur.idx, true); });
    if (speedEl) {
      speedEl.addEventListener("input", function () {
        speed = Number(speedEl.value) / 100;
        if (lab) lab.setSpeed(speed);
        var label = cfg.speedLabel ? $(cfg.speedLabel) : null;
        if (label) label.textContent = speed.toFixed(1) + "×";
      });
      speed = Number(speedEl.value) / 100;
    }

    if (cfg.autoStart && (cfg.demos || []).length && demoBox && demoBox.firstChild) {
      var first = cfg.demos[0];
      selectDemo(first, demoBox.firstChild);
    }

    return {
      select: function (i) { selectDemo(cfg.demos[i], demoBox ? demoBox.children[i] : null); },
      stop: stopAuto
    };
  }

  Lab.teach = init;
})(window);
