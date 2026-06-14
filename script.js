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

const cols = 14;
const rows = 9;
let activeTool = "rock";
let tick = 0;
let day = 1;
let autoTimer = null;

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

function deepCloneGrid(source) {
  return source.map((row) =>
    row.map((cell) => ({ ...cell }))
  );
}

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

function tideLevel() {
  return Math.round(50 + Math.sin(tick / 2.2) * 42);
}

function phaseName(level) {
  if (level > 78) return "满潮";
  if (level > 54) return "涨潮";
  if (level > 28) return "退潮";
  return "低潮";
}

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

function totals() {
  return grid.flat().reduce(
    (sum, cell) => {
      sum.snails += cell.snails;
      sum.crabs += cell.crabs;
      sum.mussels += cell.mussel;
      sum.stars += cell.stars;
      sum.kelp += cell.kelp ? 1 : 0;
      sum.rock += cell.rock ? 1 : 0;
      sum.shade += cell.shade ? 1 : 0;
      return sum;
    },
    { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 }
  );
}

function stabilityScore(sum) {
  const shelter = Math.min(22, sum.rock * 1.2 + sum.shade * 1.6);
  const food = Math.min(26, sum.kelp * 3 + sum.mussels * 0.8);
  const crowdPenalty = Math.max(0, sum.mussels - 28) * 1.4 + Math.max(0, sum.crabs - 12) * 2;
  const balance = 24 - Math.abs(sum.snails - sum.kelp * 3) * 0.7 - Math.abs(sum.stars * 4 - sum.mussels) * 0.42;
  return Math.max(0, Math.min(100, Math.round(28 + shelter + food + balance - crowdPenalty)));
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
}

function logEvent(text) {
  const li = document.createElement("li");
  li.textContent = text;
  eventList.prepend(li);
  while (eventList.children.length > 5) eventList.lastElementChild.remove();
}

function neighbors(cell) {
  return [
    grid[cell.y - 1]?.[cell.x],
    grid[cell.y + 1]?.[cell.x],
    grid[cell.y]?.[cell.x - 1],
    grid[cell.y]?.[cell.x + 1]
  ].filter(Boolean);
}

function advance() {
  if (challengeComplete || challengeFailed) return;
  tick += 1;
  if (tick % 2 === 0) day += 1;
  const level = tideLevel();
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

  if (currentChallenge && stress > 0) challengeStressCount += 1;

  if (phaseName(level) === "满潮") logEvent("满潮带来浮游养分，贝类扩张更快。");
  else if (stress > 0) logEvent(`低水位造成${stress}处生物压力。`);
  else if (births > 3) logEvent("海藻边缘出现新的螺类活动。");
  else logEvent(`${phaseName(level)}平稳经过。`);

  draw();
  updatePanel();
  if (currentChallenge) checkChallengeProgress();
}

function applyTool(cell) {
  if (!cell || cell.base === "water") return;
  if (activeTool === "rock") cell.rock = !cell.rock;
  if (activeTool === "kelp") cell.kelp = !cell.kelp;
  if (activeTool === "mussel") cell.mussel = cell.mussel ? 0 : 3;
  if (activeTool === "shade") cell.shade = !cell.shade;
  if (activeTool === "clear") {
    cell.rock = false;
    cell.kelp = false;
    cell.mussel = 0;
    cell.shade = false;
  }
  draw();
  updatePanel();
}

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const size = cellSize();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width / size.w);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height / size.h);
  applyTool(grid[y]?.[x]);
});

toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeTool = button.dataset.tool;
    toolButtons.forEach((item) => item.classList.toggle("active", item === button));
  });
});

document.querySelector("#advanceBtn").addEventListener("click", advance);
document.querySelector("#resetBtn").addEventListener("click", resetSimulation);
autoBtn.addEventListener("click", () => {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    autoBtn.textContent = "自动推进";
  } else {
    autoTimer = setInterval(advance, 900);
    autoBtn.textContent = "暂停推进";
  }
});

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
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    autoBtn.textContent = "自动推进";
  }
  currentChallenge = null;
  challengeComplete = false;
  challengeFailed = false;
  challengeStressCount = 0;
  challengeProgressEl.classList.add("hidden");
  hideChallengeStatus();
  resetSimulation();
}

function resetSimulation() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
    autoBtn.textContent = "自动推进";
  }
  tick = 0;
  day = 1;
  challengeStressCount = 0;
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
      if (current >= goal.target) return { state: "pass", detail: `${current}/${goal.target}` };
      if (expired) return { state: "fail", detail: `已超期（第${day}天）` };
      return { state: "active", detail: `${current}/${goal.target}（第${day}天）` };
    }
    case "range_min": {
      const current = sum.mussels;
      if (day >= goal.startDay && day <= goal.endDay) {
        if (current >= goal.target) return { state: "pass", detail: `${current}只` };
        return { state: "active", detail: `${current}只（第${day}天）` };
      }
      if (day > goal.endDay) return { state: "fail", detail: `已超期` };
      return { state: "active", detail: `${current}只（等待第${goal.startDay}天）` };
    }
    case "range_max": {
      const current = sum.mussels;
      if (day >= goal.startDay && day <= goal.endDay) {
        if (current <= goal.target) return { state: "pass", detail: `${current}只` };
        return { state: "fail", detail: `${current}只（超出）` };
      }
      if (day > goal.endDay) return { state: "pass", detail: `已维持` };
      return { state: "active", detail: `${current}只（等待第${goal.startDay}天）` };
    }
    case "max_count": {
      const current = challengeStressCount;
      const expired = day > goal.deadline;
      if (current > goal.target) return { state: "fail", detail: `${current}/${goal.target}` };
      if (expired) return { state: "pass", detail: `已通过（${current}次）` };
      return { state: "active", detail: `${current}/${goal.target}（第${day}天）` };
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
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
      autoBtn.textContent = "自动推进";
    }
  } else if (allPass) {
    challengeComplete = true;
    showChallengeStatus("success", "挑战成功！生态管理出色。");
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
      autoBtn.textContent = "自动推进";
    }
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

logEvent("潮汐池进入初始观察。");
draw();
updatePanel();
