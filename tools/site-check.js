#!/usr/bin/env node
/* ==========================================================================
 *  site-check.js —— 小数点实验室 · 站点契约自检
 *  ------------------------------------------------------------------
 *  只依赖 Node 内置模块，用正则解析 HTML，不引入任何构建步骤。
 *  目的：把「这个站点必须满足的约定」写成可执行的断言，
 *        改完随手跑一次，避免改版时悄悄破坏结构 / 无障碍 / 资源引用。
 *
 *  用法： node tools/site-check.js
 * ========================================================================== */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PAGES = ["index.html", "multiply.html", "divide.html", "equation.html"];
const CHAPTERS = [
  { file: "multiply.html", script: "js/multiply.js", canvas: "areaCanvas" },
  { file: "divide.html", script: "js/divide.js", canvas: "moverCanvas" },
  { file: "equation.html", script: "js/equation.js", canvas: "balCanvas" }
];
const STEPS = ["s-lab", "s-why", "s-teach", "s-practice", "s-game"];

let pass = 0;
const fails = [];

function check(name, cond, detail) {
  if (cond) { pass++; return; }
  fails.push(name + (detail ? "\n      → " + detail : ""));
}
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function exists(rel) {
  try { return fs.statSync(path.join(ROOT, rel)).isFile(); } catch (e) { return false; }
}
/** 去掉 ?query 再判断本地文件是否存在 */
const bare = (u) => u.split("?")[0].split("#")[0];

/* ------------------------------------------------------------------ */
for (const page of PAGES) {
  const tag = "[" + page + "]";

  /* ---- 1. 文件与 head 必备项 ---- */
  check(tag + " 文件存在", exists(page));
  const html = read(page);
  check(tag + " 声明 charset", /<meta charset="UTF-8">/i.test(html));
  check(tag + " 声明 lang=zh-CN", /<html lang="zh-CN">/.test(html));
  check(tag + " 有 viewport（移动端不缩放错乱）", /name="viewport"[^>]*width=device-width/.test(html));
  check(tag + " 有 title", /<title>[^<]{4,}<\/title>/.test(html));
  check(tag + " 有 description", /name="description"/.test(html));
  check(tag + " 有 favicon", /rel="icon"/.test(html));

  /* ---- 2. id 不能重复（重复 id 会让 getElementById 取错元素） ---- */
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  check(tag + " 无重复 id", dup.length === 0, dup.join(", "));

  /* ---- 3. 本地资源必须真的存在（含页面互链） ---- */
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => u && !/^(https?:|data:|#|mailto:)/.test(u));
  const missing = [...new Set(refs)].filter((u) => !exists(bare(u)));
  check(tag + " 本地资源与链接都存在", missing.length === 0, missing.join(", "));

  /* ---- 4. 每页都要有 h1（标题层级从 h1 开始，读屏才不迷路） ---- */
  check(tag + " 有 h1 标题", /<h1[\s>]/.test(html));

  /* ---- 5. 无障碍：画布要有替代说明（首页用 model-viewer，没有裸露的 canvas） ---- */
  const canvases = [...html.matchAll(/<canvas\b[^>]*>/g)].map((m) => m[0]);
  canvases.forEach((c) => {
    const id = (c.match(/id="([^"]+)"/) || [])[1] || "?";
    check(tag + " 画布 #" + id + " 有 role=img", /role="img"/.test(c));
    check(tag + " 画布 #" + id + " 有 aria-label", /aria-label="[^"]{8,}"/.test(c));
  });
  if (/<model-viewer/.test(html) || /createElement\("model-viewer"\)/.test(html)) {
    check(tag + " 3D 模型查看器有替代文本", /setAttribute\("alt"/.test(html) || /alt="[^"]{6,}"/.test(html));
  }

  /* ---- 6. aria-describedby / for 指向的 id 必须存在 ---- */
  const idSet = new Set(ids);
  ["aria-describedby", "aria-labelledby", "for"].forEach((attr) => {
    const vals = [...html.matchAll(new RegExp(attr + '="([^"]+)"', "g"))]
      .flatMap((m) => m[1].split(/\s+/));
    const bad = vals.filter((v) => v && !idSet.has(v));
    check(tag + " " + attr + " 指向的 id 都存在", bad.length === 0, bad.join(", "));
  });

  /* ---- 7. 脚本一律 defer（不阻塞首屏解析） ---- */
  const scripts = [...html.matchAll(/<script\b[^>]*src="[^"]+"[^>]*>/g)].map((m) => m[0]);
  check(tag + " 有外链脚本", scripts.length > 0);
  const blocking = scripts.filter((s) => !/\sdefer\b/.test(s) && !/type="module"/.test(s));
  check(tag + " 外链脚本都没有阻塞解析", blocking.length === 0, blocking.join(" | "));

  /* ---- 8. 资源版本号一致（改完必须整体升版本，否则旧缓存不刷新） ---- */
  const vers = [...new Set([...html.matchAll(/\?v=(\d+)/g)].map((m) => m[1]))];
  check(tag + " 资源版本号唯一", vers.length <= 1, vers.join(", "));

  /* ---- 9. 移动端不能被 3D 区域卡住滚动 ---- */
  check(tag + " 未禁用画布触摸滚动", !/touch-action:\s*none/.test(html));
}

/* 四页之间的版本号必须完全一致：只升一半会出现「新的 HTML + 旧的 JS」 */
const allVers = new Set();
PAGES.forEach((p) => {
  [...read(p).matchAll(/\?v=(\d+)/g)].forEach((m) => allVers.add(m[1]));
});
check("四页资源版本号一致", allVers.size === 1, [...allVers].join(", "));

/* ------------------------------------------------------------------ */
/* 章节页专属：五步结构 + 核心脚本                                            */
const core = read("js/lab-core.js");
const stagesInCore = [...core.matchAll(/id:\s*"(s-[a-z]+)"/g)].map((m) => m[1]);
check("lab-core 定义的五阶段与页面一致", stagesInCore.join(",") === STEPS.join(","),
  "core: " + stagesInCore.join(","));

CHAPTERS.forEach((c) => {
  const tag = "[" + c.file + "]";
  const html = read(c.file);

  const secs = [...html.matchAll(/<section id="(s-[a-z]+)"/g)].map((m) => m[1]);
  check(tag + " 五个阶段 section 齐全且顺序正确", secs.join(",") === STEPS.join(","), secs.join(","));

  check(tag + " 引用了本章交互脚本", html.includes(c.script));
  ["js/lab-core.js", "js/lab-3d.js", "js/lab-teach.js"].forEach((dep) => {
    check(tag + " 引用了 " + dep, html.includes(dep));
  });
  check(tag + " 引用了 handwrite 引擎", html.includes("lib/handwrite.js"));
  check(tag + " 有本章专属画布 #" + c.canvas, html.includes('id="' + c.canvas + '"'));
  check(tag + " 有 2D 降级容器", html.includes('id="wFallback"'));
  check(tag + " 标出人教版单元", /人教版五年级上册 · 第 \d 单元/.test(html));
});

/* ------------------------------------------------------------------ */
/* 全局约定                                                                */
const css = read("css/lab.css");
check("CSS 定义纸面墨色变量 --ink", /--ink:/.test(css));
check("CSS 定义纸面墨色变量 --ink-2", /--ink-2:/.test(css));
check("CSS 有键盘焦点样式", /:focus-visible/.test(css));
check("CSS 有读屏专用隐藏类", /\.sr-only/.test(css));
check("CSS 未残留已删除的旧类 .ch-nav", !/\.ch-nav/.test(css));
check("CSS 未残留已删除的旧类 .rail-steps", !/\.rail-steps/.test(css));

const coreHasDead = /\.short\b/.test(read("js/lab-core.js"));
check("lab-core 无遗留未使用字段 short", !coreHasDead);

/* ------------------------------------------------------------------ */
/* 输出                                                                    */
const LINE = "─".repeat(52);
console.log("小数点实验室 · 站点自检");
console.log(LINE);
if (fails.length) {
  fails.forEach((f) => console.log("✗ " + f));
  console.log(LINE);
}
console.log((fails.length ? "❌ " : "✅ ") + "通过 " + pass + " 项，失败 " + fails.length + " 项");
process.exit(fails.length ? 1 : 0);
