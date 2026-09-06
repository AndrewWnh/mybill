"use strict";

// ---------- 分类 ----------
const EXPENSE_CATS = ["餐饮", "交通", "购物", "娱乐", "居住", "医疗", "教育", "其他"];
const INCOME_CATS = ["工资", "奖金", "理财", "兼职", "其他"];

// ---------- 数据存储（手机本地） ----------
const KEY = "mybill_records";
let records = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(records));
  renderSummary();
}

function genPid() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
function todayISO() {
  return iso(new Date());
}
function iso(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}
function thisMonth() {
  return todayISO().slice(0, 7);
}
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

// ---------- 操作 ----------
function addRecord(d) {
  records.unshift(d);
  save();
}
function deleteRecord(pid) {
  records = records.filter((r) => r.pid !== pid);
  save();
}

function currentType() {
  return document.querySelector("#f-type button.on").dataset.t;
}
function fillCatSelect() {
  const sel = document.getElementById("f-cat");
  const cats = currentType() === "支出" ? EXPENSE_CATS : INCOME_CATS;
  sel.innerHTML = cats.map((c) => `<option>${c}</option>`).join("");
}
function fillFilterCat() {
  const sel = document.getElementById("s-cat");
  sel.innerHTML = '<option>全部</option>' + EXPENSE_CATS.concat(INCOME_CATS).map((c) => `<option>${c}</option>`).join("");
}

// ---------- 渲染 ----------
function renderSummary() {
  const now = new Date();
  const ym = thisMonth();
  let spend = 0;
  records.forEach((r) => {
    if (r.type === "支出" && r.date.slice(0, 7) === ym) spend += r.amount;
  });
  document.getElementById("month-label").textContent = now.getMonth() + 1 + " 月支出";
  document.getElementById("month-spend").textContent = fmt(spend);
}

function listItemHtml(r) {
  const sign = r.type === "支出" ? "-" : "+";
  const cls = r.type === "支出" ? "expense" : "income";
  return `<div class="list-item">
    <div class="main">
      <div class="cat">${r.category} <span class="muted">${r.date}</span></div>
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

function renderList() {
  const month = document.getElementById("s-month").value;
  const type = document.getElementById("s-type").value;
  const cat = document.getElementById("s-cat").value;
  let list = records.filter((r) => {
    if (month && r.date.slice(0, 7) !== month) return false;
    if (type !== "全部" && r.type !== type) return false;
    if (cat !== "全部" && r.category !== cat) return false;
    return true;
  });
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
  if (range === "近 3 月") {
    const cutoff = new Date(y, m - 2, 1);
    return d >= cutoff;
  }
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
  if (period === "日") return dateStr;
  if (period === "周") return mondayOf(dateStr);
  if (period === "月") return dateStr.slice(0, 7);
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
  const range = document.getElementById("st-range").value;
  const period = document.getElementById("st-period").value;
  const all = records.filter((r) => inRange(r.date, range));
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

  const trend = groupSpend(spend, period);
  const tLabels = trend.map((t) => t.label);
  const tData = trend.map((t) => t.total);

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById("trend-chart"), {
    type: "bar",
    data: {
      labels: tLabels,
      datasets: [{ label: "支出", data: tData, backgroundColor: "rgba(11,154,110,.7)" }],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
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

function renderSync() {
  document.getElementById("rec-count").textContent = records.length;
  document.getElementById("pc-url").textContent = "提示：同步不要求电脑在线，等你连上电脑热点再发送文件即可。";
}

function renderAll() {
  renderSummary();
  renderRecent();
  renderList();
  renderStats();
  renderSync();
  fillFilterCat();
}

// ---------- Excel / 文件 ----------
function buildWorkbook() {
  const detail = records.map((r) => ({
    "日期": r.date, "类型": r.type, "分类": r.category, "金额": r.amount, "备注": r.note, "pid": r.pid,
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(detail);
  ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 26 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, "明细");

  const catMap = {};
  records.forEach((r) => {
    if (r.type === "支出") catMap[r.category] = (catMap[r.category] || 0) + r.amount;
  });
  const summary = Object.keys(catMap).map((c) => ({ "分类": c, "金额": catMap[c] })).sort((a, b) => b["金额"] - a["金额"]);
  const ws2 = XLSX.utils.json_to_sheet(summary);
  ws2["!cols"] = [{ wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, "汇总");
  return wb;
}

function xlsxBlob(wb) {
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

function importBackupFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let arr;
    try {
      const parsed = JSON.parse(reader.result);
      arr = Array.isArray(parsed) ? parsed : (parsed && parsed.records) || [];
    } catch (e) {
      toast("备份文件格式不正确");
      return;
    }
    if (!arr.length) { toast("备份里没有记录"); return; }
    const ids = new Set(records.map((r) => r.pid));
    let added = 0;
    arr.forEach((r) => {
      const pid = r.pid || genPid();
      if (ids.has(pid)) return;
      ids.add(pid);
      records.push({
        pid: pid,
        date: String(r.date || "").slice(0, 10),
        type: r.type === "收入" ? "收入" : "支出",
        category: r.category || "其他",
        amount: Number(r.amount) || 0,
        note: r.note || "",
        created_at: r.created_at || new Date().toISOString(),
      });
      added++;
    });
    save();
    toast(added ? `已导入 ${added} 条记录` : "备份与现有记录一致，没有新增");
    renderAll();
  };
  reader.readAsText(file);
}

function shareToPc() {
  if (records.length === 0) { toast("还没有记录可发送"); return; }
  const wb = buildWorkbook();
  const file = new File([xlsxBlob(wb)], "记账_" + todayISO() + ".xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: "记账数据" }).then(() => toast("已生成文件")).catch(() => {
      downloadBlob(file, file.name);
      toast("已下载文件，请发送到电脑");
    });
  } else {
    downloadBlob(file, file.name);
    toast("已下载文件，请发送到电脑");
  }
}

// ---------- 事件 ----------
function bindEvents() {
  document.getElementById("f-date").value = todayISO();
  document.getElementById("s-month").value = thisMonth();
  fillCatSelect();

  document.querySelectorAll("#f-type button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#f-type button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      fillCatSelect();
    });
  });

  document.getElementById("add-btn").addEventListener("click", () => {
    const amount = parseFloat(document.getElementById("f-amount").value);
    if (!(amount > 0)) { toast("请输入大于 0 的金额"); return; }
    addRecord({
      pid: genPid(),
      date: document.getElementById("f-date").value || todayISO(),
      type: currentType(),
      category: document.getElementById("f-cat").value,
      amount: Math.round(amount * 100) / 100,
      note: document.getElementById("f-note").value.trim(),
      created_at: new Date().toISOString(),
    });
    document.getElementById("f-amount").value = "";
    document.getElementById("f-note").value = "";
    toast("已添加");
    renderAll();
  });

  document.querySelector(".bottomnav").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    document.querySelectorAll(".bottomnav button").forEach((x) => x.classList.remove("on"));
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
    btn.classList.add("on");
    document.getElementById(btn.dataset.tab).classList.add("on");
  });

  ["s-month", "s-type", "s-cat"].forEach((id) => document.getElementById(id).addEventListener("change", renderList));
  ["st-range", "st-period"].forEach((id) => document.getElementById(id).addEventListener("change", renderStats));

  document.getElementById("list-body").addEventListener("click", (e) => {
    const btn = e.target.closest(".del");
    if (!btn) return;
    if (confirm("删除这条记录？")) { deleteRecord(btn.dataset.pid); toast("已删除"); renderAll(); }
  });

  document.getElementById("share-btn").addEventListener("click", shareToPc);
  document.getElementById("download-btn").addEventListener("click", () => {
    if (!records.length) { toast("还没有记录"); return; }
    XLSX.writeFile(buildWorkbook(), "记账_" + todayISO() + ".xlsx");
  });
  document.getElementById("json-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    downloadBlob(blob, "记账备份_" + todayISO() + ".json");
  });
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
    if (confirm("确定清空本机所有记录？")) { records = []; save(); toast("已清空"); renderAll(); }
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

bindEvents();
renderAll();
