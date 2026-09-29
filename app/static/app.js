"use strict";

const GATE_LABEL = { start: "起点", mid: "中途门", finish: "终点" };
const MAX_RUNNERS = 3;
const MAX_RECORDS = 40;

const DEMO = {
  runners: [
    { number: "1", seg1lo: "4", seg1hi: "6", seg2lo: "6", seg2hi: "8" },
    { number: "2", seg1lo: "3", seg1hi: "4", seg2lo: "2", seg2hi: "3" },
  ],
  // 故意乱序、含同秒备选与无法成趟的舍弃读数
  records: [
    { id: "1f-b", runner: "1", gate: "finish", second: "26" },
    { id: "2f-a", runner: "2", gate: "finish", second: "11" },
    { id: "1m-b", runner: "1", gate: "mid", second: "5" },
    { id: "1s-a", runner: "1", gate: "start", second: "0" },
    { id: "2m-b", runner: "2", gate: "mid", second: "9" },
    { id: "1f-a", runner: "1", gate: "finish", second: "12" },
    { id: "1m-a", runner: "1", gate: "mid", second: "5" },
    { id: "2s-a", runner: "2", gate: "start", second: "5" },
    { id: "1m-c", runner: "1", gate: "mid", second: "18" },
    { id: "2f-x", runner: "2", gate: "finish", second: "40" },
    { id: "1s-b", runner: "1", gate: "start", second: "13" },
    { id: "2m-a", runner: "2", gate: "mid", second: "8" },
    { id: "1s-x", runner: "1", gate: "start", second: "50" },
  ],
};

let state = structuredClone(DEMO);
let recordSeq = 0;
let reqSeq = 0;

const runnersBody = document.getElementById("runners-body");
const recordsBody = document.getElementById("records-body");
const recordCount = document.getElementById("record-count");
const errorsBox = document.getElementById("errors");
const resultsBox = document.getElementById("results");

/* ---------------- 渲染 ---------------- */

function renderRunners() {
  runnersBody.innerHTML = "";
  state.runners.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.dataset.index = i;
    tr.appendChild(numCell("number", r.number, "选手编号"));
    tr.appendChild(numCell("seg1lo", r.seg1lo, "起点→中途门下限", 1));
    tr.appendChild(numCell("seg1hi", r.seg1hi, "起点→中途门上限", 1));
    tr.appendChild(numCell("seg2lo", r.seg2lo, "中途门→终点下限", 1));
    tr.appendChild(numCell("seg2hi", r.seg2hi, "中途门→终点上限", 1));

    const td = document.createElement("td");
    td.className = "op-cell";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn small danger";
    del.textContent = "删";
    del.dataset.action = "del-runner";
    del.disabled = state.runners.length <= 1;
    td.appendChild(del);
    tr.appendChild(td);
    runnersBody.appendChild(tr);
  });
  document.getElementById("add-runner").disabled =
    state.runners.length >= MAX_RUNNERS;
}

function numCell(field, value, aria, min) {
  const td = document.createElement("td");
  const inp = document.createElement("input");
  inp.type = "number";
  inp.value = value;
  inp.min = min !== undefined ? String(min) : "1";
  inp.step = "1";
  inp.dataset.field = field;
  inp.setAttribute("aria-label", aria);
  td.appendChild(inp);
  return td;
}

function renderRecords() {
  recordsBody.innerHTML = "";
  state.records.forEach((rec, i) => {
    const tr = document.createElement("tr");
    tr.dataset.index = i;

    const tdId = document.createElement("td");
    const idInp = document.createElement("input");
    idInp.type = "text";
    idInp.value = rec.id;
    idInp.placeholder = "唯一 ID";
    idInp.dataset.field = "id";
    tdId.appendChild(idInp);
    tr.appendChild(tdId);

    const tdRunner = document.createElement("td");
    const runnerInp = document.createElement("input");
    runnerInp.type = "number";
    runnerInp.min = "1";
    runnerInp.step = "1";
    runnerInp.value = rec.runner;
    runnerInp.dataset.field = "runner";
    tdRunner.appendChild(runnerInp);
    tr.appendChild(tdRunner);

    const tdGate = document.createElement("td");
    const sel = document.createElement("select");
    sel.dataset.field = "gate";
    for (const g of ["start", "mid", "finish"]) {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = GATE_LABEL[g];
      if (rec.gate === g) opt.selected = true;
      sel.appendChild(opt);
    }
    tdGate.appendChild(sel);
    tr.appendChild(tdGate);

    const tdSec = document.createElement("td");
    const secInp = document.createElement("input");
    secInp.type = "number";
    secInp.min = "0";
    secInp.step = "1";
    secInp.value = rec.second;
    secInp.dataset.field = "second";
    tdSec.appendChild(secInp);
    tr.appendChild(tdSec);

    const tdOp = document.createElement("td");
    tdOp.className = "op-cell";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn small danger";
    del.textContent = "删";
    del.dataset.action = "del-record";
    tdOp.appendChild(del);
    tr.appendChild(tdOp);

    recordsBody.appendChild(tr);
  });
  recordCount.textContent = `当前 ${state.records.length} / ${MAX_RECORDS} 条`;
  document.getElementById("add-record").disabled =
    state.records.length >= MAX_RECORDS;
}

/* ---------------- 交互 ---------------- */

runnersBody.addEventListener("input", (e) => {
  const field = e.target.dataset.field;
  if (!field) return;
  const i = Number(e.target.closest("tr").dataset.index);
  state.runners[i][field] = e.target.value;
  scheduleJudge();
});

runnersBody.addEventListener("click", (e) => {
  if (e.target.dataset.action === "del-runner") {
    const i = Number(e.target.closest("tr").dataset.index);
    state.runners.splice(i, 1);
    renderRunners();
    scheduleJudge();
  }
});

document.getElementById("add-runner").addEventListener("click", () => {
  if (state.runners.length >= MAX_RUNNERS) return;
  state.runners.push({
    number: String(nextRunnerNumber()),
    seg1lo: "", seg1hi: "", seg2lo: "", seg2hi: "",
  });
  renderRunners();
  scheduleJudge();
});

recordsBody.addEventListener("input", (e) => {
  const field = e.target.dataset.field;
  if (!field) return;
  const i = Number(e.target.closest("tr").dataset.index);
  state.records[i][field] = e.target.value;
  scheduleJudge();
});

recordsBody.addEventListener("click", (e) => {
  if (e.target.dataset.action === "del-record") {
    const i = Number(e.target.closest("tr").dataset.index);
    state.records.splice(i, 1);
    renderRecords();
    scheduleJudge();
  }
});

document.getElementById("add-record").addEventListener("click", () => {
  if (state.records.length >= MAX_RECORDS) return;
  state.records.push({
    id: nextRecordId(),
    runner: state.runners[0] ? state.runners[0].number : "",
    gate: "start",
    second: "0",
  });
  renderRecords();
  scheduleJudge();
});

document.getElementById("clear-records").addEventListener("click", () => {
  state.records = [];
  renderRecords();
  scheduleJudge();
});

document.getElementById("load-demo").addEventListener("click", () => {
  state = structuredClone(DEMO);
  renderRunners();
  renderRecords();
  scheduleJudge();
});

document.getElementById("judge-btn").addEventListener("click", () => {
  runJudge();
});

function nextRunnerNumber() {
  const used = new Set(
    state.runners.map((r) => parseInt(r.number, 10)).filter((n) => n >= 1)
  );
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

function nextRecordId() {
  const used = new Set(state.records.map((r) => r.id));
  let candidate;
  do {
    recordSeq += 1;
    candidate = `id-${recordSeq}`;
  } while (used.has(candidate));
  return candidate;
}

/* ---------------- 裁决请求 ---------------- */

let debounceTimer = null;
function scheduleJudge() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runJudge, 300);
}

function buildPayload() {
  return {
    runners: state.runners.map((r) => ({
      number: r.number,
      seg1: { lo: r.seg1lo, hi: r.seg1hi },
      seg2: { lo: r.seg2lo, hi: r.seg2hi },
    })),
    records: state.records.map((rec) => ({
      id: rec.id,
      runner: rec.runner,
      gate: rec.gate,
      second: rec.second,
    })),
  };
}

async function runJudge() {
  const currentReq = ++reqSeq;
  let data;
  try {
    const resp = await fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    data = await resp.json();
  } catch (err) {
    if (currentReq !== reqSeq) return;
    showErrors(["无法连接裁决服务: " + err]);
    clearResults();
    return;
  }
  if (currentReq !== reqSeq) return; // 已有更新的请求, 丢弃过期响应

  if (data.ok) {
    showErrors(null);
    renderResults(data);
  } else {
    // 非法输入: 不展示任何部分结果
    showErrors(data.errors || ["裁决失败"]);
    clearResults();
  }
}

function showErrors(errors) {
  if (!errors) {
    errorsBox.classList.add("hidden");
    errorsBox.innerHTML = "";
    return;
  }
  errorsBox.innerHTML = "";
  const h = document.createElement("h3");
  h.textContent = "输入非法，未进行裁决（修正后自动重算）：";
  errorsBox.appendChild(h);
  const ul = document.createElement("ul");
  for (const msg of errors) {
    const li = document.createElement("li");
    li.textContent = msg;
    ul.appendChild(li);
  }
  errorsBox.appendChild(ul);
  errorsBox.classList.remove("hidden");
}

function clearResults() {
  resultsBox.innerHTML = "";
}

/* ---------------- 结果渲染 ---------------- */

function renderResults(data) {
  resultsBox.innerHTML = "";
  for (const r of data.runners) {
    resultsBox.appendChild(renderRunnerResult(r));
  }
}

function renderRunnerResult(r) {
  const card = document.createElement("div");
  card.className = "runner-result";

  const h3 = document.createElement("h3");
  h3.appendChild(document.createTextNode(`选手 ${r.number}`));
  const badge = document.createElement("span");
  badge.className = "badge " + (r.lap_count > 0 ? "ok" : "zero");
  badge.textContent = r.lap_count > 0 ? `${r.lap_count} 次完整计次` : "零次";
  h3.appendChild(badge);
  if (r.lap_count > 0) {
    const pill = document.createElement("span");
    pill.className = "total-pill";
    pill.textContent = `各趟用时之和 ${r.total_duration} 秒`;
    h3.appendChild(pill);
  }
  card.appendChild(h3);

  const meta = document.createElement("div");
  meta.className = "meta-line";
  meta.textContent =
    `合格耗时区间：起点→中途门 [${r.seg1.lo}, ${r.seg1.hi}] 秒；` +
    `中途门→终点 [${r.seg2.lo}, ${r.seg2.hi}] 秒`;
  card.appendChild(meta);

  if (r.lap_count === 0) {
    const note = document.createElement("div");
    note.className = "empty-note";
    note.textContent = "无完整计次（没有任何满足两段耗时与门序要求的记录组合）。";
    card.appendChild(note);
  } else {
    const list = document.createElement("div");
    list.className = "lap-list";
    for (const lap of r.laps) list.appendChild(renderLap(lap));
    card.appendChild(list);
  }

  const unused = document.createElement("div");
  unused.className = "unused";
  const title = document.createElement("div");
  title.className = "unused-title";
  title.textContent = "未采纳记录";
  unused.appendChild(title);

  if (r.unused.length === 0) {
    const note = document.createElement("div");
    note.className = "empty-note";
    note.textContent = "无（该选手的所有记录均被采纳）。";
    unused.appendChild(note);
  } else {
    const chips = document.createElement("div");
    chips.className = "chip-list";
    for (const rec of r.unused) chips.appendChild(makeChip(rec));
    unused.appendChild(chips);
  }
  card.appendChild(unused);

  return card;
}

function renderLap(lap) {
  const box = document.createElement("div");
  box.className = "lap";

  const title = document.createElement("div");
  title.className = "lap-title";
  const left = document.createElement("span");
  left.textContent = `第 ${lap.index} 趟`;
  title.appendChild(left);
  const right = document.createElement("span");
  right.textContent =
    `用时 ${lap.duration} 秒（段一 ${lap.seg1} 秒，段二 ${lap.seg2} 秒）`;
  title.appendChild(right);
  box.appendChild(title);

  const chain = document.createElement("div");
  chain.className = "lap-chain";
  chain.appendChild(makeChip(lap.start));
  chain.appendChild(segLabel(lap.seg1));
  const arrow1 = document.createElement("span");
  arrow1.className = "arrow";
  arrow1.textContent = "→";
  chain.appendChild(arrow1);
  chain.appendChild(makeChip(lap.mid));
  chain.appendChild(segLabel(lap.seg2));
  const arrow2 = document.createElement("span");
  arrow2.className = "arrow";
  arrow2.textContent = "→";
  chain.appendChild(arrow2);
  chain.appendChild(makeChip(lap.finish));
  box.appendChild(chain);

  return box;
}

function segLabel(seconds) {
  const span = document.createElement("span");
  span.className = "seg-time";
  span.textContent = `${seconds}s`;
  return span;
}

function makeChip(rec) {
  const chip = document.createElement("span");
  chip.className = "chip " + rec.gate;
  const g = document.createElement("span");
  g.className = "gate-name";
  g.textContent = GATE_LABEL[rec.gate];
  chip.appendChild(g);
  const rid = document.createElement("span");
  rid.className = "rid";
  rid.textContent = rec.id;
  chip.appendChild(rid);
  const sec = document.createElement("span");
  sec.className = "sec";
  sec.textContent = `@${rec.second}s`;
  chip.appendChild(sec);
  return chip;
}

/* ---------------- 启动 ---------------- */

renderRunners();
renderRecords();
runJudge();
