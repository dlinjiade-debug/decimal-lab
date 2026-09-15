/* ==========================================================================
 *  lab-core.js —— 小数点实验室 公共内核
 *  · 进度存储（每章：例题/练习/闯关 完成数）
 *  · 页面脚手架：页内步骤导航高亮、减少动画、全屏、toast
 *  · 练习/闯关通用驱动：Lab.Quiz(el, bank, opts)
 * ========================================================================== */
(function (root) {
  "use strict";

  var STORE_KEY = "decimal-lab-v1";
  var CHAPTERS = [
    { id: "multiply", tone: "multiply", num: "01", name: "小数乘法", unit: "人教版五上 · 第 1 单元", file: "multiply.html",
      desc: "用 3D 面积积木看见「积的小数位数 = 因数小数位数之和」。" },
    { id: "divide",   tone: "divide",   num: "02", name: "小数除法", unit: "人教版五上 · 第 3 单元", file: "divide.html",
      desc: "3D 双轨同步搬运小数点，把小数除法转化成整数除法。" },
    { id: "equation", tone: "equation", num: "03", name: "简易方程", unit: "人教版五上 · 第 5 单元", file: "equation.html",
      desc: "一台可以上手拨动的 3D 天平，把等式的性质玩明白。" }
  ];

  /* ------------------------- 存储 ------------------------- */
  function read() {
    try { return JSON.parse(root.localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function write(o) {
    try { root.localStorage.setItem(STORE_KEY, JSON.stringify(o)); } catch (e) { /* 隐私模式兜底 */ }
  }
  var store = read();
  function ensure(id) {
    if (!store[id] || typeof store[id] !== "object") store[id] = { done: {}, quiz: 0, quizTotal: 0 };
    if (!store[id].done) store[id].done = {};
    return store[id];
  }

  /* ------------------------- UI 小工具 ------------------------- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2000);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ------------------------- 主题 / 设置 ------------------------- */
  var SET_KEY = "decimal-lab-settings";
  function settings() {
    try { return JSON.parse(root.localStorage.getItem(SET_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveSettings(o) {
    try { root.localStorage.setItem(SET_KEY, JSON.stringify(o)); } catch (e) { /* noop */ }
  }
  function applyReduceMotion(on) {
    document.body.classList.toggle("reduce-motion", !!on);
  }

  /**
   * 3D 不可用时的统一收尾。
   * 只藏掉画布本身，**保留读数与控件** —— 滑块/按钮背后的算式与讲解并不依赖 3D，
   * 藏掉它们等于把还能用的功能一起关掉了。
   * @param {Element|string} el  画布元素或选择器
   * @param {string} note        给学生的替代说明
   */
  function dec3d(el, note) {
    var cv = typeof el === "string" ? $(el) : el;
    if (!cv) return false;
    var card = cv.closest ? cv.closest(".stage-card") : null;
    if (!card) return false;
    card.classList.add("no3d");
    var badge = card.querySelector(".badge3d");
    if (badge) badge.textContent = "2D";
    var hint = card.querySelector(".stage-hint");
    if (hint) hint.textContent = "本机未启用 WebGL";
    if (note) {
      var p = document.createElement("p");
      p.className = "stage-note";
      p.textContent = note;
      var wrap = cv.closest(".stage-canvas-wrap");
      if (wrap && wrap.parentNode) wrap.parentNode.insertBefore(p, wrap.nextSibling);
      else card.appendChild(p);
    }
    return true;
  }

  /* ------------------------- 页面脚手架（照旧站骨架） ------------------------- */
  var STAGES = [
    { id: "s-lab",      num: "1", name: "提出课题", note: "先玩 3D 实验台" },
    { id: "s-why",      num: "2", name: "收集线索", note: "算理揭秘" },
    { id: "s-teach",    num: "3", name: "动手验证", note: "看铅笔板书" },
    { id: "s-practice", num: "4", name: "锁定规律", note: "亲手练一遍" },
    { id: "s-game",     num: "5", name: "独立破案", note: "闯关拿徽章" }
  ];
  /* 五阶段与进度键的对应 */
  var STAGE_KEY = { "s-lab": "lab", "s-why": "teach", "s-teach": "teach", "s-practice": "practice", "s-game": "quiz" };
  /* 每章的一句话要点（右卡常驻，与正文标题不重复） */
  var CLUE = {
    multiply: { hint: "因数一共几位小数，积就点几位小数；位数不够，前面补 0。" },
    divide:   { hint: "被除数和除数同时放大相同的倍数，商不变。移几位，看除数。" },
    equation: { hint: "两边同加、同减、同乘、同除以（不为 0），等式仍然成立。" }
  };

  /** 一次性搭好整页骨架：顶栏 + 五阶段进度条 + 左侧案卷轨 + 右侧当前线索 + 底部操作条 */
  function mountShell(active) {
    var top = $("#labTop");
    if (top) {
      top.className = "lab-top";
      /* 阶段导航只在这里出现一次；章节切换交给左侧案卷轨 */
      var track = active ? STAGES.map(function (s) {
        return '<a href="#' + s.id + '"><i>' + s.num + "</i><span>" + s.name + "</span></a>";
      }).join("") : "";
      top.innerHTML =
        '<div class="lab-top-in">' +
          '<a class="lab-brand" href="index.html">' +
            '<span class="logo" aria-hidden="true"><svg viewBox="0 0 24 24">' +
              '<path d="M4 6.5h16M4 12h16M4 17.5h9"/><circle cx="18.5" cy="17.5" r="2.6"/>' +
            "</svg></span>" +
            "<span>小数点实验室<small>CHALK LAB</small></span>" +
          "</a>" +
          (track
            ? '<nav class="stage-track" id="labTrack" aria-label="五阶段进度">' + track + "</nav>"
            : '<span class="top-spacer"></span>') +
          '<div class="top-actions">' +
            '<button type="button" class="icon-btn" id="labFullscreen" aria-label="全屏" title="全屏">' +
              '<svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg></button>' +
            '<button type="button" class="icon-btn" id="labSettings" aria-label="设置" title="设置">' +
              '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/></svg></button>' +
          "</div>" +
        "</div>";

      var fs = $("#labFullscreen");
      if (fs) fs.onclick = function () {
        if (!document.fullscreenElement) { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); }
        else { document.exitFullscreen && document.exitFullscreen(); }
      };
      var st = $("#labSettings"), dlg = $("#labSettingsDialog");
      if (st && dlg) {
        st.onclick = function () { dlg.showModal(); };
        var cb = $("#setReduceMotion");
        if (cb) {
          cb.checked = !!settings().reduceMotion;
          cb.onchange = function () { var s = settings(); s.reduceMotion = cb.checked; saveSettings(s); applyReduceMotion(cb.checked); };
        }
        var rb = $("#setReset");
        if (rb) rb.onclick = function () {
          try { root.localStorage.removeItem(STORE_KEY); } catch (e) { /* noop */ }
          toast("全部进度已重置");
          setTimeout(function () { location.reload(); }, 700);
        };
      }
    }

    /* ---- 左侧案卷轨：只做章节切换（阶段导航在顶栏，这里不再重复） ---- */
    var rail = $("#labRail");
    if (rail) {
      rail.className = "case-rail";
      rail.innerHTML =
        '<div class="rail-head"><span>小数案例档案</span><small>CASE FILES</small></div>' +
        '<nav class="rail-list">' +
          CHAPTERS.map(function (c) {
            return '<a href="' + c.file + '"' + (c.id === active ? ' class="is-on"' : "") + ">" +
              "<em>" + c.num + "</em><span>" + esc(c.name) + "</span></a>";
          }).join("") +
        "</nav>";
    }

    /* ---- 右侧本章要点 ---- */
    var clue = $("#labClue");
    if (clue && active) {
      var ch = null;
      CHAPTERS.forEach(function (c) { if (c.id === active) ch = c; });
      var cc = CLUE[active] || { hint: "" };
      clue.innerHTML =
        '<small class="clue-kicker">本章要点 · KEY POINT</small>' +
        "<h3>" + esc(ch ? ch.name : "") + "</h3>" +
        '<div class="clue-rule"></div>' +
        '<p class="clue-q">' + cc.hint + "</p>" +
        '<div class="clue-stamp" id="clueStamp">未解锁</div>';
    }

    /* ---- 底部操作条：只留前后翻页（提示已在右卡常驻，当前节已在顶栏高亮） ---- */
    var bar = $("#labBar");
    var targets = [];
    if (bar) {
      bar.className = "op-bar";
      if (active) {
        targets = STAGES.map(function (s) { return document.getElementById(s.id); });
        bar.innerHTML =
          '<div class="op-in">' +
            '<button type="button" class="op" id="opTop">⬆ 回到顶部</button>' +
            '<span class="op-spacer"></span>' +
            '<button type="button" class="op" id="opPrev">◀ 上一节</button>' +
            '<button type="button" class="op primary" id="opNext">下一节 ▶</button>' +
          "</div>";
        var topBtn = $("#opTop"), prevBtn = $("#opPrev"), nextBtn = $("#opNext");
        if (topBtn) topBtn.onclick = function () { root.scrollTo({ top: 0, behavior: "smooth" }); };
        if (prevBtn) prevBtn.onclick = function () { gotoSec(curIdx - 1); };
        if (nextBtn) nextBtn.onclick = function () { gotoSec(curIdx + 1); };
      } else {
        bar.innerHTML =
          '<div class="op-in">' +
            '<button type="button" class="op" id="opTop">⬆ 回到顶部</button>' +
            '<span class="op-spacer"></span>' +
            '<a class="op primary" href="multiply.html" style="text-decoration:none">从第一章开始 ▶</a>' +
          "</div>";
        var tb = $("#opTop");
        if (tb) tb.onclick = function () { root.scrollTo({ top: 0, behavior: "smooth" }); };
      }
    }

    /* ---- 滚动联动：顶栏阶段高亮 + 右侧进度章 ---- */
    var curIdx = 0;
    function gotoSec(i) {
      i = Math.max(0, Math.min(targets.length - 1, i));
      if (targets[i]) targets[i].scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function sync() {
      if (!active || !targets.length) return;
      var y = root.scrollY + 170, best = 0;
      targets.forEach(function (t, i) { if (t && t.offsetTop <= y) best = i; });
      curIdx = best;
      var s = ensure(active);
      var trackLinks = $$("#labTrack a");
      STAGES.forEach(function (st, i) {
        var done = !!s.done[STAGE_KEY[st.id]];
        if (trackLinks[i]) {
          trackLinks[i].classList.toggle("is-on", i === best);
          trackLinks[i].classList.toggle("is-done", done && i !== best);
        }
      });
      var prevBtn = $("#opPrev"), nextBtn = $("#opNext");
      if (prevBtn) prevBtn.disabled = best === 0;
      if (nextBtn) nextBtn.disabled = best === targets.length - 1;
      var stamp = $("#clueStamp");
      if (stamp) {
        var got = Math.min(4, Object.keys(s.done).length);
        stamp.textContent = got >= 4 ? "本章完成" : got + " / 4 步";
        stamp.classList.toggle("on", got >= 4);
      }
    }
    root.addEventListener("scroll", sync, { passive: true });
    root.addEventListener("resize", sync);
    applyReduceMotion(!!settings().reduceMotion);
    setTimeout(sync, 60);
    sync();

    return { sync: sync, gotoSec: gotoSec };
  }

  /** 章节卡片进度显示（首页用） */
  function progressOf(id) { var s = ensure(id); return { done: Object.keys(s.done).length, quiz: s.quiz || 0, quizTotal: s.quizTotal || 0 }; }

  /** 标记一个完成点，返回是否为"新完成" */
  function mark(id, key) {
    var s = ensure(id);
    if (s.done[key]) return false;
    s.done[key] = 1;
    write(store);
    return true;
  }
  function recordQuiz(id, score, total) {
    var s = ensure(id);
    s.quiz = Math.max(s.quiz || 0, score);
    s.quizTotal = total;
    write(store);
  }

  /* ------------------------- 通用闯关 ------------------------- */
  /**
   * Lab.quiz({ mount, bank, chapter, onFinish })
   * bank: [{ q, opts, ans, why }]
   */
  function quiz(opt) {
    var box = typeof opt.mount === "string" ? $(opt.mount) : opt.mount;
    if (!box) return;
    var bank = opt.bank, idx = 0, score = 0, locked = false;

    box.innerHTML =
      '<div class="qbar">' +
        '<span class="pill">第 <b data-q-idx>1</b> / ' + bank.length + " 关</span>" +
        '<span class="pill">答对 <b data-q-score>0</b> 题</span>' +
        '<span style="margin-left:auto;color:var(--chalk-soft);font-weight:600" data-q-hint>答对 ' + Math.ceil(bank.length * 0.75) + " 题解锁本章徽章</span>" +
      "</div>" +
      '<div class="bar"><i data-q-bar></i></div>' +
      '<div class="qtext" data-q-text></div>' +
      '<div class="opts" data-q-opts></div>' +
      '<div class="fb" data-q-fb role="status" aria-live="polite"></div>' +
      '<button type="button" class="btn primary" data-q-next style="display:none">下一关 →</button>' +
      '<div class="badge-unlock" data-q-badge></div>';

    var elIdx = $("[data-q-idx]", box), elScore = $("[data-q-score]", box), elBar = $("[data-q-bar]", box);
    var elText = $("[data-q-text]", box), elOpts = $("[data-q-opts]", box);
    var elFb = $("[data-q-fb]", box), elNext = $("[data-q-next]", box), elBadge = $("[data-q-badge]", box);

    function paint() {
      elIdx.textContent = idx + 1;
      elScore.textContent = score;
      elBar.style.width = (idx / bank.length * 100) + "%";
    }
    function load() {
      locked = false;
      var q = bank[idx];
      elText.textContent = q.q;
      elFb.className = "fb";
      elFb.innerHTML = "";
      elNext.style.display = "none";
      elOpts.innerHTML = "";
      paint();
      q.opts.forEach(function (o, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "opt";
        b.textContent = o;
        b.onclick = function () {
          if (locked) return;
          if (i === q.ans) {
            locked = true;
            b.classList.add("correct");
            score++;
            elScore.textContent = score;
            elFb.className = "fb show ok";
            elFb.innerHTML = "✅ 答对了！" + q.why;
            if (idx === bank.length - 1) finish(); else elNext.style.display = "";
          } else {
            b.classList.add("wrong");
            elFb.className = "fb show no";
            elFb.innerHTML = "❌ 再想一想。" + q.why;
            setTimeout(function () { b.classList.remove("wrong"); }, 900);
          }
        };
        elOpts.appendChild(b);
      });
    }
    function finish() {
      elBar.style.width = "100%";
      var pass = Math.ceil(bank.length * 0.75);
      recordQuiz(opt.chapter, score, bank.length);
      if (score >= pass) {
        var fresh = mark(opt.chapter, "quiz");
        elBadge.className = "badge-unlock show";
        elBadge.innerHTML = "🏅 本章徽章已解锁！答对 " + score + " / " + bank.length + " 题。" +
          (fresh ? "" : "（之前已解锁过啦）") + "切到下一章继续吧。";
        if (fresh) toast("🏅 徽章 +1");
      } else {
        elBadge.className = "badge-unlock show";
        elBadge.innerHTML = "答对 " + score + " / " + bank.length + " 题，再差一点点。回到上面的「3D 实验台」和「跟我学」复习一下再来挑战吧。";
      }
      if (opt.onFinish) opt.onFinish(score, bank.length);
    }
    elNext.onclick = function () {
      if (idx >= bank.length - 1) return;
      idx++; load();
    };
    load();
  }

  /* ------------------------- 分步演示器 ------------------------- */
  /**
   * Lab.stepper(steps, mountEl, { empty, auto, onStep })
   * steps: [{ explain, render(el) }]
   * 会自动接管 #btnPrev / #btnNext / #btnReset —— 若这三个按钮存在。
   */
  function stepper(steps, mount, o) {
    o = o || {};
    var i = -1, autoTimer = null;

    function paint() {
      mount.innerHTML = "";
      if (i < 0) {
        var ph = document.createElement("div");
        ph.className = "placeholder";
        ph.innerHTML = o.empty || "选择一个例题，然后点「下一步」开始演示。";
        mount.appendChild(ph);
        return;
      }
      var s = steps[i];
      var body = document.createElement("div");
      mount.appendChild(body);
      if (s.explain) {
        var ex = document.createElement("div");
        ex.className = "explain";
        ex.innerHTML = s.explain;
        mount.appendChild(ex);
      }
      s.render(body);
      var r = mount.getBoundingClientRect();
      if (r.top < 0 || r.bottom > (root.innerHeight || 800)) {
        mount.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (o.onStep) o.onStep(i, steps.length);
    }
    function go(n) { i = Math.max(-1, Math.min(steps.length - 1, n)); paint(); }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
      if (autoBtn) {
        autoBtn.style.background = "";
        autoBtn.style.color = "";
        autoBtn.style.borderColor = "";
      }
    }

    var prevBtn = $("#btnPrev"), nextBtn = $("#btnNext"), resetBtn = $("#btnReset");
    var autoBtn = null;
    if (prevBtn) prevBtn.onclick = function () { stopAuto(); go(i - 1); };
    if (nextBtn) nextBtn.onclick = function () { stopAuto(); go(i + 1); };
    if (resetBtn) resetBtn.onclick = function () { stopAuto(); go(-1); };
    if (o.auto !== false && nextBtn && nextBtn.parentElement) {
      autoBtn = document.createElement("button");
      autoBtn.type = "button";
      autoBtn.className = "btn";
      autoBtn.textContent = "自动播放";
      autoBtn.onclick = function () {
        if (autoTimer) { stopAuto(); return; }
        autoBtn.style.background = "linear-gradient(135deg,var(--ch),var(--ch-2))";
        autoBtn.style.color = "#fff";
        autoBtn.style.borderColor = "transparent";
        if (i < 0) go(0);
        autoTimer = setInterval(function () {
          if (i >= steps.length - 1) { stopAuto(); return; }
          go(i + 1);
        }, 5200);
      };
      nextBtn.parentElement.appendChild(autoBtn);
    }
    paint();

    return {
      next: function () { stopAuto(); go(i + 1); },
      prev: function () { stopAuto(); go(i - 1); },
      reset: function () { stopAuto(); go(-1); },
      goto: go,
      stop: stopAuto,
      index: function () { return i; },
      total: steps.length
    };
  }

  /** 全站按钮点击反馈音效（可选，静默失败） */
  function beep(ok) {
    if (settings().mute) return;
    try {
      var Ctx = root.AudioContext || root.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = ok ? 880 : 220;
      g.gain.value = 0.05;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      o.stop(ctx.currentTime + 0.2);
      setTimeout(function () { ctx.close(); }, 400);
    } catch (e) { /* 静默 */ }
  }

  root.Lab = {
    CHAPTERS: CHAPTERS,
    STAGES: STAGES,
    mountShell: mountShell,
    toast: toast,
    esc: esc,
    $: $, $$: $$,
    mark: mark,
    progressOf: progressOf,
    recordQuiz: recordQuiz,
    quiz: quiz,
    stepper: stepper,
    beep: beep,
    dec3d: dec3d,
    settings: settings,
    applyReduceMotion: applyReduceMotion
  };
})(window);
