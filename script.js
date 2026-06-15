const canvas = document.querySelector("#poolCanvas");
const ctx = canvas.getContext("2d");
const toolButtons = [...document.querySelectorAll(".tool")];
const eventList = document.querySelector("#eventList");
const stabilityEl = document.querySelector("#stability");
const stabilityBar = document.querySelector("#stabilityBar");
const tideLabel = document.querySelector("#tideLabel");
const phaseLabel = document.querySelector("#phaseLabel");
const dayLabel = document.querySelector("#dayLabel");
const tideNeedle = document.querySelector("#tideNeedle");
const autoBtn = document.querySelector("#autoBtn");
const challengeBtn = document.querySelector("#challengeBtn");
const challengeModal = document.querySelector("#challengeModal");
const closeChallengeBtn = document.querySelector("#closeChallengeBtn");
const challengeListEl = document.querySelector("#challengeList");
const challengeProgressEl = document.querySelector("#challengeProgress");
const challengeTitleEl = document.querySelector("#challengeTitle");
const challengeDescEl = document.querySelector("#challengeDesc");
const challengeGoalsEl = document.querySelector("#challengeGoals");
const quitChallengeBtn = document.querySelector("#quitChallengeBtn");
const challengeStatusEl = document.querySelector("#challengeStatus");
const statusIconEl = document.querySelector("#statusIcon");
const statusTextEl = document.querySelector("#statusText");
const budgetEl = document.querySelector("#budget");
const budgetBar = document.querySelector("#budgetBar");
const budgetTipEl = document.querySelector("#budgetTip");
const sandboxBtn = document.querySelector("#sandboxBtn");
const sandboxModal = document.querySelector("#sandboxModal");
const closeSandboxBtn = document.querySelector("#closeSandboxBtn");
const sandboxNameInput = document.querySelector("#sandboxNameInput");
const saveSandboxBtn = document.querySelector("#saveSandboxBtn");
const sandboxListEl = document.querySelector("#sandboxList");
const sandboxEmptyEl = document.querySelector("#sandboxEmpty");
const deltaIndicatorEl = document.querySelector("#deltaIndicator");
const deltaArrowEl = document.querySelector("#deltaArrow");
const deltaValueEl = document.querySelector("#deltaValue");
const feedbackSummaryEl = document.querySelector("#feedbackSummary");
const feedbackImpactsEl = document.querySelector("#feedbackImpacts");
const feedbackHistoryListEl = document.querySelector("#feedbackHistoryList");

const SANDBOX_STORAGE_KEY = "tidepool_sandbox_scenarios";

const cols = 14;
const rows = 9;
let activeTool = "rock";
let tick = 0;
let day = 1;
let autoTimer = null;
let isAdvancing = false;

const AUTO_ADVANCE_INTERVAL = 900;

function isAutoRunning() {
  return autoTimer !== null;
}

function setAutoButtonState(running) {
  autoBtn.textContent = running ? "暂停推进" : "自动推进";
  autoBtn.setAttribute("aria-pressed", running ? "true" : "false");
  autoBtn.setAttribute("aria-label", running ? "暂停自动推进" : "启动自动推进");
  autoBtn.classList.toggle("auto-active", running);
}

function stopAutoAdvance() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    setAutoButtonState(false);
  }
}

function startAutoAdvance() {
  if (isAdvancing) return;
  if (challengeComplete || challengeFailed) return;
  if (autoTimer) return;
  autoTimer = setInterval(advance, AUTO_ADVANCE_INTERVAL);
  setAutoButtonState(true);
}

function toggleAutoAdvance() {
  if (isAutoRunning()) {
    stopAutoAdvance();
  } else {
    startAutoAdvance();
  }
}

const TOOL_COSTS = {
  rock: 3,
  kelp: 2,
  mussel: 4,
  shade: 1,
  clear: 0
};

const INITIAL_BUDGET = 40;
let budget = INITIAL_BUDGET;

const CHALLENGES = [
  {
    id: "stability_80_by_day6",
    title: "稳定守护者",
    desc: "在第6天结束前，将生态稳定度维持在80以上。",
    goals: [
      {
        id: "stability",
        label: "生态稳定度 ≥ 80",
        type: "threshold",
        target: 80,
        deadline: 6
      }
    ]
  },
  {
    id: "mussel_range",
    title: "贝类平衡师",
    desc: "在第5天到第8天期间，贝类数量保持在18~28之间。",
    goals: [
      {
        id: "mussel_min",
        label: "贝类数量 ≥ 18（第5-8天）",
        type: "range_min",
        target: 18,
        startDay: 5,
        endDay: 8
      },
      {
        id: "mussel_max",
        label: "贝类数量 ≤ 28（第5-8天）",
        type: "range_max",
        target: 28,
        startDay: 5,
        endDay: 8
      }
    ]
  },
  {
    id: "low_tide_resilience",
    title: "低潮抗压",
    desc: "在10天内，避免低潮压力事件累计不超过6次。",
    goals: [
      {
        id: "stress_count",
        label: "低潮压力次数 ≤ 6",
        type: "max_count",
        target: 6,
        deadline: 10
      }
    ]
  }
];

let currentChallenge = null;
let initialState = null;
let challengeStressCount = 0;
let challengeComplete = false;
let challengeFailed = false;

const deepCloneGrid = TidepoolCore.deepCloneGrid;
const tideLevel = () => TidepoolCore.tideLevel(tick);
const phaseName = TidepoolCore.phaseName;
const totals = () => TidepoolCore.totals(grid);
const stabilityScore = TidepoolCore.stabilityScore;
const stabilityComponents = TidepoolCore.stabilityComponents;
const explainStabilityChange = TidepoolCore.explainStabilityChange;
const neighbors = (cell) => TidepoolCore.neighbors(grid, cell);

let feedbackHistory = [];
const FEEDBACK_HISTORY_MAX = 8;

const initial = [
  "wwwwwwwwwwwwww",
  "wwsrrrsssrrsww",
  "wsrkkssmssrrww",
  "wssrksrrrsssww",
  "wrrsssskkssrww",
  "wssmrrssskswww",
  "wwssrsssrrswww",
  "wwwrssmssswwww",
  "wwwwwwwwwwwwww"
];

const grid = initial.map((row, y) =>
  [...row].map((char, x) => ({
    x,
    y,
    base: char === "w" ? "water" : char === "r" ? "rock" : "sand",
    rock: char === "r",
    kelp: char === "k",
    mussel: char === "m" ? 3 : 0,
    shade: false,
    snails: x % 5 === 0 && y % 2 === 0 ? 2 : 0,
    crabs: x % 7 === 0 && y % 3 === 0 ? 1 : 0,
    stars: x === 10 && y === 4 ? 1 : 0
  }))
);

function cellSize() {
  return {
    w: canvas.width / cols,
    h: canvas.height / rows
  };
}

function drawCell(cell, w, h, level) {
  const x = cell.x * w;
  const y = cell.y * h;
  const wet = cell.base === "water" || level > 68 - cell.y * 4;
  ctx.fillStyle = wet ? "#76b8c2" : "#d8c69b";
  ctx.fillRect(x, y, w + 1, h + 1);

  if (cell.rock) {
    ctx.fillStyle = "#6d6c62";
    rounded(x + w * 0.18, y + h * 0.2, w * 0.64, h * 0.5, 12);
    ctx.fill();
  }

  if (cell.shade) {
    ctx.fillStyle = "rgba(35, 52, 49, 0.24)";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.52, y + h * 0.4, w * 0.38, h * 0.24, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (cell.kelp) {
    ctx.strokeStyle = "#4f7e3a";
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + w * (0.34 + i * 0.12), y + h * 0.78);
      ctx.quadraticCurveTo(x + w * (0.22 + i * 0.16), y + h * 0.45, x + w * (0.38 + i * 0.13), y + h * 0.18);
      ctx.stroke();
    }
  }

  if (cell.mussel) {
    for (let i = 0; i < cell.mussel; i += 1) {
      ctx.fillStyle = "#344b64";
      ctx.beginPath();
      ctx.ellipse(x + w * (0.32 + i * 0.14), y + h * 0.65, w * 0.08, h * 0.12, -0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawAnimals(cell, x, y, w, h);

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.strokeRect(x, y, w, h);
}

function drawAnimals(cell, x, y, w, h) {
  for (let i = 0; i < Math.min(cell.snails, 4); i += 1) {
    ctx.fillStyle = "#d9a14d";
    ctx.beginPath();
    ctx.arc(x + w * (0.2 + i * 0.16), y + h * 0.36, w * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < Math.min(cell.crabs, 3); i += 1) {
    ctx.fillStyle = "#c86556";
    ctx.fillRect(x + w * (0.55 + i * 0.11), y + h * 0.36, w * 0.09, h * 0.07);
  }

  if (cell.stars) {
    ctx.fillStyle = "#b5647a";
    star(x + w * 0.74, y + h * 0.72, w * 0.13, 5);
  }
}

function rounded(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
}

function star(cx, cy, radius, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + i * Math.PI / points;
    const r = i % 2 ? radius * 0.42 : radius;
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
}

function draw() {
  const level = tideLevel();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  grid.flat().forEach((cell) => drawCell(cell, canvas.width / cols, canvas.height / rows, level));
  ctx.fillStyle = `rgba(37, 91, 107, ${0.18 + level / 420})`;
  ctx.fillRect(0, canvas.height * (1 - level / 100), canvas.width, canvas.height);
}

function updatePanel() {
  const level = tideLevel();
  const sum = totals();
  const score = stabilityScore(sum);
  stabilityEl.textContent = score;
  stabilityBar.style.width = `${score}%`;
  tideLabel.textContent = `${level}%`;
  tideNeedle.style.transform = `rotate(${level * 2.7 - 135}deg)`;
  phaseLabel.textContent = phaseName(level);
  dayLabel.textContent = `第${day}天`;
  document.querySelector("#snails").textContent = sum.snails;
  document.querySelector("#crabs").textContent = sum.crabs;
  document.querySelector("#mussels").textContent = sum.mussels;
  document.querySelector("#stars").textContent = sum.stars;
  budgetEl.textContent = budget;
  const budgetPercent = Math.max(0, Math.min(100, (budget / INITIAL_BUDGET) * 100));
  budgetBar.style.width = `${budgetPercent}%`;
  budgetBar.parentElement.classList.toggle("budget-low", budget < 10);
}

function renderDeltaIndicator(netDelta) {
  deltaIndicatorEl.classList.remove("delta-positive", "delta-negative", "delta-neutral");
  if (netDelta > 0) {
    deltaIndicatorEl.classList.add("delta-positive");
    deltaArrowEl.textContent = "▲";
    deltaValueEl.textContent = `+${netDelta}`;
  } else if (netDelta < 0) {
    deltaIndicatorEl.classList.add("delta-negative");
    deltaArrowEl.textContent = "▼";
    deltaValueEl.textContent = `${netDelta}`;
  } else {
    deltaIndicatorEl.classList.add("delta-neutral");
    deltaArrowEl.textContent = "—";
    deltaValueEl.textContent = "0";
  }
}

function renderImpacts(impacts) {
  feedbackImpactsEl.innerHTML = "";
  if (!impacts || impacts.length === 0) {
    const empty = document.createElement("span");
    empty.className = "impact-empty";
    empty.textContent = "本轮暂无显著影响因素";
    feedbackImpactsEl.appendChild(empty);
    return;
  }
  impacts.forEach((impact) => {
    const tag = document.createElement("span");
    tag.className = `impact-tag impact-${impact.id}`;
    const strengthDots = Array.from({ length: 3 }, (_, i) =>
      `<span class="${i < impact.strength ? "active" : ""}"></span>`
    ).join("");
    const deltaText = impact.delta > 0 ? `+${impact.delta}` : `${impact.delta}`;
    tag.innerHTML = `
      <span class="impact-label">${impact.label}</span>
      <span class="impact-strength">${strengthDots}</span>
      <span class="impact-delta">${deltaText}</span>
    `;
    feedbackImpactsEl.appendChild(tag);
  });
}

function renderFeedbackSummary(netDelta, summary) {
  feedbackSummaryEl.classList.remove("summary-positive", "summary-negative", "summary-neutral");
  if (netDelta > 0) feedbackSummaryEl.classList.add("summary-positive");
  else if (netDelta < 0) feedbackSummaryEl.classList.add("summary-negative");
  else feedbackSummaryEl.classList.add("summary-neutral");
  feedbackSummaryEl.textContent = summary;
}

function renderFeedbackHistory() {
  feedbackHistoryListEl.innerHTML = "";
  if (feedbackHistory.length === 0) {
    const li = document.createElement("li");
    li.className = "history-empty";
    li.textContent = "暂无历史记录";
    feedbackHistoryListEl.appendChild(li);
    return;
  }
  feedbackHistory.forEach((entry) => {
    const li = document.createElement("li");
    const cardClass = entry.netDelta > 0 ? "card-positive" : entry.netDelta < 0 ? "card-negative" : "card-neutral";
    li.className = `history-card ${cardClass}`;

    const deltaClass = entry.netDelta > 0 ? "delta-up" : entry.netDelta < 0 ? "delta-down" : "delta-flat";
    const deltaText = entry.netDelta > 0 ? `+${entry.netDelta}` : entry.netDelta < 0 ? `${entry.netDelta}` : "±0";

    const causeTags = (entry.impactLabels || []).map((lbl) => {
      const found = entry.impacts.find((im) => im.label === lbl);
      const polarity = found ? found.polarity : "neutral";
      const causeClass = polarity === "positive" ? "cause-positive" : polarity === "negative" ? "cause-negative" : "cause-neutral";
      return `<span class="history-cause ${causeClass}">${lbl}</span>`;
    }).join("");

    li.innerHTML = `
      <div class="history-head">
        <span class="history-day">${entry.dayLabel}</span>
        <span class="history-phase">${entry.phaseName}</span>
      </div>
      <div class="history-scoreline">
        <span class="history-score">${entry.currScore}</span>
        <span class="history-delta ${deltaClass}">${deltaText}</span>
      </div>
      <div class="history-causes">${causeTags || '<span class="history-cause">平稳过渡</span>'}</div>
    `;
    feedbackHistoryListEl.appendChild(li);
  });
}

function updateFeedbackPanel(explainResult, dayNum, phase, levelValue) {
  if (!explainResult) {
    deltaIndicatorEl.classList.remove("delta-positive", "delta-negative");
    deltaIndicatorEl.classList.add("delta-neutral");
    deltaArrowEl.textContent = "—";
    deltaValueEl.textContent = "0";
    feedbackSummaryEl.classList.remove("summary-positive", "summary-negative");
    feedbackSummaryEl.classList.add("summary-neutral");
    feedbackSummaryEl.textContent = "等待推进观察...";
    renderImpacts([]);
    renderFeedbackHistory();
    return;
  }
  renderDeltaIndicator(explainResult.netDelta);
  renderFeedbackSummary(explainResult.netDelta, explainResult.summary);
  renderImpacts(explainResult.impacts);

  const historyEntry = {
    dayNum,
    dayLabel: `第${dayNum}天`,
    phaseName: phase,
    tideLevel: levelValue,
    netDelta: explainResult.netDelta,
    prevScore: explainResult.prevScore,
    currScore: explainResult.currScore,
    summary: explainResult.summary,
    impacts: explainResult.impacts.map((i) => ({
      id: i.id,
      label: i.label,
      polarity: i.polarity,
      strength: i.strength,
      delta: i.delta
    })),
    impactLabels: explainResult.impacts.map((i) => i.label)
  };
  feedbackHistory.unshift(historyEntry);
  if (feedbackHistory.length > FEEDBACK_HISTORY_MAX) {
    feedbackHistory = feedbackHistory.slice(0, FEEDBACK_HISTORY_MAX);
  }
  renderFeedbackHistory();
}

function logEvent(text) {
  const li = document.createElement("li");
  li.textContent = text;
  eventList.prepend(li);
  while (eventList.children.length > 5) eventList.lastElementChild.remove();
}

let budgetTipTimer = null;
function showBudgetTip(text, type = "warn") {
  budgetTipEl.textContent = text;
  budgetTipEl.className = `budget-tip budget-${type}`;
  budgetTipEl.classList.remove("hidden");
  if (budgetTipTimer) clearTimeout(budgetTipTimer);
  budgetTipTimer = setTimeout(() => {
    budgetTipEl.classList.add("hidden");
  }, 1800);
}

function advance() {
  if (isAdvancing) return;
  if (challengeComplete || challengeFailed) return;
  isAdvancing = true;
  try {
  const prevSum = totals();
  tick += 1;
  if (tick % 2 === 0) day += 1;
  const level = tideLevel();
  const currentPhase = phaseName(level);
  let births = 0;
  let stress = 0;

  grid.flat().forEach((cell) => {
    const wet = cell.base === "water" || level > 68 - cell.y * 4;
    const kelpNearby = neighbors(cell).some((n) => n.kelp);
    const shelter = cell.rock || cell.shade || neighbors(cell).some((n) => n.rock);

    if (cell.kelp && wet && Math.random() < 0.23) {
      const target = neighbors(cell).find((n) => !n.kelp && !n.rock && Math.random() < 0.4);
      if (target) target.kelp = true;
    }

    if (kelpNearby && wet && shelter && Math.random() < 0.3) {
      cell.snails = Math.min(6, cell.snails + 1);
      births += 1;
    }

    if (cell.mussel && wet && Math.random() < 0.22) cell.mussel = Math.min(6, cell.mussel + 1);
    if (cell.crabs && cell.snails > 0 && Math.random() < 0.44) cell.snails -= 1;
    if (cell.stars && cell.mussel > 0 && Math.random() < 0.55) cell.mussel -= 1;

    if (!wet && !cell.shade && !cell.rock) {
      if (cell.snails && Math.random() < 0.34) {
        cell.snails -= 1;
        stress += 1;
      }
      if (cell.mussel && Math.random() < 0.18) cell.mussel -= 1;
    }

    if (cell.mussel > 4 && Math.random() < 0.12) cell.stars = Math.min(2, cell.stars + 1);
    if (cell.snails > 3 && shelter && Math.random() < 0.1) cell.crabs = Math.min(3, cell.crabs + 1);
  });

  const currSum = totals();
  const explain = explainStabilityChange(prevSum, currSum, level);

  if (currentChallenge && stress > 0) challengeStressCount += 1;

  if (currentPhase === "满潮") logEvent("满潮带来浮游养分，贝类扩张更快。");
  else if (stress > 0) logEvent(`低水位造成${stress}处生物压力。`);
  else if (births > 3) logEvent("海藻边缘出现新的螺类活动。");
  else logEvent(`${currentPhase}平稳经过。`);

  draw();
  updatePanel();
  updateFeedbackPanel(explain, day, currentPhase, level);
  if (currentChallenge) checkChallengeProgress();
  } finally {
    isAdvancing = false;
  }
}

function applyTool(cell) {
  if (!cell || cell.base === "water") return;

  const cost = TOOL_COSTS[activeTool];

  if (activeTool === "clear") {
    const hadRock = cell.rock;
    const hadKelp = cell.kelp;
    const hadMussel = cell.mussel > 0;
    const hadShade = cell.shade;
    if (!hadRock && !hadKelp && !hadMussel && !hadShade) return;

    let refund = 0;
    if (hadRock) refund += TOOL_COSTS.rock;
    if (hadKelp) refund += TOOL_COSTS.kelp;
    if (hadMussel) refund += TOOL_COSTS.mussel;
    if (hadShade) refund += TOOL_COSTS.shade;
    budget += refund;

    cell.rock = false;
    cell.kelp = false;
    cell.mussel = 0;
    cell.shade = false;
    showBudgetTip(`清理回收 +${refund} 预算`, "gain");
  } else if (activeTool === "rock") {
    if (!cell.rock) {
      if (budget < cost) {
        showBudgetTip(`预算不足！放置岩缝需要 ${cost}`);
        return;
      }
      budget -= cost;
      cell.rock = true;
      showBudgetTip(`放置岩缝 -${cost}`, "spend");
    } else {
      cell.rock = false;
      budget += cost;
      showBudgetTip(`移除岩缝 +${cost}`, "gain");
    }
  } else if (activeTool === "kelp") {
    if (!cell.kelp) {
      if (budget < cost) {
        showBudgetTip(`预算不足！放置海藻需要 ${cost}`);
        return;
      }
      budget -= cost;
      cell.kelp = true;
      showBudgetTip(`放置海藻 -${cost}`, "spend");
    } else {
      cell.kelp = false;
      budget += cost;
      showBudgetTip(`移除海藻 +${cost}`, "gain");
    }
  } else if (activeTool === "mussel") {
    if (cell.mussel === 0) {
      if (budget < cost) {
        showBudgetTip(`预算不足！放置贝群需要 ${cost}`);
        return;
      }
      budget -= cost;
      cell.mussel = 3;
      showBudgetTip(`放置贝群 -${cost}`, "spend");
    } else {
      cell.mussel = 0;
      budget += cost;
      showBudgetTip(`移除贝群 +${cost}`, "gain");
    }
  } else if (activeTool === "shade") {
    if (!cell.shade) {
      if (budget < cost) {
        showBudgetTip(`预算不足！放置遮阴需要 ${cost}`);
        return;
      }
      budget -= cost;
      cell.shade = true;
      showBudgetTip(`放置遮阴 -${cost}`, "spend");
    } else {
      cell.shade = false;
      budget += cost;
      showBudgetTip(`移除遮阴 +${cost}`, "gain");
    }
  }

  draw();
  updatePanel();
}

function getCanvasCoords(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  return { x, y };
}

canvas.addEventListener("click", (event) => {
  const { x, y } = getCanvasCoords(event);
  const size = cellSize();
  const cellX = Math.floor(x / size.w);
  const cellY = Math.floor(y / size.h);
  applyTool(grid[cellY]?.[cellX]);
});

let resizeTimeout = null;
window.addEventListener("resize", () => {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    draw();
  }, 100);
});

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeTool = button.dataset.tool;
    toolButtons.forEach((item) => item.classList.toggle("active", item === button));
  });
});

document.querySelector("#advanceBtn").addEventListener("click", advance);
document.querySelector("#resetBtn").addEventListener("click", resetSimulation);
autoBtn.addEventListener("click", toggleAutoAdvance);

challengeBtn.addEventListener("click", openChallengeModal);
closeChallengeBtn.addEventListener("click", closeChallengeModal);
quitChallengeBtn.addEventListener("click", quitChallenge);
challengeModal.addEventListener("click", (e) => {
  if (e.target === challengeModal) closeChallengeModal();
});

function renderChallengeList() {
  challengeListEl.innerHTML = "";
  CHALLENGES.forEach((ch) => {
    const card = document.createElement("button");
    card.className = "challenge-card";
    card.innerHTML = `
      <h3>${ch.title}</h3>
      <p>${ch.desc}</p>
      <ul>
        ${ch.goals.map((g) => `<li>${g.label}</li>`).join("")}
      </ul>
      <span class="start-btn">开始挑战</span>
    `;
    card.addEventListener("click", () => startChallenge(ch));
    challengeListEl.appendChild(card);
  });
}

function openChallengeModal() {
  if (currentChallenge) return;
  renderChallengeList();
  challengeModal.classList.remove("hidden");
}

function closeChallengeModal() {
  challengeModal.classList.add("hidden");
}

function startChallenge(challenge) {
  currentChallenge = challenge;
  challengeComplete = false;
  challengeFailed = false;
  challengeStressCount = 0;
  closeChallengeModal();
  hideChallengeStatus();
  challengeProgressEl.classList.remove("hidden");
  challengeTitleEl.textContent = challenge.title;
  challengeDescEl.textContent = challenge.desc;
  resetSimulation();
  renderChallengeGoals();
}

function quitChallenge() {
  stopAutoAdvance();
  currentChallenge = null;
  challengeComplete = false;
  challengeFailed = false;
  challengeStressCount = 0;
  challengeProgressEl.classList.add("hidden");
  hideChallengeStatus();
  resetSimulation();
}

function resetSimulation() {
  stopAutoAdvance();
  isAdvancing = false;
  tick = 0;
  day = 1;
  budget = INITIAL_BUDGET;
  challengeStressCount = 0;
  feedbackHistory = [];
  if (currentChallenge) {
    challengeComplete = false;
    challengeFailed = false;
  }
  const baseInitial = initial.map((row, y) =>
    [...row].map((char, x) => ({
      x,
      y,
      base: char === "w" ? "water" : char === "r" ? "rock" : "sand",
      rock: char === "r",
      kelp: char === "k",
      mussel: char === "m" ? 3 : 0,
      shade: false,
      snails: x % 5 === 0 && y % 2 === 0 ? 2 : 0,
      crabs: x % 7 === 0 && y % 3 === 0 ? 1 : 0,
      stars: x === 10 && y === 4 ? 1 : 0
    }))
  );
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      grid[y][x] = { ...baseInitial[y][x] };
    }
  }
  eventList.innerHTML = "";
  hideChallengeStatus();
  logEvent("潮汐池进入初始观察。");
  draw();
  updatePanel();
  updateFeedbackPanel(null, day, phaseName(tideLevel()), tideLevel());
  if (currentChallenge) renderChallengeGoals();
}

function renderChallengeGoals() {
  challengeGoalsEl.innerHTML = "";
  const sum = totals();
  const score = stabilityScore(sum);
  currentChallenge.goals.forEach((goal) => {
    const li = document.createElement("li");
    const status = evaluateGoal(goal, sum, score);
    li.className = `goal-item goal-${status.state}`;
    li.innerHTML = `
      <span class="goal-icon">${status.state === "pass" ? "✓" : status.state === "fail" ? "✗" : "○"}</span>
      <span class="goal-text">${goal.label}</span>
      <span class="goal-value">${status.detail}</span>
    `;
    challengeGoalsEl.appendChild(li);
  });
}

function evaluateGoal(goal, sum, score) {
  switch (goal.type) {
    case "threshold": {
      const current = score;
      const expired = day > goal.deadline;
      if (current < goal.target) return { state: "fail", detail: `${current}/${goal.target}（第${day}天低于目标）` };
      if (expired) {
        return { state: "pass", detail: `维持至第${goal.deadline}天：${current}/${goal.target}` };
      }
      return { state: "active", detail: `当前达标 ${current}/${goal.target}（待第${goal.deadline}天验证）` };
    }
    case "range_min": {
      const current = sum.mussels;
      if (day >= goal.startDay && day <= goal.endDay) {
        if (current < goal.target) return { state: "fail", detail: `${current}只跌破下限${goal.target}（第${day}天）` };
        return { state: "active", detail: `${current}只，维持中（第${day}天/第${goal.endDay}天）` };
      }
      if (day > goal.endDay) return { state: "pass", detail: `第${goal.startDay}-${goal.endDay}天维持达标` };
      return { state: "active", detail: `${current}只（等待第${goal.startDay}天）` };
    }
    case "range_max": {
      const current = sum.mussels;
      if (day >= goal.startDay && day <= goal.endDay) {
        if (current > goal.target) return { state: "fail", detail: `${current}只超出上限${goal.target}（第${day}天）` };
        return { state: "active", detail: `${current}只，维持中（第${day}天/第${goal.endDay}天）` };
      }
      if (day > goal.endDay) return { state: "pass", detail: `第${goal.startDay}-${goal.endDay}天未超限` };
      return { state: "active", detail: `${current}只（等待第${goal.startDay}天）` };
    }
    case "max_count": {
      const current = challengeStressCount;
      const expired = day > goal.deadline;
      if (current > goal.target) return { state: "fail", detail: `${current}/${goal.target}（已超限）` };
      if (expired) return { state: "pass", detail: `10天内共${current}次（≤${goal.target}）` };
      return { state: "active", detail: `${current}/${goal.target}（第${day}天/第${goal.deadline}天）` };
    }
    default:
      return { state: "active", detail: "" };
  }
}

function checkChallengeProgress() {
  if (!currentChallenge || challengeComplete || challengeFailed) return;
  const sum = totals();
  const score = stabilityScore(sum);
  renderChallengeGoals();

  const results = currentChallenge.goals.map((g) => evaluateGoal(g, sum, score));
  const allPass = results.every((r) => r.state === "pass");
  const anyFail = results.some((r) => r.state === "fail");

  if (anyFail) {
    challengeFailed = true;
    showChallengeStatus("fail", "挑战失败！点击重置再试一次。");
    stopAutoAdvance();
  } else if (allPass) {
    challengeComplete = true;
    showChallengeStatus("success", "挑战成功！生态管理出色。");
    stopAutoAdvance();
  }
}

function showChallengeStatus(type, text) {
  challengeStatusEl.className = `challenge-status status-${type}`;
  statusIconEl.textContent = type === "success" ? "🏆" : "💧";
  statusTextEl.textContent = text;
}

function hideChallengeStatus() {
  challengeStatusEl.classList.add("hidden");
}

function serializeState() {
  const events = [];
  const items = eventList.querySelectorAll("li");
  items.forEach((li) => events.push(li.textContent));

  return {
    version: 2,
    savedAt: Date.now(),
    grid: deepCloneGrid(grid),
    tick,
    day,
    budget,
    activeTool,
    events,
    currentChallenge: currentChallenge ? { ...currentChallenge } : null,
    challengeStressCount,
    challengeComplete,
    challengeFailed,
    feedbackHistory: [...feedbackHistory]
  };
}

function deserializeState(state) {
  stopAutoAdvance();
  isAdvancing = false;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      grid[y][x] = { ...state.grid[y][x] };
    }
  }

  tick = state.tick;
  day = state.day;
  budget = state.budget;
  activeTool = state.activeTool || "rock";
  challengeStressCount = state.challengeStressCount || 0;
  challengeComplete = state.challengeComplete || false;
  challengeFailed = state.challengeFailed || false;
  feedbackHistory = state.feedbackHistory ? [...state.feedbackHistory] : [];

  if (state.currentChallenge) {
    currentChallenge = { ...state.currentChallenge };
    challengeProgressEl.classList.remove("hidden");
    challengeTitleEl.textContent = currentChallenge.title;
    challengeDescEl.textContent = currentChallenge.desc;
  } else {
    currentChallenge = null;
    challengeProgressEl.classList.add("hidden");
  }

  toolButtons.forEach((item) => {
    item.classList.toggle("active", item.dataset.tool === activeTool);
  });

  eventList.innerHTML = "";
  if (state.events && state.events.length > 0) {
    state.events.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      eventList.appendChild(li);
    });
  }

  draw();
  updatePanel();
  renderFeedbackHistory();
  if (feedbackHistory.length > 0) {
    const latest = feedbackHistory[0];
    renderDeltaIndicator(latest.netDelta);
    renderFeedbackSummary(latest.netDelta, latest.summary);
    renderImpacts(latest.impacts);
  } else {
    updateFeedbackPanel(null, day, phaseName(tideLevel()), tideLevel());
  }
  if (currentChallenge) renderChallengeGoals();
  if (challengeComplete) showChallengeStatus("success", "挑战成功！生态管理出色。");
  else if (challengeFailed) showChallengeStatus("fail", "挑战失败！点击重置再试一次。");
  else hideChallengeStatus();
}

function getSandboxes() {
  try {
    const raw = localStorage.getItem(SANDBOX_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setSandboxes(list) {
  localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(list));
}

function generateId() {
  return "sb_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function saveSandbox(name) {
  const trimmed = name.trim();
  if (!trimmed) {
    showBudgetTip("请输入方案名称", "warn");
    return false;
  }

  stopAutoAdvance();

  const state = serializeState();
  const sandboxes = getSandboxes();
  const existingIndex = sandboxes.findIndex((s) => s.name === trimmed);

  if (existingIndex >= 0) {
    sandboxes[existingIndex] = {
      ...sandboxes[existingIndex],
      state,
      updatedAt: Date.now()
    };
    showBudgetTip(`已覆盖方案「${trimmed}」`, "gain");
  } else {
    sandboxes.unshift({
      id: generateId(),
      name: trimmed,
      state,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    showBudgetTip(`已保存方案「${trimmed}」`, "gain");
  }

  setSandboxes(sandboxes);
  renderSandboxList();
  return true;
}

function loadSandbox(id) {
  const sandboxes = getSandboxes();
  const sandbox = sandboxes.find((s) => s.id === id);
  if (!sandbox) {
    showBudgetTip("方案不存在", "warn");
    return false;
  }

  deserializeState(sandbox.state);
  showBudgetTip(`已加载方案「${sandbox.name}」`, "gain");
  return true;
}

function deleteSandbox(id) {
  const sandboxes = getSandboxes();
  const sandbox = sandboxes.find((s) => s.id === id);
  if (!sandbox) return;

  const confirmed = confirm(`确定要删除方案「${sandbox.name}」吗？`);
  if (!confirmed) return;

  const filtered = sandboxes.filter((s) => s.id !== id);
  setSandboxes(filtered);
  renderSandboxList();
  showBudgetTip(`已删除方案「${sandbox.name}」`, "spend");
}

function renderSandboxList() {
  const sandboxes = getSandboxes();
  sandboxListEl.innerHTML = "";

  if (sandboxes.length === 0) {
    sandboxEmptyEl.classList.remove("hidden");
    return;
  }

  sandboxEmptyEl.classList.add("hidden");

  sandboxes.forEach((sb) => {
    const card = document.createElement("div");
    card.className = "sandbox-card";

    const sum = TidepoolCore.totals(sb.state.grid);
    const score = TidepoolCore.stabilityScore(sum);
    const date = new Date(sb.updatedAt);
    const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    const safeName = escapeHtml(sb.name);

    card.innerHTML = `
      <div class="sandbox-card-head">
        <h4 class="sandbox-card-name">${safeName}</h4>
        <span class="sandbox-card-date">${dateStr}</span>
      </div>
      <div class="sandbox-card-meta">
        <span>第${sb.state.day}天</span>
        <span>稳定度 ${score}</span>
        <span>螺 ${sum.snails} · 蟹 ${sum.crabs} · 贝 ${sum.mussels} · 星 ${sum.stars}</span>
      </div>
      <div class="sandbox-card-actions">
        <button class="sandbox-load-btn" data-id="${sb.id}">加载</button>
        <button class="sandbox-overwrite-btn" data-id="${sb.id}">覆盖</button>
        <button class="sandbox-delete-btn" data-id="${sb.id}">删除</button>
      </div>
    `;

    card.querySelector(".sandbox-load-btn").addEventListener("click", () => {
      loadSandbox(sb.id);
      closeSandboxModal();
    });

    card.querySelector(".sandbox-overwrite-btn").addEventListener("click", () => {
      stopAutoAdvance();
      const state = serializeState();
      const list = getSandboxes();
      const idx = list.findIndex((s) => s.id === sb.id);
      if (idx >= 0) {
        list[idx].state = state;
        list[idx].updatedAt = Date.now();
        setSandboxes(list);
        renderSandboxList();
        showBudgetTip(`已覆盖方案「${sb.name}」`, "gain");
      }
    });

    card.querySelector(".sandbox-delete-btn").addEventListener("click", () => {
      deleteSandbox(sb.id);
    });

    sandboxListEl.appendChild(card);
  });
}

function openSandboxModal() {
  stopAutoAdvance();
  renderSandboxList();
  sandboxNameInput.value = "";
  sandboxModal.classList.remove("hidden");
  setTimeout(() => sandboxNameInput.focus(), 100);
}

function closeSandboxModal() {
  sandboxModal.classList.add("hidden");
}

sandboxBtn.addEventListener("click", openSandboxModal);
closeSandboxBtn.addEventListener("click", closeSandboxModal);
sandboxModal.addEventListener("click", (e) => {
  if (e.target === sandboxModal) closeSandboxModal();
});

saveSandboxBtn.addEventListener("click", () => {
  const name = sandboxNameInput.value.trim();
  if (saveSandbox(name)) {
    sandboxNameInput.value = "";
  }
});

sandboxNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const name = sandboxNameInput.value.trim();
    if (saveSandbox(name)) {
      sandboxNameInput.value = "";
    }
  }
});

logEvent("潮汐池进入初始观察。");
draw();
updatePanel();
updateFeedbackPanel(null, day, phaseName(tideLevel()), tideLevel());
setAutoButtonState(false);

window.addEventListener("beforeunload", () => {
  stopAutoAdvance();
});
