/* ==========================================================================
 *  multiply.js —— 模块 01 · 小数乘法（3D 面积积木台）
 * ========================================================================== */
(function () {
  "use strict";
  var CH = "multiply";
  Lab.mountShell(CH);

  /* ======================= 01 · 3D 面积积木台 ======================= */
  var canvas = document.getElementById("areaCanvas");
  var lab = Lab3D.supported ? Lab3D.area(canvas, { a: 3, b: 2 }) : null;

  var rA = document.getElementById("rangeA");
  var rB = document.getElementById("rangeB");
  var aLabel = document.getElementById("aLabel");
  var bLabel = document.getElementById("bLabel");
  var eqEl = document.getElementById("areaEq");
  var fracEl = document.getElementById("areaFrac");
  var spinBtn = document.getElementById("areaSpin");

  function nice(x) { return String(Number(x.toFixed(2))); }
  function cells(a, b) { return a * b; }

  function sync() {
    var a = Number(rA.value), b = Number(rB.value);
    if (lab) { lab.setA(a); lab.setB(b); }
    aLabel.textContent = nice(a / 10);
    bLabel.textContent = nice(b / 10);
    var n = cells(a, b);
    var product = n / 100;
    eqEl.innerHTML = nice(a / 10) + " × " + nice(b / 10) + " = <em>" + String(product) + "</em>";
    fracEl.textContent = a + "/10 × " + b + "/10 = " + n + "/100　→　亮起来 " + n + " 格 = " + product;
  }
  function markLab() { if (Lab.mark(CH, "lab")) Lab.toast("🎉 3D 实验台已解锁"); }

  if (rA) rA.addEventListener("input", function () { sync(); markLab(); });
  if (rB) rB.addEventListener("input", function () { sync(); markLab(); });
  var spinning = false;
  if (spinBtn) spinBtn.addEventListener("click", function () {
    spinning = !spinning;
    if (lab) lab.stage.setAutoRotate(spinning);
    spinBtn.textContent = "自动旋转：" + (spinning ? "开" : "关");
  });
  var resetBtn = document.getElementById("areaReset");
  if (resetBtn) resetBtn.addEventListener("click", function () {
    rA.value = 3; rB.value = 2; sync();
  });
  if (lab) {
    lab.stage.setAutoRotate(true);
    spinning = true;
    if (spinBtn) spinBtn.textContent = "自动旋转：开";
  } else {
    Lab.dec3d(canvas, "本机未启用 WebGL，3D 面积模型无法显示。拖动下面的滑块仍然会改变算式读数，结论一样看得见。");
    if (spinBtn) spinBtn.style.display = "none";   // 没有 3D 时这个按钮没有意义
  }
  sync();

  /* ======================= 03 · 3D 铅笔板书 ======================= */
  var DEMOS = [
    { a: "3.6", b: "5", label: "例1　3.6 × 5", tag: "小数 × 整数" },
    { a: "2.35", b: "1.5", label: "例2　2.35 × 1.5", tag: "小数 × 小数（经典）" },
    { a: "0.72", b: "0.06", label: "例3　0.72 × 0.06", tag: "位数不够要补 0" },
    { a: "1.25", b: "0.8", label: "例4　1.25 × 0.8", tag: "末尾的 0 要化简" },
    { a: "1.05", b: "2.4", label: "例5　1.05 × 2.4", tag: "因数中间有 0 别漏算" },
    { a: "24", b: "0.5", label: "例6　24 × 0.5", tag: "整数 × 小数" },
    { a: "0.056", b: "0.05", label: "例7　0.056 × 0.05", tag: "补 0 与化简一起考" }
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
        build: function () { return buildMultSteps(d.a, d.b); }
      };
    })
  });

  /* ======================= 04 · 亲手练 ======================= */
  var PB = [
    { a: "2.35", b: "1.5" }, { a: "0.72", b: "0.06" }, { a: "1.25", b: "0.8" },
    { a: "24", b: "0.5" }, { a: "0.056", b: "0.05" }, { a: "1.05", b: "2.4" },
    { a: "6.5", b: "1.04" }, { a: "3.84", b: "2.6" }, { a: "0.25", b: "0.4" },
    { a: "12", b: "0.03" }
  ];
  var pIdx = 0, pScore = 0, pDone = false;
  var elPIdx = document.getElementById("pIdx"), elPTotal = document.getElementById("pTotal");
  var elPScore = document.getElementById("pScore"), elPQ = document.getElementById("pQ");
  var elPInt = document.getElementById("pInt"), elPDec = document.getElementById("pDec");
  var elPRow = document.getElementById("pRow"), elPFb = document.getElementById("pFb"), elPNext = document.getElementById("pNext");
  elPTotal.textContent = PB.length;

  // 提示行（只创建一次，避免重复插入）
  var pHint = document.createElement("div");
  pHint.style.cssText = "font-size:13.5px;color:var(--ink-2);min-height:20px";
  elPRow.parentElement.insertBefore(pHint, elPRow);

  function pad0(str, n) { while (str.length < n) str = "0" + str; return str; }
  function normNum(s) {
    if (s.charAt(0) === ".") s = "0" + s;
    s = s.replace(/^0+(?=\d)/, "");
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s === "" ? "0" : s;
  }

  function pLoad() {
    pDone = false;
    elPIdx.textContent = pIdx + 1;
    elPScore.textContent = pScore;
    elPFb.className = "fb";
    elPFb.innerHTML = "";
    elPNext.style.display = "none";
    elPRow.innerHTML = "";

    var q = PB[pIdx];
    var decTotal = vDecimalsOf(q.a) + vDecimalsOf(q.b);
    var raw = (BigInt(vStripPoint(q.a)) * BigInt(vStripPoint(q.b))).toString();
    var intProd = pad0(raw, decTotal);            // 位数不够前面补 0
    var slotAns = intProd.length - decTotal;      // 正确的插入位置（插在第 slotAns 个数字之后）
    var answer = normNum(vPlaceDecimal(intProd, decTotal));

    elPQ.textContent = q.a + " × " + q.b + " = ?";
    elPInt.textContent = intProd;
    elPDec.textContent = decTotal;

    var hint = raw.length < decTotal ? "※ 整数乘出来的积位数不够，已经先补 0 占位了。" : "";
    pHint.textContent = hint;

    for (var k = 0; k <= intProd.length - 1; k++) {
      (function (slot, isFirst) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "slot";
        b.title = isFirst ? "把小数点放在最前面（前面要补 0）" : "把小数点放在第 " + slot + " 个数字之后";
        b.setAttribute("aria-label", b.title);
        b.addEventListener("click", function () {
          if (pDone) return;
          var candidate = normNum(intProd.slice(0, slot) + "." + intProd.slice(slot));
          if (slot === slotAns) {
            pDone = true;
            b.classList.add("good");
            pScore++;
            elPScore.textContent = pScore;
            var msg = "✅ 对了！两个因数一共 <b>" + decTotal + "</b> 位小数，从积的<b>最右边</b>往左数 " + decTotal +
              " 位 —— 答案就是 <b>" + answer + "</b>。";
            if (raw.length < decTotal) msg += "<br>这一题 432 只有 3 位，不够点 4 位，所以<b>前面补了一个 0</b>。";
            if (normNum(vPlaceDecimal(intProd, decTotal)) !== vPlaceDecimal(intProd, decTotal)) {
              msg += "<br>别忘了最后<b>化简</b>：" + vPlaceDecimal(intProd, decTotal) + " → <b>" + answer + "</b>（先点小数点，再去末尾 0）。";
            }
            msg += "<br>再用 3 秒检查一下：积应该比 " + q.a + " " + (Number(answer) < Number(q.a) ? "小" : "大") + "（乘" +
              (Number(q.b) < 1 ? "比 1 小的数，越乘越小" : "比 1 大的数，越乘越大") + "）。";
            elPFb.className = "fb show ok";
            elPFb.innerHTML = msg;
            Lab.beep(true);
            Lab.mark(CH, "practice");
            elPNext.style.display = "";
          } else {
            b.classList.add("bad");
            elPFb.className = "fb show no";
            elPFb.innerHTML = "❌ 这里会得到 " + candidate + "，不对。<br>口诀：<b>从最右边往左数 " + decTotal +
              " 位</b>，数到哪儿就在哪儿点小数点。再试一次。";
            Lab.beep(false);
            setTimeout(function () { b.classList.remove("bad"); }, 1000);
          }
        });
        elPRow.appendChild(b);
      })(k, k === 0);

      var d = document.createElement("span");
      d.className = "dg";
      d.textContent = intProd.charAt(k);
      elPRow.appendChild(d);
    }
  }

  elPNext.addEventListener("click", function () {
    pIdx++;
    if (pIdx < PB.length) pLoad();
    else {
      elPQ.textContent = "🎉 10 题全部做完！";
      elPRow.innerHTML = "";
      pHint.textContent = "";
      elPFb.className = "fb show ok";
      elPFb.innerHTML = "分数：" + pScore + " / " + PB.length + "。去下面闯关吧！";
      elPNext.style.display = "none";
    }
  });
  pLoad();

  /* ======================= 04 · 闯关挑战 ======================= */
  Lab.quiz({
    mount: "#quizMount",
    chapter: CH,
    bank: [
      { q: "1.8 × 0.3 = ?", opts: ["5.4", "0.54", "54"], ans: 1, why: " 18 × 3 = 54，因数共 1+1 = 2 位小数 → 0.54。" },
      { q: "2.6 × 1.5 = ?", opts: ["3.9", "39", "0.39"], ans: 0, why: " 26 × 15 = 390，共 2 位小数 → 3.90 → 化简 3.9。" },
      { q: "0.37 × 0.4 = ?", opts: ["1.48", "0.148", "0.0148"], ans: 1, why: " 37 × 4 = 148，共 3 位小数 → 0.148。" },
      { q: "0.72 × 0.06 = ?", opts: ["0.0432", "0.432", "4.32"], ans: 0, why: " 72 × 6 = 432，共 4 位小数，432 只有 3 位 → 前面补 0 → 0.0432。" },
      { q: "1.25 × 0.8 = ?", opts: ["1", "10", "0.1"], ans: 0, why: " 125 × 8 = 1000，共 3 位小数 → 1.000 → 化简 → 1。" },
      { q: "1.05 × 2.4 = ?", opts: ["2.52", "25.2", "0.252"], ans: 0, why: " 105 × 24 = 2520（因数中间的 0 要参与计算），共 3 位小数 → 2.520 → 化简 2.52。" },
      { q: "一个数（0 除外）乘 0.99，积比原来的数（　）", opts: ["大一些", "小一些", "不变"], ans: 1, why: " 乘比 1 小的数，越乘越小；乘 1.01 才会变大。" },
      { q: "一个因数扩大到原来的 10 倍，另一个因数不变，积（　）", opts: ["不变", "扩大到原来的 10 倍", "扩大到原来的 100 倍"], ans: 1, why: " 积随因数等倍变化：一个因数 ×10，积也 ×10。" },
      { q: "计算 2.4 × 0.3 时得到 72，这个结果（　）", opts: ["对，答案是 72", "错，应该比 2.4 小", "错，应该比 72 大"], ans: 1, why: " 0.3 < 1，积必须比 2.4 小。正确是 24 × 3 = 72，共 2 位小数 → 0.72。" },
      { q: "13 × 0.2 = ?", opts: ["2.6", "0.26", "26"], ans: 0, why: " 13 × 2 = 26，共 1 位小数 → 2.6。" },
      { q: "0.56 × 0.04 = ?", opts: ["0.0224", "0.224", "2.24"], ans: 0, why: " 56 × 4 = 224，共 4 位小数，位数不够补 0 → 0.0224。" },
      { q: "0.25 × 0.4 = ?", opts: ["0.1", "1", "0.01"], ans: 0, why: " 25 × 4 = 100，共 3 位小数 → 0.100 → 去掉末尾的 0 → 0.1。" },
      { q: "下面哪一句是对的？", opts: ["积的小数点和因数的小数点对齐", "积的小数位数等于因数小数位数的和", "因数末尾的 0 要先去掉再算"], ans: 1, why: " 加法和减法才讲「小数点对齐」；乘法是数位数。因数末尾的 0 也不用提前去，算完再化简。" },
      { q: "3.5 × 0.98 的积比 3.5（　）", opts: ["大一些", "小一些", "相等"], ans: 1, why: " 0.98 < 1，乘比 1 小的数越乘越小。答案是 3.43。" }
    ],
    onFinish: function (s, t) {
      if (s >= Math.ceil(t * 0.75)) Lab.toast("🏆 小数乘法通关！");
    }
  });
})();
