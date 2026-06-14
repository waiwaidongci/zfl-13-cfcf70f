const assert = require("assert");
const {
  deepCloneGrid,
  tideLevel,
  phaseName,
  totals,
  stabilityScore,
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
  assert.deepStrictEqual(sum, { snails: 0, crabs: 0, mussels: 0, stars: 0, kelp: 0, rock: 0, shade: 0 });
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
  assert.ok(result.some((n) => n.x === 1 && n.y === 0), "应有右侧邻居");
  assert.ok(result.some((n) => n.x === 0 && n.y === 1), "应有下方邻居");
});

test("右下角格子只有两个邻居", () => {
  const grid = makeEmptyGrid(5, 5);
  const cell = grid[4][4];
  const result = neighbors(grid, cell);
  assert.strictEqual(result.length, 2);
  assert.ok(result.some((n) => n.x === 3 && n.y === 4), "应有左侧邻居");
  assert.ok(result.some((n) => n.x === 4 && n.y === 3), "应有上方邻居");
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

console.log(`\n=== 测试完成：${passed} 通过，${failed} 失败 ===`);

if (failed > 0) {
  process.exit(1);
}
