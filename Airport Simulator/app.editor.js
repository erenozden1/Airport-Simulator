// app.editor.js: the interactive grid editor — loaded right after
// app.config.js. Success-rate/cost palette building, tile placement logic,
// the main canvas draw() (plus the mini run-2..N panels it keeps in sync),
// and mouse/keyboard interaction with the canvas.

// ---------- Success-rate tiers ----------
// kiosk/baggage/tagomat can be bought at any of these reliability tiers;
// counters are always 100% (a human doesn't have a "success rate"). The
// listed TILE_TYPES costPerHour is priced at SUCCESS_RATE_BASE_PCT — each
// step up the tier ladder costs SUCCESS_RATE_STEP_MULT (20%) more.
const SUCCESS_RATE_OPTIONS = [60, 70, 80, 90, 95, 99];
const SUCCESS_RATE_BASE_PCT = 70;
const SUCCESS_RATE_STEP_MULT = 1.2;
const SUCCESS_PCT_FIELD = { kiosk: "kioskSuccessPct", baggage: "bagdropSuccessPct", tagomat: "tagomatSuccessPct" };

function successCostMultiplier(pct) {
  const baseIdx = SUCCESS_RATE_OPTIONS.indexOf(SUCCESS_RATE_BASE_PCT);
  const idx = SUCCESS_RATE_OPTIONS.indexOf(pct);
  return Math.pow(SUCCESS_RATE_STEP_MULT, idx - baseIdx);
}

// hourly cost of one unit of `type` at its currently selected success-rate
// tier; types without a tunable success rate (counter, workers) just use
// their flat rate
function effectiveCostPerHour(type) {
  const def = PLACEABLE_TYPES[type];
  const field = SUCCESS_PCT_FIELD[type];
  return field ? def.costPerHour * successCostMultiplier(state[field]) : def.costPerHour;
}

// row of tier buttons for a machine's palette card, or a plain "always 100%"
// note for types with no tunable success rate (the counter)
function successRateRow(type) {
  const field = SUCCESS_PCT_FIELD[type];
  if (!field) return null; // counter: no tunable success rate, nothing to show
  const container = document.createElement("div");
  const label = document.createElement("div");
  label.className = "success-rate-label";
  label.textContent = t("successRateLabel");
  container.appendChild(label);
  const wrap = document.createElement("div");
  wrap.className = "success-rate-row";
  for (const pct of SUCCESS_RATE_OPTIONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "success-rate-btn";
    btn.textContent = `${pct}%`;
    if (state[field] === pct) btn.classList.add("active");
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // don't also arm this tile as the placement tool
      state[field] = pct;
      buildPalette(); // refresh this card's cost line and the active button
      updateLayoutCost();
    });
    wrap.appendChild(btn);
  }
  container.appendChild(wrap);
  return container;
}

function buildPalette() {
  tileListEl.innerHTML = "";
  // a tile type the user has switched off every operation for can't do
  // anything useful, so it's not offered as a placement tool at all
  // (workers have no tileOps entry — this only ever concerns machine types)
  if (state.selectedTool && state.tileOps[state.selectedTool] && !Object.values(state.tileOps[state.selectedTool]).some(Boolean)) {
    state.selectedTool = null;
  }
  for (const [key, def] of Object.entries(TILE_TYPES)) {
    if (!Object.values(state.tileOps[key]).some(Boolean)) continue;
    const card = document.createElement("div");
    card.className = "tile-card";
    card.dataset.type = key;

    const top = document.createElement("div");
    top.className = "tile-top";
    const swatch = document.createElement("div");
    swatch.className = "tile-swatch";
    swatch.style.background = def.color;
    const name = document.createElement("div");
    name.className = "tile-name";
    name.textContent = t(def.labelKey);
    const size = document.createElement("span");
    size.className = "tile-size";
    size.textContent = `${def.baseW}x${def.baseH}`;
    top.appendChild(swatch);
    top.appendChild(name);
    top.appendChild(size);
    card.appendChild(top);
    card.appendChild(costLine(effectiveCostPerHour(key)));
    const rateRow = successRateRow(key);
    if (rateRow) card.appendChild(rateRow);

    if (def.orientable) {
      const orientBtn = document.createElement("button");
      orientBtn.className = "orient-btn";
      orientBtn.textContent = t(state.orientation[key] === "v" ? "rotateV" : "rotateH");
      orientBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.orientation[key] = state.orientation[key] === "h" ? "v" : "h";
        orientBtn.textContent = t(state.orientation[key] === "h" ? "rotateH" : "rotateV");
        // rotating also arms this tile for placement; if it's already the
        // active tool, keep it selected instead of toggling it off
        if (state.selectedTool !== key) selectTool(key);
        draw(); // refresh the hover preview with the new orientation
      });
      card.appendChild(orientBtn);
    }

    card.addEventListener("click", () => selectTool(key));
    tileListEl.appendChild(card);
  }
  updateTileCounts();
  buildWorkerPalette();
  updateLayoutCost();
}

// workers aren't gated by Tile Operations (they have no operations of their
// own), so this is simpler than buildPalette(): always show both, no
// orientation button since a 1x1 person-icon has no meaningful rotation
function buildWorkerPalette() {
  const el = document.getElementById("worker-list");
  if (!el) return;
  el.innerHTML = "";
  for (const [key, def] of Object.entries(WORKER_TYPES)) {
    const card = document.createElement("div");
    card.className = "tile-card";
    card.dataset.type = key;

    const top = document.createElement("div");
    top.className = "tile-top";
    const swatch = document.createElement("div");
    swatch.className = "tile-swatch worker-swatch";
    swatch.style.background = def.color;
    const name = document.createElement("div");
    name.className = "tile-name";
    name.textContent = t(def.labelKey);
    const size = document.createElement("span");
    size.className = "tile-size";
    size.textContent = `${def.baseW}x${def.baseH}`;
    top.appendChild(swatch);
    top.appendChild(name);
    top.appendChild(size);
    card.appendChild(top);
    card.appendChild(costLine(effectiveCostPerHour(key)));

    card.addEventListener("click", () => selectTool(key));
    el.appendChild(card);
  }
  updateWorkerCounts();
}

// summary line of how many of each worker type are on the grid
function updateWorkerCounts() {
  const el = document.getElementById("worker-counts");
  if (!el) return;
  const parts = [];
  for (const [key, def] of Object.entries(WORKER_TYPES)) {
    const n = state.counts[key] ? state.counts[key].placed : 0;
    const names = t(def.countKey);
    parts.push(`${n} ${n === 1 ? names[0] : names[1]}`);
  }
  el.textContent = parts.join(" · ");
}

function updateProgress() {
  updateTileCounts();
  updateWorkerCounts();
  updateLayoutCost();
}

// total hourly running cost of everything currently on the grid
function updateLayoutCost() {
  const el = document.getElementById("layout-cost");
  if (!el) return;
  let total = 0;
  for (const key of Object.keys(PLACEABLE_TYPES)) {
    const n = state.counts[key] ? state.counts[key].placed : 0;
    total += n * effectiveCostPerHour(key);
  }
  el.textContent = `${t("layoutCost")}: ${tn("costPerHour", formatCost(total))}`;
}

// summary of how many of each tile type are on the grid, e.g. "5 kiosks - 3 bag drops - 2 counters"
function updateTileCounts() {
  const el = document.getElementById("tile-counts");
  if (!el) return;
  const parts = [];
  for (const [key, def] of Object.entries(TILE_TYPES)) {
    const n = state.counts[key] ? state.counts[key].placed : 0;
    const names = t(def.countKey);
    parts.push(`${n} ${n === 1 ? names[0] : names[1]}`);
  }
  el.textContent = parts.join(" · ");
}

function selectTool(type) {
  state.selectedTool = state.selectedTool === type ? null : type;
  document.querySelectorAll(".tile-card").forEach((el) => {
    el.classList.toggle("active", el.dataset.type === state.selectedTool);
  });
  updateStatusTool();
}

function updateStatusTool() {}

// ---------- Tile placement logic ----------
function getOrientedSize(type) {
  const def = PLACEABLE_TYPES[type];
  if (!def.orientable || state.orientation[type] === "h") {
    return { w: def.baseW, h: def.baseH };
  }
  return { w: def.baseH, h: def.baseW };
}

function canPlace(type, x, y) {
  const { w, h } = getOrientedSize(type);
  if (x < 0 || y < 0 || x + w > state.width || y + h > state.height) return false;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const idx = (y + dy) * state.width + (x + dx);
      if (state.grid[idx] !== -1) return false;
    }
  }
  return true;
}

// per-type indices in placement order (K1, K2, SBD1, C1...). Deleting a tile
// renumbers the rest of its type so the labels stay compact with no gaps.
function renumberTiles() {
  const counters = {};
  for (const tile of state.tiles.values()) {
    counters[tile.type] = (counters[tile.type] || 0) + 1;
    tile.num = counters[tile.type];
  }
}

function placeTile(type, x, y) {
  if (!canPlace(type, x, y)) return false;
  const { w, h } = getOrientedSize(type);
  const id = state.nextTileId++;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const idx = (y + dy) * state.width + (x + dx);
      state.grid[idx] = id;
    }
  }
  const tile = { type, x, y, w, h };
  // default to a side that's actually walkable right now if one exists, so a
  // freshly placed tile isn't dead on arrival; the user can click to change it
  const sides = allowedSides(tile);
  tile.queueSide = sides.find((s) => sideCandidates(tile, s).some((c) => isWalkable(c.x, c.y))) || sides[0];
  state.tiles.set(id, tile);
  state.counts[type].placed++;
  renumberTiles();
  updateProgress(type);
  // during a run, a newly placed machine opens for business immediately
  // (workers aren't stations — they just boost nearby ones — so skip this)
  if (sim.running && TILE_TYPES[type]) {
    const queueCell = queueCellOf(tile);
    if (queueCell) {
      const queuePath = buildQueuePath(queueCell, new Set(sim.stations.flatMap((s) => s.queuePath.map((p) => p.x + "," + p.y))));
      sim.stations.push({ tile, type, queueCell, queuePath, queue: [], serving: null, serviceLeft: 0, enRoute: 0, served: 0, peakQueue: 0, busySeconds: 0 });
    }
  }
  return true;
}

function eraseAt(x, y) {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return false;
  const idx = y * state.width + x;
  const id = state.grid[idx];
  if (id === -1) return false;
  const tile = state.tiles.get(id);
  for (let dy = 0; dy < tile.h; dy++) {
    for (let dx = 0; dx < tile.w; dx++) {
      state.grid[(tile.y + dy) * state.width + (tile.x + dx)] = -1;
    }
  }
  state.tiles.delete(id);
  state.counts[tile.type].placed--;
  renumberTiles();
  updateProgress(tile.type);
  // during a run, closing a machine sends its queue (and anyone heading there) elsewhere
  if (sim.running) {
    const stIdx = sim.stations.findIndex((s) => s.tile === tile);
    if (stIdx >= 0) {
      const st = sim.stations.splice(stIdx, 1)[0];
      const displaced = [...st.queue];
      if (st.serving) displaced.push(st.serving);
      st.queue = [];
      st.serving = null;
      for (const a of sim.agents) {
        if (!a.done && a.station === st && !displaced.includes(a)) displaced.push(a); // en route
      }
      for (const a of displaced) {
        a.station = null;
        a.cx = Math.round(a.x);
        a.cy = Math.round(a.y);
        dispatchGoal(a);
      }
    }
  }
  return true;
}

// wipe every placed machine (grid size and settings stay as they are)
const clearGridBtn = document.getElementById("clear-grid-btn");

function clearGrid() {
  if (!state.grid || sims.some((s) => s.running)) return; // layout is locked mid-run
  state.grid.fill(-1);
  state.tiles.clear();
  state.nextTileId = 1;
  for (const key of Object.keys(PLACEABLE_TYPES)) state.counts[key].placed = 0;
  state.selectedTool = null;
  resetSim(); // also clears leftover passengers from a finished run
  buildPalette();
  updateTileCounts();
  draw();
}

clearGridBtn.addEventListener("click", clearGrid);

// ---------- Canvas rendering ----------
function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = "#14171e";
  ctx.fillRect(0, 0, rect.width, rect.height);

  const { zoom, panX, panY } = state;
  const cellPx = CELL_SIZE * zoom;

  // visible cell range
  const col0 = Math.max(0, Math.floor(-panX / cellPx));
  const row0 = Math.max(0, Math.floor(-panY / cellPx));
  const col1 = Math.min(state.width, Math.ceil((rect.width - panX) / cellPx));
  const row1 = Math.min(state.height, Math.ceil((rect.height - panY) / cellPx));

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // grid background for the actual grid area
  ctx.fillStyle = "#1b1f27";
  ctx.fillRect(0, 0, state.width * CELL_SIZE, state.height * CELL_SIZE);

  // grid lines (skip if too small to matter)
  if (cellPx >= 4) {
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    for (let c = col0; c <= col1; c++) {
      ctx.moveTo(c * CELL_SIZE, row0 * CELL_SIZE);
      ctx.lineTo(c * CELL_SIZE, row1 * CELL_SIZE);
    }
    for (let r = row0; r <= row1; r++) {
      ctx.moveTo(col0 * CELL_SIZE, r * CELL_SIZE);
      ctx.lineTo(col1 * CELL_SIZE, r * CELL_SIZE);
    }
    ctx.stroke();
  }

  // border of the whole grid
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2 / zoom;
  ctx.strokeRect(0, 0, state.width * CELL_SIZE, state.height * CELL_SIZE);

  // gates: colored 3-cell segments on the borderline, labels written outside the grid
  const gateW = state.width * CELL_SIZE;
  const gateH = state.height * CELL_SIZE;
  ctx.lineWidth = CELL_SIZE * 0.3;
  ctx.font = `bold ${CELL_SIZE * 0.9}px sans-serif`;
  for (const g of state.gates) {
    ctx.strokeStyle = GATE_COLORS[g.type];
    ctx.fillStyle = GATE_COLORS[g.type];
    const label = g.type === "entrance" ? t("entrance") : t("exit");
    const a = g.start * CELL_SIZE;
    const b = (g.start + g.len) * CELL_SIZE;
    const mid = (a + b) / 2;
    ctx.beginPath();
    if (g.side === "top") {
      ctx.moveTo(a, 0);
      ctx.lineTo(b, 0);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, mid, -CELL_SIZE * 0.5);
    } else if (g.side === "right") {
      ctx.moveTo(gateW, a);
      ctx.lineTo(gateW, b);
      ctx.stroke();
      ctx.save();
      ctx.translate(gateW + CELL_SIZE * 0.5, mid);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, 0, 0);
      ctx.restore();
    } else if (g.side === "left") {
      ctx.moveTo(0, a);
      ctx.lineTo(0, b);
      ctx.stroke();
      ctx.save();
      ctx.translate(-CELL_SIZE * 0.5, mid);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }

  // every placed worker's effect zone, tinted just enough to read against the
  // grid floor without drawing attention away from the machines/people on it
  for (const tile of state.tiles.values()) {
    if (WORKER_TYPES[tile.type]) drawWorkerEffectOverlay(tile.type, tile.x, tile.y, 0.07);
  }

  // tiles
  for (const tile of state.tiles.values()) {
    if (tile.x + tile.w < col0 || tile.x > col1 || tile.y + tile.h < row0 || tile.y > row1) continue;
    const def = PLACEABLE_TYPES[tile.type];
    const isWorker = !!WORKER_TYPES[tile.type];
    const boostPct = isWorker ? 0 : boostPctFor(tile);
    const accelerated = boostPct > 0;
    const boostColor = accelerated ? boostColorForPct(boostPct) : null;
    const cx = (tile.x + tile.w / 2) * CELL_SIZE;
    const cy = (tile.y + tile.h / 2) * CELL_SIZE;
    if (isWorker) {
      // workers are drawn as a person (same chibi top-view body as passengers,
      // so they visibly belong to the same "person" family) but with a fixed,
      // non-random uniform colour instead of a passenger's randomized outfit,
      // plus a coloured ring on the ground beneath their feet — no passenger
      // ever has one, so it reads as "staff" at a glance regardless of colour
      const r = CELL_SIZE * 0.36;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
      ctx.strokeStyle = def.color;
      ctx.lineWidth = CELL_SIZE * 0.07;
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      drawPersonBody(ctx, r, WORKER_LOOK[tile.type]);
      ctx.restore();
    } else {
      ctx.fillStyle = def.color;
      ctx.fillRect(tile.x * CELL_SIZE + 1, tile.y * CELL_SIZE + 1, tile.w * CELL_SIZE - 2, tile.h * CELL_SIZE - 2);
      // sped up by a nearby worker: a pulsing gold outline, so the tile's own
      // colour (what type of machine it is) stays perfectly readable
      if (accelerated) {
        drawBoostGlow(tile.x * CELL_SIZE, tile.y * CELL_SIZE, tile.w * CELL_SIZE, tile.h * CELL_SIZE, performance.now(), boostColor);
      }
    }
    // tile label (K1, SBD3, IN2, …)
    if (isWorker) {
      // below the ring, since the tile center is now a face, not open fill
      const label = shortLabel(tile.type) + tile.num;
      const r = CELL_SIZE * 0.36;
      ctx.font = `${CELL_SIZE * 0.34}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeText(label, cx, cy + r * 1.4 + 2);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, cx, cy + r * 1.4 + 2);
    } else {
      // shown always, shrunk to fit the tile
      ctx.fillStyle = "#0b0d12";
      const label = shortLabel(tile.type) + tile.num;
      const vertical = tile.h > tile.w; // rotated tile: rotate the text with it
      // fit the label to the tile: along its long side (width) and short side (height)
      const along = (vertical ? tile.h : tile.w) * CELL_SIZE;
      const across = (vertical ? tile.w : tile.h) * CELL_SIZE;
      const fitByWidth = (along * 0.86) / (label.length * 0.6);
      const fitByHeight = across * 0.62;
      const fontSize = Math.min(CELL_SIZE * 0.5, fitByWidth, fitByHeight);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.translate(cx, cy);
      if (vertical) ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, 0);
      ctx.restore();
      drawQueueArrow(tile);
      if (accelerated) {
        drawBoostBadge((tile.x + tile.w) * CELL_SIZE, tile.y * CELL_SIZE, CELL_SIZE * 0.26, performance.now(), boostColor);
      }
    }
  }

  // agents (passengers), drawn as top-view people
  for (const a of sim.agents) {
    if (a.done) continue;
    drawPerson(a);
  }

  // hover highlight
  if (state.hoverCell && state.selectedTool) {
    const { w, h } = getOrientedSize(state.selectedTool);
    const ok = canPlace(state.selectedTool, state.hoverCell.x, state.hoverCell.y);
    ctx.fillStyle = ok ? "rgba(91,140,255,0.35)" : "rgba(255,107,107,0.35)";
    ctx.fillRect(state.hoverCell.x * CELL_SIZE, state.hoverCell.y * CELL_SIZE, w * CELL_SIZE, h * CELL_SIZE);
    // about to place a worker: preview exactly which cells its bonus reaches
    if (ok && WORKER_TYPES[state.selectedTool]) {
      drawWorkerEffectOverlay(state.selectedTool, state.hoverCell.x, state.hoverCell.y, 0.22);
    }
  }

  ctx.restore();
  drawMinis(); // keep the extra runs in sync with every main redraw
}

// ---------- Mini runs (runs 2-N) ----------
// small top-down views of the extra simulations: same layout, agents as dots.
// The strip scrolls and the run count is uncapped, so only the panels actually
// scrolled into view are redrawn each frame — an IntersectionObserver tracks
// which indices are visible instead of checking bounding rects every frame.
const miniSimsEl = document.getElementById("mini-sims");
let miniCanvases = [];
let miniTimeEls = [];
let visibleMiniIndices = new Set();
let miniObserver = null;

// rebuild the .mini-sim panels to match `count` extra runs (runs 2..count+1)
function rebuildMiniPanels(count) {
  if (miniObserver) miniObserver.disconnect();
  visibleMiniIndices = new Set();
  miniSimsEl.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const panel = document.createElement("div");
    panel.className = "mini-sim";
    panel.dataset.index = i;
    panel.innerHTML =
      `<div class="mini-label"><span data-i18n="run">${t("run")}</span> ${i + 2} &middot; <span class="mini-time">00:00</span></div>` +
      `<canvas></canvas>`;
    miniSimsEl.appendChild(panel);
  }
  miniSimsEl.style.display = count > 0 ? "" : "none";
  miniCanvases = Array.from(document.querySelectorAll(".mini-sim canvas"));
  miniTimeEls = Array.from(document.querySelectorAll(".mini-sim .mini-time"));

  if (count > 0) {
    miniObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const idx = Number(entry.target.dataset.index);
        if (entry.isIntersecting) visibleMiniIndices.add(idx);
        else visibleMiniIndices.delete(idx);
      }
    }, { root: miniSimsEl, threshold: 0 });
    document.querySelectorAll(".mini-sim").forEach((panel) => miniObserver.observe(panel));
  }
}
rebuildMiniPanels(DEFAULT_RUNS - 1); // populate the panels the static HTML left empty

// apply a new total run count: rebuilds the sims array and the mini panels to match
function rebuildRuns(n) {
  const count = Math.max(MIN_RUNS, Math.round(n) || DEFAULT_RUNS);
  if (count === sims.length) return;
  // carry the currently-selected speed over to the new run objects — makeSim()
  // defaults to 1x, which would otherwise silently desync from what the speed
  // button still displays (it's never touched here, so it'd keep reading 500x
  // while the new sims actually ran at 1x)
  const currentSpeedMul = sims.length ? sims[0].speedMul : 1;
  sims = Array.from({ length: count }, makeSim);
  for (const s of sims) s.speedMul = currentSpeedMul;
  rebuildMiniPanels(count - 1);
  resetSim();
  draw();
}

numRunsInput.addEventListener("change", () => rebuildRuns(Number(numRunsInput.value)));

function drawMinis() {
  for (const i of visibleMiniIndices) drawMini(i);
}

function drawMini(i) {
  const s = sims[i + 1];
  const c = miniCanvases[i];
  const mctx = c.getContext("2d");
  const rect = c.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.round(rect.width * dpr);
  const ph = Math.round(rect.height * dpr);
  if (c.width !== pw || c.height !== ph) {
    c.width = pw;
    c.height = ph;
  }
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mctx.fillStyle = "#14171e";
  mctx.fillRect(0, 0, rect.width, rect.height);
  if (!state.width || !state.height) return;

  const pad = 6;
  const scale = Math.min((rect.width - pad * 2) / state.width, (rect.height - pad * 2) / state.height);
  const ox = (rect.width - state.width * scale) / 2;
  const oy = (rect.height - state.height * scale) / 2;

  // floor + border
  mctx.fillStyle = "#1c212b";
  mctx.fillRect(ox, oy, state.width * scale, state.height * scale);
  mctx.strokeStyle = "#333a48";
  mctx.strokeRect(ox, oy, state.width * scale, state.height * scale);

  // gates as colored strips on the border
  const strip = Math.max(2, scale * 0.3);
  for (const g of state.gates) {
    mctx.fillStyle = GATE_COLORS[g.type];
    if (g.side === "top") mctx.fillRect(ox + g.start * scale, oy, g.len * scale, strip);
    else if (g.side === "bottom") mctx.fillRect(ox + g.start * scale, oy + state.height * scale - strip, g.len * scale, strip);
    else if (g.side === "left") mctx.fillRect(ox, oy + g.start * scale, strip, g.len * scale);
    else if (g.side === "right") mctx.fillRect(ox + state.width * scale - strip, oy + g.start * scale, strip, g.len * scale);
  }

  // machines and workers
  for (const tile of state.tiles.values()) {
    mctx.fillStyle = PLACEABLE_TYPES[tile.type].color;
    mctx.fillRect(ox + tile.x * scale + 0.5, oy + tile.y * scale + 0.5, tile.w * scale - 1, tile.h * scale - 1);
  }

  // passengers as dots (shirt colors), elderly get a white outline
  const r = Math.max(1.5, scale * 0.35);
  for (const a of s.agents) {
    if (a.done) continue;
    mctx.beginPath();
    mctx.arc(ox + (a.x + 0.5) * scale, oy + (a.y + 0.5) * scale, r, 0, Math.PI * 2);
    mctx.fillStyle = a.shirt;
    mctx.fill();
    if (a.elderly) {
      mctx.strokeStyle = "#ffffff";
      mctx.lineWidth = 1;
      mctx.stroke();
    }
  }

  // header: elapsed time, green check when this run is done
  if (miniTimeEls[i]) miniTimeEls[i].textContent = formatSimTime(s.elapsed) + (s.finished ? " ✓" : "");
  c.parentElement.classList.toggle("done", s.finished);
}

// top-view person: shoulders + head + hair, facing the direction of travel
function drawPerson(a) {
  const px = (a.x + 0.5) * CELL_SIZE;
  const py = (a.y + 0.5) * CELL_SIZE;
  const r = CELL_SIZE * 0.36;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(a.angle);

  // a wheeled suitcase seen from above: a narrow rectangle pushed slightly
  // ahead of the person on their left, until it's dropped off
  if (a.hasBag) {
    const bagDepth = r * 0.38; // along the walking direction (narrow)
    const bagWidth = r * 0.85; // across it (the long side of the case)
    const bagX = r * 0.4; // slightly in front
    const bagY = -r * 1.3; // on the left side
    ctx.beginPath();
    ctx.roundRect(bagX, bagY, bagDepth, bagWidth, r * 0.08);
    ctx.fillStyle = a.bag;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = CELL_SIZE * 0.02;
    ctx.stroke();
    // top-view detail: the case's center seam across the lid
    ctx.beginPath();
    ctx.moveTo(bagX + bagDepth / 2, bagY + r * 0.08);
    ctx.lineTo(bagX + bagDepth / 2, bagY + bagWidth - r * 0.08);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = CELL_SIZE * 0.015;
    ctx.stroke();
    // handle bar from the case to the hand
    ctx.beginPath();
    ctx.moveTo(bagX + bagDepth / 2, bagY + bagWidth);
    ctx.lineTo(r * 0.25, -r * 0.6);
    ctx.strokeStyle = "#666";
    ctx.lineWidth = CELL_SIZE * 0.03;
    ctx.stroke();
  }

  // elderly passengers carry a walking stick, held out to their right side
  if (a.elderly) {
    ctx.beginPath();
    ctx.moveTo(r * 0.1, r * 0.85);
    ctx.lineTo(r * 1.05, r * 1.05);
    ctx.strokeStyle = "#8b5a2b";
    ctx.lineWidth = CELL_SIZE * 0.05;
    ctx.lineCap = "round";
    ctx.stroke();
    // hand gripping the stick
    ctx.beginPath();
    ctx.arc(r * 0.1, r * 0.85, r * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = a.skin;
    ctx.fill();
  }

  // the body itself (shoulders + head + hair), shared with the boarding page
  drawPersonBody(ctx, r, a);

  ctx.restore();
}

// The core top-view body — chibi-proportioned shoulders, head, hair, and a
// hint of a face — drawn at the origin facing +x. Shared by the grid view and
// the boarding page so passengers look identical. `look` supplies
// { shirt, skin, hair }. The caller handles translate/rotate.
function drawPersonBody(g, r, look) {
  // shoulders (ellipse wider than deep, so it reads as a body from above) —
  // kept a little smaller than the head for chibi-style proportions
  g.beginPath();
  g.ellipse(0, 0, r * 0.56, r * 0.94, 0, 0, Math.PI * 2);
  g.fillStyle = look.shirt;
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.lineWidth = r * 0.0556; // == CELL_SIZE*0.02 on the grid (r = CELL_SIZE*0.36)
  g.stroke();

  // head, nudged toward the facing direction (+x) — oversized on purpose,
  // a bigger head relative to the body reads as "cute" at a glance. Outlined
  // so its edge reads against the shoulders/background regardless of colour.
  const headR = r * 0.58;
  const headX = r * 0.14;
  g.beginPath();
  g.arc(headX, 0, headR, 0, Math.PI * 2);
  g.fillStyle = look.skin;
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.4)";
  g.lineWidth = Math.max(0.5, r * 0.035);
  g.stroke();

  // hair cap: smaller than the head and pushed further back, with its own
  // outline, so it always reads as a distinct shape rather than blending
  // into the skin when the two colours are close in tone
  g.beginPath();
  g.arc(headX - r * 0.22, 0, headR * 0.86, 0, Math.PI * 2);
  g.fillStyle = look.hair;
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.4)";
  g.lineWidth = Math.max(0.5, r * 0.03);
  g.stroke();

  // eyes: white sclera + black pupil, so they pop against any skin or hair
  // colour instead of relying on a faint dot that can vanish into dark hair
  const eyeX = headX + headR * 0.55;
  const eyeOff = headR * 0.3;
  const eyeR = Math.max(0.9, headR * 0.22);
  const pupilR = Math.max(0.5, eyeR * 0.55);
  for (const dir of [-1, 1]) {
    g.beginPath();
    g.arc(eyeX, dir * eyeOff, eyeR, 0, Math.PI * 2);
    g.fillStyle = "#fff";
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.5)";
    g.lineWidth = Math.max(0.4, eyeR * 0.18);
    g.stroke();
    g.beginPath();
    g.arc(eyeX + eyeR * 0.15, dir * eyeOff, pupilR, 0, Math.PI * 2);
    g.fillStyle = "#1a1a1a";
    g.fill();
  }
}

function shortLabel(type) {
  switch (type) {
    case "kiosk": return "K";
    case "baggage": return "SBD";
    case "counter": return "C";
    case "tagomat": return "T";
    case "intern": return "IN";
    case "officer": return "OF";
    default: return "";
  }
}

// ---------- Mouse interaction ----------
function screenToCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const worldX = (sx - state.panX) / state.zoom;
  const worldY = (sy - state.panY) / state.zoom;
  return {
    x: Math.floor(worldX / CELL_SIZE),
    y: Math.floor(worldY / CELL_SIZE),
  };
}

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// pointer events cover mouse, touch, and pen input
canvas.addEventListener("pointerdown", (e) => {
  if (sim.running) return; // layout is locked while the simulation runs
  const cell = screenToCell(e.clientX, e.clientY);
  if (cell.x < 0 || cell.y < 0 || cell.x >= state.width || cell.y >= state.height) return;
  if (e.button === 2) {
    eraseAt(cell.x, cell.y);
    draw();
  } else if (e.button === 0) {
    const hitId = state.grid[cell.y * state.width + cell.x];
    if (hitId !== -1) {
      // clicking an existing machine cycles which side its queue forms on;
      // workers have no queue, so clicking one placed does nothing
      const hitTile = state.tiles.get(hitId);
      if (TILE_TYPES[hitTile.type]) cycleQueueSide(hitTile);
      draw();
    } else if (state.selectedTool) {
      placeTile(state.selectedTool, cell.x, cell.y);
      draw();
    }
  }
});

canvas.addEventListener("pointermove", (e) => {
  const cell = screenToCell(e.clientX, e.clientY);
  if (cell.x >= 0 && cell.y >= 0 && cell.x < state.width && cell.y < state.height) {
    state.hoverCell = cell;
  } else {
    state.hoverCell = null;
  }
  draw();
});

canvas.addEventListener("pointerleave", () => {
  state.hoverCell = null;
  draw();
});

// keep the grid fitted to the window at all times
function refitCanvas() {
  resizeCanvas();
  fitViewToGrid();
  draw();
  if (!boardingModal.classList.contains("hidden")) drawBoardingPage();
}
window.addEventListener("resize", refitCanvas);

// also refit when the canvas container itself changes size
// (e.g. responsive layout stacking panels, orientation change)
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(refitCanvas).observe(canvas.parentElement);
}

// keyboard: Escape deselects tool
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    state.selectedTool = null;
    document.querySelectorAll(".tile-card").forEach((el) => el.classList.remove("active"));
    updateStatusTool();
    draw();
  }
});

