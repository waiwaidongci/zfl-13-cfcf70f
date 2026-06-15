(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory(root.TidepoolCore || require("./core.js"));
  } else {
    root.TidepoolState = factory(root.TidepoolCore);
  }
})(typeof self !== "undefined" ? self : this, function (TidepoolCore) {
  const cols = 14;
  const rows = 9;

  const INITIAL_BUDGET = 40;
  const FEEDBACK_HISTORY_MAX = 8;
  const SANDBOX_STORAGE_KEY = "tidepool_sandbox_scenarios";
  const AUTO_ADVANCE_INTERVAL = 900;

  const TOOL_COSTS = {
    rock: 3,
    kelp: 2,
    mussel: 4,
    shade: 1,
    clear: 0
  };

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

  const initialTemplate = [
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

  function createInitialGrid() {
    return initialTemplate.map((row, y) =>
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
  }

  const state = {
    cols,
    rows,
    INITIAL_BUDGET,
    FEEDBACK_HISTORY_MAX,
    SANDBOX_STORAGE_KEY,
    AUTO_ADVANCE_INTERVAL,
    TOOL_COSTS,
    CHALLENGES,
    grid: createInitialGrid(),
    tick: 0,
    day: 1,
    budget: INITIAL_BUDGET,
    activeTool: "rock",
    feedbackHistory: [],
    isAdvancing: false,
    autoTimer: null,
    currentChallenge: null,
    challengeStressCount: 0,
    challengeComplete: false,
    challengeFailed: false,
    events: []
  };

  function isAutoRunning() {
    return state.autoTimer !== null;
  }

  function setAutoButtonState(running, autoBtn) {
    if (!autoBtn) return;
    autoBtn.textContent = running ? "暂停推进" : "自动推进";
    autoBtn.setAttribute("aria-pressed", running ? "true" : "false");
    autoBtn.setAttribute("aria-label", running ? "暂停自动推进" : "启动自动推进");
    autoBtn.classList.toggle("auto-active", running);
  }

  function stopAutoAdvance(autoBtn) {
    if (state.autoTimer) {
      clearInterval(state.autoTimer);
      state.autoTimer = null;
      setAutoButtonState(false, autoBtn);
    }
  }

  function startAutoAdvance(advanceFn, autoBtn) {
    if (state.isAdvancing) return;
    if (state.challengeComplete || state.challengeFailed) return;
    if (state.autoTimer) return;
    state.autoTimer = setInterval(advanceFn, AUTO_ADVANCE_INTERVAL);
    setAutoButtonState(true, autoBtn);
  }

  function toggleAutoAdvance(advanceFn, autoBtn) {
    if (isAutoRunning()) {
      stopAutoAdvance(autoBtn);
    } else {
      startAutoAdvance(advanceFn, autoBtn);
    }
  }

  function resetSimulationState() {
    stopAutoAdvance();
    state.isAdvancing = false;
    state.tick = 0;
    state.day = 1;
    state.budget = INITIAL_BUDGET;
    state.challengeStressCount = 0;
    state.feedbackHistory = [];
    if (state.currentChallenge) {
      state.challengeComplete = false;
      state.challengeFailed = false;
    }
    const baseInitial = createInitialGrid();
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        state.grid[y][x] = { ...baseInitial[y][x] };
      }
    }
    state.events = [];
  }

  function tideLevel() {
    return TidepoolCore.tideLevel(state.tick);
  }

  function totals() {
    return TidepoolCore.totals(state.grid);
  }

  function neighbors(cell) {
    return TidepoolCore.neighbors(state.grid, cell);
  }

  function deepCloneGrid() {
    return TidepoolCore.deepCloneGrid(state.grid);
  }

  function serializeState() {
    return {
      version: 2,
      savedAt: Date.now(),
      grid: deepCloneGrid(),
      tick: state.tick,
      day: state.day,
      budget: state.budget,
      activeTool: state.activeTool,
      events: [...state.events],
      currentChallenge: state.currentChallenge ? { ...state.currentChallenge } : null,
      challengeStressCount: state.challengeStressCount,
      challengeComplete: state.challengeComplete,
      challengeFailed: state.challengeFailed,
      feedbackHistory: [...state.feedbackHistory]
    };
  }

  function deserializeState(savedState) {
    stopAutoAdvance();
    state.isAdvancing = false;

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        state.grid[y][x] = { ...savedState.grid[y][x] };
      }
    }

    state.tick = savedState.tick;
    state.day = savedState.day;
    state.budget = savedState.budget;
    state.activeTool = savedState.activeTool || "rock";
    state.challengeStressCount = savedState.challengeStressCount || 0;
    state.challengeComplete = savedState.challengeComplete || false;
    state.challengeFailed = savedState.challengeFailed || false;
    state.feedbackHistory = savedState.feedbackHistory ? [...savedState.feedbackHistory] : [];

    if (savedState.currentChallenge) {
      state.currentChallenge = { ...savedState.currentChallenge };
    } else {
      state.currentChallenge = null;
    }

    state.events = savedState.events && savedState.events.length > 0 ? [...savedState.events] : [];
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
    return String(text).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[char]
    );
  }

  function logEvent(text) {
    state.events.unshift(text);
    if (state.events.length > 5) {
      state.events = state.events.slice(0, 5);
    }
  }

  return {
    state,
    cols,
    rows,
    INITIAL_BUDGET,
    FEEDBACK_HISTORY_MAX,
    TOOL_COSTS,
    CHALLENGES,
    isAutoRunning,
    setAutoButtonState,
    stopAutoAdvance,
    startAutoAdvance,
    toggleAutoAdvance,
    resetSimulationState,
    tideLevel,
    totals,
    neighbors,
    deepCloneGrid,
    serializeState,
    deserializeState,
    getSandboxes,
    setSandboxes,
    generateId,
    escapeHtml,
    logEvent
  };
});
