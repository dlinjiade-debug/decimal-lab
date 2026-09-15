/* ==========================================================================
 *  书本级竖式引擎  vertical-calc.js  v3 —— 手写笔顺版
 *  ------------------------------------------------------------------
 *  · 竖式整体用 SVG 绘制，数字是真实的笔画路径
 *  · 每一步"新写"的数字像人拿笔一样一笔一笔写出来（stroke-dash 动画）
 *  · 排版贴合人教版教材：小数点紧贴数字、长除号、横线贴内容
 *  对外接口不变：buildMultSteps(a,b) / buildDivSteps(a,b) -> [{explain, render}]
 * ========================================================================== */
(function (root) {
  "use strict";

  /* ---------------- 手写字形（笔画路径，30×44 视框） ---------------- */
  const GLYPH = {
    "0": ["M15,3 C22,3 26,11 26,22 C26,33 22,41 15,41 C8,41 4,33 4,22 C4,11 8,3 15,3 Z"],
    "1": ["M6,11 L14,4 L14,42"],
    "2": ["M5,13 C5,5 25,3 25,12 C25,19 9,30 4,42 L27,42"],
    "3": ["M6,9 C9,3 25,4 25,12 C25,18 18,21 13,22 C20,22 26,26 25,33 C24,41 12,44 5,37"],
    "4": ["M20,42 L20,4 L4,30 L27,30"],
    "5": ["M24,4 L10,4 L8,21 C11,18 17,17 21,20 C26,23 27,30 25,35 C22,42 12,44 6,38"],
    "6": ["M23,5 C15,9 7,18 6,27 C5,36 10,42 16,42 C22,42 26,37 25,31 C24,24 16,21 11,25 C9,27 8,29 8,29"],
    "7": ["M4,4 L26,4 L12,42"],
    "8": ["M15,3 C20,3 24,6 24,10 C24,15 20,18 15,19 C10,18 6,15 6,10 C6,6 10,3 15,3",
          "M15,19 C21,19 26,23 26,29 C26,36 21,42 15,42 C9,42 4,36 4,29 C4,23 9,19 15,19"],
    "9": ["M25,13 C24,6 17,2 11,5 C5,8 5,16 10,20 C15,23 23,21 25,14 C26,23 26,33 20,42"],
    "×": ["M7,13 L25,33", "M25,13 L7,33"],
  };

  const ANIM_CLASS_RE = /(^|[\s])(hot|new|bring|final|write)([\s]|$)/;
  const CLASSROOM_PACE = {
    startDelayMs: 450,
    strokeMs: 340,
    strokeGapMs: 420,
    explanationLagMs: 300,
    minStepMs: 6500,
  };

  function isAnimatedClass(cls) { return ANIM_CLASS_RE.test(cls || ""); }

  function readableTextLength(html) {
    return String(html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, "").length;
  }

  function stepTiming(animatedItemCount, explain) {
    const count = Math.max(0, Number(animatedItemCount) || 0);
    const writeMs = count
      ? CLASSROOM_PACE.startDelayMs + Math.max(0, count - 1) * CLASSROOM_PACE.strokeGapMs + CLASSROOM_PACE.strokeMs
      : 0;
    const readMs = Math.max(3500, Math.min(5200, 2500 + readableTextLength(explain) * 22));
    return {
      writeDurationMs: writeMs,
      readDurationMs: readMs,
      autoDelayMs: Math.max(CLASSROOM_PACE.minStepMs, writeMs + CLASSROOM_PACE.explanationLagMs + readMs),
    };
  }

  /* ---------------- 小数字符串工具 ---------------- */
  function vDecimalsOf(s) { const i = s.indexOf("."); return i < 0 ? 0 : s.length - i - 1; }
  function vStripPoint(s) { return s.replace(".", ""); }

  /** 小数点右移 n 位 */
  function vShiftPointRight(str, n) {
    let intPart = str, frac = "";
    const i = str.indexOf(".");
    if (i >= 0) { intPart = str.slice(0, i); frac = str.slice(i + 1); }
    while (frac.length < n) frac += "0";
    let merged = intPart + frac.slice(0, n);
    const rest = frac.slice(n);
    merged = merged.replace(/^0+(?=\d)/, "");
    if (merged === "") merged = "0";
    return rest ? merged + "." + rest : merged;
  }
  function vStripPointRight(s, n) { return vStripPoint(vShiftPointRight(s, n)); }

  /** 整数串按 totalDec 位小数加点（位数不够自动前面补 0） */
  function vPlaceDecimal(intStr, totalDec) {
    if (totalDec <= 0) return intStr.replace(/^0+(?=\d)/, "");
    let s = intStr.replace(/^0+(?=\d)/, "");
    while (s.length <= totalDec) s = "0" + s;
    const cut = s.length - totalDec;
    return s.slice(0, cut) + "." + s.slice(cut);
  }
  /** 去掉小数末尾多余的 0：3.60 -> 3.6 ; 3.00 -> 3 */
  function vTrimZeros(s) {
    if (s.indexOf(".") < 0) return s;
    return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }
  function digitCount(s) { return s.replace(/\./g, "").length; }
  /** 去掉前导 0： "072" -> "72"，至少保留一位 */
  function stripLead(s) { const r = s.replace(/^0+(?=\d)/, ""); return r === "" ? "0" : r; }

  /* ==========================================================================
   *  Sheet —— 竖式排版器
   *  坐标系：列 col（每列一个数字），行 row。
   *  小数点不占列，画在「列 col 与 col+1 之间的缝隙」中央，
   *  缝隙宽度 dotGap 只在该处存在，其余列紧贴 —— 与教材视觉一致。
   * ========================================================================== */
  function Sheet(o) {
    o = o || {};
    this.cw = o.cw || 42;        // 数字列宽
    this.lh = o.lh || 56;        // 行高
    this.dotW = o.dotW || 13;    // 小数点直径
    this.dotGap = o.dotGap || 15;// 小数点所在缝隙的额外宽度
    this.items = [];
    this.dots = {};              // 记录哪些列边界有小数点
    this.maxRow = 0;
  }
  Sheet.prototype = {
    _t(r) { if (r > this.maxRow) this.maxRow = r; return this; },

    /** 放一个字符（数字或运算符），占一列 */
    put(row, col, ch, cls) {
      this._t(row);
      this.items.push({ k: "c", row: row, col: col, ch: ch, cls: cls || "" });
      return this;
    },
    /** 小数点：位于列 col 与 col+1 之间 */
    dot(row, col, cls) {
      this._t(row);
      this.dots[col] = (this.dots[col] || 0) + 1;
      this.items.push({ k: "p", row: row, col: col, cls: cls || "" });
      return this;
    },
    /** 横线：覆盖 c0..c1 列 */
    bar(row, c0, c1, cls) {
      this._t(row);
      this.items.push({ k: "b", row: row, c0: c0, c1: c1, cls: cls || "" });
      return this;
    },
    /** 教材长除号：顶部横线从 colS 延伸到 c1，左端向下弯出「)」弧 */
    ldiv(row, colS, c1, cls) {
      this._t(row);
      this.items.push({ k: "L", row: row, col: colS, c1: c1, cls: cls || "" });
      return this;
    },
    /** 右对齐写一串数字（支持 '.'），返回最左列 */
    str(row, endCol, s, clsFn, dotCls) {
      let col = endCol;
      for (let i = s.length - 1; i >= 0; i--) {
        const ch = s[i];
        if (ch === ".") this.dot(row, col, dotCls || "decpt");
        else { this.put(row, col, ch, clsFn ? (clsFn(ch, col) || "") : ""); col--; }
      }
      return endCol - digitCount(s) + 1;
    },
    /** 左对齐写一串数字（支持 '.'），返回下一个空列 */
    strL(row, startCol, s, clsFn, dotCls) {
      let col = startCol;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === ".") this.dot(row, col - 1, dotCls || "decpt");
        else { this.put(row, col, ch, clsFn ? (clsFn(ch, col) || "") : ""); col++; }
      }
      return col;
    },

    colX(col) {
      let x = 0;
      if (col >= 0) {
        for (let j = 0; j < col; j++) x += this.cw + (this.dots[j] ? this.dotGap : 0);
      } else {
        for (let j = -1; j >= col; j--) x -= this.cw + (this.dots[j] ? this.dotGap : 0);
      }
      return x;
    },
    bounds() {
      let c0 = 1e9, c1 = -1e9;
      this.items.forEach(function (it) {
        if (it.k === "c" || it.k === "p") { c0 = Math.min(c0, it.col); c1 = Math.max(c1, it.col); }
        if (it.k === "b") { c0 = Math.min(c0, it.c0); c1 = Math.max(c1, it.c1); }
        if (it.k === "L") { c0 = Math.min(c0, it.col); c1 = Math.max(c1, it.c1); }
      });
      if (c1 < 0) { c0 = 0; c1 = 0; }
      return { c0: c0, c1: c1 };
    },

    animatedItemCount() {
      let count = 0;
      this.items.forEach(function (it) {
        if (!isAnimatedClass(it.cls)) return;
        if (it.k === "c") {
          count += (GLYPH[it.ch] || [it.ch]).length;
          if ((it.cls || "").indexOf("hot") >= 0) count += 1;
          if ((it.cls || "").indexOf("bring") >= 0) count += 1;
        } else count += 1;
      });
      return count;
    },

    toDOM() {
      const PADX = 26, PADY = 14;
      const b = this.bounds();
      const offX = this.colX(b.c0);
      const W = this.colX(b.c1 + 1) - offX + PADX * 2;
      const H = (this.maxRow + 1) * this.lh + PADY * 2;
      const self = this;
      /* 本步新写的内容（hot/new/bring/final）走手写动画 */
      const SW = 4.4; // 笔画粗细
      const parts = [];

      function strokeColor(cls) {
        cls = cls || "";
        if (cls.indexOf("hot") >= 0) return "vs-red";
        if (cls.indexOf("bring") >= 0) return "vs-blue";
        if (cls.indexOf("new") >= 0 || cls.indexOf("final") >= 0) return "vs-green";
        if (cls.indexOf("op") >= 0) return "vs-op";
        return "vs-ink";
      }

      this.items.forEach(function (it) {
        const Y = it.row * self.lh + PADY;
        if (it.k === "c") {
          const X = self.colX(it.col) - offX + PADX;
          const anim = isAnimatedClass(it.cls);
          const color = strokeColor(it.cls);
          const gx = X + (self.cw - 30) / 2;
          const gy = Y + (self.lh - 46) / 2 - 2;
          /* hot 高亮底色（垫在笔画下面） */
          if ((it.cls || "").indexOf("hot") >= 0) {
            parts.push('<rect class="hhot"' + (anim ? ' data-anim="1"' : '') +
              ' x="' + (X + 1) + '" y="' + (Y + 5) + '" width="' + (self.cw - 2) +
              '" height="' + (self.lh - 8) + '" rx="9"/>');
          }
          const strokes = GLYPH[it.ch];
          if (strokes) {
            strokes.forEach(function (d) {
              parts.push('<path class="' + color + (anim ? ' hw' : '') + '"' +
                (anim ? ' data-anim="1"' : '') + ' transform="translate(' + gx + "," + gy + ')" d="' + d +
                '" fill="none" stroke-width="' + SW + '" stroke-linecap="round" stroke-linejoin="round"/>');
            });
          } else {
            /* 未收录字形回退为文字 */
            parts.push('<text class="vtxt" x="' + (X + self.cw / 2) + '" y="' + (Y + self.lh * 0.76) +
              '" text-anchor="middle" font-size="36" font-weight="600" fill="' +
              (color === "vs-red" ? "#e53935" : color === "vs-green" ? "#2e7d32" : color === "vs-blue" ? "#1e88e5" : "#263238") + '"' +
              (anim ? ' data-anim="1"' : "") + ">" + it.ch + "</text>");
          }
          /* 落位箭头（bring 字符上方的小 ↓） */
          if ((it.cls || "").indexOf("bring") >= 0) {
            const cx = X + self.cw / 2;
            const ay = Y + 4;
            parts.push('<path class="vs-blue hw" data-anim="1" d="M ' + cx + " " + (ay - 22) + " L " + cx + " " + (ay - 6) +
              " M " + (cx - 7) + " " + (ay - 14) + " L " + cx + " " + (ay - 6) + " L " + (cx + 7) + " " + (ay - 14) +
              '" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>');
          }
        } else if (it.k === "p") {
          const X = self.colX(it.col) + self.cw + (self.dotGap - self.dotW) / 2 - offX + PADX;
          const cy = Y + self.lh * 0.72;
          const anim = isAnimatedClass(it.cls);
          parts.push('<circle class="vp ' + (it.cls || "") + (anim ? ' hwf' : '') + '"' +
            (anim ? ' data-anim="1"' : '') + ' cx="' + (X + self.dotW / 2) + '" cy="' + cy + '" r="5.2"/>');
        } else if (it.k === "b") {
          const X = self.colX(it.c0) - offX + PADX - 5;
          const BW = self.colX(it.c1 + 1) - self.colX(it.c0) + 10;
          const Yb = Y + self.lh * 0.52;
          const anim = isAnimatedClass(it.cls);
          parts.push('<line class="vs-ink' + (anim ? ' hw' : '') + '"' + (anim ? ' data-anim="1"' : '') + ' x1="' + X + '" y1="' + Yb +
            '" x2="' + (X + BW) + '" y2="' + Yb + '" stroke-width="3.2" stroke-linecap="round"/>');
        } else if (it.k === "L") {
          const sx = self.colX(it.col) + self.cw * 0.5 - offX + PADX;   // 弧顶部
          const ex = self.colX(it.c1 + 1) - offX + PADX;                 // 横线右端
          const ty = Y + 2;                                              // 横线 y
          const by = Y + self.lh + 2;                                    // 弧底 y
          const bow = self.cw * 0.36;                                    // 弧向右凸出量
          const d = "M " + ex + " " + ty +
            " L " + sx + " " + ty +
            " C " + (sx + bow) + " " + (ty + (by - ty) * 0.36) +
            " " + (sx + bow) + " " + (ty + (by - ty) * 0.74) +
            " " + (sx + bow * 0.16) + " " + by;
          const anim = isAnimatedClass(it.cls);
          parts.push('<path class="vs-ink' + (anim ? ' hw' : '') + '"' + (anim ? ' data-anim="1"' : '') + ' d="' + d + '" fill="none" stroke-width="3" stroke-linecap="round"/>');
        }
      });

      const wrap = document.createElement("div");
      wrap.className = "vsheet-wrap";
      wrap.innerHTML = '<div class="vsheet"><svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">' +
        parts.join("") + "</svg></div>";
      return wrap;
    },
  };

  /* ---------------- 手写动画：笔画按书写顺序逐笔写出 ---------------- */
  function handwrite(wrap) {
    const els = wrap.querySelectorAll("[data-anim]");
    const n = els.length;
    if (!n) return 0;
    /* 有手写引擎时走统一的笔尖跟随动画（与公式卡同一套）；否则退回简单过渡 */
    if (root.HW && root.HW.animateStrokes) {
      return root.HW.animateStrokes(els, {
        sequential: true,
        per: CLASSROOM_PACE.strokeGapMs / 1000,
        delay: CLASSROOM_PACE.startDelayMs / 1000,
        dur: CLASSROOM_PACE.strokeMs / 1000,
        strokePause: (CLASSROOM_PACE.strokeGapMs - CLASSROOM_PACE.strokeMs) / 1000,
      }) || 0;
    }
    const reduceMotion = root.document && root.document.body && root.document.body.classList.contains("reduce-motion");
    if (reduceMotion) return 0;
    const gap = CLASSROOM_PACE.strokeGapMs / 1000;
    const duration = CLASSROOM_PACE.strokeMs / 1000;
    const base = CLASSROOM_PACE.startDelayMs / 1000;
    for (let i = 0; i < n; i++) {
      const el = els[i];
      const delay = base + i * gap;
      if (el.tagName === "path" || el.tagName === "line") {
        let L = 120;
        try { L = el.getTotalLength(); } catch (e) { /* 离线兜底 */ }
        el.style.strokeDasharray = L + " " + L;
        el.style.strokeDashoffset = L;
        void el.getBoundingClientRect(); // 强制回流，让过渡生效
        el.style.transition = "stroke-dashoffset " + duration.toFixed(2) + "s ease-in-out " + delay.toFixed(2) + "s";
        el.style.strokeDashoffset = "0";
      } else {
        el.style.transformBox = "fill-box";
        el.style.transformOrigin = "center";
        if (el.animate) {
          el.animate(
            [{ opacity: 0, transform: "scale(0.3)" }, { opacity: 1, transform: "scale(1)" }],
            { duration: Math.round(duration * 1000), delay: Math.round(delay * 1000), fill: "backwards", easing: "ease-out" }
          );
        }
      }
    }
    return Math.round((base + Math.max(0, n - 1) * gap + duration) * 1000);
  }

  /* ---------------- 步骤包装 ---------------- */
  /* 手写完整算式（依赖 handwrite.js，缺省时退回纯文本） */
  function hwEq(items) {
    if (root.HW) {
      const animated = items.map(function (item) { return Object.assign({}, item, { anim: true }); });
      return '<div class="hw-card hw-eq">' + root.HW.html(animated, { size: 44 }).html + "</div>";
    }
    return "<div class='final-answer'>" + items.map(function (it) { return it.text; }).join("") + "</div>";
  }
  function mkStep(sheet, explain, extraHTML, meta) {
    meta = meta || {};
    const animatedItemCount = sheet.animatedItemCount();
    const timing = stepTiming(animatedItemCount, explain);
    const step = {
      explain: explain,
      animatedItemCount: animatedItemCount,
      writeDurationMs: timing.writeDurationMs,
      readDurationMs: timing.readDurationMs,
      autoDelayMs: timing.autoDelayMs,
      writePhases: meta.writePhases || [],
      render: function (el) {
        const w = sheet.toDOM();
        el.appendChild(w);
        const actualWriteMs = handwrite(w); // 挂载后再启动笔顺动画（getTotalLength 需要 DOM）
        step.writeDurationMs = actualWriteMs;
        step.autoDelayMs = Math.max(CLASSROOM_PACE.minStepMs,
          actualWriteMs + CLASSROOM_PACE.explanationLagMs + step.readDurationMs);
        if (extraHTML) {
          const d = document.createElement("div");
          d.className = "step-extra";
          d.innerHTML = extraHTML;
          el.appendChild(d);
          if (root.HW) root.HW.animate(d, { sequential: true, per: 0.42, delay: 0.45, dur: 0.34, strokePause: 0.08 });
        }
        if (explain) {
          const b = document.createElement("div");
          b.className = "explain-bubble";
          b.innerHTML = explain;
          b.style.animationDelay = Math.round(actualWriteMs + CLASSROOM_PACE.explanationLagMs) + "ms";
          el.appendChild(b);
        }
      },
    };
    return step;
  }
  function mkStepHTML(html, explain, meta) {
    const timing = stepTiming(0, explain);
    return {
      explain: explain,
      animatedItemCount: 0,
      writeDurationMs: 0,
      readDurationMs: timing.readDurationMs,
      autoDelayMs: timing.autoDelayMs,
      writePhases: (meta && meta.writePhases) || [],
      render: function (el) {
        const d = document.createElement("div");
        d.className = "step-extra";
        d.innerHTML = html;
        el.appendChild(d);
        if (explain) {
          const b = document.createElement("div");
          b.className = "explain-bubble";
          b.innerHTML = explain;
          el.appendChild(b);
        }
      },
    };
  }

  /* ==========================================================================
   *  小数乘法  buildMultSteps("2.35", "1.5")
   *  步骤：抄题 → 去小数点变整数 → 逐位乘（部分积左移）→ 相加 → 点小数点 → 化简
   * ========================================================================== */
  function buildMultSteps(a, b) {
    const decA = vDecimalsOf(a), decB = vDecimalsOf(b), total = decA + decB;
    const A = stripLead(vStripPoint(a)), B = stripLead(vStripPoint(b));
    const intProd = (BigInt(A) * BigInt(B)).toString();
    const rawProd = vPlaceDecimal(intProd, total);   // 带完整小数位的积
    const finalStr = vTrimZeros(rawProd);
    const needPad = intProd.length < rawProd.replace(/\./g, "").length; // 是否前面补过 0
    const needTrim = finalStr !== rawProd;           // 末尾是否有可化简的 0

    // 最右列：要同时容得下原题（带小数点）和积
    const R = Math.max(digitCount(a), digitCount(b), digitCount(rawProd)) - 1;
    const steps = [];

    /* 每一步都重建整张竖式：state 描述"当前画到哪" */
    function sheet(st) {
      const s = new Sheet({});
      const sa = st.showPoint ? a : A;      // 本步显示的被乘数
      const sb = st.showPoint ? b : B;      // 本步显示的乘数
      const aLeft = R - digitCount(sa) + 1;
      const bLeft = R - digitCount(sb) + 1;
      const opCol = bLeft - 1;              // × 号紧贴乘数左边
      const baseCls = st.baseCls || "old";
      s.str(0, R, sa, function () { return baseCls; }, baseCls === "old" ? "decpt" : "decpt " + baseCls);
      s.put(1, opCol, "\u00D7", baseCls === "old" ? "op" : "op " + baseCls);
      s.str(1, R, sb, function () { return baseCls; }, baseCls === "old" ? "decpt" : "decpt " + baseCls);
      s.bar(2, Math.min(aLeft, opCol), R, baseCls === "old" ? "" : baseCls);

      // 部分积
      let leftMost = aLeft;
      st.parts.forEach(function (p, k) {
        const start = s.str(3 + k, R - k, p.str, function () { return p.cls || "old"; });
        leftMost = Math.min(leftMost, start);
      });

      if (st.showSum) {
        s.bar(3 + st.parts.length, Math.min(leftMost, R - intProd.length + 1), R, st.sumCls || "");
        s.str(4 + st.parts.length, R, intProd, function () { return st.sumCls || "old"; });
      }
      if (st.showFinal) {
        const r = 3 + st.parts.length + (st.showSum ? 2 : 0);
        s.bar(r, Math.min(leftMost, R - digitCount(rawProd) + 1), R);
        s.str(r + 1, R, st.finalText, function () {
          return "final";
        }, st.dotNew ? "decpt new" : "decpt");
      }
      return s;
    }

    const st = { showPoint: true, parts: [], showSum: false, showFinal: false, finalText: rawProd, baseCls: "write", sumCls: "" };

    /* 第1步：抄题 */
    steps.push(mkStep(sheet(st),
      "<b>抄题：</b>两个因数<b>末位对齐</b>，× 写在乘数左边，画一条横线。",
      "", { writePhases: ["写被乘数", "写乘数", "画横线"] }));
    st.baseCls = "old";

    /* 第2步：暂时不看小数点 */
    if (total > 0) {
      st.showPoint = false;
      steps.push(mkStep(sheet(st),
        "<b>小数点先「隐身」：</b>把 " + a + "、 " + b + " 当作整数 <b>" + A + " × " + B + "</b> 来算，算完再把小数点变回来。"));
    }

    /* 逐位乘 */
    for (let k = 0; k < B.length; k++) {
      const d = B[B.length - 1 - k];
      const pp = (BigInt(A) * BigInt(d)).toString();
      const placeName = k === 0 ? "个" : (k === 1 ? "十" : (k === 2 ? "百" : "千"));
      st.parts.push({
        str: pp,
        value: (BigInt(pp) * (BigInt(10) ** BigInt(k))).toString(),
        cls: "hot"
      });
      st.parts.forEach(function (p, idx) { if (idx < k) p.cls = "old"; });
      const dZero = (d === "0");
      let ex;
      if (dZero) {
        ex = "<b>用" + placeName + "位上的 " + d + " 乘：</b>" + d + " 乘任何数都得 0，这一行写 <b>0</b> 占位，位置不能省。";
      } else if (k > 0) {
        ex = "<b>用" + placeName + "位上的 " + d + " 乘：</b>" + A + " × " + d + " = <b>" + pp + "</b>。" +
          "它表示 " + pp + " 个" + pow10(k) + "，所以<b>向左错开 " + k + " 位</b>写。";
      } else {
        ex = "<b>用个位上的 " + d + " 乘：</b>" + A + " × " + d + " = <b>" + pp + "</b>，末尾对齐个位。";
      }
      steps.push(mkStep(sheet(st), ex));
    }
    st.parts.forEach(function (p) { p.cls = "old"; });

    /* 相加 */
    if (B.length > 1) {
      st.showSum = true;
      st.sumCls = "write";
      steps.push(mkStep(sheet(st),
        "<b>把部分积加起来：</b>" + st.parts.map(function (p) { return p.value; }).join(" + ") +
        " = <b>" + intProd + "</b>。到这里为止都是整数乘法。",
        "", { writePhases: ["画横线", "写整数积"] }));
      st.sumCls = "";
    }

    /* 点小数点 */
    if (total > 0) {
      st.showPoint = true;   // 小数点回归
      st.showFinal = true;
      st.dotNew = true;      // 这一步小数点"跳"出来
      steps.push(mkStep(sheet(st),
        "<b>关键一步——点小数点！</b>两个因数共 <b>" + total + "</b> 位小数（" + decA + " + " + decB + "），" +
        "从 " + intProd + " 的右边往左数 " + total + " 位 → <b style='color:#2e7d32'>" + rawProd + "</b>" +
        (needPad ? "<br>位数不够，先在前面<b>补 0</b> 再点。" : "")));
      st.dotNew = false;
    }

    /* 化简 */
    if (needTrim) {
      st.finalText = finalStr;
      steps.push(mkStep(sheet(st),
        "<b>化简：</b>小数末尾的 0 要去掉 → <b style='color:#2e7d32'>" + rawProd + " = " + finalStr + "</b>。"));
    }

    steps.push(mkStep(sheet(st),
      "<b>完成！</b>" + a + " × " + b + " = <b style='color:#2e7d32'>" + finalStr + "</b>" +
      "<br>验算：" + finalStr + " ÷ " + b + " = " + a + " ✓",
      hwEq([{ text: a, color: "ink" }, { text: " × ", color: "op" }, { text: b, color: "ink" },
        { text: " = ", color: "op" }, { text: finalStr, color: "green" }])));

    return steps;
  }

  function pow10(n) { let r = 1; for (let i = 0; i < n; i++) r *= 10; return r; }

  function gcdBigInt(a, b) {
    a = a < 0n ? -a : a;
    b = b < 0n ? -b : b;
    while (b !== 0n) { const next = a % b; a = b; b = next; }
    return a;
  }

  function hasTerminatingDecimal(numerator, denominator) {
    if (denominator === 0n) return false;
    let reduced = (denominator < 0n ? -denominator : denominator) /
      gcdBigInt(numerator, denominator);
    while (reduced % 2n === 0n) reduced /= 2n;
    while (reduced % 5n === 0n) reduced /= 5n;
    return reduced === 1n;
  }

  function roundRationalString(numerator, denominator, places) {
    const scale = 10n ** BigInt(places);
    let scaled = numerator * scale;
    let rounded = scaled / denominator;
    const remainder = scaled % denominator;
    if (remainder * 2n >= denominator) rounded += 1n;
    let digits = rounded.toString();
    if (places === 0) return digits;
    digits = digits.padStart(places + 1, "0");
    return digits.slice(0, -places) + "." + digits.slice(-places);
  }

  /* ==========================================================================
   *  小数除法  buildDivSteps("7.65", "0.85")
   *  教材式长除号；商的小数点与被除数对齐；不够除商 0；添 0 继续除；循环小数
   * ========================================================================== */
  function buildDivSteps(dividend, divisor) {
    const steps = [];
    let div = dividend, dsor = divisor;

    /* --- 第 1 步：除数是小数 → 同时右移 --- */
    const sh = vDecimalsOf(dsor);
    if (sh > 0) {
      const div2 = vShiftPointRight(div, sh);
      const dsor2 = vStripPointRight(dsor, sh);
      steps.push(mkStepHTML(
        '<div class="shift-card">' +
        '<div class="sc-row"><span class="sc-label">被除数</span>' +
        '<span class="sc-old">' + div + "</span>" +
        '<span class="sc-arrow">小数点右移 ' + sh + " 位 →</span>" +
        '<span class="sc-new">' + div2 + "</span></div>" +
        '<div class="sc-row"><span class="sc-label">除数</span>' +
        '<span class="sc-old">' + dsor + "</span>" +
        '<span class="sc-arrow">小数点右移 ' + sh + " 位 →</span>" +
        '<span class="sc-new">' + dsor2 + "</span></div>" +
        "</div>",
        "<b>第 1 步：把除数变成整数。</b>利用商不变的性质，被除数和除数的小数点<b>同时右移 " + sh + " 位</b>：" +
        dividend + " ÷ " + divisor + " → <b>" + div2 + " ÷ " + dsor2 + "</b>。"));
      div = div2; dsor = dsor2;
    }

    /* --- 长除状态机 --- */
    const digits0 = vStripPoint(div);
    const pIdx0 = div.indexOf(".");
    const pointIdx = pIdx0 < 0 ? digits0.length : pIdx0; // 小数点前有几个数字
    const V = BigInt(dsor);

    const fractionDigits = Math.max(0, digits0.length - pointIdx);
    const rationalNumerator = BigInt(digits0 || "0");
    const rationalDenominator = V * (10n ** BigInt(fractionDigits));
    const terminating = hasTerminatingDecimal(rationalNumerator, rationalDenominator);
    const ROUND_PLACES = 2;
    const GUARD_DIGITS = ROUND_PLACES + 1;
    const col0 = Math.max(3, dsor.length + 2); // 被除数起始列（左边给除数留出位置）

    const state = {
      digits: digits0.slice(),
      pointIdx: pointIdx,
      quot: [],        // {col, ch, cls}
      pointShown: false,
      ptr: 0,          // 当前处理到第几个数字（数字列索引）
      rows: [],        // 依次：{t:'prod',str,col} {t:'bar',c0,c1} {t:'rem',str,col,bring?}
      extraDigit: null,// 添的 0：{col, ch}
      appendCount: 0,
      hiCol: -1,       // 当前高亮列
      baseCls: "write",
    };

    function sheet() {
      const s = new Sheet({});
      // 除数（右对齐到 col0-2）
      s.str(1, col0 - 2, dsor, function () { return state.baseCls || "old"; }, state.baseCls === "write" ? "decpt write" : "decpt");
      // 被除数（含已添的 0）
      let dstr = "";
      for (let i = 0; i < state.digits.length; i++) {
        if (i === state.pointIdx) dstr += ".";
        dstr += state.digits[i];
      }
      if (state.extraDigit) dstr += state.extraDigit.ch;
      if (state.pointIdx === state.digits.length && state.extraDigit && !state.pointShown) {
        // 整数被除数且还没点小数点：添 0 前要先点
      }
      let clsFn = function (ch, col) {
        const dc = col - col0 - (col > col0 + state.pointIdx - 1 && state.pointShown ? 0 : 0);
        return state.hiCol === col ? "hot" : "old";
      };
      s.strL(1, col0, dstr, function (ch, col) {
        if (col === state.hiCol) return "hot";
        if (state.extraDigit && col === col0 + state.digits.length) return "bring";
        return state.baseCls || "old";
      }, state.baseCls === "write" ? "decpt write" : "decpt");
      // 长除号：横线覆盖到被除数最后一位
      const lastCol = col0 + state.digits.length - 1 + (state.extraDigit ? 1 : 0);
      s.ldiv(1, col0 - 1, lastCol, state.baseCls === "write" ? "write" : "");
      // 商
      state.quot.forEach(function (q) { s.put(0, q.col, q.ch, q.cls); });
      if (state.pointShown) s.dot(0, col0 + state.pointIdx - 1, state.dotAnim ? "decpt new" : "decpt");
      // 运算行
      state.rows.forEach(function (r) {
        if (r.t === "prod") s.str(3 + r.row, r.col, r.str, function () { return r.cls || "old"; });
        else if (r.t === "bar") s.bar(3 + r.row, r.c0, r.c1, r.cls || "");
        else if (r.t === "rem") {
          s.str(3 + r.row, r.col, r.str, function (ch, col) {
            return col === r.col ? (r.bringHere ? "bring" : (r.cls || "new")) : (r.cls || "new");
          });
          if (r.bring) s.put(3 + r.row, r.col + 1, r.bring, "bring");
        }
      });
      return s;
    }

    steps.push(mkStep(sheet(),
      (sh > 0 ? "<b>第 2 步：</b>" : "<b>列竖式：</b>") +
      "除数 <b>" + dsor + "</b> 写在左边，被除数 <b>" + div + "</b> 住进长除号，商一位一位写在<b>上面</b>。",
      "", { writePhases: ["写除数", "写被除数", "画长除号"] }));
    state.baseCls = "old";

    let R = 0n;
    let row = 0;
    let writtenAny = false;
    let i = 0;
    let guard = 0;
    let stepNo = steps.length;
    let inexact = false;

    while (guard++ < 40) {
      const needAppend = i >= state.digits.length;

      /* 添 0 */
      if (needAppend) {
        if (R === 0n) break;
        const fractionWritten = state.quot.filter(function (entry) {
          return entry.col >= col0 + state.pointIdx;
        }).length;
        if (!terminating && fractionWritten >= GUARD_DIGITS) {
          inexact = true;
          steps.push(mkStep(sheet(),
            "<b>除不尽了：</b>商的小数部分不会终止，会出现<b>循环</b>。" +
            "保留两位小数时，已经多算到第三位，可以用它来<b>四舍五入</b>。"));
          break;
        }
        state.appendCount++;
        state.extraDigit = { col: col0 + state.digits.length, ch: "0" };
        // 添 0 前先把小数点点上（若还没点）
        if (!state.pointShown) {
          state.pointShown = true;
          state.dotAnim = true;
          steps.push(mkStep(sheet(),
            "<b>整数部分除完了——先点小数点！</b>商的小数点要<b>和被除数的小数点对齐</b>。"));
          state.dotAnim = false;
        }
        steps.push(mkStep(sheet(),
          "<b>添 0 继续除：</b>余数 " + R + " 后面没数字了。小数末尾<b>添 0</b>，大小不变。"));
        // 把添的 0 并入 digits，方便后续统一处理
        state.digits += "0";
        state.extraDigit = null;
      }

      /* 商的小数点（整数部分刚好除完时） */
      if (i >= state.pointIdx && !state.pointShown) {
        state.pointShown = true;
        state.dotAnim = true;
        steps.push(mkStep(sheet(),
          "<b>整数部分除完了——先点小数点！</b>商的小数点要<b>和被除数的小数点对齐</b>，再往下除。"));
        state.dotAnim = false;
      }
      if (i >= state.digits.length) break;

      const cur = R * 10n + BigInt(state.digits[i]);
      const q = cur / V;
      const rem = cur % V;
      const qCol = col0 + i;

      /* 不够除 */
      if (q === 0n && !writtenAny && i < state.pointIdx) {
        state.hiCol = qCol;
        steps.push(mkStep(sheet(),
          "<b>不够除：</b>" + cur.toString() + " ÷ " + dsor + " 商不了 1，跳过这一位，" +
          "把它和下一位<b>合起来</b>再除。"));
        R = rem; i++; continue;
      }

      /* 写商；随后按“乘、画线、减”的人类列式顺序逐笔呈现。 */
      state.quot.forEach(function (x) { x.cls = "old"; });
      state.rows.forEach(function (entry) { entry.cls = "old"; });
      state.quot.push({ col: qCol, ch: q.toString(), cls: "hot" });
      writtenAny = true;
      state.hiCol = qCol;

      /* 写乘积 */
      const pr = (V * q).toString();
      state.rows.push({ t: "prod", row: row, col: qCol, str: pr, cls: "hot" });
      state.rows.push({ t: "bar", row: row + 1, c0: qCol - pr.length + 1, c1: qCol, cls: "write" });

      /* 余数（落下来的下一位单独成一步，和教材一致） */
      const hasNext = (i + 1) < state.digits.length;
      const remStr = (rem === 0n && hasNext) ? "" : rem.toString();
      state.rows.push({ t: "rem", row: row + 2, col: qCol, str: remStr, cls: "new", bring: null });

      const ex = "<b>第 " + (++stepNo) + " 步：</b>" + cur.toString() + " ÷ " + dsor + "，商 <b style='color:#e53935'>" + q + "</b>：" +
        dsor + " × " + q + " = " + pr + "，" + cur + " − " + pr + " = <b>" + rem + "</b>" +
        (rem === 0n ? (hasNext ? "，余 0。" : "，<b style='color:#2e7d32'>正好除尽！</b>") : "，余 <b>" + rem + "</b>。");
      steps.push(mkStep(sheet(), ex, "", {
        writePhases: ["写商", "写乘积", "画横线", "写余数"],
      }));
      state.quot.forEach(function (x) { x.cls = "old"; });
      state.rows.forEach(function (entry) { entry.cls = "old"; });

      R = rem;
      row += 3;
      i++;

      /* 落下下一位（教材里这单独是一步） */
      if (i < state.digits.length) {
        const lastRem = state.rows[state.rows.length - 1];
        lastRem.bring = state.digits[i];
        const nextNum = (R * 10n + BigInt(state.digits[i])).toString();
        steps.push(mkStep(sheet(),
          "<b>落下 " + state.digits[i] + "：</b>和余数 " + R + " 合成 <b>" + nextNum + "</b>，继续除。"));
      }
      if (R === 0n && i >= state.digits.length) break;
    }

    if (R !== 0n && !inexact) inexact = true;

    /* 完成 */
    state.hiCol = -1;
    state.quot.forEach(function (x) { x.cls = "old"; });
    let qStr = "";
    let qi = 0;
    const sortedQ = state.quot.slice().sort(function (a, b2) { return a.col - b2.col; });
    for (let c = 0; c < col0 + state.digits.length + 2; c++) {
      const hit = sortedQ.filter(function (x) { return x.col === c; })[0];
      if (c === col0 + state.pointIdx && state.pointShown) qStr += ".";
      if (hit) qStr += hit.ch;
    }
    if (qStr.indexOf(".") === 0) qStr = "0" + qStr;
    if (qStr === "") qStr = "0";

    const roundedQ = inexact ? roundRationalString(rationalNumerator, rationalDenominator, ROUND_PLACES) : qStr;
    const rawFraction = (qStr.split(".")[1] || "");
    const guardDigit = rawFraction.charAt(ROUND_PLACES) || "0";

    steps.push(mkStep(sheet(),
      inexact
        ? "<b>完成！</b>算到下一位得到 " + qStr + "…，第三位是 <b>" + guardDigit + "</b>，" +
          "四舍五入后，商<b>大约</b>是 <b style='color:#2e7d32'>" + roundedQ + "</b>（保留两位小数）。"
        : "<b>完成！</b>" + dividend + " ÷ " + divisor + " = <b style='color:#2e7d32'>" + qStr + "</b>" +
          "<br>验算：商 × 除数 = 被除数 → " + qStr + " × " + divisor + " = " + dividend + " ✓",
      hwEq([{ text: dividend, color: "ink" }, { text: " ÷ ", color: "op" }, { text: divisor, color: "ink" },
        { text: inexact ? " ≈ " : " = ", color: "op" }, { text: roundedQ, color: "green" }])));

    return steps;
  }

  /* ---------------- 导出 ---------------- */
  const api = {
    buildMultSteps: buildMultSteps,
    buildDivSteps: buildDivSteps,
    vPlaceDecimal: vPlaceDecimal,
    vShiftPointRight: vShiftPointRight,
    vDecimalsOf: vDecimalsOf,
    vStripPoint: vStripPoint,
    Sheet: Sheet,
  };
  if (typeof window !== "undefined") {
    Object.keys(api).forEach(function (k) { window[k] = api[k]; });
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : global);
