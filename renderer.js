(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory(root.TidepoolState || require("./state.js"));
  } else {
    root.TidepoolRenderer = factory(root.TidepoolState);
  }
})(typeof self !== "undefined" ? self : this, function (TidepoolState) {
  const { state, tideLevel } = TidepoolState;

  function createRenderer(canvas) {
    const ctx = canvas.getContext("2d");

    function cellSize() {
      return {
        w: canvas.width / state.cols,
        h: canvas.height / state.rows
      };
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
        const angle = -Math.PI / 2 + (i * Math.PI) / points;
        const r = i % 2 ? radius * 0.42 : radius;
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();
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
          ctx.quadraticCurveTo(
            x + w * (0.22 + i * 0.16),
            y + h * 0.45,
            x + w * (0.38 + i * 0.13),
            y + h * 0.18
          );
          ctx.stroke();
        }
      }

      if (cell.mussel) {
        for (let i = 0; i < cell.mussel; i += 1) {
          ctx.fillStyle = "#344b64";
          ctx.beginPath();
          ctx.ellipse(
            x + w * (0.32 + i * 0.14),
            y + h * 0.65,
            w * 0.08,
            h * 0.12,
            -0.55,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }

      drawAnimals(cell, x, y, w, h);

      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.strokeRect(x, y, w, h);
    }

    function draw() {
      const level = tideLevel();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      state.grid
        .flat()
        .forEach((cell) =>
          drawCell(cell, canvas.width / state.cols, canvas.height / state.rows, level)
        );
      ctx.fillStyle = `rgba(37, 91, 107, ${0.18 + level / 420})`;
      ctx.fillRect(0, canvas.height * (1 - level / 100), canvas.width, canvas.height);
    }

    function getCanvasCoords(event) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      return { x, y };
    }

    function getCellAt(x, y) {
      const size = cellSize();
      const cellX = Math.floor(x / size.w);
      const cellY = Math.floor(y / size.h);
      return state.grid[cellY]?.[cellX] || null;
    }

    return {
      canvas,
      ctx,
      cellSize,
      rounded,
      star,
      drawAnimals,
      drawCell,
      draw,
      getCanvasCoords,
      getCellAt
    };
  }

  return {
    createRenderer
  };
});
