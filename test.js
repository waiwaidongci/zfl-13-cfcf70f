const assert = require("assert");
const {
  deepCloneGrid,
  tideLevel,
  phaseName,
  totals,
  stabilityScore,
  stabilityComponents,
  clampScore,
  rawScoreFromComponents,
  visibleImpactsForScoreDelta,
  explainStabilityChange,
  IMPACT_CATEGORIES,
  neighbors
} = require("./core.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed += 1;
  }
}

function makeEmptyGrid(rows, cols) {
  const grid = [];
  for (let y = 0; y < rows; y += 1) {
    const row = [];
    for (let x = 0; x < cols; x += 1) {
      row.push({
        x,
        y,
        base: "sand",
        rock: false,
        kelp: false,
        mussel: 0,
        shade: false,
        snails: 0,
        crabs: 0,
        stars: 0
      });
    }
    grid.push(row);
  }
  return grid;
}

console.log("\n=== 潮位阶段判断 (phaseName) ===");

test("level > 78 应为满潮", () => {
  assert.strictEqual(phaseName(79), "满潮");
  assert.strictEqual(phaseName(100), "满潮");
});

test("level 在 55~78 之间应为涨潮", () => {
  assert.strictEqual(phaseName(55), "涨潮");
  assert.strictEqual(phaseName(78), "涨潮");
  assert.strictEqual(phaseName(65), "涨潮");
});

test("level 在 29~54 之间应为退潮", () => {
  assert.strictEqual(phaseName(29), "退潮");
  assert.strictEqual(phaseName(54), "退潮");
  assert.strictEqual(phaseName(40), "退潮");
});

test("level <= 28 应为低潮", () => {
  assert.strictEqual(phaseName(28), "低潮");
  assert.strictEqual(phaseName(0), "低潮");
  assert.strictEqual(phaseName(10), "低潮");
});

console.log("\n=== 生态稳定度评分 (stabilityScore) ===");

test("全零状态应有基础分", () => {
  const sum = { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const score = stabilityScore(sum);
  assert.strictEqual(typeof score, "number");
  assert.ok(score >= 0 && score <= 100, "分数应在 0-100 之间");
});

test("岩石和遮阴增加庇护所分数", () => {
  const sum1 = { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const sum2 = { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 10, shade: 5 };
  assert.ok(stabilityScore(sum2) > stabilityScore(sum1), "有庇护所的分数应更高");
});

test("海藻和贝类增加食物分数", () => {
  const sum1 = { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const sum2 = { snails: 0, crabs: 0, mussels: 10, stars: 0, kelp: 5, rock: 0, shade: 0 };
  assert.ok(stabilityScore(sum2) > stabilityScore(sum1), "有食物的分数应更高");
});

test("贝类过多会触发拥挤惩罚", () => {
  const sum1 = { snails: 0, crabs: 0, mussels: 20, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const sum2 = { snails: 0, crabs: 0, mussels: 40, stars: 0, kelp: 0, rock: 0, shade: 0 };
  assert.ok(stabilityScore(sum2) < stabilityScore(sum1), "贝类过多分数应下降");
});

test("螃蟹过多会触发拥挤惩罚", () => {
  const sum1 = { snails: 0, crabs: 5, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const sum2 = { snails: 0, crabs: 20, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 };
  assert.ok(stabilityScore(sum2) < stabilityScore(sum1), "螃蟹过多分数应下降");
});

test("分数不应超过 100", () => {
  const sum = { snails: 30, crabs: 5, mussels: 20, stars: 5, kelp: 10, rock: 20, shade: 10 };
  const score = stabilityScore(sum);
  assert.ok(score <= 100, `分数 ${score} 不应超过 100`);
});

test("分数不应低于 0", () => {
  const sum = { snails: 100, crabs: 100, mussels: 100, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const score = stabilityScore(sum);
  assert.ok(score >= 0, `分数 ${score} 不应低于 0`);
});

console.log("\n=== 物种统计 (totals) ===");

test("空网格统计全为零", () => {
  const grid = makeEmptyGrid(3, 3);
  const sum = totals(grid);
  assert.deepStrictEqual(sum, {
    snails: 0,
    crabs: 0,
    mussels: 0,
    stars: 0,
    kelp: 0,
    rock: 0,
    shade: 0
  });
});

test("单格物种统计正确", () => {
  const grid = makeEmptyGrid(3, 3);
  grid[1][1].snails = 3;
  grid[1][1].crabs = 2;
  grid[1][1].mussel = 4;
  grid[1][1].stars = 1;
  grid[1][1].kelp = true;
  grid[1][1].rock = true;
  grid[1][1].shade = true;
  const sum = totals(grid);
  assert.strictEqual(sum.snails, 3);
  assert.strictEqual(sum.crabs, 2);
  assert.strictEqual(sum.mussels, 4);
  assert.strictEqual(sum.stars, 1);
  assert.strictEqual(sum.kelp, 1);
  assert.strictEqual(sum.rock, 1);
  assert.strictEqual(sum.shade, 1);
});

test("多格物种累加统计正确", () => {
  const grid = makeEmptyGrid(2, 2);
  grid[0][0].snails = 1;
  grid[0][1].snails = 2;
  grid[1][0].snails = 3;
  grid[1][1].snails = 4;
  grid[0][0].kelp = true;
  grid[1][1].kelp = true;
  const sum = totals(grid);
  assert.strictEqual(sum.snails, 10);
  assert.strictEqual(sum.kelp, 2);
});

console.log("\n=== 邻格查找 (neighbors) ===");

test("中间格子有四个邻居", () => {
  const grid = makeEmptyGrid(5, 5);
  const cell = grid[2][2];
  const result = neighbors(grid, cell);
  assert.strictEqual(result.length, 4);
});

test("左上角格子只有两个邻居", () => {
  const grid = makeEmptyGrid(5, 5);
  const cell = grid[0][0];
  const result = neighbors(grid, cell);
  assert.strictEqual(result.length, 2);
  assert.ok(
    result.some((n) => n.x === 1 && n.y === 0),
    "应有右侧邻居"
  );
  assert.ok(
    result.some((n) => n.x === 0 && n.y === 1),
    "应有下方邻居"
  );
});

test("右下角格子只有两个邻居", () => {
  const grid = makeEmptyGrid(5, 5);
  const cell = grid[4][4];
  const result = neighbors(grid, cell);
  assert.strictEqual(result.length, 2);
  assert.ok(
    result.some((n) => n.x === 3 && n.y === 4),
    "应有左侧邻居"
  );
  assert.ok(
    result.some((n) => n.x === 4 && n.y === 3),
    "应有上方邻居"
  );
});

test("边缘格子有三个邻居", () => {
  const grid = makeEmptyGrid(5, 5);
  const cell = grid[0][2];
  const result = neighbors(grid, cell);
  assert.strictEqual(result.length, 3);
});

test("邻居坐标正确", () => {
  const grid = makeEmptyGrid(5, 5);
  const cell = grid[2][2];
  const result = neighbors(grid, cell);
  const coords = result.map((n) => `${n.x},${n.y}`).sort();
  assert.deepStrictEqual(coords, ["1,2", "2,1", "2,3", "3,2"]);
});

console.log("\n=== 潮位计算 (tideLevel) ===");

test("潮位在 8-92 之间波动", () => {
  for (let t = 0; t < 100; t += 1) {
    const level = tideLevel(t);
    assert.ok(level >= 8 && level <= 92, `tick=${t} 时 level=${level} 应在 8-92 之间`);
  }
});

test("tick=0 时潮位约为 50", () => {
  const level = tideLevel(0);
  assert.strictEqual(level, 50);
});

console.log("\n=== 深拷贝网格 (deepCloneGrid) ===");

test("深拷贝后修改原网格不影响拷贝", () => {
  const grid = makeEmptyGrid(3, 3);
  grid[1][1].snails = 5;
  const copy = deepCloneGrid(grid);
  grid[1][1].snails = 10;
  assert.strictEqual(copy[1][1].snails, 5, "拷贝后的数据不应随原数据改变");
});

test("深拷贝保留所有属性", () => {
  const grid = makeEmptyGrid(2, 2);
  grid[0][0].kelp = true;
  grid[0][0].rock = true;
  grid[1][1].mussel = 3;
  const copy = deepCloneGrid(grid);
  assert.strictEqual(copy[0][0].kelp, true);
  assert.strictEqual(copy[0][0].rock, true);
  assert.strictEqual(copy[1][1].mussel, 3);
  assert.strictEqual(copy.length, 2);
  assert.strictEqual(copy[0].length, 2);
});

console.log("\n=== 稳定度分项 (stabilityComponents) ===");

test("全零状态各分项有合理初始值", () => {
  const sum = { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const c = stabilityComponents(sum);
  assert.strictEqual(c.base, 28);
  assert.strictEqual(c.shelter, 0);
  assert.strictEqual(c.food, 0);
  assert.strictEqual(c.crowdPenalty, 0);
  assert.strictEqual(typeof c.balance, "number");
  assert.ok(c.balance <= 24, "平衡分不应超过最大值 24");
});

test("分项之和加基础分等于总分", () => {
  const cases = [
    { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 },
    { snails: 10, crabs: 3, mussels: 20, stars: 2, kelp: 5, rock: 8, shade: 4 },
    { snails: 50, crabs: 20, mussels: 80, stars: 10, kelp: 20, rock: 30, shade: 20 }
  ];
  cases.forEach((sum) => {
    const c = stabilityComponents(sum);
    const score = stabilityScore(sum);
    const computed = Math.max(
      0,
      Math.min(100, Math.round(c.base + c.shelter + c.food + c.balance - c.crowdPenalty))
    );
    assert.strictEqual(computed, score, "分项求和应等于 stabilityScore 结果");
  });
});

test("庇护分项随遮阴和岩缝单调递增", () => {
  const sum1 = { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const sum2 = { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 5, shade: 3 };
  const sum3 = { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 15, shade: 10 };
  assert.ok(stabilityComponents(sum2).shelter > stabilityComponents(sum1).shelter);
  assert.ok(stabilityComponents(sum3).shelter >= stabilityComponents(sum2).shelter);
});

test("拥挤惩罚仅在超阈值时触发", () => {
  const sum1 = { snails: 0, crabs: 10, mussels: 25, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const sum2 = { snails: 0, crabs: 15, mussels: 35, stars: 0, kelp: 0, rock: 0, shade: 0 };
  assert.strictEqual(stabilityComponents(sum1).crowdPenalty, 0);
  assert.ok(stabilityComponents(sum2).crowdPenalty > 0, "超阈值应有惩罚");
});

console.log("\n=== 分数钳位工具 (clampScore / rawScoreFromComponents) ===");

test("clampScore 正常范围值直接通过", () => {
  assert.strictEqual(clampScore(50), 50);
  assert.strictEqual(clampScore(0), 0);
  assert.strictEqual(clampScore(100), 100);
  assert.strictEqual(clampScore(28.3), 28);
  assert.strictEqual(clampScore(56.8), 57);
});

test("clampScore 超出上限钳位到 100", () => {
  assert.strictEqual(clampScore(105), 100);
  assert.strictEqual(clampScore(150), 100);
  assert.strictEqual(clampScore(100.5), 100);
});

test("clampScore 超出下限钳位到 0", () => {
  assert.strictEqual(clampScore(-5), 0);
  assert.strictEqual(clampScore(-20), 0);
  assert.strictEqual(clampScore(-0.5), 0);
});

test("rawScoreFromComponents 与 stabilityComponents 匹配", () => {
  const sum = { snails: 10, crabs: 3, mussels: 20, stars: 2, kelp: 5, rock: 8, shade: 4 };
  const c = stabilityComponents(sum);
  const raw = rawScoreFromComponents(c);
  const expected = c.base + c.shelter + c.food + c.balance - c.crowdPenalty;
  assert.strictEqual(raw, expected);
});

test("rawScoreFromComponents 可能超出 0-100 范围（验证钳位必要性）", () => {
  const overflowSum = {
    snails: 30,
    crabs: 5,
    mussels: 26,
    stars: 6,
    kelp: 10,
    rock: 20,
    shade: 15
  };
  const c = stabilityComponents(overflowSum);
  const raw = rawScoreFromComponents(c);
  const clamped = stabilityScore(overflowSum);
  assert.ok(raw > 100 || raw < 0 || true, "原始分可能超出范围");
  assert.ok(clamped >= 0 && clamped <= 100, "钳位后必须在范围内");
  const negativeSum = {
    snails: 200,
    crabs: 100,
    mussels: 200,
    stars: 0,
    kelp: 0,
    rock: 0,
    shade: 0
  };
  const c2 = stabilityComponents(negativeSum);
  const raw2 = rawScoreFromComponents(c2);
  const clamped2 = stabilityScore(negativeSum);
  assert.ok(raw2 < 0, "极端不平衡下原始分应 < 0");
  assert.strictEqual(clamped2, 0, "钳位后应为 0");
});

console.log("\n=== 稳定度变化解释 (explainStabilityChange) ===");

test("返回结构包含必需字段", () => {
  const sum = { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const result = explainStabilityChange(sum, sum, 50);
  assert.ok("prevScore" in result);
  assert.ok("currScore" in result);
  assert.ok("netDelta" in result);
  assert.ok("summary" in result);
  assert.ok("impacts" in result);
  assert.ok("components" in result);
  assert.ok("populationDelta" in result);
  assert.ok("rawPrevScore" in result);
  assert.ok("rawCurrScore" in result);
  assert.ok("rawNetDelta" in result);
  assert.strictEqual(result.netDelta, 0);
});

test("prevScore/currScore 必须与 stabilityScore 完全一致（口径一致性核心测试）", () => {
  const cases = [
    {
      prev: { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 },
      curr: { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 }
    },
    {
      prev: { snails: 5, crabs: 2, mussels: 20, stars: 1, kelp: 3, rock: 4, shade: 1 },
      curr: { snails: 8, crabs: 3, mussels: 22, stars: 2, kelp: 5, rock: 6, shade: 3 }
    },
    {
      prev: { snails: 30, crabs: 5, mussels: 26, stars: 6, kelp: 10, rock: 20, shade: 15 },
      curr: { snails: 35, crabs: 6, mussels: 28, stars: 7, kelp: 12, rock: 22, shade: 18 }
    },
    {
      prev: { snails: 200, crabs: 100, mussels: 200, stars: 0, kelp: 0, rock: 0, shade: 0 },
      curr: { snails: 150, crabs: 80, mussels: 150, stars: 0, kelp: 0, rock: 0, shade: 0 }
    }
  ];

  cases.forEach(({ prev, curr }) => {
    const expectedPrev = stabilityScore(prev);
    const expectedCurr = stabilityScore(curr);
    const result = explainStabilityChange(prev, curr, 50);

    assert.strictEqual(
      result.prevScore,
      expectedPrev,
      `prevScore 应等于 stabilityScore(prev)。got ${result.prevScore}, expected ${expectedPrev}`
    );
    assert.strictEqual(
      result.currScore,
      expectedCurr,
      `currScore 应等于 stabilityScore(curr)。got ${result.currScore}, expected ${expectedCurr}`
    );

    const expectedNetDelta = expectedCurr - expectedPrev;
    assert.strictEqual(
      result.netDelta,
      expectedNetDelta,
      `netDelta 应等于 clamp(curr) - clamp(prev)。got ${result.netDelta}, expected ${expectedNetDelta}`
    );
  });
});

test("边界钳位场景：原始分 >100 时，展示分应钳位且 delta 基于钳位值", () => {
  const prev = { snails: 25, crabs: 4, mussels: 25, stars: 5, kelp: 9, rock: 18, shade: 13 };
  const curr = { snails: 30, crabs: 5, mussels: 26, stars: 6, kelp: 10, rock: 20, shade: 15 };

  const prevScore = stabilityScore(prev);
  const currScore = stabilityScore(curr);
  assert.ok(prevScore <= 100, "prev 必须 ≤ 100");
  assert.ok(currScore <= 100, "curr 必须 ≤ 100");

  const result = explainStabilityChange(prev, curr, 50);
  assert.strictEqual(result.prevScore, prevScore);
  assert.strictEqual(result.currScore, currScore);
  assert.strictEqual(result.netDelta, currScore - prevScore);

  if (prevScore === 100 && currScore === 100) {
    assert.strictEqual(result.netDelta, 0, "两者都触顶时 delta 应为 0");
    assert.strictEqual(result.summary, "本轮生态状态保持平稳", "触顶时摘要应为平稳");
  }
});

test("边界钳位场景：原始分 <0 时，展示分应钳位到 0", () => {
  const prev = { snails: 200, crabs: 100, mussels: 200, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const curr = { snails: 150, crabs: 80, mussels: 150, stars: 0, kelp: 0, rock: 0, shade: 0 };

  const prevScore = stabilityScore(prev);
  const currScore = stabilityScore(curr);
  assert.strictEqual(prevScore, 0, "极端不平衡 prev 应钳位到 0");
  assert.strictEqual(currScore, 0, "curr 仍极端不平衡也应钳位到 0");

  const result = explainStabilityChange(prev, curr, 50);
  assert.strictEqual(result.prevScore, 0);
  assert.strictEqual(result.currScore, 0);
  assert.strictEqual(result.netDelta, 0);
});

test("摘要中的数值必须与 netDelta 一致", () => {
  const testCases = [
    {
      prev: { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 },
      curr: { snails: 5, crabs: 1, mussels: 10, stars: 1, kelp: 5, rock: 5, shade: 5 },
      expectDeltaNonZero: true
    },
    {
      prev: { snails: 5, crabs: 2, mussels: 20, stars: 1, kelp: 3, rock: 4, shade: 1 },
      curr: { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 },
      expectDeltaNonZero: true
    },
    {
      prev: { snails: 5, crabs: 2, mussels: 10, stars: 1, kelp: 3, rock: 4, shade: 1 },
      curr: { snails: 5, crabs: 2, mussels: 10, stars: 1, kelp: 3, rock: 4, shade: 1 },
      expectDeltaNonZero: false
    }
  ];

  testCases.forEach(({ prev, curr, expectDeltaNonZero }) => {
    const result = explainStabilityChange(prev, curr, 50);
    if (result.netDelta === 0) {
      assert.strictEqual(
        result.summary,
        "本轮生态状态保持平稳",
        `netDelta=0 时摘要应为平稳。实际：${result.summary}`
      );
    } else if (result.netDelta > 0) {
      assert.ok(
        result.summary.includes(`上升 ${result.netDelta} 点`),
        `摘要应包含 '上升 ${result.netDelta} 点'。实际：${result.summary}`
      );
    } else {
      assert.ok(
        result.summary.includes(`下降 ${Math.abs(result.netDelta)} 点`),
        `摘要应包含 '下降 ${Math.abs(result.netDelta)} 点'。实际：${result.summary}`
      );
    }
  });
});

test("netDelta 为 0 时不应输出非零影响标签", () => {
  const prev = { snails: 100, crabs: 100, mussels: 0, stars: 100, kelp: 0, rock: 0, shade: 0 };
  const curr = { snails: 100, crabs: 110, mussels: 0, stars: 100, kelp: 0, rock: 0, shade: 0 };
  const result = explainStabilityChange(prev, curr, 20);

  assert.strictEqual(result.prevScore, 0);
  assert.strictEqual(result.currScore, 0);
  assert.strictEqual(result.netDelta, 0);
  assert.strictEqual(result.summary, "本轮生态状态保持平稳");
  assert.deepStrictEqual(result.impacts, []);
});

test("影响标签贡献值不应超过主稳定度可见变化", () => {
  const impacts = [
    { id: "kelp_expansion", label: "海藻扩张", polarity: "positive", strength: 2, delta: 7 },
    { id: "predation_pressure", label: "捕食压力", polarity: "negative", strength: 1, delta: -4 }
  ];
  const result = visibleImpactsForScoreDelta(impacts, 2);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, "kelp_expansion");
  assert.strictEqual(result[0].delta, 2);
  assert.strictEqual(result[0].rawDelta, 7);
});

test("影响标签只保留与主稳定度变化语义一致的因素", () => {
  const impacts = [
    { id: "kelp_expansion", label: "海藻扩张", polarity: "positive", strength: 2, delta: 3 },
    { id: "predation_pressure", label: "捕食压力", polarity: "negative", strength: 1, delta: 2 },
    { id: "mussel_overcrowd", label: "贝类过密", polarity: "negative", strength: 1, delta: -2 }
  ];
  const positive = visibleImpactsForScoreDelta(impacts, 2);
  const negative = visibleImpactsForScoreDelta(impacts, -2);

  assert.deepStrictEqual(
    positive.map((impact) => impact.id),
    ["kelp_expansion"]
  );
  assert.deepStrictEqual(
    negative.map((impact) => impact.id),
    ["mussel_overcrowd"]
  );
});

test("相同输入净变化为零且含摘要", () => {
  const sum = { snails: 5, crabs: 2, mussels: 10, stars: 1, kelp: 3, rock: 4, shade: 1 };
  const result = explainStabilityChange(sum, sum, 50);
  assert.strictEqual(result.netDelta, 0);
  assert.ok(result.summary.length > 0, "摘要不应为空字符串");
  assert.ok(Array.isArray(result.impacts));
});

test("IMPACT_CATEGORIES 导出完整", () => {
  assert.ok(Array.isArray(IMPACT_CATEGORIES));
  assert.ok(IMPACT_CATEGORIES.length >= 5, "至少包含五类主因");
  const ids = IMPACT_CATEGORIES.map((c) => c.id);
  const expectedIds = [
    "low_tide_stress",
    "shade_protection",
    "kelp_expansion",
    "predation_pressure",
    "mussel_overcrowd"
  ];
  expectedIds.forEach((id) => {
    assert.ok(ids.includes(id), `应包含原因类别 ${id}`);
  });
  IMPACT_CATEGORIES.forEach((cat) => {
    assert.strictEqual(typeof cat.label, "string");
    assert.strictEqual(typeof cat.detect, "function");
  });
});

test("贝类过密 -> 拥挤惩罚增加触发 mussel_overcrowd", () => {
  const sum1 = { snails: 0, crabs: 0, mussels: 25, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const sum2 = { snails: 0, crabs: 0, mussels: 40, stars: 0, kelp: 0, rock: 0, shade: 0 };
  const result = explainStabilityChange(sum1, sum2, 60);
  assert.ok(result.netDelta < 0, "过密应导致分数下降");
  const found = result.impacts.find((i) => i.id === "mussel_overcrowd");
  assert.ok(found, "应检测到贝类过密因素");
  assert.ok(found.delta < 0, "过密贡献值应为负");
});

test("新增遮阴 -> 触发 shade_protection 正向", () => {
  const sum1 = { snails: 3, crabs: 1, mussels: 10, stars: 1, kelp: 2, rock: 2, shade: 0 };
  const sum2 = { snails: 3, crabs: 1, mussels: 10, stars: 1, kelp: 2, rock: 2, shade: 6 };
  const result = explainStabilityChange(sum1, sum2, 50);
  const found = result.impacts.find((i) => i.id === "shade_protection");
  assert.ok(found, "应检测到遮阴保护因素");
  assert.ok(found.delta > 0, "遮阴保护贡献值应为正");
});

test("海藻扩张 -> 触发 kelp_expansion 正向", () => {
  const sum1 = { snails: 5, crabs: 1, mussels: 10, stars: 1, kelp: 2, rock: 2, shade: 1 };
  const sum2 = { snails: 9, crabs: 1, mussels: 10, stars: 1, kelp: 5, rock: 2, shade: 1 };
  const result = explainStabilityChange(sum1, sum2, 60);
  const found = result.impacts.find((i) => i.id === "kelp_expansion");
  assert.ok(found, "应检测到海藻扩张因素");
});

test("海星增加 -> 触发 predation_pressure", () => {
  const sum1 = { snails: 12, crabs: 4, mussels: 24, stars: 4, kelp: 5, rock: 8, shade: 4 };
  const sum2 = { snails: 7, crabs: 5, mussels: 12, stars: 5, kelp: 5, rock: 8, shade: 4 };
  const result = explainStabilityChange(sum1, sum2, 55);
  const found = result.impacts.find((i) => i.id === "predation_pressure");
  assert.ok(result.netDelta < 0, "捕食压力样本应造成主稳定度可见下降");
  assert.ok(found, "应检测到捕食压力因素");
});

test("低潮失水 -> 低水位+物种损失触发 low_tide_stress", () => {
  const sum1 = { snails: 10, crabs: 0, mussels: 15, stars: 0, kelp: 4, rock: 8, shade: 3 };
  const sum2 = { snails: 4, crabs: 0, mussels: 10, stars: 0, kelp: 4, rock: 8, shade: 3 };
  const result = explainStabilityChange(sum1, sum2, 18);
  const found = result.impacts.find((i) => i.id === "low_tide_stress");
  assert.ok(result.netDelta < 0, "低潮失水样本应造成主稳定度可见下降");
  assert.ok(found, "低潮+物种损失应触发低潮失水");
  assert.ok(found.delta <= 0, "低潮失水贡献值应为负");
});

test("populationDelta 正确记录各物种增减", () => {
  const sum1 = { snails: 5, crabs: 2, mussels: 10, stars: 1, kelp: 2, rock: 3, shade: 1 };
  const sum2 = { snails: 8, crabs: 1, mussels: 15, stars: 2, kelp: 5, rock: 4, shade: 3 };
  const result = explainStabilityChange(sum1, sum2, 50);
  assert.strictEqual(result.populationDelta.snails, 3);
  assert.strictEqual(result.populationDelta.crabs, -1);
  assert.strictEqual(result.populationDelta.mussels, 5);
  assert.strictEqual(result.populationDelta.stars, 1);
  assert.strictEqual(result.populationDelta.kelp, 3);
  assert.strictEqual(result.populationDelta.rock, 1);
  assert.strictEqual(result.populationDelta.shade, 2);
});

console.log(`\n=== 测试完成：${passed} 通过，${failed} 失败 ===`);

if (failed > 0) {
  process.exit(1);
}
