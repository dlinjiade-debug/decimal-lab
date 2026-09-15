/* ==========================================================================
 *  divide.js —— 模块 02 · 小数除法（3D 双轨同步搬运）
 * ========================================================================== */
(function () {
  "use strict";
  var CH = "divide";
  Lab.mountShell(CH);

  /* ======================= 01 · 3D 同步搬运轨道 ======================= */
  var PRESETS = [
    { d: "7.65", s: "0.85" },
    { d: "12.6", s: "0.28" },
    { d: "0.756", s: "0.18" },
    { d: "5.98", s: "0.23" },
    { d: "0.9", s: "0.045" },
    { d: "1.44", s: "1.2" },
    { d: "22.4", s: "4" }
  ];

  var canvas = document.getElementById("moverCanvas");
  var lab = (Lab3D.supported && canvas) ? Lab3D.mover(canvas) : null;
  if (!lab) Lab.dec3d(canvas, "本机未启用 WebGL，3D 搬运轨道无法显示。点「两边同时右移 1 位」照样会一步步算出转化结果，上面的读数会同步更新。");
  var elEq = document.getElementById("mvEq");
  var elFrac = document.getElementById("mvFrac");
  var elCount = document.getElementById("mvCount");
  var stepBtn = document.getElementById("mvStep");
  var autoBtn = document.getElementById("mvAuto");
  var resetBtn = document.getElementById("mvReset");
  var presetBox = document.getElementById("mvPresets");

  var cur = PRESETS[0], k = 0, target = 0, autoTimer = null;

  function fmtDiv(a, b) {
    var v = a / b;
    if (!isFinite(v)) return "?";
    return String(Number(v.toFixed(6)));
  }
  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; if (autoBtn) autoBtn.textContent = "自动搬完"; }
  }

  function render(flash) {
    var curD = vShiftPointRight(cur.d, k);
    var curS = vShiftPointRight(cur.s, k);
    var done = (k >= target);
    if (lab) {
      lab.render(curD, curS, done ? 0x22c55e : 0x0ea5e9);
      if (flash) lab.flash(done ? 0x22c55e : 0xf59e0b);
    }
    elEq.textContent = curD + " ÷ " + curS;
    if (target === 0) {
      elFrac.innerHTML = "除数 " + cur.s + " 已经是整数，<b>不用搬小数点</b>。直接除就好，商的小数点和被除数对齐。";
    } else if (!done) {
      elFrac.innerHTML = "除数 " + cur.s + " 有 <b>" + target + "</b> 位小数 → 已经右移了 " + k +
        " 位，还要再右移 <b>" + (target - k) + "</b> 位（被除数也一起移）。";
    } else {
      elFrac.innerHTML = "两边都右移了 " + target + " 位，除数变成整数 → <b>" + curD + " ÷ " + curS + " = " +
        fmtDiv(Number(curD), Number(curS)) + "</b>　这就是普通的整数除法了。";
    }
    elCount.textContent = "已右移 " + k + " 位";
    if (stepBtn) stepBtn.disabled = done;
    if (done && Lab.mark(CH, "lab")) Lab.toast("🎉 转化成功，实验台已解锁");
  }

  function setPreset(p, btn) {
    stopAuto();
    cur = p; k = 0;
    target = vDecimalsOf(p.s);
    if (presetBox) Lab.$$("button", presetBox).forEach(function (b2) { b2.classList.remove("is-on"); });
    if (btn) btn.classList.add("is-on");
    render(false);
  }

  PRESETS.forEach(function (p) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.innerHTML = p.d + " ÷ " + p.s +
      (vDecimalsOf(p.s) === 0 ? '<i class="tag">除数是整数</i>' : "");
    b.addEventListener("click", function () { setPreset(p, b); });
    presetBox.appendChild(b);
  });

  if (stepBtn) stepBtn.addEventListener("click", function () {
    stopAuto();
    if (k >= target) return;
    k++;
    render(true);
    Lab.beep(true);
  });
  if (autoBtn) autoBtn.addEventListener("click", function () {
    if (autoTimer) { stopAuto(); return; }
    if (k >= target) return;
    autoBtn.textContent = "暂停";
    autoTimer = setInterval(function () {
      if (k >= target) { stopAuto(); return; }
      k++; render(true);
    }, 1150);
  });
  if (resetBtn) resetBtn.addEventListener("click", function () { stopAuto(); k = 0; render(false); });

  setPreset(PRESETS[0], presetBox.firstChild);

  /* ======================= 02 · 手写竖式分步 ======================= */
  var DEMOS = [
    { a: "22.4", b: "4", label: "例1　22.4 ÷ 4", tag: "除数是整数" },
    { a: "7.65", b: "0.85", label: "例2　7.65 ÷ 0.85", tag: "先转化成 765 ÷ 85" },
    { a: "3.8", b: "0.5", label: "例3　3.8 ÷ 0.5", tag: "末尾添 0 继续除" },
    { a: "16", b: "5", label: "例4　16 ÷ 5", tag: "整数除整数，先点小数点" },
    { a: "12.6", b: "0.28", label: "例5　12.6 ÷ 0.28", tag: "点错就全错：1260 ÷ 28" },
    { a: "10", b: "3", label: "例6　10 ÷ 3", tag: "除不尽 · 循环小数" },
    { a: "1.69", b: "0.26", label: "例7　1.69 ÷ 0.26", tag: "商比被除数大" }
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
    demos: DEMOS.map(function (d) {
      return {
        label: d.label, tag: d.tag,
        build: function () { return buildDivSteps(d.a, d.b); }
      };
    })
  });

  /* ======================= 04 · 亲手练 ======================= */
  var PB = [
    { q: "5.98 ÷ 0.23", opts: ["598 ÷ 23", "59.8 ÷ 23", "5.98 ÷ 23"], ans: 0,
      why: " 除数 0.23 有 2 位小数 → 右移 2 位变成 23；被除数 5.98 也要右移 2 位 → 598。" },
    { q: "12.6 ÷ 0.28", opts: ["126 ÷ 28", "12.6 ÷ 28", "1260 ÷ 28"], ans: 2,
      why: " 0.28 → 28 右移 2 位；12.6 也要右移 2 位，只有 1 位小数就补 0：12.6 → 1260。" },
    { q: "0.756 ÷ 0.18", opts: ["75.6 ÷ 18", "756 ÷ 18", "0.756 ÷ 18"], ans: 0,
      why: " 0.18 → 18 右移 2 位；0.756 右移 2 位 → 75.6。" },
    { q: "51.3 ÷ 0.27", opts: ["513 ÷ 27", "51.3 ÷ 27", "5130 ÷ 27"], ans: 2,
      why: " 同时右移 2 位：0.27 → 27；51.3 → 51.30 → 5130。" },
    { q: "7.2 ÷ 0.24", opts: ["72 ÷ 24", "720 ÷ 24", "7.2 ÷ 24"], ans: 1,
      why: " 同时右移 2 位：0.24 → 24；7.2 → 7.20 → 720。" },
    { q: "0.9 ÷ 0.045", opts: ["90 ÷ 45", "9 ÷ 45", "900 ÷ 45"], ans: 2,
      why: " 除数 0.045 有 3 位小数 → 两边都右移 3 位：0.045 → 45；0.9 → 0.900 → 900。" },
    { q: "1.44 ÷ 1.2", opts: ["144 ÷ 12", "14.4 ÷ 12", "1.44 ÷ 12"], ans: 1,
      why: " 除数 1.2 只有 1 位小数 → 右移 1 位：1.2 → 12；1.44 → 14.4。移几位看除数！" },
    { q: "62.4 ÷ 2.6", opts: ["624 ÷ 26", "62.4 ÷ 26", "624 ÷ 260"], ans: 0,
      why: " 同时右移 1 位：2.6 → 26；62.4 → 624。" },
    { q: "4.8 ÷ 0.6", opts: ["48 ÷ 6", "4.8 ÷ 6", "480 ÷ 6"], ans: 0,
      why: " 同时右移 1 位：0.6 → 6；4.8 → 48。答案 8，比 4.8 大——除以比 1 小的数，商变大。" },
    { q: "3.6 ÷ 1.5", opts: ["36 ÷ 15", "360 ÷ 15", "3.6 ÷ 15"], ans: 0,
      why: " 同时右移 1 位：1.5 → 15；3.6 → 36。答案 2.4，比 3.6 小——除以比 1 大的数，商变小。" }
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
    elPQ.textContent = q.q + " = ?　（先转化成整数除法）";
    elPFb.className = "fb";
    elPFb.innerHTML = "";
    elPNext.style.display = "none";
    elPOpts.innerHTML = "";
    q.opts.forEach(function (o, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "opt";
      b.textContent = o;
      b.addEventListener("click", function () {
        if (pLocked) return;
        if (i === q.ans) {
          pLocked = true;
          b.classList.add("correct");
          pScore++;
          elPScore.textContent = pScore;
          elPFb.className = "fb show ok";
          elPFb.innerHTML = "✅ 转化正确！" + q.why;
          Lab.beep(true);
          Lab.mark(CH, "practice");
          elPNext.style.display = "";
        } else {
          b.classList.add("wrong");
          elPFb.className = "fb show no";
          elPFb.innerHTML = "❌ 口诀：「除数移几位，被除数也移几位」。再想想：" + q.why;
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
      elPQ.textContent = "🎉 10 题转化全部完成！";
      elPOpts.innerHTML = "";
      elPFb.className = "fb show ok";
      elPFb.innerHTML = "分数：" + pScore + " / " + PB.length + "。转化这一步稳了，去闯关吧！";
      elPNext.style.display = "none";
    }
  });
  pLoad();

  /* ======================= 04 · 闯关挑战 ======================= */
  Lab.quiz({
    mount: "#quizMount",
    chapter: CH,
    bank: [
      { q: "商的小数点要和（　）对齐", opts: ["除数的小数点", "被除数的小数点", "随便哪个"], ans: 1, why: " 除数是整数时，一位一位按数位除，商的小数点自然和被除数的小数点对齐。" },
      { q: "4.8 ÷ 0.6 = ?", opts: ["0.8", "8", "80"], ans: 1, why: " 转化：48 ÷ 6 = 8。8 比 4.8 大，符合「除以比 1 小的数商变大」。" },
      { q: "7.5 ÷ 0.25 = ?", opts: ["3", "30", "300"], ans: 1, why: " 转化：750 ÷ 25 = 30。除以 0.25 相当于乘 4。" },
      { q: "0.32 ÷ 0.05 的商和 0.32 相比（　）", opts: ["商更大", "商更小", "相等"], ans: 0, why: " 转化后 32 ÷ 5 = 6.4，比 0.32 大很多。除以小于 1 的数（0 除外），商比被除数大。" },
      { q: "5.6 ÷ 7 = ?", opts: ["0.8", "8", "0.08"], ans: 0, why: " 56 ÷ 7 = 8，商的小数点与被除数的小数点对齐 → 0.8。" },
      { q: "1.69 ÷ 0.26 = ?", opts: ["6.5", "0.65", "65"], ans: 0, why: " 同时右移 2 位：169 ÷ 26 = 6.5。" },
      { q: "计算 12.6 ÷ 0.28 时，转化正确的是（　）", opts: ["1260 ÷ 28", "126 ÷ 28", "12.6 ÷ 28"], ans: 0, why: " 同时右移 2 位：0.28 → 28；12.6 只有 1 位小数，补 0 后 → 1260。" },
      { q: "一个数（0 除外）÷ 1.01，商比原来的数（　）", opts: ["大一些", "小一些", "不变"], ans: 1, why: " 除以比 1 大的数，商变小；除以比 1 小的数（0 除外），商变大。" },
      { q: "2.4 ÷ 0.12 = 20，验算应该用（　）", opts: ["20 × 0.12，看是否等于 2.4", "2.4 × 0.12", "20 ÷ 2.4"], ans: 0, why: " 除法的验算：商 × 除数 = 被除数。" },
      { q: "0.75 ÷ 0.15 = ?", opts: ["5", "0.5", "50"], ans: 0, why: " 转化：75 ÷ 15 = 5。" },
      { q: "3.8 ÷ 0.5 除到末尾还有余数，应该（　）", opts: ["直接写成余数", "在被除数末尾添 0 继续除", "把商写成整数"], ans: 1, why: " 依据小数的性质（3.8 = 3.80），在末尾添 0 继续除，直到余数为 0 或达到要求的位数。答案是 7.6。" },
      { q: "10 ÷ 3 的商是（　）", opts: ["3.3", "3.333…（循环小数）", "3.4"], ans: 1, why: " 除不尽，商是循环小数 3.333…；题目要求保留两位小数时，四舍五入写作 3.33。" },
      { q: "1.44 ÷ 1.2 转化后是（　）", opts: ["144 ÷ 12", "14.4 ÷ 12", "1.44 ÷ 12"], ans: 1, why: " 移几位由除数决定：1.2 有 1 位小数，两个数都右移 1 位。" },
      { q: "下面哪个说法是错的？", opts: ["被除数和除数同时乘 10，商不变", "除数有几位小数，被除数也右移几位", "被除数的小数点不动，只移除数的"], ans: 2, why: " 只移除数会改变商，必须两个同时移相同的位数。" }
    ],
    onFinish: function (s, t) {
      if (s >= Math.ceil(t * 0.75)) Lab.toast("🏆 小数除法通关！");
    }
  });
})();
