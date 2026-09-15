/* ==========================================================================
 *  通用手写引擎  handwrite.js
 *  ------------------------------------------------------------------
 *  把「式子 / 公式」像人拿笔一样一笔一划写出来。
 *  字形全部是真实笔画路径（30 × 52 字框，基线 y=40）：
 *    数字 0-9、小写字母 a-z 常用集、大写字母 A B C E H L M P R S T W、
 *    运算符 + − × ÷ = ( ) . ² ³ < > ° /
 *  用法：
 *    HW.write(container, [{text:"3a", color:"red", anim:true}], {size:46})
 *    HW.html(items, opts)  只取 SVG 字符串，自己插入 DOM
 *    HW.animate(root)      触发 root 内所有 data-hw 笔画的书写动画
 * ========================================================================== */
(function (root) {
  "use strict";

  const GLYPH = {
    /* ---- 数字 ---- */
    "0": ["M15,5 C22,5 26,12 26,22 C26,32 22,40 15,40 C8,40 4,32 4,22 C4,12 8,5 15,5 Z"],
    "1": ["M7,12 L15,5 L15,40"],
    "2": ["M5,13 C5,6 25,4 25,13 C25,20 9,30 4,40 L27,40"],
    "3": ["M6,10 C9,4 25,5 25,13 C25,19 18,21 13,22 C20,22 26,25 25,32 C24,40 12,42 5,36"],
    "4": ["M21,40 L21,5 L4,28 L27,28"],
    "5": ["M24,5 L10,5 L8,21 C11,18 17,17 21,20 C26,23 27,29 25,34 C22,41 12,43 6,37"],
    "6": ["M23,6 C15,10 6,18 6,26 C5,34 10,40 16,40 C22,40 26,35 25,29 C24,23 16,20 11,24 C9,26 8,28 8,28"],
    "7": ["M4,5 L26,5 L12,40"],
    "8": ["M15,5 C20,5 24,8 24,12 C24,17 20,20 15,20 C10,20 6,17 6,12 C6,8 10,5 15,5",
          "M15,20 C21,20 26,24 26,30 C26,36 21,40 15,40 C9,40 4,36 4,30 C4,24 9,20 15,20"],
    "9": ["M25,14 C24,7 17,3 11,6 C5,9 5,17 10,21 C15,24 23,22 25,15 C26,24 26,32 20,40"],

    /* ---- 运算符 ---- */
    "+": ["M5,22 L25,22", "M15,12 L15,32"],
    "-": ["M5,22 L25,22"],
    "\u2212": ["M5,22 L25,22"],
    "×": ["M7,12 L25,32", "M25,12 L7,32"],
    "÷": ["M4,22 L26,22", "M15,10 L15,14", "M15,30 L15,34"],
    "=": ["M4,17 L26,17", "M4,27 L26,27"],
    ".": ["M15,36 m-2.8,0 a2.8,2.8 0 1,0 5.6,0 a2.8,2.8 0 1,0 -5.6,0"],
    ",": ["M15,36 m-2.6,0 a2.6,2.6 0 1,0 5.2,0 a2.6,2.6 0 1,0 -5.2,0", "M14,38 C12,42 10,45 8,47"],
    ":": ["M15,14 m-2.4,0 a2.4,2.4 0 1,0 4.8,0 a2.4,2.4 0 1,0 -4.8,0",
          "M15,32 m-2.6,0 a2.6,2.6 0 1,0 5.2,0 a2.6,2.6 0 1,0 -5.2,0"],
    "(": ["M20,6 C12,15 10,27 13,36 C14,40 15,42 16,45"],
    ")": ["M10,6 C18,15 20,27 17,36 C16,40 15,42 14,45"],
    "<": ["M24,12 L6,22 L24,32"],
    ">": ["M6,12 L24,22 L6,32"],
    "²": ["M8,11 C9,6 15,4 18,7 C21,10 19,14 14,16 C11,17 8,17 6,19"],
    "³": ["M7,9 C10,5 17,5 18,9 C19,13 14,14 12,15 C15,15 20,16 20,20 C20,24 12,23 6,20"],
    "°": ["M15,8 m-3.6,0 a3.6,3.6 0 1,0 7.2,0 a3.6,3.6 0 1,0 -7.2,0"],
    "/": ["M24,42 L7,6"],

    /* ---- 小写字母（基线 40，x 高顶 16） ---- */
    "a": ["M24,18 C20,14 8,15 6,24 C4,33 9,40 15,40 C20,40 24,36 24,30", "M24,16 L24,40"],
    "b": ["M8,4 L8,40", "M8,24 C10,18 20,16 23,21 C26,26 22,32 16,33 C11,34 8,31 8,27"],
    "c": ["M25,23 C23,18 18,16 13,17 C8,18 6,24 7,30 C8,37 15,41 22,38"],
    "d": ["M23,4 L23,40", "M23,24 C21,18 11,16 8,21 C5,26 9,32 15,33 C20,34 23,31 23,27"],
    "e": ["M6,29 L23,29 C23,22 19,17 13,17 C7,17 4,23 6,31 C7,38 14,41 21,38"],
    "f": ["M21,7 C19,3 14,3 11,6 L9,40", "M4,18 L18,18"],
    "g": ["M23,23 C21,18 15,16 11,19 C6,22 5,29 8,33 C11,37 18,38 22,34",
          "M23,16 L23,44 C23,49 17,51 12,48"],
    "h": ["M8,4 L8,40", "M8,26 C10,19 18,16 21,20 C24,24 22,32 21,36 C20,39 22,40 23,40"],
    "i": ["M12,16 L12,35 C12,38 14,40 16,38", "M12,7 L12,9"],
    "j": ["M14,16 L14,44 C14,48 11,51 7,49", "M14,7 L14,9"],
    "k": ["M8,4 L8,40", "M22,17 L9,28 L23,40"],
    "l": ["M12,4 L12,38 C12,39 14,40 16,39"],
    "m": ["M6,16 L6,40", "M6,26 C8,19 13,17 15,20 C17,23 15,30 15,34 C15,37 16,39 17,39",
          "M15,26 C17,19 22,17 24,20 C26,23 24,30 24,34 C24,37 25,39 26,39"],
    "n": ["M6,16 L6,40", "M6,26 C8,19 16,16 19,20 C22,24 20,32 20,36 C20,39 21,40 22,40"],
    "o": ["M15,17 C21,17 25,22 25,29 C25,36 21,40 15,40 C9,40 5,36 5,29 C5,22 9,17 15,17 Z"],
    "p": ["M6,16 L6,49", "M6,24 C8,18 18,16 21,20 C24,24 21,31 15,32 C10,33 6,31 6,27"],
    "q": ["M23,16 L23,49", "M23,24 C21,18 11,16 8,20 C5,24 8,31 14,32 C19,33 23,31 23,27"],
    "r": ["M8,16 L8,40", "M8,26 C10,20 16,17 20,18"],
    "s": ["M23,20 C21,16 15,15 11,17 C7,19 8,24 12,26 C16,28 22,29 22,33 C22,38 15,42 7,38"],
    "t": ["M14,6 L14,33 C14,37 17,40 21,37", "M6,17 L22,17"],
    "u": ["M6,16 L6,32 C6,37 10,40 14,39 C18,38 20,34 20,29 L20,16", "M20,32 L20,40"],
    "v": ["M5,16 L15,40 L25,16"],
    "w": ["M4,16 L10,40 L15,22 L20,40 L26,16"],
    "x": ["M7,16 L24,40", "M24,16 L7,40"],
    "y": ["M6,16 L14,33 L22,16", "M20,30 C19,38 16,45 12,50"],
    "z": ["M6,17 L24,17 L6,39 L25,39"],

    /* ---- 大写字母（大写字顶 5，基线 40） ---- */
    "A": ["M4,40 L15,5 L26,40", "M9,27 L21,27"],
    "B": ["M8,5 L8,40", "M8,5 C16,5 21,8 21,13 C21,18 16,21 8,21",
          "M8,21 C17,21 23,24 23,30 C23,36 16,40 8,40"],
    "C": ["M25,12 C22,6 15,3 10,7 C5,11 4,20 5,26 C6,33 11,38 18,38 C22,38 25,36 26,34"],
    "E": ["M24,5 L8,5 L8,40 L24,40", "M8,22 L20,22"],
    "H": ["M7,5 L7,40", "M23,5 L23,40", "M7,22 L23,22"],
    "L": ["M8,5 L8,40 L24,40"],
    "M": ["M4,40 L4,6 L15,26 L26,6 L26,40"],
    "P": ["M8,5 L8,40", "M8,5 C17,5 22,8 22,14 C22,20 17,23 8,23"],
    "R": ["M8,5 L8,40", "M8,5 C17,5 22,8 22,14 C22,19 17,22 8,22", "M14,22 L24,40"],
    "S": ["M24,10 C21,5 13,3 9,7 C5,11 8,17 14,20 C20,23 26,25 25,31 C24,38 14,42 7,37"],
    "T": ["M4,7 L26,7", "M15,7 L15,40"],
    "W": ["M3,5 L10,40 L16,17 L22,40 L28,5"],
  };

  /* 字符步进宽度（字框 30 宽，按字形疏密微调） */
  const ADV = {
    "i": 17, "l": 17, "j": 17, "f": 22, "t": 26, "r": 24, "(": 20, ")": 20,
    ".": 16, ",": 16, ":": 16, "²": 22, "³": 22, "1": 26,
    "+": 30, "-": 30, "\u2212": 30, "×": 32, "÷": 32, "=": 32, "<": 28, ">": 28,
    "m": 40, "w": 40, "W": 40, "M": 38,
    "°": 16, "/": 22,
  };
  const CW = 30, CH = 52;   // 字框尺寸

  const COLOR = {
    ink: "#2b3742", red: "#d9483f", green: "#2f7d5f",
    blue: "#2f6fb0", amber: "#c07d1e", op: "#8496a1", purple: "#7a5ea8",
  };

  /** 估算一段文本的宽度（字框单位） */
  function measure(text) {
    let w = 0;
    for (const ch of text) w += (ADV[ch] || 32);
    return w;
  }

  /**
   * 生成手写公式的 SVG 字符串
   * @param {Array} items [{text, color, anim}]  color: ink|red|green|blue|amber|op|purple
   * @param {Object} opt  {size:46, gap:6, delay:0.08, unit:false}
   * @returns {{html:string, w:number, h:number}}
   */
  function html(items, opt) {
    opt = opt || {};
    const size = opt.size || 46;          // 字高（px）
    const gap = opt.gap != null ? opt.gap : 8;
    const s = size / CH;                  // 缩放比
    const decor = opt.decor || "";        // 追加在 svg 内的装饰（下划线等）

    let totalU = 0;
    items.forEach(function (it, i) {
      totalU += measure(it.text || "") * s;
      if (i < items.length - 1) totalU += gap;
    });
    const W = Math.ceil(totalU + 8);
    const H = Math.ceil(size * 1.18 + 12);
    const originY = (H - size) / 2;                        // 字框原点的 y
    const baseY = originY + size * (40 / CH) - 2;         // 文字回退使用的基线 y

    const parts = [];
    let x = 4;
    items.forEach(function (it) {
      const color = COLOR[it.color] || COLOR.ink;
      const anim = it.anim ? " data-hw=\"1\"" : "";
      const sw = (it.bold ? 4.6 : 4) / (s > 1 ? 1 : 1);
      for (const ch of (it.text || "")) {
        const st = GLYPH[ch];
        const adv = (ADV[ch] || 32) * s;
        if (st) {
          st.forEach(function (d) {
            parts.push('<path class="hw-stroke"' + anim +
              ' transform="translate(' + x.toFixed(1) + "," + originY.toFixed(1) + ") scale(" + s.toFixed(4) + ")" +
              '" d="' + d + '" fill="none" stroke="' + color +
              '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>');
          });
        } else {
          /* 未收录字形（如中文）退回文字 */
          parts.push('<text class="hw-fallback"' + anim + ' x="' + (x + adv / 2).toFixed(1) +
            '" y="' + (baseY - size * 0.06).toFixed(1) + '" text-anchor="middle" font-size="' +
            (size * 0.82).toFixed(1) + '" font-weight="600" fill="' + color + '">' + ch + "</text>");
        }
        x += adv;
      }
      x += gap;
    });

    return {
      w: W, h: H,
      html: '<svg class="hw-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">' +
        parts.join("") + decor + "</svg>",
    };
  }

  /**
   * 逐笔书写动画（带笔尖跟随）——手写卡与竖式共用
   * @param {Array|NodeList} els 待书写元素（path/line 走笔画，其余淡入）
   * @param {Object} opt {total:总时长, per:单笔间隔上限, delay:起始延迟, dur:单笔时长, pen:是否显示笔尖}
   */
  function animateStrokes(els, opt) {
    opt = opt || {};
    const n = els.length;
    if (!n) return 0;
    const reduced = !!(root.document && root.document.body && root.document.body.classList.contains("reduce-motion")) ||
      !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (reduced) {
      for (let i = 0; i < n; i++) {
        els[i].style.opacity = "1";
        els[i].style.strokeDasharray = "none";
        els[i].style.strokeDashoffset = "0";
      }
      return 0;
    }
    const total = opt.total || 2.0;                 // 整段书写总时长（秒）
    const base = opt.delay != null ? opt.delay : 0.06;
    const DUR = opt.dur || 0.28;                    // 单笔时长（秒）
    const strokePause = opt.strokePause != null ? opt.strokePause : 0.06;
    const gap = opt.sequential
      ? Math.max(opt.per || (DUR + strokePause), DUR + strokePause)
      : Math.min(opt.per || 0.3, total / n);
    const showPen = opt.pen !== false;
    const durationMs = Math.round((base + Math.max(0, n - 1) * gap + DUR) * 1000);

    const strokes = [];
    for (let i = 0; i < n; i++) {
      const el = els[i];
      const delay = base + i * gap;
      if (el.tagName === "path" || el.tagName === "line") {
        let L = 100;
        try { L = el.getTotalLength(); } catch (e) { /* 兜底 */ }
        strokes.push({
          el: el, L: L, t0: delay, t1: delay + DUR,
          tr: el.getAttribute("transform") || "",
          svg: el.closest ? el.closest("svg") : null,
        });
      } else {
        el.style.transformBox = "fill-box";
        el.style.transformOrigin = "center";
        if (el.animate) {
          el.animate(
            [{ opacity: 0, transform: "scale(0.3)" }, { opacity: 1, transform: "scale(1)" }],
            { duration: 260, delay: Math.round(delay * 1000), fill: "backwards", easing: "ease-out" }
          );
        }
      }
    }
    if (!strokes.length) return durationMs;
    if (!showPen) {
      /* 不需要笔尖时退回 CSS 过渡，省一帧循环 */
      strokes.forEach(function (s) {
        s.el.style.strokeDasharray = s.L + " " + s.L;
        s.el.style.strokeDashoffset = s.L;
        void s.el.getBoundingClientRect();
        s.el.style.transition = "stroke-dashoffset " + DUR + "s ease-in-out " + s.t0.toFixed(2) + "s";
        s.el.style.strokeDashoffset = "0";
      });
      return durationMs;
    }

    /* 初始隐藏所有笔画 */
    strokes.forEach(function (s) {
      s.el.style.strokeDasharray = s.L + " " + s.L;
      s.el.style.strokeDashoffset = s.L;
    });
    void strokes[0].el.getBoundingClientRect(); // 强制一次布局，避免闪现

    /* 笔尖：每张 svg 一支（不同 svg 的坐标/变换互不通用） */
    const pens = new Map();
    function penOf(svg) {
      if (!svg) return null;
      if (pens.has(svg)) return pens.get(svg);
      const pen = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      pen.setAttribute("class", "hw-pen");
      pen.setAttribute("r", "3.6");
      pen.setAttribute("fill", "#1b4a7a");
      pen.setAttribute("opacity", "0");
      svg.appendChild(pen);
      pens.set(svg, pen);
      return pen;
    }

    const T0 = performance.now();
    function frame(now) {
      const t = (now - T0) / 1000;
      let active = null, finished = true;
      for (const s of strokes) {
        const p = (t - s.t0) / (s.t1 - s.t0);
        if (p <= 0) { finished = false; continue; }
        if (p < 1) {
          finished = false;
          s.el.style.strokeDashoffset = String(s.L * (1 - p));
          if (!active) active = { s: s, p: p };
        } else {
          s.el.style.strokeDashoffset = "0";
        }
      }
      /* 同一时刻只显示一支笔尖（先到先写） */
      pens.forEach(function (pen) { pen.setAttribute("opacity", "0"); });
      if (active) {
        const pen = penOf(active.s.svg);
        if (pen) {
          try {
            const pt = active.s.el.getPointAtLength(active.s.L * active.p);
            pen.setAttribute("cx", pt.x.toFixed(1));
            pen.setAttribute("cy", pt.y.toFixed(1));
            pen.setAttribute("transform", active.s.tr);
            pen.setAttribute("opacity", "1");
          } catch (e) { /* 个别浏览器 getTotalLength 前不可用 */ }
        }
      }
      if (!finished) requestAnimationFrame(frame);
      else setTimeout(function () { pens.forEach(function (pen) { pen.remove(); }); pens.clear(); }, 350);
    }
    requestAnimationFrame(frame);
    return durationMs;
  }

  /** 触发 root 内所有 data-hw 笔画的逐笔书写动画 */
  function animate(root, opt) {
    if (!root) return 0;
    return animateStrokes(root.querySelectorAll("[data-hw]"), opt);
  }

  /**
   * 在容器内写一段公式（可带中文混排）
   * @param {HTMLElement} box 容器
   * @param {Array} items [{text, color, anim}]
   * @param {Object} opt  {size, gap, center, delay, animate}
   */
  function write(box, items, opt) {
    opt = opt || {};
    const r = html(items, opt);
    const wrap = document.createElement("div");
    wrap.className = "hw-wrap" + (opt.center === false ? "" : " center");
    wrap.innerHTML = r.html;
    box.appendChild(wrap);
    if (opt.animate !== false) animate(wrap, opt);
    return wrap;
  }

  root.HW = {
    GLYPH: GLYPH, html: html, write: write,
    animate: animate, animateStrokes: animateStrokes,
    measure: measure, COLOR: COLOR,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.HW;
})(typeof window !== "undefined" ? window : globalThis);
