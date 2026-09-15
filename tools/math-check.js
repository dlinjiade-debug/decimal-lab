/* ==========================================================================
 *  math-check.js —— 站点题库 / 练习题库的答案自检
 *  直接加载 lib/vertical-calc.js（与页面同一份引擎），核对每道题的预期答案。
 *  运行： node .qa/math-check.js
 * ========================================================================== */
"use strict";
const path = require("path");
const api = require(path.join(__dirname, "..", "lib", "vertical-calc.js"));

function trim(s) {
  if (s.indexOf(".") < 0) return s;
  return s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
/** 和页面一致：先补 0 保证位数够，再点小数点，最后化简 */
function product(a, b) {
  const raw = (BigInt(api.vStripPoint(a)) * BigInt(api.vStripPoint(b))).toString();
  const dec = api.vDecimalsOf(a) + api.vDecimalsOf(b);
  return trim(api.vPlaceDecimal(raw, dec));
}
function shifted(x, n) { return api.vShiftPointRight(x, n); }

let fails = 0, total = 0;
function eq(label, got, want) {
  total++;
  if (String(got) !== String(want)) {
    fails++;
    console.log("  ✗ " + label + "  得到 " + got + "，应为 " + want);
  }
}

console.log("── 小数乘法：亲手练 10 题 ──");
[
  ["2.35", "1.5", "3.525"], ["0.72", "0.06", "0.0432"], ["1.25", "0.8", "1"],
  ["24", "0.5", "12"], ["0.056", "0.05", "0.0028"], ["1.05", "2.4", "2.52"],
  ["6.5", "1.04", "6.76"], ["3.84", "2.6", "9.984"], ["0.25", "0.4", "0.1"],
  ["12", "0.03", "0.36"]
].forEach(([a, b, want]) => eq(`${a} × ${b}`, product(a, b), want));

console.log("── 小数乘法：闯关 14 题 ──");
[
  ["1.8", "0.3", "0.54"], ["2.6", "1.5", "3.9"], ["0.37", "0.4", "0.148"],
  ["0.72", "0.06", "0.0432"], ["1.25", "0.8", "1"], ["1.05", "2.4", "2.52"],
  ["13", "0.2", "2.6"], ["0.56", "0.04", "0.0224"], ["0.25", "0.4", "0.1"],
  ["3.5", "0.98", "3.43"], ["2.4", "0.3", "0.72"]
].forEach(([a, b, want]) => eq(`${a} × ${b}`, product(a, b), want));

console.log("── 小数除法：3D 实验台预设（右移「除数小数位数」位）──");
[
  ["7.65", "0.85", "765", "85"], ["12.6", "0.28", "1260", "28"],
  ["0.756", "0.18", "75.6", "18"], ["5.98", "0.23", "598", "23"],
  ["0.9", "0.045", "900", "45"], ["1.44", "1.2", "14.4", "12"],
  ["22.4", "4", "22.4", "4"]
].forEach(([d, s, wd, ws]) => {
  const n = api.vDecimalsOf(s);
  eq(`${d} ÷ ${s} 的被除数`, shifted(d, n), wd);
  eq(`${d} ÷ ${s} 的除数`, shifted(s, n), ws);
  eq(`${d} ÷ ${s} 转化后除数必须是整数`, api.vDecimalsOf(shifted(s, n)), 0);
});

console.log("── 小数除法：亲手练 / 闯关的转化结果 ──");
[
  ["5.98", "0.23", "598", "23"], ["12.6", "0.28", "1260", "28"],
  ["0.756", "0.18", "75.6", "18"], ["51.3", "0.27", "5130", "27"],
  ["7.2", "0.24", "720", "24"], ["0.9", "0.045", "900", "45"],
  ["1.44", "1.2", "14.4", "12"], ["62.4", "2.6", "624", "26"],
  ["4.8", "0.6", "48", "6"], ["3.6", "1.5", "36", "15"],
  ["1.69", "0.26", "169", "26"], ["2.4", "0.12", "240", "12"]
].forEach(([d, s, wd, ws]) => {
  const n = api.vDecimalsOf(s);
  eq(`${d} ÷ ${s} → 被除数`, shifted(d, n), wd);
  eq(`${d} ÷ ${s} → 除数`, shifted(s, n), ws);
});

console.log("── 小数除法：商与被除数的大小关系（闯关解析里引用的结论）──");
[
  ["4.8", "0.6", 8], ["7.5", "0.25", 30], ["1.69", "0.26", 6.5],
  ["0.75", "0.15", 5], ["5.6", "7", 0.8], ["3.8", "0.5", 7.6],
  ["2.4", "0.12", 20], ["3.6", "1.5", 2.4]
].forEach(([d, s, want]) => {
  const n = api.vDecimalsOf(s);
  const q = Number(shifted(d, n)) / Number(shifted(s, n));
  eq(`${d} ÷ ${s}`, Number(q.toFixed(6)), want);
});

console.log("── 竖式引擎：分步生成不报错且能拿到末步 ──");
[
  ["3.6", "5"], ["2.35", "1.5"], ["0.72", "0.06"], ["1.25", "0.8"],
  ["1.05", "2.4"], ["24", "0.5"], ["0.056", "0.05"]
].forEach(([a, b]) => {
  const steps = api.buildMultSteps(a, b);
  total++;
  if (!steps || !steps.length) { fails++; console.log("  ✗ buildMultSteps(" + a + "," + b + ") 无步骤"); }
});
[
  ["22.4", "4"], ["7.65", "0.85"], ["3.8", "0.5"], ["16", "5"],
  ["12.6", "0.28"], ["10", "3"], ["1.69", "0.26"]
].forEach(([a, b]) => {
  const steps = api.buildDivSteps(a, b);
  total++;
  if (!steps || !steps.length) { fails++; console.log("  ✗ buildDivSteps(" + a + "," + b + ") 无步骤"); }
});

console.log("");
console.log(fails === 0
  ? "✅ 全部通过：" + total + " 项断言"
  : "❌ 失败 " + fails + " / " + total);
process.exit(fails === 0 ? 0 : 1);
