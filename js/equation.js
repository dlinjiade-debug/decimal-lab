/* ==========================================================================
 *  equation.js —— 模块 03 · 简易方程（3D 天平 + 手写解方程）
 * ========================================================================== */
(function () {
  "use strict";
  var CH = "equation";
  Lab.mountShell(CH);

  /* ======================= 01 · 3D 天平实验台 ======================= */
  var SCEN = [
    {
      id: "add", title: "x + 20 = 100", x: 80,
      left: [{ kind: "x" }, { kind: "num", v: 20 }],
      right: [{ kind: "num", v: 100 }],
      steps: [{
        label: "两边同时减 20",
        op: { left: { subNum: 20 }, right: { subNum: 20 } },
        note: "x 旁边多了个 +20，就用「减 20」把它请走。左边减、右边也必须减 —— 天平才不歪。",
        after: "左边只剩 x，右边 100 − 20 = 80，所以 x = 80。"
      }],
      verify: "把 x = 80 代回原方程：80 + 20 = 100 ✓"
    },
    {
      id: "mul", title: "3x = 60", x: 20,
      left: [{ kind: "x" }, { kind: "x" }, { kind: "x" }],
      right: [{ kind: "num", v: 60 }],
      steps: [{
        label: "两边同时除以 3",
        op: { left: { divNum: 3 }, right: { divNum: 3 } },
        note: "3x 就是 3 个 x，x 被乘了 3 → 两边同时除以 3。左边 3 个 x 变成 1 个 x，右边 60 ÷ 3 = 20。",
        after: "x = 20。验算：3 × 20 = 60 ✓"
      }],
      verify: "把 x = 20 代回：3 × 20 = 60 ✓"
    },
    {
      id: "mix", title: "2x + 6 = 18", x: 6,
      left: [{ kind: "x" }, { kind: "x" }, { kind: "num", v: 6 }],
      right: [{ kind: "num", v: 18 }],
      steps: [
        {
          label: "两边同时减 6",
          op: { left: { subNum: 6 }, right: { subNum: 6 } },
          note: "两步方程，先把 +6 清掉。两边同时减 6，右边 18 − 6 = 12。",
          after: "剩下 2x = 12。"
        },
        {
          label: "两边同时除以 2",
          op: { left: { divNum: 2 }, right: { divNum: 2 } },
          note: "2x 表示 x 被乘了 2 → 两边同时除以 2。",
          after: "x = 6。验算：2 × 6 + 6 = 18 ✓"
        }
      ],
      verify: "把 x = 6 代回：2 × 6 + 6 = 18 ✓"
    },
    {
      id: "sub", title: "x − 15 = 35", x: 50,
      left: [{ kind: "x" }, { kind: "num", v: -15 }],
      right: [{ kind: "num", v: 35 }],
      steps: [{
        label: "两边同时加 15",
        op: { left: { addNum: 15 }, right: { addNum: 15 } },
        note: "这一步最容易错：x 旁边是「减 15」，要反过来「加 15」才能抵消成一个 0。",
        after: "x = 50。验算：50 − 15 = 35 ✓"
      }],
      verify: "把 x = 50 代回：50 − 15 = 35 ✓"
    }
  ];

  var canvas = document.getElementById("balCanvas");
  var lab = (Lab3D.supported && canvas) ? Lab3D.balance(canvas) : null;
  if (!lab) Lab.dec3d(canvas, "本机未启用 WebGL，3D 天平无法显示。下面的按钮照样能一步步推出答案，「解题过程」会同步记录每一步；按「❌ 只在左边」时文字会告诉你为什么天平会歪。");
  var elEq = document.getElementById("balEq");
  var elHint = document.getElementById("balHint");
  var elHist = document.getElementById("balHistory");
  var elNote = document.getElementById("balNote");
  var stepBtn = document.getElementById("balStep");
  var wrongBtn = document.getElementById("balWrong");
  var resetBtn = document.getElementById("balReset");
  var scenBox = document.getElementById("balScen");

  var cur = SCEN[0], stepIdx = 0, snapshot = null, hist = [];

  /* ---- 3D 不可用时的纯数据镜像：同一套等式性质，只是不上天平 ---- */
  var AOP = Lab3D.applyOps;
  var sim = null;
  function cloneBlocks(list) {
    return (list || []).map(function (b) { return { kind: b.kind, v: b.v }; });
  }
  function simWeight(list) {
    var s = 0;
    list.forEach(function (b) { s += b.kind === "x" ? cur.x : b.v; });
    return s;
  }
  function simReset() { sim = { left: cloneBlocks(cur.left), right: cloneBlocks(cur.right) }; }

  function blocksToStr(list) {
    var xs = 0, nums = [];
    list.forEach(function (b) { if (b.kind === "x") xs++; else nums.push(b.v); });
    var parts = [];
    if (xs === 1) parts.push("x");
    else if (xs > 1) parts.push(xs + "x");
    nums.forEach(function (v) { parts.push(v < 0 ? "− " + Math.abs(v) : String(v)); });
    return parts.length ? parts.join(" + ").replace("+ − ", "− ") : "0";
  }
  function curEq() {
    if (lab) {
      var b = lab.blocks();
      return blocksToStr(b.left) + " = " + blocksToStr(b.right);
    }
    if (!sim) return cur.title;
    return blocksToStr(sim.left) + " = " + blocksToStr(sim.right);
  }
  function paintHistory() {
    elHist.innerHTML = hist.map(function (h, i) {
      var tone = i === 0 ? "var(--chalk)" : (i === hist.length - 1 ? "var(--ch)" : "var(--chalk-soft)");
      return '<div style="color:' + tone + '">' + (i === 0 ? "" : '<span style="font-size:12px;color:var(--chalk-soft);font-family:var(--font);font-weight:700;margin-right:8px">解：</span>') + h + "</div>";
    }).join("");
  }

  function setScen(sc, btn) {
    cur = sc; stepIdx = 0; snapshot = null;
    Lab.$$("button", scenBox).forEach(function (b) { b.classList.remove("is-on"); });
    if (btn) btn.classList.add("is-on");
    if (lab) lab.load({ x: sc.x, left: sc.left, right: sc.right });
    else simReset();
    hist = [sc.title];
    paintHistory();
    elEq.textContent = sc.title;
    elHint.textContent = "天平平衡 → 左边 = 右边";
    elNote.innerHTML = "点「" + sc.steps[0].label + "」，看着天平说话。";
    syncButtons();
  }
  function syncButtons() {
    var s = cur.steps[stepIdx];
    if (s) {
      stepBtn.textContent = s.label;
      stepBtn.disabled = false;
      wrongBtn.textContent = "❌ " + s.label.replace("两边同时", "只在左边");
      wrongBtn.disabled = false;
    } else {
      stepBtn.textContent = "✔ 已经解出来了";
      stepBtn.disabled = true;
      wrongBtn.disabled = true;
    }
    if (resetBtn) resetBtn.disabled = (stepIdx === 0 && !snapshot);
  }

  SCEN.forEach(function (sc) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = sc.title;
    b.addEventListener("click", function () { setScen(sc, b); });
    scenBox.appendChild(b);
  });

  if (stepBtn) stepBtn.addEventListener("click", function () {
    var s = cur.steps[stepIdx];
    if (!s) return;
    snapshot = null;
    if (lab) lab.step(s.op);
    else if (AOP) {
      sim.left = AOP(cloneBlocks(sim.left), s.op.left);
      sim.right = AOP(cloneBlocks(sim.right), s.op.right);
    }
    stepIdx++;
    hist.push(curEq());
    paintHistory();
    elEq.textContent = curEq();
    elHint.textContent = s.after || "";
    elNote.innerHTML = s.note;
    Lab.beep(true);
    if (stepIdx >= cur.steps.length) {
      if (Lab.mark(CH, "lab")) Lab.toast("🎉 天平实验台已解锁");
      elNote.innerHTML = s.note + "<br><b style='color:var(--ch)'>" + cur.verify + "</b>";
    }
    syncButtons();
  });

  if (wrongBtn) wrongBtn.addEventListener("click", function () {
    var s = cur.steps[stepIdx];
    if (!s) return;
    var w;
    if (lab) {
      if (!snapshot) snapshot = lab.blocks();
      w = lab.wrongStep(s.op.left);
    } else if (AOP) {
      if (!snapshot) snapshot = { left: cloneBlocks(sim.left), right: cloneBlocks(sim.right) };
      sim.left = AOP(cloneBlocks(sim.left), s.op.left);   // 故意只动一边
      w = { left: simWeight(sim.left), right: simWeight(sim.right) };
    } else {
      w = { left: "?", right: "?" };
    }
    elEq.textContent = curEq();
    elHint.textContent = "⚠️ 天平歪了！左边 " + w.left + "，右边 " + w.right;
    elNote.innerHTML = "<b class='red'>只看一边会怎样：</b>左边变成了 " + w.left + "，右边还是 " + w.right +
      " —— 天平立刻歪掉，等式就不成立了。<br><b>这就是「两边必须同时」的原因。</b>点「重来」恢复。";
    Lab.beep(false);
    syncButtons();
  });

  if (resetBtn) resetBtn.addEventListener("click", function () {
    if (snapshot && lab) {
      lab.loadRaw(snapshot.left, snapshot.right);
      snapshot = null;
      elEq.textContent = curEq();
      elHint.textContent = "天平恢复平衡 → 左边 = 右边";
      elNote.innerHTML = "恢复了。记住：<b>两边同时做一样的操作</b>，天平才永远平。";
    } else {
      setScen(cur, Lab.$(".chip.is-on", scenBox));
    }
    syncButtons();
  });

  setScen(SCEN[0], scenBox.firstChild);

  /* ======================= 03 · 3D 铅笔板书 ======================= */
  function F(t, c) { return { text: t, color: c || "ink" }; }

  /** 一行手写式子；animate=true 表示这一行是「本步新写的」 */
  function hwLine(items, animate, size) {
    var wrap = document.createElement("div");
    wrap.className = "hw-wrap";
    var its = items.map(function (it) { return { text: it.text, color: it.color, anim: !!animate }; });
    wrap.innerHTML = HW.html(its, { size: size || 46 }).html;
    return wrap;
  }
  function hwCard(items, animate, size) {
    var box = document.createElement("div");
    box.className = "hw-card";
    box.appendChild(hwLine(items, animate, size));
    return box;
  }
  function plainCard(html) {
    var box = document.createElement("div");
    box.className = "hw-card";
    box.innerHTML = html;
    return box;
  }

  /** 把「每一步新增哪几行」的定义展开成 steps；render 时把前面的行一并写出来 */
  function eqSteps(defs) {
    return defs.map(function (def, k) {
      return {
        explain: def.explain,
        render: function (el) {
          for (var j = 0; j <= k; j++) {
            (defs[j].add || []).forEach(function (items) {
              el.appendChild(hwCard(items, j === k, 46));
            });
            if (j === k && defs[j].extra) el.appendChild(plainCard(defs[j].extra));
          }
        }
      };
    });
  }

  var EQ_DEMOS = [
    {
      label: "例1　x + 20 = 100", tag: "两边同时减",
      steps: [
        { explain: "这是今天要解的方程。x 旁边多了个 <b>+20</b>，目标是把 x <b>单独请到一边</b>。",
          add: [[F("x + 20 = 100")]] },
        { explain: "x 旁边是「加 20」→ 两边<b>同时减 20</b> 把它抵消。红色是两边同时做的动作。",
          add: [[F("x + 20 ", "ink"), F("\u2212 20", "red"), F(" = ", "op"), F("100 ", "ink"), F("\u2212 20", "red")]] },
        { explain: "左边 20 \u2212 20 = 0，只剩 <b>x</b>；右边 100 \u2212 20 = 80。",
          add: [[F("x", "blue"), F(" = ", "op"), F("80", "green")]] },
        { explain: "把 x = 80 代回<b>原</b>方程：左边 = 80 + 20 = 100，右边 = 100，<em>左边 = 右边 ✓</em>",
          add: [[F("80 + 20 = 100", "green")]],
          extra: '<div style="font-size:15px;color:var(--ink-2);line-height:1.8">书写格式：每行开头写「<b>解：</b>」，<b>等号上下对齐</b>。</div>' }
      ]
    },
    {
      label: "例2　3x = 60", tag: "两边同时除",
      steps: [
        { explain: "先说清楚 3x 是什么：它是 <b>3 × x</b>（3 个 x 相加），不是 3 加 x。",
          add: [[F("3x", "ink"), F(" = ", "op"), F("3", "blue"), F(" × ", "op"), F("x", "blue")]] },
        { explain: "x 被乘了 3 → 两边<b>同时除以 3</b>（不是减 3，也不是除以 60）。",
          add: [[F("3x ", "ink"), F("\u00f7 3", "red"), F(" = ", "op"), F("60 ", "ink"), F("\u00f7 3", "red")]] },
        { explain: "3x \u00f7 3 = x，60 \u00f7 3 = 20。",
          add: [[F("x", "blue"), F(" = ", "op"), F("20", "green")]] },
        { explain: "检验：把 x = 20 代回原方程，3 × 20 = 60 ✓",
          add: [[F("3 × 20 = 60", "green")]] }
      ]
    },
    {
      label: "例3　x \u2212 6 = 10", tag: "减用加抵消",
      steps: [
        { explain: "这次 x 旁边是「<b>减</b> 6」。要抵消减，就要反过来<b>加</b>。",
          add: [[F("x \u2212 6 = 10")]] },
        { explain: "两边<b>同时加 6</b>，左边 \u2212 6 + 6 = 0，只剩 x。",
          add: [[F("x \u2212 6 ", "ink"), F("+ 6", "red"), F(" = ", "op"), F("10 ", "ink"), F("+ 6", "red")]] },
        { explain: "右边 10 + 6 = 16。",
          add: [[F("x", "blue"), F(" = ", "op"), F("16", "green")]] },
        { explain: "<b>易错点：</b>如果两边同时「减 6」，左边会变成 x \u2212 12，离 x 单独一边更远了。<b>加用减抵消，减用加抵消。</b>",
          add: [[F("16 \u2212 6 = 10", "green")]],
          extra: '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
            '<div style="flex:1;min-width:170px;background:#fff1f0;border:1px solid #ffd4d1;border-radius:12px;padding:10px 13px;font-size:14.5px;line-height:1.7">' +
            '<b style="color:#c0392b">❌ 两边同减 6</b><br><span style="font-family:var(--font-num);font-size:16px">x \u2212 6 \u2212 6 = x \u2212 12</span></div>' +
            '<div style="flex:1;min-width:170px;background:#edfbf4;border:1px solid #b9ecd3;border-radius:12px;padding:10px 13px;font-size:14.5px;line-height:1.7">' +
            '<b style="color:#047857">✅ 两边同加 6</b><br><span style="font-family:var(--font-num);font-size:16px">x \u2212 6 + 6 = x</span></div></div>' }
      ]
    },
    {
      label: "例4　x \u00f7 4 = 5", tag: "除用乘抵消",
      steps: [
        { explain: "x \u00f7 4 表示 x 被 4 除了 → 两边<b>同时乘 4</b>。",
          add: [[F("x \u00f7 4", "ink"), F(" × 4", "red"), F(" = ", "op"), F("5", "ink"), F(" × 4", "red")]] },
        { explain: "x \u00f7 4 × 4 = x，5 × 4 = 20。",
          add: [[F("x", "blue"), F(" = ", "op"), F("20", "green")]] },
        { explain: "检验：20 \u00f7 4 = 5 ✓",
          add: [[F("20 \u00f7 4 = 5", "green")]] }
      ]
    },
    {
      label: "例5　2x + 6 = 18", tag: "两步方程",
      steps: [
        { explain: "两步方程的策略：<b>先清加减，再清乘除</b>。先把 +6 收拾掉。",
          add: [[F("2x + 6 = 18")]] },
        { explain: "两边同时减 6。",
          add: [[F("2x + 6 ", "ink"), F("\u2212 6", "red"), F(" = ", "op"), F("18 ", "ink"), F("\u2212 6", "red")]] },
        { explain: "右边 18 \u2212 6 = 12，变成一步方程了。",
          add: [[F("2x", "ink"), F(" = ", "op"), F("12", "green")]] },
        { explain: "两边同时除以 2。",
          add: [[F("2x ", "ink"), F("\u00f7 2", "red"), F(" = ", "op"), F("12 ", "ink"), F("\u00f7 2", "red")],
                [F("x", "blue"), F(" = ", "op"), F("6", "green")]] },
        { explain: "检验：2 × 6 + 6 = 18 ✓。<b>顺序不能反</b> —— 先除以 2 会把 6 也除掉，就错了。",
          add: [[F("2 × 6 + 6 = 18", "green")]] }
      ]
    },
    {
      label: "附　用字母表示数", tag: "书写规矩",
      steps: [
        { explain: "字母表示数有三个书写规矩：<b>数字写在字母前面</b>，<b>乘号可以省略</b>。",
          add: [[F("a × b", "ink"), F(" = ", "op"), F("ab", "green")],
                [F("1 × a", "ink"), F(" = ", "op"), F("a", "green")],
                [F("3 × x", "ink"), F(" = ", "op"), F("3x", "green")]] },
        { explain: "<b>a × a</b> 写成 <b>a\u00b2</b>，读作「a 的平方」，表示两个 a 相乘。",
          add: [[F("a × a", "ink"), F(" = ", "op"), F("a\u00b2", "green")]] },
        { explain: "常见的数量关系也可以写成字母式子。",
          add: [],
          extra: '<div style="font-size:15.5px;line-height:2;color:var(--ink-2)">' +
            '路程 = 速度 × 时间 → <code class="f">s = vt</code><br>' +
            '长方形面积 = 长 × 宽 → <code class="f">S = ab</code><br>' +
            '长方形周长 = (长 + 宽) × 2 → <code class="f">C = 2(a + b)</code></div>' }
      ]
    }
  ];

  Lab.teach({
    chapter: CH,
    canvas: "#writeCanvas",
    mount: "#wDemoBtns",
    caption: "#wCaption",
    stepNo: "#wStepNo",
    play: "#wPlay", prev: "#wPrev", next: "#wNext", replay: "#wReplay",
    speed: "#wSpeed", speedLabel: "#wSpeedLabel",
    fallback: "#wFallback",
    autoStart: true,
    demos: EQ_DEMOS.map(function (d) {
      return {
        label: d.label, tag: d.tag,
        build: function () { return eqSteps(d.steps); }
      };
    })
  });

  /* ======================= 04 · 亲手练 ======================= */
  /* ======================= 03 · 亲手练 ======================= */
  var PB = [
    { q: "x + 7 = 15", opts: ["两边同时减 7", "两边同时加 7", "两边同时除以 7"], ans: 0,
      why: " x 旁边是「加 7」→ 反着来，两边同时减 7 → x = 8。" },
    { q: "3x = 24", opts: ["两边同时减 3", "两边同时除以 3", "两边同时加 3"], ans: 1,
      why: " 3x 表示 3 × x，x 被乘了 3 → 两边同时除以 3 → x = 8。" },
    { q: "x ÷ 5 = 4", opts: ["两边同时乘 5", "两边同时除以 5", "两边同时加 5"], ans: 0,
      why: " x 被 5 除了 → 两边同时乘 5 → x = 20。" },
    { q: "x − 9 = 12", opts: ["两边同时减 9", "两边同时加 9", "两边同时乘 9"], ans: 1,
      why: " x 旁边是「减 9」→ 反着来，两边同时加 9 → x = 21。" },
    { q: "6x = 42", opts: ["两边同时除以 6", "两边同时减 6", "两边同时除以 42"], ans: 0,
      why: " x 被乘了 6 → 两边同时除以 6 → x = 7。" },
    { q: "2x + 5 = 17　（第一步）", opts: ["两边同时除以 2", "两边同时减 5", "两边同时加 5"], ans: 1,
      why: " 两步方程先清加减再清乘除：先把 +5 清掉 → 2x = 12，再除以 2 → x = 6。" },
    { q: "4x − 8 = 20　（第一步）", opts: ["两边同时加 8", "两边同时减 8", "两边同时除以 4"], ans: 0,
      why: " x 旁边是「减 8」→ 两边同时加 8 → 4x = 28，再除以 4 → x = 7。" },
    { q: "x + 3.5 = 9", opts: ["两边同时减 3.5", "两边同时加 3.5", "两边同时除以 3.5"], ans: 0,
      why: " 小数一样处理，两边同时减 3.5 → x = 5.5。" },
    { q: "0.5x = 6", opts: ["两边同时除以 0.5", "两边同时减 0.5", "两边同时乘 0.5"], ans: 0,
      why: " x 被乘了 0.5 → 两边同时除以 0.5 → x = 12。（6 ÷ 0.5 = 12，商比被除数大，符合规律）" },
    { q: "x ÷ 1.2 = 5", opts: ["两边同时乘 1.2", "两边同时除以 1.2", "两边同时加 1.2"], ans: 0,
      why: " x 被 1.2 除了 → 两边同时乘 1.2 → x = 6。" }
  ];
  var pIdx = 0, pScore = 0, pLocked = false;
  var elPIdx = document.getElementById("pIdx"), elPTotal = document.getElementById("pTotal");
  var elPScore = document.getElementById("pScore"), elPQ = document.getElementById("pQ");
  var elPOpts = document.getElementById("pOpts"), elPFb = document.getElementById("pFb"), elPNext = document.getElementById("pNext");
  elPTotal.textContent = PB.length;

  function pLoad() {
    pLocked = false;
    var q = PB[pIdx];
    elPIdx.textContent = pIdx + 1;
    elPScore.textContent = pScore;
    elPQ.textContent = q.q + "　→ 下一步该怎么做？";
    elPFb.className = "fb";
    elPFb.innerHTML = "";
    elPNext.style.display = "none";
    elPOpts.innerHTML = "";
    q.opts.forEach(function (o, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "opt";
      b.style.fontFamily = "inherit";
      b.style.fontSize = "16.5px";
      b.textContent = o;
      b.addEventListener("click", function () {
        if (pLocked) return;
        if (i === q.ans) {
          pLocked = true;
          b.classList.add("correct");
          pScore++;
          elPScore.textContent = pScore;
          elPFb.className = "fb show ok";
          elPFb.innerHTML = "✅ 方向正确！" + q.why;
          Lab.beep(true);
          Lab.mark(CH, "practice");
          elPNext.style.display = "";
        } else {
          b.classList.add("wrong");
          elPFb.className = "fb show no";
          elPFb.innerHTML = "❌ 再想想：目标是让 <b>x 单独站在一边</b>。" + q.why;
          Lab.beep(false);
          setTimeout(function () { b.classList.remove("wrong"); }, 1000);
        }
      });
      elPOpts.appendChild(b);
    });
  }
  elPNext.addEventListener("click", function () {
    pIdx++;
    if (pIdx < PB.length) pLoad();
    else {
      elPQ.textContent = "🎉 10 题全部完成！";
      elPOpts.innerHTML = "";
      elPFb.className = "fb show ok";
      elPFb.innerHTML = "分数：" + pScore + " / " + PB.length + "。去闯关吧！";
      elPNext.style.display = "none";
    }
  });
  pLoad();

  /* ======================= 04 · 闯关挑战 ======================= */
  Lab.quiz({
    mount: "#quizMount",
    chapter: CH,
    bank: [
      { q: "下面哪个是方程？", opts: ["30 + 40 = 70", "x − 14 > 40", "5x = 60"], ans: 2, why: " 方程要同时满足「是等式」和「含有未知数」两个条件。30+40=70 没有未知数；x−14>40 是不等式。" },
      { q: "x = 30 是不是方程？", opts: ["是，它含未知数又是等式", "不是，右边没有未知数", "不是，太简单了"], ans: 0, why: " 只要含有未知数、又是等式，就是方程。x = 30 是最简单的一类方程。" },
      { q: "方程和等式的关系是（　）", opts: ["方程一定是等式", "等式一定是方程", "两者没关系"], ans: 0, why: " 方程一定含有未知数，所以它先得是等式；但等式不一定含未知数，所以等式不一定是方程。" },
      { q: "等式的性质是：等式两边同时（　），左右两边仍然相等", opts: ["加上同一个数", "乘同一个数（除数不为 0 也可以）", "以上都对"], ans: 2, why: " 加减同一个数、乘同一个数、除以同一个不为 0 的数，等式都仍然成立。" },
      { q: "解 x + 18 = 30，应该两边同时（　）", opts: ["减 18", "加 18", "除以 18"], ans: 0, why: " x 旁边是 +18 → 两边同时减 18 → x = 12。" },
      { q: "解 7x = 56，x = （　）", opts: ["7", "8", "49"], ans: 1, why: " 两边同时除以 7：56 ÷ 7 = 8。" },
      { q: "解 x − 12 = 25，x = （　）", opts: ["13", "37", "300"], ans: 1, why: " 两边同时加 12：25 + 12 = 37。" },
      { q: "解 x ÷ 6 = 8，x = （　）", opts: ["48", "14", "1.33"], ans: 0, why: " 两边同时乘 6：8 × 6 = 48。" },
      { q: "解 3x + 4 = 19，x = （　）", opts: ["5", "7.67", "15"], ans: 0, why: " 先两边减 4 得 3x = 15，再两边除以 3 得 x = 5。检验：3×5+4 = 19 ✓" },
      { q: "3x 表示（　）", opts: ["3 加 x", "3 乘 x", "3 和 x 拼在一起"], ans: 1, why: " 3x 就是 3 × x，也就是 3 个 x 相加。" },
      { q: "a × b 通常写成（　）", opts: ["ab", "a + b", "b分之a"], ans: 0, why: " 字母与字母相乘时乘号可以省略，写作 ab；数字与字母相乘时数字写前面，如 3x。" },
      { q: "a × a 可以写成（　）", opts: ["2a", "a²", "aa 不能写"], ans: 1, why: " a × a 写作 a²，读作「a 的平方」。注意 2a 表示的是 2 × a，和 a² 完全不同。" },
      { q: "检验 x = 5 是否是 4x − 3 = 17 的解，应该（　）", opts: ["把 5 代回原方程：4×5−3 = 17 = 右边 ✓", "把 5 代到 4x 里算一下就行", "再解一遍方程"], ans: 0, why: " 检验就是把解代回<b>原</b>方程，看左边是否等于右边。" },
      { q: "小明有一些卡片，又买了 20 张，现在共 100 张。列方程应该是（　）", opts: ["x + 20 = 100", "x − 20 = 100", "20x = 100"], ans: 0, why: " 等量关系：原来 + 新买的 = 现在 → x + 20 = 100，解得 x = 80。列方程的关键是找等量关系。" }
    ],
    onFinish: function (s, t) {
      if (s >= Math.ceil(t * 0.75)) Lab.toast("🏆 简易方程通关！");
    }
  });
})();
