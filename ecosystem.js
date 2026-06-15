(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory(
      root.TidepoolCore || require("./core.js"),
      root.TidepoolState || require("./state.js")
    );
  } else {
    root.TidepoolEcosystem = factory(root.TidepoolCore, root.TidepoolState);
  }
})(typeof self !== "undefined" ? self : this, function (TidepoolCore, TidepoolState) {
  const {
    state,
    TOOL_COSTS,
    tideLevel,
    totals,
    neighbors,
    logEvent,
    resetSimulationState,
    stopAutoAdvance
  } = TidepoolState;

  const phaseName = TidepoolCore.phaseName;
  const stabilityScore = TidepoolCore.stabilityScore;
  const explainStabilityChange = TidepoolCore.explainStabilityChange;

  function applyTool(cell) {
    if (!cell || cell.base === "water") return { changed: false, tip: null };

    const cost = TOOL_COSTS[state.activeTool];
    let tip = null;

    if (state.activeTool === "clear") {
      const hadRock = cell.rock;
      const hadKelp = cell.kelp;
      const hadMussel = cell.mussel > 0;
      const hadShade = cell.shade;
      if (!hadRock && !hadKelp && !hadMussel && !hadShade) {
        return { changed: false, tip: null };
      }

      let refund = 0;
      if (hadRock) refund += TOOL_COSTS.rock;
      if (hadKelp) refund += TOOL_COSTS.kelp;
      if (hadMussel) refund += TOOL_COSTS.mussel;
      if (hadShade) refund += TOOL_COSTS.shade;
      state.budget += refund;

      cell.rock = false;
      cell.kelp = false;
      cell.mussel = 0;
      cell.shade = false;
      tip = { text: `清理回收 +${refund} 预算`, type: "gain" };
    } else if (state.activeTool === "rock") {
      if (!cell.rock) {
        if (state.budget < cost) {
          return { changed: false, tip: { text: `预算不足！放置岩缝需要 ${cost}`, type: "warn" } };
        }
        state.budget -= cost;
        cell.rock = true;
        tip = { text: `放置岩缝 -${cost}`, type: "spend" };
      } else {
        cell.rock = false;
        state.budget += cost;
        tip = { text: `移除岩缝 +${cost}`, type: "gain" };
      }
    } else if (state.activeTool === "kelp") {
      if (!cell.kelp) {
        if (state.budget < cost) {
          return { changed: false, tip: { text: `预算不足！放置海藻需要 ${cost}`, type: "warn" } };
        }
        state.budget -= cost;
        cell.kelp = true;
        tip = { text: `放置海藻 -${cost}`, type: "spend" };
      } else {
        cell.kelp = false;
        state.budget += cost;
        tip = { text: `移除海藻 +${cost}`, type: "gain" };
      }
    } else if (state.activeTool === "mussel") {
      if (cell.mussel === 0) {
        if (state.budget < cost) {
          return { changed: false, tip: { text: `预算不足！放置贝群需要 ${cost}`, type: "warn" } };
        }
        state.budget -= cost;
        cell.mussel = 3;
        tip = { text: `放置贝群 -${cost}`, type: "spend" };
      } else {
        cell.mussel = 0;
        state.budget += cost;
        tip = { text: `移除贝群 +${cost}`, type: "gain" };
      }
    } else if (state.activeTool === "shade") {
      if (!cell.shade) {
        if (state.budget < cost) {
          return { changed: false, tip: { text: `预算不足！放置遮阴需要 ${cost}`, type: "warn" } };
        }
        state.budget -= cost;
        cell.shade = true;
        tip = { text: `放置遮阴 -${cost}`, type: "spend" };
      } else {
        cell.shade = false;
        state.budget += cost;
        tip = { text: `移除遮阴 +${cost}`, type: "gain" };
      }
    }

    return { changed: true, tip };
  }

  function advance() {
    if (state.isAdvancing) return null;
    if (state.challengeComplete || state.challengeFailed) return null;
    state.isAdvancing = true;

    let result = null;
    try {
      const prevSum = totals();
      state.tick += 1;
      if (state.tick % 2 === 0) state.day += 1;
      const level = tideLevel();
      const currentPhase = phaseName(level);
      let births = 0;
      let stress = 0;

      state.grid.flat().forEach((cell) => {
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
        if (cell.snails > 3 && shelter && Math.random() < 0.1)
          cell.crabs = Math.min(3, cell.crabs + 1);
      });

      const currSum = totals();
      const explain = explainStabilityChange(prevSum, currSum, level);

      if (state.currentChallenge && stress > 0) state.challengeStressCount += 1;

      if (currentPhase === "满潮") {
        logEvent("满潮带来浮游养分，贝类扩张更快。");
      } else if (stress > 0) {
        logEvent(`低水位造成${stress}处生物压力。`);
      } else if (births > 3) {
        logEvent("海藻边缘出现新的螺类活动。");
      } else {
        logEvent(`${currentPhase}平稳经过。`);
      }

      const historyEntry = {
        dayNum: state.day,
        dayLabel: `第${state.day}天`,
        phaseName: currentPhase,
        tideLevel: level,
        netDelta: explain.netDelta,
        prevScore: explain.prevScore,
        currScore: explain.currScore,
        summary: explain.summary,
        impacts: explain.impacts.map((i) => ({
          id: i.id,
          label: i.label,
          polarity: i.polarity,
          strength: i.strength,
          delta: i.delta
        })),
        impactLabels: explain.impacts.map((i) => i.label)
      };
      state.feedbackHistory.unshift(historyEntry);
      if (state.feedbackHistory.length > state.FEEDBACK_HISTORY_MAX) {
        state.feedbackHistory = state.feedbackHistory.slice(0, state.FEEDBACK_HISTORY_MAX);
      }

      const challengeResult = state.currentChallenge ? checkChallengeProgress() : null;

      result = {
        explain,
        day: state.day,
        currentPhase,
        level,
        challengeResult
      };
    } finally {
      state.isAdvancing = false;
    }

    return result;
  }

  function evaluateGoal(goal, sum, score) {
    switch (goal.type) {
      case "threshold": {
        const current = score;
        const expired = state.day > goal.deadline;
        if (current < goal.target)
          return { state: "fail", detail: `${current}/${goal.target}（第${state.day}天低于目标）` };
        if (expired) {
          return { state: "pass", detail: `维持至第${goal.deadline}天：${current}/${goal.target}` };
        }
        return {
          state: "active",
          detail: `当前达标 ${current}/${goal.target}（待第${goal.deadline}天验证）`
        };
      }
      case "range_min": {
        const current = sum.mussels;
        if (state.day >= goal.startDay && state.day <= goal.endDay) {
          if (current < goal.target)
            return {
              state: "fail",
              detail: `${current}只跌破下限${goal.target}（第${state.day}天）`
            };
          return {
            state: "active",
            detail: `${current}只，维持中（第${state.day}天/第${goal.endDay}天）`
          };
        }
        if (state.day > goal.endDay)
          return { state: "pass", detail: `第${goal.startDay}-${goal.endDay}天维持达标` };
        return { state: "active", detail: `${current}只（等待第${goal.startDay}天）` };
      }
      case "range_max": {
        const current = sum.mussels;
        if (state.day >= goal.startDay && state.day <= goal.endDay) {
          if (current > goal.target)
            return {
              state: "fail",
              detail: `${current}只超出上限${goal.target}（第${state.day}天）`
            };
          return {
            state: "active",
            detail: `${current}只，维持中（第${state.day}天/第${goal.endDay}天）`
          };
        }
        if (state.day > goal.endDay)
          return { state: "pass", detail: `第${goal.startDay}-${goal.endDay}天未超限` };
        return { state: "active", detail: `${current}只（等待第${goal.startDay}天）` };
      }
      case "max_count": {
        const current = state.challengeStressCount;
        const expired = state.day > goal.deadline;
        if (current > goal.target)
          return { state: "fail", detail: `${current}/${goal.target}（已超限）` };
        if (expired) return { state: "pass", detail: `10天内共${current}次（≤${goal.target}）` };
        return {
          state: "active",
          detail: `${current}/${goal.target}（第${state.day}天/第${goal.deadline}天）`
        };
      }
      default:
        return { state: "active", detail: "" };
    }
  }

  function checkChallengeProgress() {
    if (!state.currentChallenge || state.challengeComplete || state.challengeFailed) return null;
    const sum = totals();
    const score = stabilityScore(sum);

    const results = state.currentChallenge.goals.map((g) => evaluateGoal(g, sum, score));
    const allPass = results.every((r) => r.state === "pass");
    const anyFail = results.some((r) => r.state === "fail");

    if (anyFail) {
      state.challengeFailed = true;
      stopAutoAdvance();
      return { status: "fail", text: "挑战失败！点击重置再试一次。", results };
    } else if (allPass) {
      state.challengeComplete = true;
      stopAutoAdvance();
      return { status: "success", text: "挑战成功！生态管理出色。", results };
    }

    return { status: "active", results };
  }

  function startChallenge(challenge) {
    state.currentChallenge = challenge;
    state.challengeComplete = false;
    state.challengeFailed = false;
    state.challengeStressCount = 0;
    resetSimulationState();
    return challenge;
  }

  function quitChallenge() {
    stopAutoAdvance();
    state.currentChallenge = null;
    state.challengeComplete = false;
    state.challengeFailed = false;
    state.challengeStressCount = 0;
    resetSimulationState();
  }

  function getChallengeGoalsStatus() {
    if (!state.currentChallenge) return [];
    const sum = totals();
    const score = stabilityScore(sum);
    return state.currentChallenge.goals.map((goal) => {
      const status = evaluateGoal(goal, sum, score);
      return { goal, status };
    });
  }

  return {
    applyTool,
    advance,
    evaluateGoal,
    checkChallengeProgress,
    startChallenge,
    quitChallenge,
    getChallengeGoalsStatus
  };
});
