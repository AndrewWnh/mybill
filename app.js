"use strict";

// ---------- 默认配置 ----------
const DEFAULT_EXPENSE_CATS = ["餐饮", "交通", "购物", "娱乐", "居住", "医疗", "教育", "其他"];
const DEFAULT_INCOME_CATS = ["工资", "奖金", "理财", "兼职", "其他"];
const DEFAULT_ACCOUNTS = [
  { name: "微信", init: 0 },
  { name: "支付宝", init: 0 },
  { name: "现金", init: 0 },
  { name: "银行卡", init: 0 },
];

const KEY = "mybill_records";
const KEY_EXP_CAT = "mybill_cat_expense";
const KEY_INC_CAT = "mybill_cat_income";
const KEY_ACCOUNTS = "mybill_platforms";
const KEY_BACKED = "mybill_backed_pids";
const KEY_DD_SIZE = "mybill_ui_ddsize";

let records = load();
let expCats = loadArr(KEY_EXP_CAT, DEFAULT_EXPENSE_CATS);
let incCats = loadArr(KEY_INC_CAT, DEFAULT_INCOME_CATS);
let accounts = loadAccounts();
let backedPids = loadArr(KEY_BACKED, []);
let ddSize = loadDdSize();

// 当前选中项
let uiType = "支出";
let uiAccount = null;
let uiCat = null;
let uiFilterType = "全部";
let uiFilterCat = "全部";
let uiStRange = "本月";
let uiStPeriod = "按月";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(records));
  renderAll();
}
function loadArr(key, def) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return def.slice();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : def.slice();
  } catch (e) { return def.slice(); }
}
function saveArr(key, arr) { localStorage.setItem(key, JSON.stringify(arr)); }
function loadAccounts() {
  try {
    const raw = localStorage.getItem(KEY_ACCOUNTS);
    if (!raw) return DEFAULT_ACCOUNTS.map(a => ({ name: a.name, init: a.init }));
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return DEFAULT_ACCOUNTS.map(a => ({ name: a.name, init: a.init }));
    return arr.map(a => (typeof a === "string" ? { name: a, init: 0 } : { name: a.name, init: Number(a.init) || 0 }));
  } catch (e) { return DEFAULT_ACCOUNTS.map(a => ({ name: a.name, init: a.init })); }
}
function saveAccounts() {
  saveArr(KEY_ACCOUNTS, accounts);
  fillAccountSelect();
  renderAccountList();
  renderAccountSummary();
  renderHeader();
}
function saveCats() {
  saveArr(KEY_EXP_CAT, expCats);
  saveArr(KEY_INC_CAT, incCats);
  fillCatSelect();
  renderFilterCats();
  renderFilterType();
  renderCatSettings();
}
function saveBacked() { saveArr(KEY_BACKED, backedPids); }

function genPid() { return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8); }
function todayISO() { return iso(new Date()); }
function iso(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}
function thisMonth() { return todayISO().slice(0, 7); }
function fmt(n) {
  return "¥" + Number(n || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 1800);
}

// ---------- 通用下拉框（点击后在字段下方展开选项） ----------
const DDS = {};
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function initDD() {
  document.querySelectorAll(".dd").forEach((el) => {
    const name = el.id;
    DDS[name] = {
      el,
      valueEl: el.querySelector(".dd-value"),
      panel: el.querySelector(".dd-panel"),
      value: "",
      onChange: null,
    };
    const trigger = el.querySelector(".dd-trigger");
    if (trigger) trigger.addEventListener("click", (e) => { e.stopPropagation(); toggleDD(name); });
    el.addEventListener("click", (e) => {
      const opt = e.target.closest(".dd-opt");
      if (!opt) return;
      setDDValue(name, opt.dataset.v);
    });
  });
  document.addEventListener("click", () => {
    document.querySelectorAll(".dd.open").forEach((dd) => dd.classList.remove("open"));
  });
}
function toggleDD(name) {
  const dd = DDS[name];
  if (!dd) return;
  const wasOpen = dd.el.classList.contains("open");
  document.querySelectorAll(".dd.open").forEach((x) => x.classList.remove("open"));
  if (!wasOpen) dd.el.classList.add("open");
}
function setDDOptions(name, options) {
  const dd = DDS[name];
  if (!dd) return;
  dd.value = options[0] || "";
  dd.panel.innerHTML = options.map((o) =>
    `<button type="button" class="dd-opt" data-v="${escapeHtml(o)}">${escapeHtml(o)}</button>`
  ).join("");
  syncDDValue(name);
}
function applyDDValue(name, value) {
  const dd = DDS[name];
  if (!dd) return;
  dd.value = value;
  syncDDValue(name);
}
function setDDValue(name, value) {
  const dd = DDS[name];
  if (!dd) return;
  dd.value = value;
  syncDDValue(name);
  dd.el.classList.remove("open");
  if (dd.onChange) dd.onChange(value);
}
function setDDOnChange(name, cb) { if (DDS[name]) DDS[name].onChange = cb; }
function getDDValue(name) { return DDS[name] ? DDS[name].value : ""; }
function syncDDValue(name) {
  const dd = DDS[name];
  if (!dd) return;
  dd.valueEl.textContent = dd.value;
  dd.panel.querySelectorAll(".dd-opt").forEach((o) => o.classList.toggle("selected", o.dataset.v === dd.value));
}

// ---------- 下拉选项卡大小 ----------
function loadDdSize() {
  const v = localStorage.getItem(KEY_DD_SIZE);
  return ["s", "m", "l"].includes(v) ? v : "m";
}
function saveDdSize() {
  localStorage.setItem(KEY_DD_SIZE, ddSize);
  applyDdSize();
}
function applyDdSize() {
  document.body.dataset.dd = ddSize;
  const seg = document.getElementById("dd-size-seg");
  if (seg) seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.s === ddSize));
}

function addRecord(d) { records.unshift(d); save(); }
function deleteRecord(pid) { records = records.filter((r) => r.pid !== pid); save(); }

function accountBalance(name) {
  const acc = accounts.find((a) => a.name === name);
  const init = acc ? (acc.init || 0) : 0;
  let net = 0;
  records.forEach((r) => { if (r.platform === name) net += (r.type === "支出" ? -1 : 1) * (r.amount || 0); });
  return init + net;
}
function totalBalance() {
  let init = accounts.reduce((s, a) => s + (a.init || 0), 0);
  let net = records.reduce((s, r) => s + (r.type === "支出" ? -1 : 1) * (r.amount || 0), 0);
  return init + net;
}

function selectedAccount() {
  if (uiAccount && accounts.some((a) => a.name === uiAccount)) return uiAccount;
  uiAccount = accounts[0] ? accounts[0].name : "";
  return uiAccount;
}
function selectedCat() {
  const list = uiType === "支出" ? expCats : incCats;
  if (uiCat && list.includes(uiCat)) return uiCat;
  uiCat = list[0] || "";
  return uiCat;
}
function validCat(cat) { return (expCats.includes(cat) || incCats.includes(cat)) ? cat : "其他"; }

function renderHeader() {
  const el = document.getElementById("header-balance");
  if (el) el.textContent = "总余额 " + fmt(totalBalance());
  const spend = records.filter((r) => r.type === "支出" && r.date.slice(0, 7) === thisMonth()).reduce((s, r) => s + r.amount, 0);
  document.getElementById("month-label").textContent = new Date().getMonth() + 1 + " 月支出";
  document.getElementById("month-spend").textContent = fmt(spend);
}

function fillAccountSelect() {
  uiAccount = selectedAccount();
  setDDOptions("f-account", accounts.map((a) => a.name));
  applyDDValue("f-account", uiAccount);
  updateAccountBalanceLine();
}
function updateAccountBalanceLine() {
  const el = document.getElementById("account-balance");
  if (el) el.textContent = fmt(accountBalance(uiAccount));
}
function fillCatSelect() {
  const list = uiType === "支出" ? expCats : incCats;
  if (!list.includes(uiCat)) uiCat = list[0] || "";
  setDDOptions("f-cat", list);
  applyDDValue("f-cat", uiCat);
}
function renderFilterType() {
  setDDOptions("s-type", ["全部", "支出", "收入"]);
  applyDDValue("s-type", uiFilterType);
}
function renderFilterCats() {
  setDDOptions("s-cat", ["全部"].concat(expCats).concat(incCats));
  applyDDValue("s-cat", uiFilterCat);
}
function renderStRange() {
  setDDOptions("st-range", ["本月", "近 3 月", "今年", "全部"]);
  applyDDValue("st-range", uiStRange);
}
function renderStPeriod() {
  setDDOptions("st-period", ["按日", "按周", "按月", "按年"]);
  applyDDValue("st-period", uiStPeriod);
}

function listItemHtml(r) {
  const sign = r.type === "支出" ? "-" : "+";
  const cls = r.type === "支出" ? "expense" : "income";
  const plat = r.platform ? `<span class="pill">${r.platform}</span>` : "";
  return `<div class="list-item">
    <div class="main">
      <div class="cat">${r.category} ${plat} <span class="muted">${r.date}</span></div>
      ${r.note ? `<div class="note">${r.note}</div>` : ""}
    </div>
    <div class="amount ${cls}">${sign}${fmt(r.amount)}</div>
    <button class="del" data-pid="${r.pid}">×</button>
  </div>`;
}
function renderRecent() {
  const el = document.getElementById("recent-list");
  const items = records.slice(0, 5);
  el.innerHTML = items.length ? items.map(listItemHtml).join("") : '<div class="muted">还没有记录。</div>';
}
function renderAccountSummary() {
  const el = document.getElementById("account-summary");
  if (!el) return;
  if (!accounts.length) { el.innerHTML = '<div class="muted">请先在设置里添加账户。</div>'; return; }
  el.innerHTML = accounts.map((a) => {
    const bal = accountBalance(a.name);
    return `<div class="platform-chip"><div class="p">${a.name}</div><div class="b ${bal < 0 ? "expense" : "income"}">${fmt(bal)}</div></div>`;
  }).join("");
}

function filteredList() {
  const month = document.getElementById("s-month").value;
  return records.filter((r) => {
    if (month && r.date.slice(0, 7) !== month) return false;
    if (uiFilterType !== "全部" && r.type !== uiFilterType) return false;
    if (uiFilterCat !== "全部" && r.category !== uiFilterCat) return false;
    return true;
  });
}
function renderList() {
  const list = filteredList();
  const total = list.filter((r) => r.type === "支出").reduce((s, r) => s + r.amount, 0);
  document.getElementById("list-total").textContent = `明细（${list.length} 笔 · 支出 ${fmt(total)}）`;
  const body = document.getElementById("list-body");
  body.innerHTML = list.length ? list.map(listItemHtml).join("") : '<div class="muted">这个范围内没有记录。</div>';
}

function inRange(dateStr, range) {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (range === "本月") return d.getFullYear() === y && d.getMonth() === m;
  if (range === "近 3 月") return d >= new Date(y, m - 2, 1);
  if (range === "今年") return d.getFullYear() === y;
  return true;
}
function mondayOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  return iso(d);
}
function periodKey(dateStr, period) {
  if (period === "按日") return dateStr;
  if (period === "按周") return mondayOf(dateStr);
  if (period === "按月") return dateStr.slice(0, 7);
  return dateStr.slice(0, 4);
}
function groupSpend(filtered, period) {
  const map = {};
  filtered.forEach((r) => {
    const k = periodKey(r.date, period);
    map[k] = (map[k] || 0) + r.amount;
  });
  return Object.keys(map).sort().map((k) => ({ label: k, total: map[k] }));
}

let trendChart = null, catChart = null;
function renderStats() {
  const all = records.filter((r) => inRange(r.date, uiStRange));
  const spend = all.filter((r) => r.type === "支出");
  const total = spend.reduce((s, r) => s + r.amount, 0);
  const count = spend.length;
  const avg = count ? total / count : 0;
  const max = count ? Math.max(...spend.map((r) => r.amount)) : 0;
  document.getElementById("stats-metrics").innerHTML =
    `<div class="m"><div class="v expense">${fmt(total)}</div><div class="l">总支出</div></div>` +
    `<div class="m"><div class="v">${count}</div><div class="l">笔数</div></div>` +
    `<div class="m"><div class="v">${fmt(avg)}</div><div class="l">平均</div></div>` +
    `<div class="m"><div class="v">${fmt(max)}</div><div class="l">最高</div></div>`;

  const trend = groupSpend(spend, uiStPeriod);
  const tLabels = trend.map((t) => t.label);
  const tData = trend.map((t) => t.total);
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById("trend-chart"), {
    type: "bar",
    data: { labels: tLabels, datasets: [{ label: "支出", data: tData, backgroundColor: "rgba(11,154,110,.7)" }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  });

  const catMap = {};
  spend.forEach((r) => (catMap[r.category] = (catMap[r.category] || 0) + r.amount));
  const cLabels = Object.keys(catMap);
  const cData = cLabels.map((c) => catMap[c]);
  if (catChart) catChart.destroy();
  catChart = new Chart(document.getElementById("cat-chart"), {
    type: "doughnut",
    data: { labels: cLabels, datasets: [{ data: cData, backgroundColor: ["#0b9a6e", "#4f8ef7", "#f2a93b", "#e5484d", "#8b5cf6", "#22b8cf", "#94a3b8", "#f472b6"] }] },
    options: { maintainAspectRatio: false, cutout: "55%", plugins: { legend: { position: "bottom" } } },
  });
}

function renderSyncBackup() {
  document.getElementById("rec-count").textContent = records.length;
  const backed = records.filter((r) => backedPids.includes(r.pid)).length;
  const next = records.length - backed;
  document.getElementById("backup-status").textContent = `已备份 ${backed}/${records.length} 笔${next > 0 ? ` · 下次备份将新增 ${next} 笔` : ""}`;
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function shareOrDownload(file) {
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: "记账数据" }).then(() => toast("已生成文件")).catch(() => { downloadBlob(file, file.name); toast("已下载文件"); });
  } else {
    downloadBlob(file, file.name);
    toast("已下载文件");
  }
}
function buildWorkbook() {
  const detail = records.map((r) => ({
    "日期": r.date, "类型": r.type, "账户": r.platform || "", "分类": r.category, "金额": r.amount, "备注": r.note, "pid": r.pid,
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(detail);
  ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 26 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, "明细");
  const catMap = {};
  records.forEach((r) => { if (r.type === "支出") catMap[r.category] = (catMap[r.category] || 0) + r.amount; });
  const summary = Object.keys(catMap).map((c) => ({ "分类": c, "金额": catMap[c] })).sort((a, b) => b["金额"] - a["金额"]);
  const ws2 = XLSX.utils.json_to_sheet(summary);
  ws2["!cols"] = [{ wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, "汇总");
  return wb;
}
function exportIncremental() {
  const delta = records.filter((r) => !backedPids.includes(r.pid));
  if (!delta.length) { toast("没有新记录需要备份"); return; }
  const blob = new Blob([JSON.stringify(delta, null, 2)], { type: "application/json" });
  const file = new File([blob], "记账备份_增量_" + todayISO() + ".json", { type: "application/json" });
  shareOrDownload(file);
  backedPids = records.map((r) => r.pid);
  saveBacked();
  renderSyncBackup();
}
function exportFullJson() {
  if (!records.length) { toast("还没有记录"); return; }
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  downloadBlob(blob, "记账完整备份_" + todayISO() + ".json");
}
function exportXlsx() {
  if (!records.length) { toast("还没有记录"); return; }
  XLSX.writeFile(buildWorkbook(), "记账报表_" + todayISO() + ".xlsx");
}
function importBackupFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let arr;
    try {
      const parsed = JSON.parse(reader.result);
      arr = Array.isArray(parsed) ? parsed : (parsed && parsed.records) || [];
    } catch (e) { toast("备份文件格式不正确"); return; }
    if (!arr.length) { toast("备份里没有记录"); return; }
    const ids = new Set(records.map((r) => r.pid));
    let added = 0;
    arr.forEach((r) => {
      const pid = r.pid || genPid();
      if (ids.has(pid)) return;
      ids.add(pid);
      records.push({
        pid,
        date: String(r.date || "").slice(0, 10),
        type: r.type === "收入" ? "收入" : "支出",
        platform: r.platform || "",
        category: validCat(r.category),
        amount: Number(r.amount) || 0,
        note: r.note || "",
        created_at: r.created_at || new Date().toISOString(),
      });
      added++;
    });
    save();
    toast(added ? `已导入 ${added} 条记录` : "备份与现有记录一致，没有新增");
  };
  reader.readAsText(file);
}

function renderAll() {
  renderHeader();
  renderRecent();
  renderList();
  renderStats();
  renderSyncBackup();
  fillAccountSelect();
  fillCatSelect();
  renderFilterType();
  renderFilterCats();
  renderStRange();
  renderStPeriod();
  renderAccountSummary();
  renderAccountList();
  renderCatSettings();
}

function openSubpage(id) {
  document.getElementById("settings-home").hidden = true;
  document.querySelectorAll(".subpage").forEach((s) => (s.hidden = true));
  const el = document.getElementById(id);
  if (el) el.hidden = false;
  if (id === "set-accounts") renderAccountList();
  if (id === "set-cats") renderCatSettings();
  if (id === "set-sync") renderSyncBackup();
  if (id === "set-ui") applyDdSize();
}
function closeSubpage() {
  document.querySelectorAll(".subpage").forEach((s) => (s.hidden = true));
  const home = document.getElementById("settings-home");
  if (home) home.hidden = false;
}
function renderAccountList() {
  const el = document.getElementById("account-list");
  if (!el) return;
  el.innerHTML = accounts.map((a) => `<div class="cat-row">
    <div class="acct-info"><span class="acct-name">${a.name}</span><span class="muted">初始 ¥${Number(a.init || 0).toLocaleString("zh-CN")} · 当前 ${fmt(accountBalance(a.name))}</span></div>
    <button class="del" data-account="${a.name}">×</button>
  </div>`).join("");
}
function renderCatSettings() {
  const e = document.getElementById("exp-cat-list");
  if (e) e.innerHTML = expCats.map((c, i) => `<div class="cat-row"><span>${c}</span><button class="del" data-type="expense" data-i="${i}">×</button></div>`).join("");
  const n = document.getElementById("inc-cat-list");
  if (n) n.innerHTML = incCats.map((c, i) => `<div class="cat-row"><span>${c}</span><button class="del" data-type="income" data-i="${i}">×</button></div>`).join("");
}
function addAccount() {
  const name = document.getElementById("new-account").value.trim();
  if (!name) { toast("请输入账户名称"); return; }
  if (accounts.some((a) => a.name === name)) { toast("这个账户已存在"); return; }
  let init = 0;
  const v = document.getElementById("new-account-init").value;
  if (v !== "") init = Number(v);
  if (isNaN(init)) { toast("初始余额格式不正确"); return; }
  accounts.push({ name, init });
  saveAccounts();
  renderAll();
  document.getElementById("new-account").value = "";
  document.getElementById("new-account-init").value = "";
  toast("已添加账户");
}
function deleteAccount(name) {
  if (accounts.length <= 1) { toast("至少保留一个账户"); return; }
  accounts = accounts.filter((a) => a.name !== name);
  saveAccounts();
  renderAll();
  toast("已删除账户");
}
function addCat(type) {
  const id = type === "支出" ? "new-exp-cat" : "new-inc-cat";
  const input = document.getElementById(id);
  const v = input.value.trim();
  if (!v) { toast("请输入分类名称"); return; }
  const list = type === "支出" ? expCats : incCats;
  if (list.includes(v)) { toast("这个分类已存在"); return; }
  list.push(v);
  saveCats();
  renderAll();
  input.value = "";
  toast(type === "支出" ? "已添加支出分类" : "已添加收入分类");
}
function deleteCat(type, i) {
  const list = type === "支出" ? expCats : incCats;
  if (list.length <= 1) { toast("至少保留一个分类"); return; }
  list.splice(i, 1);
  saveCats();
  renderAll();
  toast("已删除分类");
}

function bindEvents() {
  document.getElementById("f-date").value = todayISO();
  document.getElementById("s-month").value = thisMonth();

  document.querySelectorAll("#f-type button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#f-type button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      uiType = b.dataset.t;
      uiCat = null;
      fillCatSelect();
    });
  });

  setDDOnChange("f-account", (v) => { uiAccount = v; updateAccountBalanceLine(); });
  setDDOnChange("f-cat", (v) => { uiCat = v; });

  document.getElementById("add-btn").addEventListener("click", () => {
    const amount = parseFloat(document.getElementById("f-amount").value);
    if (!(amount > 0)) { toast("请输入大于 0 的金额"); return; }
    addRecord({
      pid: genPid(),
      date: document.getElementById("f-date").value || todayISO(),
      type: uiType,
      platform: selectedAccount(),
      category: selectedCat(),
      amount: Math.round(amount * 100) / 100,
      note: document.getElementById("f-note").value.trim(),
      created_at: new Date().toISOString(),
    });
    document.getElementById("f-amount").value = "";
    document.getElementById("f-note").value = "";
    toast("已添加");
  });

  document.getElementById("s-month").addEventListener("change", renderList);
  setDDOnChange("s-type", (v) => { uiFilterType = v; renderList(); });
  setDDOnChange("s-cat", (v) => { uiFilterCat = v; renderList(); });

  setDDOnChange("st-range", (v) => { uiStRange = v; renderStats(); });
  setDDOnChange("st-period", (v) => { uiStPeriod = v; renderStats(); });

  document.getElementById("list-body").addEventListener("click", (e) => {
    const b = e.target.closest(".del");
    if (!b) return;
    if (confirm("删除这条记录？")) { deleteRecord(b.dataset.pid); toast("已删除"); }
  });

  document.getElementById("inc-backup-btn").addEventListener("click", exportIncremental);
  document.getElementById("full-backup-btn").addEventListener("click", exportFullJson);
  document.getElementById("dl-xlsx-btn").addEventListener("click", exportXlsx);
  document.getElementById("restore-btn").addEventListener("click", () => {
    const input = document.getElementById("restore-file");
    input.value = "";
    input.click();
  });
  document.getElementById("restore-file").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importBackupFile(f);
    e.target.value = "";
  });
  document.getElementById("clear-btn").addEventListener("click", () => {
    if (confirm("确定清空本机所有记录？")) { records = []; save(); toast("已清空"); }
  });

  document.querySelector(".bottomnav").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    document.querySelectorAll(".bottomnav button").forEach((x) => x.classList.remove("on"));
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
    btn.classList.add("on");
    document.getElementById(btn.dataset.tab).classList.add("on");
    if (btn.dataset.tab === "tab-settings") closeSubpage();
  });

  document.querySelectorAll("#settings-home .menu-item").forEach((mi) => {
    mi.addEventListener("click", () => openSubpage(mi.dataset.sub));
  });
  document.querySelectorAll(".subpage .back-btn").forEach((b) => b.addEventListener("click", closeSubpage));
  document.getElementById("dd-size-seg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-s]");
    if (!b || b.dataset.s === ddSize) return;
    ddSize = b.dataset.s;
    saveDdSize();
    toast("已调整下拉选项卡大小");
  });

  document.getElementById("add-account-btn").addEventListener("click", addAccount);
  document.getElementById("account-list").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-account]");
    if (b) deleteAccount(b.dataset.account);
  });

  document.getElementById("add-exp-cat-btn").addEventListener("click", () => addCat("支出"));
  document.getElementById("add-inc-cat-btn").addEventListener("click", () => addCat("收入"));
  document.getElementById("exp-cat-list").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-type='expense']");
    if (b) deleteCat("支出", +b.dataset.i);
  });
  document.getElementById("inc-cat-list").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-type='income']");
    if (b) deleteCat("收入", +b.dataset.i);
  });
}

const isLocalHost = location.hostname === "localhost" || location.hostname === "127.0.0.1" || /^\d+\.\d+\.\d+\.\d+$/.test(location.hostname);
if ("serviceWorker" in navigator && !isLocalHost) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

initDD();
applyDdSize();
bindEvents();
renderAll();
