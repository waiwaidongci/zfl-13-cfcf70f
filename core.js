(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();
  } else {
    root.TidepoolCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  function deepCloneGrid(source) {
    return source.map((row) => row.map((cell) => ({ ...cell })));
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

  function stabilityComponents(sum) {
    const shelter = Math.min(22, sum.rock * 1.2 + sum.shade * 1.6);
    const food = Math.min(26, sum.kelp * 3 + sum.mussels * 0.8);
    const crowdPenalty = Math.max(0, sum.mussels - 28) * 1.4 + Math.max(0, sum.crabs - 12) * 2;
    const balance =
      24 - Math.abs(sum.snails - sum.kelp * 3) * 0.7 - Math.abs(sum.stars * 4 - sum.mussels) * 0.42;
    const base = 28;
    return { shelter, food, crowdPenalty, balance, base };
  }

  function clampScore(raw) {
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  function rawScoreFromComponents(c) {
    return c.base + c.shelter + c.food + c.balance - c.crowdPenalty;
  }

  function stabilityScore(sum) {
    const c = stabilityComponents(sum);
    return clampScore(rawScoreFromComponents(c));
  }

  const IMPACT_CATEGORIES = [
    {
      id: "low_tide_stress",
      label: "低潮失水",
      polarity: "negative",
      detect: (ctx) => {
        const { prevSum, currSum, tide, rawNetDelta } = ctx;
        const scoreDelta = Math.round(rawNetDelta);
        const snailLoss = prevSum.snails - currSum.snails;
        const musselLoss = prevSum.mussels - currSum.mussels;
        const shadeCoverage = currSum.shade + currSum.rock;
        const totalLoss = snailLoss + musselLoss;
        let detected = null;
        if (tide <= 28 && (snailLoss >= 1 || musselLoss >= 1)) {
          const strength = Math.min(3, Math.max(1, Math.ceil(totalLoss / 3)));
          detected = {
            id: "low_tide_stress",
            strength,
            delta: Math.min(scoreDelta, -totalLoss || -1)
          };
        } else if (tide <= 20 && shadeCoverage < 6 && scoreDelta <= 0) {
          const strength = Math.min(2, Math.max(1, Math.round((6 - shadeCoverage) / 3)));
          detected = { id: "low_tide_stress", strength, delta: scoreDelta || -1 };
        } else if (tide <= 28 && scoreDelta < 0 && shadeCoverage < 4) {
          const strength = Math.min(2, Math.max(1, Math.round(Math.abs(scoreDelta) / 3)));
          detected = { id: "low_tide_stress", strength, delta: scoreDelta };
        }
        return detected;
      }
    },
    {
      id: "shade_protection",
      label: "遮阴保护",
      polarity: "positive",
      detect: (ctx) => {
        const { prevSum, currSum, tide, prevComps, currComps, rawNetDelta } = ctx;
        const shelterDelta = currComps.shelter - prevComps.shelter;
        const shadeDelta = currSum.shade - prevSum.shade;
        const rockDelta = currSum.rock - prevSum.rock;
        const scoreDelta = rawNetDelta;
        if ((shadeDelta > 0 || rockDelta > 0) && shelterDelta > 0) {
          const strength = Math.min(3, Math.max(1, Math.round(shelterDelta / 2)));
          const actualDelta =
            Math.round(scoreDelta) >= 0
              ? Math.round(Math.max(1, shelterDelta))
              : Math.round(shelterDelta);
          return { id: "shade_protection", strength, delta: actualDelta };
        }
        if (
          tide <= 35 &&
          currSum.shade >= 2 &&
          scoreDelta > 0 &&
          currSum.snails >= prevSum.snails
        ) {
          const strength = Math.min(2, Math.max(1, Math.round(scoreDelta / 2)));
          return { id: "shade_protection", strength, delta: Math.round(scoreDelta) };
        }
        return null;
      }
    },
    {
      id: "kelp_expansion",
      label: "海藻扩张",
      polarity: "positive",
      detect: (ctx) => {
        const { prevSum, currSum, prevComps, currComps, rawNetDelta } = ctx;
        const kelpDelta = currSum.kelp - prevSum.kelp;
        const foodDelta = currComps.food - prevComps.food;
        if (kelpDelta > 0 && foodDelta > 0) {
          const strength = Math.min(3, Math.max(1, kelpDelta));
          return { id: "kelp_expansion", strength, delta: Math.round(foodDelta) };
        }
        const snailDelta = currSum.snails - prevSum.snails;
        if (kelpDelta > 0 && snailDelta > 0) {
          const strength = Math.min(2, Math.max(1, Math.ceil((kelpDelta + snailDelta) / 3)));
          const scoreDelta = rawNetDelta;
          return { id: "kelp_expansion", strength, delta: Math.max(1, Math.round(scoreDelta)) };
        }
        return null;
      }
    },
    {
      id: "predation_pressure",
      label: "捕食压力",
      polarity: "negative",
      detect: (ctx) => {
        const { prevSum, currSum, rawNetDelta } = ctx;
        const starDelta = currSum.stars - prevSum.stars;
        const musselDelta = currSum.mussels - prevSum.mussels;
        const snailDelta = currSum.snails - prevSum.snails;
        const crabDelta = currSum.crabs - prevSum.crabs;
        let predLoss = 0;
        if (starDelta >= 0 && musselDelta < 0 && prevSum.stars > 0)
          predLoss += Math.abs(musselDelta);
        if (crabDelta >= 0 && snailDelta < 0 && prevSum.crabs > 0) predLoss += Math.abs(snailDelta);
        const scoreDelta = rawNetDelta;
        if (predLoss >= 2) {
          const strength = Math.min(3, Math.max(1, Math.round(predLoss / 2)));
          return { id: "predation_pressure", strength, delta: Math.round(scoreDelta) };
        }
        if (starDelta > 0) {
          const strength = Math.min(2, Math.max(1, starDelta));
          return { id: "predation_pressure", strength, delta: Math.round(scoreDelta) || -1 };
        }
        return null;
      }
    },
    {
      id: "mussel_overcrowd",
      label: "贝类过密",
      polarity: "negative",
      detect: (ctx) => {
        const { currSum, prevComps, currComps } = ctx;
        const crowdDelta = currComps.crowdPenalty - prevComps.crowdPenalty;
        if (currSum.mussels > 28 && crowdDelta > 0) {
          const strength = Math.min(3, Math.max(1, Math.round(crowdDelta / 3)));
          return { id: "mussel_overcrowd", strength, delta: -Math.round(crowdDelta) };
        }
        if (currSum.mussels > 28) {
          const strength = Math.min(2, Math.max(1, Math.round((currSum.mussels - 28) / 8)));
          return {
            id: "mussel_overcrowd",
            strength,
            delta: -Math.round(currComps.crowdPenalty) || -1
          };
        }
        return null;
      }
    },
    {
      id: "species_balance",
      label: "物种平衡",
      polarity: "neutral",
      detect: (ctx) => {
        const { prevComps, currComps } = ctx;
        const balanceDelta = currComps.balance - prevComps.balance;
        if (Math.abs(balanceDelta) >= 3) {
          const strength = Math.min(3, Math.max(1, Math.round(Math.abs(balanceDelta) / 3)));
          return { id: "species_balance", strength, delta: Math.round(balanceDelta) };
        }
        return null;
      }
    }
  ];

  function visibleImpactsForScoreDelta(impacts, netDelta) {
    if (netDelta === 0) return [];
    const direction = Math.sign(netDelta);
    const maxMagnitude = Math.abs(netDelta);
    return impacts
      .filter((impact) => {
        if (Math.sign(impact.delta) !== direction) return false;
        if (direction > 0) return impact.polarity !== "negative";
        return impact.polarity !== "positive";
      })
      .map((impact) => ({
        ...impact,
        rawDelta: impact.delta,
        delta: direction * Math.min(Math.abs(impact.delta), maxMagnitude)
      }));
  }

  function explainStabilityChange(prevSum, currSum, tide) {
    const prevComps = stabilityComponents(prevSum);
    const currComps = stabilityComponents(currSum);
    const rawPrevScore = rawScoreFromComponents(prevComps);
    const rawCurrScore = rawScoreFromComponents(currComps);
    const rawNetDelta = rawCurrScore - rawPrevScore;
    const prevScore = clampScore(rawPrevScore);
    const currScore = clampScore(rawCurrScore);
    const netDelta = currScore - prevScore;

    const ctx = {
      prevSum,
      currSum,
      tide,
      prevComps,
      currComps,
      rawPrevScore,
      rawCurrScore,
      rawNetDelta,
      prevScore,
      currScore,
      netDelta
    };
    const impacts = [];

    for (const cat of IMPACT_CATEGORIES) {
      const result = cat.detect(ctx);
      if (result) {
        impacts.push({
          ...result,
          label: cat.label,
          polarity: cat.polarity
        });
      }
    }

    const visibleImpacts = visibleImpactsForScoreDelta(impacts, netDelta);
    visibleImpacts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    let summary;
    if (netDelta > 0) {
      const positive = visibleImpacts.filter((i) => i.delta > 0);
      if (positive.length > 0) {
        summary = `${positive[0].label}推动稳定度上升 ${netDelta} 点`;
      } else {
        summary = `生态状况改善，稳定度上升 ${netDelta} 点`;
      }
    } else if (netDelta < 0) {
      const negative = visibleImpacts.filter((i) => i.delta < 0);
      if (negative.length > 0) {
        summary = `${negative[0].label}导致稳定度下降 ${Math.abs(netDelta)} 点`;
      } else {
        summary = `生态压力增加，稳定度下降 ${Math.abs(netDelta)} 点`;
      }
    } else {
      summary = "本轮生态状态保持平稳";
    }

    return {
      prevScore,
      currScore,
      netDelta,
      rawPrevScore: Math.round(rawPrevScore),
      rawCurrScore: Math.round(rawCurrScore),
      rawNetDelta: Math.round(rawNetDelta),
      summary,
      impacts: visibleImpacts,
      components: {
        prev: prevComps,
        curr: currComps
      },
      populationDelta: {
        snails: currSum.snails - prevSum.snails,
        crabs: currSum.crabs - prevSum.crabs,
        mussels: currSum.mussels - prevSum.mussels,
        stars: currSum.stars - prevSum.stars,
        kelp: currSum.kelp - prevSum.kelp,
        rock: currSum.rock - prevSum.rock,
        shade: currSum.shade - prevSum.shade
      }
    };
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
    stabilityComponents,
    clampScore,
    rawScoreFromComponents,
    stabilityScore,
    visibleImpactsForScoreDelta,
    explainStabilityChange,
    IMPACT_CATEGORIES,
    neighbors
  };
});
