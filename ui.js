(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory(
      root.TidepoolCore || require("./core.js"),
      root.TidepoolState || require("./state.js"),
      root.TidepoolEcosystem || require("./ecosystem.js"),
      root.TidepoolRenderer || require("./renderer.js")
    );
  } else {
    root.TidepoolUI = factory(
      root.TidepoolCore,
      root.TidepoolState,
      root.TidepoolEcosystem,
      root.TidepoolRenderer
    );
  }
})(typeof self !== "undefined" ? self : this, function (TidepoolCore, TidepoolState, TidepoolEcosystem, TidepoolRenderer) {
  const {
    state,
    INITIAL_BUDGET,
    CHALLENGES,
    setAutoButtonState,
    stopAutoAdvance,
    startAutoAdvance,
    toggleAutoAdvance,
    resetSimulationState,
    tideLevel,
    totals,
    serializeState,
    deserializeState,
    getSandboxes,
    setSandboxes,
    generateId,
    escapeHtml,
    logEvent
  } = TidepoolState;

  const {
    applyTool,
    advance,
    startChallenge,
    quitChallenge,
    getChallengeGoalsStatus
  } = TidepoolEcosystem;

  const phaseName = TidepoolCore.phaseName;
  const stabilityScore = TidepoolCore.stabilityScore;

  let refs = null;
  let renderer = null;
  let budgetTipTimer = null;

  function initRefs() {
    refs = {
      canvas: document.querySelector("#poolCanvas"),
      toolButtons: [...document.querySelectorAll(".tool")],
      eventList: document.querySelector("#eventList"),
      stabilityEl: document.querySelector("#stability"),
      stabilityBar: document.querySelector("#stabilityBar"),
      tideLabel: document.querySelector("#tideLabel"),
      phaseLabel: document.querySelector("#phaseLabel"),
      dayLabel: document.querySelector("#dayLabel"),
      tideNeedle: document.querySelector("#tideNeedle"),
      autoBtn: document.querySelector("#autoBtn"),
      challengeBtn: document.querySelector("#challengeBtn"),
      challengeModal: document.querySelector("#challengeModal"),
      closeChallengeBtn: document.querySelector("#closeChallengeBtn"),
      challengeListEl: document.querySelector("#challengeList"),
      challengeProgressEl: document.querySelector("#challengeProgress"),
      challengeTitleEl: document.querySelector("#challengeTitle"),
      challengeDescEl: document.querySelector("#challengeDesc"),
      challengeGoalsEl: document.querySelector("#challengeGoals"),
      quitChallengeBtn: document.querySelector("#quitChallengeBtn"),
      challengeStatusEl: document.querySelector("#challengeStatus"),
      statusIconEl: document.querySelector("#statusIcon"),
      statusTextEl: document.querySelector("#statusText"),
      budgetEl: document.querySelector("#budget"),
      budgetBar: document.querySelector("#budgetBar"),
      budgetTipEl: document.querySelector("#budgetTip"),
      sandboxBtn: document.querySelector("#sandboxBtn"),
      sandboxModal: document.querySelector("#sandboxModal"),
      closeSandboxBtn: document.querySelector("#closeSandboxBtn"),
      sandboxNameInput: document.querySelector("#sandboxNameInput"),
      saveSandboxBtn: document.querySelector("#saveSandboxBtn"),
      sandboxListEl: document.querySelector("#sandboxList"),
      sandboxEmptyEl: document.querySelector("#sandboxEmpty"),
      deltaIndicatorEl: document.querySelector("#deltaIndicator"),
      deltaArrowEl: document.querySelector("#deltaArrow"),
      deltaValueEl: document.querySelector("#deltaValue"),
      feedbackSummaryEl: document.querySelector("#feedbackSummary"),
      feedbackImpactsEl: document.querySelector("#feedbackImpacts"),
      feedbackHistoryListEl: document.querySelector("#feedbackHistoryList"),
      advanceBtn: document.querySelector("#advanceBtn"),
      resetBtn: document.querySelector("#resetBtn")
    };
  }

  function initRenderer() {
    renderer = TidepoolRenderer.createRenderer(refs.canvas);
  }

  function showBudgetTip(text, type = "warn") {
    refs.budgetTipEl.textContent = text;
    refs.budgetTipEl.className = `budget-tip budget-${type}`;
    refs.budgetTipEl.classList.remove("hidden");
    if (budgetTipTimer) clearTimeout(budgetTipTimer);
    budgetTipTimer = setTimeout(() => {
      refs.budgetTipEl.classList.add("hidden");
    }, 1800);
  }

  function updatePanel() {
    const level = tideLevel();
    const sum = totals();
    const score = stabilityScore(sum);
    refs.stabilityEl.textContent = score;
    refs.stabilityBar.style.width = `${score}%`;
    refs.tideLabel.textContent = `${level}%`;
    refs.tideNeedle.style.transform = `rotate(${level * 2.7 - 135}deg)`;
    refs.phaseLabel.textContent = phaseName(level);
    refs.dayLabel.textContent = `第${state.day}天`;
    document.querySelector("#snails").textContent = sum.snails;
    document.querySelector("#crabs").textContent = sum.crabs;
    document.querySelector("#mussels").textContent = sum.mussels;
    document.querySelector("#stars").textContent = sum.stars;
    refs.budgetEl.textContent = state.budget;
    const budgetPercent = Math.max(0, Math.min(100, (state.budget / INITIAL_BUDGET) * 100));
    refs.budgetBar.style.width = `${budgetPercent}%`;
    refs.budgetBar.parentElement.classList.toggle("budget-low", state.budget < 10);
  }

  function renderDeltaIndicator(netDelta) {
    refs.deltaIndicatorEl.classList.remove("delta-positive", "delta-negative", "delta-neutral");
    if (netDelta > 0) {
      refs.deltaIndicatorEl.classList.add("delta-positive");
      refs.deltaArrowEl.textContent = "▲";
      refs.deltaValueEl.textContent = `+${netDelta}`;
    } else if (netDelta < 0) {
      refs.deltaIndicatorEl.classList.add("delta-negative");
      refs.deltaArrowEl.textContent = "▼";
      refs.deltaValueEl.textContent = `${netDelta}`;
    } else {
      refs.deltaIndicatorEl.classList.add("delta-neutral");
      refs.deltaArrowEl.textContent = "—";
      refs.deltaValueEl.textContent = "0";
    }
  }

  function renderImpacts(impacts) {
    refs.feedbackImpactsEl.innerHTML = "";
    if (!impacts || impacts.length === 0) {
      const empty = document.createElement("span");
      empty.className = "impact-empty";
      empty.textContent = "本轮暂无显著影响因素";
      refs.feedbackImpactsEl.appendChild(empty);
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
      refs.feedbackImpactsEl.appendChild(tag);
    });
  }

  function renderFeedbackSummary(netDelta, summary) {
    refs.feedbackSummaryEl.classList.remove("summary-positive", "summary-negative", "summary-neutral");
    if (netDelta > 0) refs.feedbackSummaryEl.classList.add("summary-positive");
    else if (netDelta < 0) refs.feedbackSummaryEl.classList.add("summary-negative");
    else refs.feedbackSummaryEl.classList.add("summary-neutral");
    refs.feedbackSummaryEl.textContent = summary;
  }

  function renderFeedbackHistory() {
    refs.feedbackHistoryListEl.innerHTML = "";
    if (state.feedbackHistory.length === 0) {
      const li = document.createElement("li");
      li.className = "history-empty";
      li.textContent = "暂无历史记录";
      refs.feedbackHistoryListEl.appendChild(li);
      return;
    }
    state.feedbackHistory.forEach((entry) => {
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
      refs.feedbackHistoryListEl.appendChild(li);
    });
  }

  function updateFeedbackPanel(explainResult, dayNum, phase, levelValue) {
    if (!explainResult) {
      refs.deltaIndicatorEl.classList.remove("delta-positive", "delta-negative");
      refs.deltaIndicatorEl.classList.add("delta-neutral");
      refs.deltaArrowEl.textContent = "—";
      refs.deltaValueEl.textContent = "0";
      refs.feedbackSummaryEl.classList.remove("summary-positive", "summary-negative");
      refs.feedbackSummaryEl.classList.add("summary-neutral");
      refs.feedbackSummaryEl.textContent = "等待推进观察...";
      renderImpacts([]);
      renderFeedbackHistory();
      return;
    }
    renderDeltaIndicator(explainResult.netDelta);
    renderFeedbackSummary(explainResult.netDelta, explainResult.summary);
    renderImpacts(explainResult.impacts);
    renderFeedbackHistory();
  }

  function renderEventList() {
    refs.eventList.innerHTML = "";
    state.events.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      refs.eventList.appendChild(li);
    });
  }

  function showChallengeStatus(type, text) {
    refs.challengeStatusEl.className = `challenge-status status-${type}`;
    refs.statusIconEl.textContent = type === "success" ? "🏆" : "💧";
    refs.statusTextEl.textContent = text;
  }

  function hideChallengeStatus() {
    refs.challengeStatusEl.classList.add("hidden");
  }

  function renderChallengeGoals() {
    refs.challengeGoalsEl.innerHTML = "";
    const goalsStatus = getChallengeGoalsStatus();
    goalsStatus.forEach(({ goal, status }) => {
      const li = document.createElement("li");
      li.className = `goal-item goal-${status.state}`;
      li.innerHTML = `
        <span class="goal-icon">${status.state === "pass" ? "✓" : status.state === "fail" ? "✗" : "○"}</span>
        <span class="goal-text">${goal.label}</span>
        <span class="goal-value">${status.detail}</span>
      `;
      refs.challengeGoalsEl.appendChild(li);
    });
  }

  function renderChallengeList() {
    refs.challengeListEl.innerHTML = "";
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
      card.addEventListener("click", () => handleStartChallenge(ch));
      refs.challengeListEl.appendChild(card);
    });
  }

  function openChallengeModal() {
    if (state.currentChallenge) return;
    renderChallengeList();
    refs.challengeModal.classList.remove("hidden");
  }

  function closeChallengeModal() {
    refs.challengeModal.classList.add("hidden");
  }

  function handleStartChallenge(challenge) {
    startChallenge(challenge);
    closeChallengeModal();
    hideChallengeStatus();
    refs.challengeProgressEl.classList.remove("hidden");
    refs.challengeTitleEl.textContent = challenge.title;
    refs.challengeDescEl.textContent = challenge.desc;
    refreshAll();
    renderChallengeGoals();
  }

  function handleQuitChallenge() {
    quitChallenge();
    refs.challengeProgressEl.classList.add("hidden");
    hideChallengeStatus();
    refreshAll();
  }

  function handleReset() {
    resetSimulationState();
    setAutoButtonState(false, refs.autoBtn);
    eventLogReset();
    hideChallengeStatus();
    refreshAll();
    if (state.currentChallenge) {
      renderChallengeGoals();
    }
  }

  function eventLogReset() {
    state.events = [];
    logEvent("潮汐池进入初始观察。");
  }

  function renderSandboxList() {
    const sandboxes = getSandboxes();
    refs.sandboxListEl.innerHTML = "";

    if (sandboxes.length === 0) {
      refs.sandboxEmptyEl.classList.remove("hidden");
      return;
    }

    refs.sandboxEmptyEl.classList.add("hidden");

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
        stopAutoAdvance(refs.autoBtn);
        const savedState = serializeState();
        const list = getSandboxes();
        const idx = list.findIndex((s) => s.id === sb.id);
        if (idx >= 0) {
          list[idx].state = savedState;
          list[idx].updatedAt = Date.now();
          setSandboxes(list);
          renderSandboxList();
          showBudgetTip(`已覆盖方案「${sb.name}」`, "gain");
        }
      });

      card.querySelector(".sandbox-delete-btn").addEventListener("click", () => {
        deleteSandbox(sb.id);
      });

      refs.sandboxListEl.appendChild(card);
    });
  }

  function saveSandbox(name) {
    const trimmed = name.trim();
    if (!trimmed) {
      showBudgetTip("请输入方案名称", "warn");
      return false;
    }

    stopAutoAdvance(refs.autoBtn);

    const savedState = serializeState();
    const sandboxes = getSandboxes();
    const existingIndex = sandboxes.findIndex((s) => s.name === trimmed);

    if (existingIndex >= 0) {
      sandboxes[existingIndex] = {
        ...sandboxes[existingIndex],
        state: savedState,
        updatedAt: Date.now()
      };
      showBudgetTip(`已覆盖方案「${trimmed}」`, "gain");
    } else {
      sandboxes.unshift({
        id: generateId(),
        name: trimmed,
        state: savedState,
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
    applyStateToUI();
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

  function openSandboxModal() {
    stopAutoAdvance(refs.autoBtn);
    renderSandboxList();
    refs.sandboxNameInput.value = "";
    refs.sandboxModal.classList.remove("hidden");
    setTimeout(() => refs.sandboxNameInput.focus(), 100);
  }

  function closeSandboxModal() {
    refs.sandboxModal.classList.add("hidden");
  }

  function applyStateToUI() {
    setActiveToolButton(state.activeTool);
    renderEventList();
    refreshAll();
    if (state.currentChallenge) {
      refs.challengeProgressEl.classList.remove("hidden");
      refs.challengeTitleEl.textContent = state.currentChallenge.title;
      refs.challengeDescEl.textContent = state.currentChallenge.desc;
      renderChallengeGoals();
    } else {
      refs.challengeProgressEl.classList.add("hidden");
    }

    renderFeedbackHistory();
    if (state.feedbackHistory.length > 0) {
      const latest = state.feedbackHistory[0];
      renderDeltaIndicator(latest.netDelta);
      renderFeedbackSummary(latest.netDelta, latest.summary);
      renderImpacts(latest.impacts);
    } else {
      updateFeedbackPanel(null, state.day, phaseName(tideLevel()), tideLevel());
    }

    if (state.challengeComplete) showChallengeStatus("success", "挑战成功！生态管理出色。");
    else if (state.challengeFailed) showChallengeStatus("fail", "挑战失败！点击重置再试一次。");
    else hideChallengeStatus();

    setAutoButtonState(false, refs.autoBtn);
  }

  function setActiveToolButton(tool) {
    state.activeTool = tool;
    refs.toolButtons.forEach((item) => item.classList.toggle("active", item.dataset.tool === tool));
  }

  function handleToolClick(button) {
    setActiveToolButton(button.dataset.tool);
  }

  function handleCanvasClick(event) {
    const { x, y } = renderer.getCanvasCoords(event);
    const cell = renderer.getCellAt(x, y);
    const result = applyTool(cell);
    if (result.tip) {
      showBudgetTip(result.tip.text, result.tip.type);
    }
    if (result.changed) {
      renderer.draw();
      updatePanel();
    }
  }

  function handleAdvance() {
    const result = advance();
    if (!result) return;

    renderer.draw();
    updatePanel();
    updateFeedbackPanel(result.explain, result.day, result.currentPhase, result.level);
    renderEventList();

    if (state.currentChallenge) {
      renderChallengeGoals();
      if (result.challengeResult) {
        if (result.challengeResult.status === "success") {
          showChallengeStatus("success", result.challengeResult.text);
        } else if (result.challengeResult.status === "fail") {
          showChallengeStatus("fail", result.challengeResult.text);
        }
      }
    }
  }

  function handleToggleAutoAdvance() {
    const advanceFn = handleAdvance;
    if (TidepoolState.isAutoRunning()) {
      stopAutoAdvance(refs.autoBtn);
    } else {
      startAutoAdvance(advanceFn, refs.autoBtn);
    }
  }

  function refreshAll() {
    renderer.draw();
    updatePanel();
    renderEventList();
  }

  function bindEvents() {
    let resizeTimeout = null;
    window.addEventListener("resize", () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        renderer.draw();
      }, 100);
    });

    refs.toolButtons.forEach((button) => {
      button.addEventListener("click", () => handleToolClick(button));
    });

    refs.canvas.addEventListener("click", handleCanvasClick);
    refs.advanceBtn.addEventListener("click", handleAdvance);
    refs.resetBtn.addEventListener("click", handleReset);
    refs.autoBtn.addEventListener("click", handleToggleAutoAdvance);

    refs.challengeBtn.addEventListener("click", openChallengeModal);
    refs.closeChallengeBtn.addEventListener("click", closeChallengeModal);
    refs.quitChallengeBtn.addEventListener("click", handleQuitChallenge);
    refs.challengeModal.addEventListener("click", (e) => {
      if (e.target === refs.challengeModal) closeChallengeModal();
    });

    refs.sandboxBtn.addEventListener("click", openSandboxModal);
    refs.closeSandboxBtn.addEventListener("click", closeSandboxModal);
    refs.sandboxModal.addEventListener("click", (e) => {
      if (e.target === refs.sandboxModal) closeSandboxModal();
    });

    refs.saveSandboxBtn.addEventListener("click", () => {
      const name = refs.sandboxNameInput.value.trim();
      if (saveSandbox(name)) {
        refs.sandboxNameInput.value = "";
      }
    });

    refs.sandboxNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const name = refs.sandboxNameInput.value.trim();
        if (saveSandbox(name)) {
          refs.sandboxNameInput.value = "";
        }
      }
    });

    window.addEventListener("beforeunload", () => {
      stopAutoAdvance(refs.autoBtn);
    });
  }

  function initUI() {
    initRefs();
    initRenderer();
    bindEvents();

    eventLogReset();
    refreshAll();
    updateFeedbackPanel(null, state.day, phaseName(tideLevel()), tideLevel());
    setAutoButtonState(false, refs.autoBtn);
  }

  return {
    initUI,
    refreshAll,
    refs: () => refs,
    renderer: () => renderer
  };
});
