(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();
  } else {
    root.TidepoolCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  function deepCloneGrid(source) {
    return source.map((row) =>
      row.map((cell) => ({ ...cell }))
    );
  }

  function tideLevel(tick) {
    return Math.round(50 + Math.sin(tick / 2.2) * 42);
  }

  function phaseName(level) {
    if (level > 78) return "满潮";
    if (level > 54) return "涨潮";
    if (level > 28) return "退潮";
    return "低潮";
  }

  function totals(grid) {
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

  function neighbors(grid, cell) {
    return [
      grid[cell.y - 1]?.[cell.x],
      grid[cell.y + 1]?.[cell.x],
      grid[cell.y]?.[cell.x - 1],
      grid[cell.y]?.[cell.x + 1]
    ].filter(Boolean);
  }

  return {
    deepCloneGrid,
    tideLevel,
    phaseName,
    totals,
    stabilityScore,
    neighbors
  };
});
