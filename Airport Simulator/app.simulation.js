// app.simulation.js: the simulation engine — loaded right after
// app.boarding.js. The tick loop that drives passenger movement, queueing,
// station service, and failures; start/stop/reset controls.

// ---------- Simulation ----------

// Box-Muller transform: sample from a normal distribution N(mean, sd)
function randNormal(mean, sd) {
  let u1 = 0;
  while (u1 === 0) u1 = Math.random(); // avoid log(0)
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sd;
}

function gatesOfType(type) {
  return state.gates.filter((g) => g.type === type);
}

// walkable = empty cell (kiosks/baggage drops block movement)
function isWalkable(x, y) {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return false;
  return state.grid[y * state.width + x] === -1;
}

// BFS shortest path between cells; returns array of {x,y} or null
function findPath(sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [{ x: sx, y: sy }];
  const w = state.width, h = state.height;
  const prev = new Int32Array(w * h).fill(-2); // -2 unvisited, -1 start
  prev[sy * w + sx] = -1;
  let frontier = [sy * w + sx];
  const dirs = [1, -1, w, -w];
  const target = ty * w + tx;
  while (frontier.length) {
    const next = [];
    for (const idx of frontier) {
      const cx = idx % w, cy = (idx / w) | 0;
      for (const d of dirs) {
        const nIdx = idx + d;
        if (d === 1 && cx === w - 1) continue;
        if (d === -1 && cx === 0) continue;
        const nx = nIdx % w, ny = (nIdx / w) | 0;
        if (ny < 0 || ny >= h) continue;
        if (prev[nIdx] !== -2) continue;
        if (!isWalkable(nx, ny)) continue;
        prev[nIdx] = idx;
        if (nIdx === target) {
          const path = [];
          let cur = nIdx;
          while (cur !== -1) {
            path.push({ x: cur % w, y: (cur / w) | 0 });
            cur = prev[cur];
          }
          return path.reverse();
        }
        next.push(nIdx);
      }
    }
    frontier = next;
  }
  return null;
}

// which grid direction each named side points away from the tile
const SIDE_DIR = { top: { dx: 0, dy: -1 }, bottom: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };

// the sides a user can pick for this tile's queue: all four for a square
// (1x1) tile, but only the two LONG sides for a 2x1 machine — queueing off
// the short end of a long counter looks wrong, so it's never offered.
function allowedSides(tile) {
  if (tile.w === tile.h) return ["top", "right", "bottom", "left"];
  return tile.w > tile.h ? ["top", "bottom"] : ["left", "right"];
}

// every walkable-candidate cell along one named side of a tile, queue-head first
function sideCandidates(tile, side) {
  const { dx, dy } = SIDE_DIR[side];
  const cells = [];
  if (dy !== 0) {
    const y = dy < 0 ? tile.y - 1 : tile.y + tile.h;
    for (let i = 0; i < tile.w; i++) cells.push({ x: tile.x + i, y, dirX: dx, dirY: dy });
  } else {
    const x = dx < 0 ? tile.x - 1 : tile.x + tile.w;
    for (let i = 0; i < tile.h; i++) cells.push({ x, y: tile.y + i, dirX: dx, dirY: dy });
  }
  return cells;
}

// advance a tile's queue side to the next one the user is allowed to pick
// (clockwise for a 1x1 tile, otherwise just toggling between the two long sides)
function cycleQueueSide(tile) {
  const sides = allowedSides(tile);
  const cur = sides.includes(tile.queueSide) ? tile.queueSide : sides[0];
  tile.queueSide = sides[(sides.indexOf(cur) + 1) % sides.length];
}

// deterministic walkable cell adjacent to a tile: the queue head position.
// dirX/dirY point away from the tile so the queue can line up outward. Only
// the user-picked side (tile.queueSide) is ever tried — no silently falling
// back to a different side, so if the chosen side is blocked the station is
// simply unusable until the user picks a side that isn't (by clicking it).
function queueCellOf(tile) {
  const sides = allowedSides(tile);
  const preferred = sides.includes(tile.queueSide) ? tile.queueSide : sides[0];
  return sideCandidates(tile, preferred).find((c) => isWalkable(c.x, c.y)) || null;
}

// small white arrowhead on the tile's edge pointing toward its chosen queue
// side, so the user can see (and left-click to change) which way it queues
function drawQueueArrow(tile) {
  const dir = SIDE_DIR[tile.queueSide] || SIDE_DIR.top;
  const cx = (tile.x + tile.w / 2) * CELL_SIZE;
  const cy = (tile.y + tile.h / 2) * CELL_SIZE;
  const edgeX = cx + dir.dx * (tile.w / 2) * CELL_SIZE;
  const edgeY = cy + dir.dy * (tile.h / 2) * CELL_SIZE;
  const len = CELL_SIZE * 0.4;
  const tipX = edgeX + dir.dx * len;
  const tipY = edgeY + dir.dy * len;
  const perpX = -dir.dy, perpY = dir.dx;
  const baseW = CELL_SIZE * 0.22;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(edgeX + perpX * baseW, edgeY + perpY * baseW);
  ctx.lineTo(edgeX - perpX * baseW, edgeY - perpY * baseW);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// how far (in cells) a station's queue can bend around obstacles before giving up
const MAX_QUEUE_PATH_LEN = 60;

// Build the line a station's queue stands along, starting at the queue head
// and walking outward. Whenever the next cell straight ahead isn't walkable
// (a wall, another tile, or a cell some other station's queue already claims),
// bend 90° instead of running through it — try one side, then the other.
// `reserved` is shared across every station built together so their queues
// route around each other too, not just around tiles.
function buildQueuePath(queueCell, reserved) {
  const key = (x, y) => x + "," + y;
  let { x, y, dirX, dirY } = queueCell;
  const path = [{ x, y, dirX, dirY }];
  reserved.add(key(x, y));
  for (let i = 1; i < MAX_QUEUE_PATH_LEN; i++) {
    const options = [
      { nx: x + dirX, ny: y + dirY, ndx: dirX, ndy: dirY }, // straight ahead
      { nx: x + dirY, ny: y - dirX, ndx: dirY, ndy: -dirX }, // bend one way
      { nx: x - dirY, ny: y + dirX, ndx: -dirY, ndy: dirX }, // bend the other way
    ];
    const next = options.find((o) => isWalkable(o.nx, o.ny) && !reserved.has(key(o.nx, o.ny)));
    if (!next) break; // boxed in on all three sides: the rest just stack up here
    ({ nx: x, ny: y, ndx: dirX, ndy: dirY } = next);
    path.push({ x, y, dirX, dirY });
    reserved.add(key(x, y));
  }
  return path;
}

// walk `dist` cells along a queue path (path[0] is the queue head) and return
// where that lands, plus which way that passenger should face (back toward
// whoever's ahead of them in line)
function pointAlongQueuePath(path, dist) {
  const idx = Math.min(Math.floor(dist), path.length - 1);
  const frac = idx < path.length - 1 ? dist - idx : 0;
  const cur = path[idx];
  const nxt = path[Math.min(idx + 1, path.length - 1)];
  const facing = frac > 0 ? nxt : cur;
  return {
    x: cur.x + (nxt.x - cur.x) * frac,
    y: cur.y + (nxt.y - cur.y) * frac,
    angle: Math.atan2(-facing.dirY, -facing.dirX),
  };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// BFS distance from (sx, sy) to every walkable cell; -1 = unreachable
function distanceMap(sx, sy) {
  const w = state.width, h = state.height;
  const dist = new Int32Array(w * h).fill(-1);
  dist[sy * w + sx] = 0;
  let frontier = [sy * w + sx];
  while (frontier.length) {
    const next = [];
    for (const idx of frontier) {
      const cx = idx % w;
      const d = dist[idx];
      const neighbors = [];
      if (cx > 0) neighbors.push(idx - 1);
      if (cx < w - 1) neighbors.push(idx + 1);
      if (idx >= w) neighbors.push(idx - w);
      if (idx < w * (h - 1)) neighbors.push(idx + w);
      for (const n of neighbors) {
        if (dist[n] !== -1) continue;
        if (!isWalkable(n % w, (n / w) | 0)) continue;
        dist[n] = d + 1;
        next.push(n);
      }
    }
    frontier = next;
  }
  return dist;
}

function buildStations() {
  sim.stations = [];
  const reserved = new Set(); // cells already claimed by an earlier station's queue path
  for (const tile of state.tiles.values()) {
    if (tile.type !== "kiosk" && tile.type !== "baggage" && tile.type !== "counter" && tile.type !== "tagomat") continue;
    const queueCell = queueCellOf(tile);
    if (!queueCell) continue; // fully walled-in station is unusable
    const queuePath = buildQueuePath(queueCell, reserved);
    sim.stations.push({ tile, type: tile.type, queueCell, queuePath, queue: [], serving: null, serviceLeft: 0, enRoute: 0, served: 0, peakQueue: 0, busySeconds: 0 });
  }
}

function queueLengthOf(st) {
  return st.queue.length + (st.serving ? 1 : 0) + st.enRoute;
}

// Decide this person's itinerary from the configured percentages
// the four operations a passenger may need, drawn from the configured percentages
function buildTraits() {
  const online = Math.random() * 100 < state.pctOnline;
  const cabinOnly = Math.random() * 100 < state.pctCabinOnly;
  return {
    needsCheckin: !online, // online passengers are already checked in
    // offline passengers always need a printed boarding pass; online ones only if they chose to print one
    needsPass: !online || Math.random() * 100 < state.pctKioskAmongOnline,
    needsTag: !cabinOnly, // baggage tag, only with a checked bag
    needsDrop: !cabinOnly, // hand the bag over, only with a checked bag
  };
}

// can a station of this type ever perform this operation (ignoring reachability)?
// fully data-driven from state.tileOps — see the Tile Operations settings page
function stationCanDo(stType, op) {
  const ops = state.tileOps[stType];
  return !!(ops && ops[op]);
}

// the passenger's earliest unmet requirement — check-in, boarding-pass printing, baggage-tag
// printing, then bag drop, always in that order — never a fixed station-type itinerary.
// null once everything's done. See dispatchGoal(), which aims for whatever this returns.
function nextNeededOp(a) {
  if (a.needsCheckin) return "checkin";
  if (a.needsPass) return "pass";
  if (a.needsTag) return "tag";
  if (a.needsDrop) return "drop";
  return null;
}

// which of the four operations this passenger will conduct at a tile of this type
function opsAtStation(a, stType) {
  const ops = [];
  if (a.needsCheckin && stationCanDo(stType, "checkin")) ops.push("checkin");
  if (a.needsPass && stationCanDo(stType, "pass")) ops.push("pass");
  if (a.needsTag && stationCanDo(stType, "tag")) ops.push("tag");
  if (a.needsDrop && stationCanDo(stType, "drop")) ops.push("drop");
  return ops;
}

// give up: roam between random spots on the floor, forever.
// `reason` records what was missing so the summary can suggest a fix.
function startWandering(a, reason) {
  a.state = "wandering";
  a.giveUpReason = reason || "counter";
  a.station = null;
  pickWanderTarget(a);
}

function pickWanderTarget(a) {
  for (let tries = 0; tries < 30; tries++) {
    const x = Math.floor(Math.random() * state.width);
    const y = Math.floor(Math.random() * state.height);
    if (!isWalkable(x, y) || (x === a.cx && y === a.cy)) continue;
    const path = findPath(a.cx, a.cy, x, y);
    if (path && path.length > 1) {
      a.path = path;
      a.seg = 0;
      a.t = 0;
      return;
    }
  }
  // boxed in: stay put and try again when the next arrival triggers
  a.path = [{ x: a.cx, y: a.cy }];
  a.seg = 0;
  a.t = 0;
}

// once per tick: flag if any queue extends over a machine tile, or two queues overlap
function detectQueueOverlaps() {
  if (sim.overlapTile && sim.overlapQueue) return; // nothing more to learn
  const cellOwner = new Map(); // "cx,cy" -> station occupying that cell
  for (const a of sim.agents) {
    if (a.state !== "queuing") continue;
    const cx = Math.round(a.x), cy = Math.round(a.y);
    if (!sim.overlapTile && cx >= 0 && cy >= 0 && cx < state.width && cy < state.height) {
      if (state.grid[cy * state.width + cx] !== -1) sim.overlapTile = true; // standing on a tile
    }
    const key = cx + "," + cy;
    const owner = cellOwner.get(key);
    if (owner === undefined) cellOwner.set(key, a.station);
    else if (owner !== a.station) sim.overlapQueue = true; // two different queues share a cell
  }
}

// is this idle station a valid destination for the agent's current outstanding step?
// a passenger whose last transaction failed only trusts a staffed counter from then on.
function stationEligibleFor(a, s) {
  if (a.failed) return s.type === "counter";
  const op = nextNeededOp(a);
  return op !== null && stationCanDo(s.type, op);
}

// Route the agent toward whatever satisfies its earliest outstanding step (see
// nextNeededOp) — not a fixed sequence of machine types. Whichever station it
// reaches will also perform every later step it's able to in the same visit
// (opsAtStation), so one stop often clears more than one step at once.
// Station choice: least queue for normal walkers, closest for slow walkers
// (pace < SLOW_PACE_THRESHOLD).
function dispatchGoal(a) {
  const w = state.width;
  const dist = distanceMap(a.cx, a.cy);
  const distOf = (s) => dist[s.queueCell.y * w + s.queueCell.x];

  const op = nextNeededOp(a);
  if (op === null) {
    const exits = gatesOfType("exit").map((g) => g.cell).filter((c) => dist[c.y * w + c.x] >= 0);
    if (!exits.length) {
      a.state = "waiting";
      a.retryIn = RETRY_SECONDS;
      return;
    }
    const best = exits.reduce((p, c) => (dist[c.y * w + c.x] < dist[p.y * w + p.x] ? c : p));
    a.path = findPath(a.cx, a.cy, best.x, best.y);
    a.seg = 0;
    a.t = 0;
    a.state = "walking";
    return;
  }
  // Assumption: an empty staffed counter beats the machines — if one is
  // completely free they walk straight to it; otherwise they try the self
  // machines first, and only settle for a busy counter when no machine is
  // reachable. A passenger whose last attempt failed skips machines entirely
  // (a failed transaction would fail again) and heads straight for a counter.
  const machines = a.failed ? [] : sim.stations.filter((s) => s.type !== "counter" && stationCanDo(s.type, op) && distOf(s) >= 0);
  const counters = sim.stations.filter((s) => s.type === "counter" && distOf(s) >= 0);
  const emptyDirect = counters.filter((s) => queueLengthOf(s) === 0);
  let options;
  if (emptyDirect.length) options = emptyDirect;
  else if (machines.length) options = machines;
  else options = counters;

  if (!options.length) {
    if (a.failed) {
      // their machine already failed and no counter is reachable: give up
      startWandering(a, "counter");
      return;
    }
    // nothing available: wait in place and look again shortly
    a.state = "waiting";
    a.retryIn = RETRY_SECONDS;
    return;
  }
  let best;
  if (a.speed < SLOW_PACE_THRESHOLD) {
    best = options.reduce((p, s) => (distOf(s) < distOf(p) ? s : p));
  } else {
    best = options.reduce((p, s) => {
      const qs = queueLengthOf(s), qp = queueLengthOf(p);
      if (qs < qp) return s;
      if (qs === qp && distOf(s) < distOf(p)) return s;
      return p;
    });
  }
  a.station = best;
  best.enRoute++;
  a.path = findPath(a.cx, a.cy, best.queueCell.x, best.queueCell.y);
  a.seg = 0;
  a.t = 0;
  a.state = "walking";
}

function onArrive(a) {
  if (a.state === "wandering") {
    pickWanderTarget(a); // aimless: just head somewhere else
    return;
  }
  if (nextNeededOp(a) === null) {
    a.done = true;
    a.state = "done";
    a.doneTime = sim.elapsed;
    sim.doneCount++;
    return;
  }
  a.station.enRoute--;
  a.station.queue.push(a);
  a.state = "queuing";
}

function spawnAgent(gate) {
  const start = gate.cell;
  // per-cell walking time drawn from N(mean, sd); speed is its reciprocal in cells/s
  const secondsPerCell = Math.max(WALK_SECONDS_MIN, randNormal(WALK_SECONDS_MEAN, WALK_SECONDS_SD));
  const speed = 1 / secondsPerCell;
  const tr = buildTraits();
  const a = {
    speed, // cells per second
    x: start.x,
    y: start.y,
    cx: start.x, // current integer cell (valid when not mid-walk)
    cy: start.y,
    path: null,
    seg: 0,
    t: 0,
    state: "walking",
    station: null,
    // outstanding operations; cleared one by one as they're performed. The
    // agent has no fixed itinerary — dispatchGoal() always aims for whichever
    // reachable station covers the earliest one still outstanding.
    needsCheckin: tr.needsCheckin,
    needsPass: tr.needsPass,
    needsTag: tr.needsTag,
    needsDrop: tr.needsDrop,
    hasBag: tr.needsDrop, // carried until dropped at a machine or counter
    failed: false, // a machine transaction failed; only a counter can help now
    done: false,
    id: ++sim.agentIdSeq,
    spawnTime: sim.elapsed,
    doneTime: null,
    queueTime: 0, // total simulated seconds spent standing in queues
    waitTotal: 0, // total simulated seconds stuck with nowhere to go
    queueByStation: new Map(), // station -> seconds queued there
    used: { kiosk: false, baggage: false, counter: false, tagomat: false },
    angle: 0, // facing direction, radians
    elderly: speed < SLOW_PACE_THRESHOLD,
    shirt: pick(SHIRT_COLORS),
    hair: speed < SLOW_PACE_THRESHOLD ? pick(ELDERLY_HAIR_COLORS) : pick(HAIR_COLORS),
    skin: pick(SKIN_COLORS),
    bag: pick(BAG_COLORS),
  };
  dispatchGoal(a);
  return a;
}

// advance ONE run (the current global `sim`) by dt simulated seconds
function tickOne(dt) {
  if (!sim.running) return;

  // arrivals: each entrance gate admits people independently with normally distributed gaps
  if (sim.toSpawn > 0) {
    for (const et of sim.entranceTimers) {
      et.nextIn -= dt;
      while (et.nextIn <= 0 && sim.toSpawn > 0) {
        sim.agents.push(spawnAgent(et.gate));
        sim.toSpawn--;
        et.nextIn += Math.max(SPAWN_GAP_MIN, randNormal(SPAWN_GAP_MEAN, SPAWN_GAP_SD));
      }
      if (sim.toSpawn === 0) break;
    }
  }

  // walking / waiting agents
  for (const a of sim.agents) {
    if (a.state === "queuing") {
      a.queueTime += dt;
      if (a.station) a.queueByStation.set(a.station, (a.queueByStation.get(a.station) || 0) + dt);
      continue;
    }
    if (a.state === "waiting") {
      a.waitTotal += dt;
      if (a.waitTotal >= MAX_WAIT_SECONDS) {
        // out of patience: give up. reason = the step they were stuck needing
        startWandering(a, nextNeededOp(a) || "exit");
        continue;
      }
      a.retryIn -= dt;
      if (a.retryIn <= 0) dispatchGoal(a); // look for stations again
      continue;
    }
    if (a.state !== "walking" && a.state !== "wandering") continue;
    let travel = a.speed * dt; // distance in cells this frame
    while (travel > 0) {
      if (a.seg >= a.path.length - 1) {
        const end = a.path[a.path.length - 1];
        a.cx = end.x;
        a.cy = end.y;
        a.x = end.x;
        a.y = end.y;
        onArrive(a);
        break;
      }
      const remaining = 1 - a.t;
      if (travel >= remaining) {
        travel -= remaining;
        a.seg++;
        a.t = 0;
      } else {
        a.t += travel;
        travel = 0;
      }
    }
    if (a.state === "walking" || a.state === "wandering") {
      const p0 = a.path[Math.min(a.seg, a.path.length - 1)];
      const p1 = a.path[Math.min(a.seg + 1, a.path.length - 1)];
      a.x = p0.x + (p1.x - p0.x) * a.t;
      a.y = p0.y + (p1.y - p0.y) * a.t;
      if (p1.x !== p0.x || p1.y !== p0.y) a.angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    }
  }

  // stations: serve one person at a time
  for (const st of sim.stations) {
    if (st.serving) {
      st.busySeconds += dt;
      st.serviceLeft -= dt;
      if (st.serviceLeft <= 0) {
        const a = st.serving;
        const doneOps = st.servingOps || [];
        st.servingOps = null;
        st.serving = null;
        st.served++;
        a.station = null;
        a.used[st.type] = true;
        if (st.type === "counter") {
          // the worker sorts everything out (all remaining operations, bags included)
          a.needsCheckin = a.needsPass = a.needsTag = a.needsDrop = false;
          a.hasBag = false;
          dispatchGoal(a);
        } else {
          const successPct =
            st.type === "kiosk" ? state.kioskSuccessPct :
            st.type === "tagomat" ? state.tagomatSuccessPct :
            state.bagdropSuccessPct;
          if (Math.random() * 100 < successPct) {
            // the conducted operations are now done for good
            for (const op of doneOps) {
              if (op === "checkin") a.needsCheckin = false;
              else if (op === "pass") a.needsPass = false;
              else if (op === "tag") a.needsTag = false;
              else if (op === "drop") {
                a.needsDrop = false;
                a.hasBag = false; // bag handed over
              }
            }
            dispatchGoal(a); // aim for whatever's next outstanding, wherever that's reachable
          } else {
            // a failed transaction leaves every operation still outstanding:
            // only a human at a counter can fix it. dispatchGoal() sees a.failed
            // and only considers counters from here on, giving up if none is reachable.
            sim.failures[st.type]++;
            a.failed = true;
            dispatchGoal(a);
          }
        }
      }
    }
    if (!st.serving && st.queue.length) {
      const a = st.queue.shift();
      st.serving = a;
      a.state = "serving";
      // visit duration = sum of the operations this passenger conducts at this tile,
      // each drawn from its own N(mean, sd)
      const ops = opsAtStation(a, st.type);
      st.servingOps = ops;
      let total = 0;
      for (const op of ops) {
        total += Math.max(OP_SECONDS_MIN, randNormal(state.ops[op].mean, state.ops[op].sd));
      }
      // nearby interns/officers speed this visit up (see speedMultiplierFor)
      st.serviceLeft = (ops.length ? total : SERVICE_SECONDS_MIN) * speedMultiplierFor(st.tile);
      a.x = a.cx = st.queueCell.x;
      a.y = a.cy = st.queueCell.y;
    }
    // line waiting people up behind the queue head, following the bent queue
    // path instead of a straight line so it doesn't run through walls/tiles
    if (st.serving) st.serving.angle = Math.atan2(-st.queueCell.dirY, -st.queueCell.dirX);
    st.queue.forEach((a, i) => {
      const p = pointAlongQueuePath(st.queuePath, 0.7 + i * 0.42);
      a.x = p.x;
      a.y = p.y;
      a.angle = p.angle;
    });
    if (st.queue.length > st.peakQueue) st.peakQueue = st.queue.length;
  }

  detectQueueOverlaps();

  // an idle machine pulls waiting people out of other queues; only those too slow
  // to bother walking (pace < SLOW_PACE_THRESHOLD) choose to stay in line instead
  if (sim.stations.some((s) => queueLengthOf(s) === 0)) {
    for (const st of sim.stations) {
      for (let i = st.queue.length - 1; i >= 0; i--) {
        const a = st.queue[i];
        if (a.speed < SLOW_PACE_THRESHOLD) continue;
        if (!sim.stations.some((s) => s !== st && queueLengthOf(s) === 0 && stationEligibleFor(a, s))) continue;
        st.queue.splice(i, 1);
        a.station = null;
        a.cx = st.queueCell.x;
        a.cy = st.queueCell.y;
        dispatchGoal(a); // re-choose; the empty station wins the least-queue rule
      }
    }
  }

  sim.elapsed += dt;

  // the run is over when everyone has exited or given up (wandering forever)
  if (sim.toSpawn === 0 && sim.agents.length > 0 && sim.agents.every((a) => a.done || a.state === "wandering")) {
    sim.running = false;
    sim.finished = true;
  }
}

// master loop: advances every still-running sim by the same wall-clock dt,
// then renders the main run and the four minis
let masterRafId = null;
let masterTimeoutId = null;
let masterLastTime = 0;

// simulated seconds allowed in a single tick, regardless of speed — protects
// movement/queue logic from one absurd jump after a real stall (tab backgrounded
// for minutes, a long GC pause, etc.). Capping the REAL delta instead (pre-multiply)
// would throttle the *effective* speed toward 1x on any frame hiccup, which is
// exactly what happened right after starting a new run at a high multiplier: a
// single slow frame (rebuilding stations, refitting the canvas) ate almost all of
// that tick's credit before the multiplier even applied.
const MAX_SIM_SECONDS_PER_TICK = 120;

function masterTick(now) {
  if (!sims.some((s) => s.running)) return;
  const dt = Math.min(((now - masterLastTime) / 1000) * sims[0].speedMul, MAX_SIM_SECONDS_PER_TICK);
  masterLastTime = now;
  for (const s of sims) {
    if (!s.running) continue;
    sim = s;
    tickOne(dt);
  }
  sim = sims[0]; // outside the tick loop everything refers to the main run
  statusTimer.textContent = formatSimTime(sims[0].elapsed);

  draw();

  if (sims.every((s) => s.finished)) {
    stopSim();
    simStartBtn.textContent = t("start");
    // boarding clip fills the plane, THEN the results appear
    startBoardingClip(() => showSummary());
    return;
  }
  scheduleTick();
}

// mm:ss under an hour, h:mm:ss beyond
function formatSimTime(seconds) {
  const s = Math.floor(seconds);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

// rAF pauses in hidden tabs; fall back to setTimeout so the sim keeps running
function scheduleTick() {
  if (document.hidden) {
    masterRafId = null;
    masterTimeoutId = setTimeout(() => masterTick(performance.now()), 33);
  } else {
    masterTimeoutId = null;
    masterRafId = requestAnimationFrame(masterTick);
  }
}

function startSim() {
  const passengers = parseInt(passengersInput.value, 10);
  if (!Number.isInteger(passengers) || passengers < 10 || passengers > 500) {
    simError.textContent = t("errPassengers");
    return;
  }
  simError.textContent = "";
  state.numPassengers = passengers;
  state.pctOnline = readPct(pctOnlineInput);
  state.pctKioskAmongOnline = readPct(pctKioskOnlineInput);
  state.pctCabinOnly = readPct(pctCabinInput);
  // kioskSuccessPct/bagdropSuccessPct/tagomatSuccessPct aren't read from a
  // form field — they're kept live by the success-rate buttons on each tile's
  // palette card (see successRateSelector), which write straight into state
  for (const op of Object.keys(state.ops)) {
    state.ops[op].mean = readNum(opInputs[op].mean, 5, 300, OP_DEFAULTS[op].mean);
    state.ops[op].sd = readNum(opInputs[op].sd, 0, 150, OP_DEFAULTS[op].sd);
  }
  resetSim();
  // every run gets its own stations, spawn budget and entrance clocks; the
  // random draws inside each are what make the five results differ
  for (const s of sims) {
    sim = s;
    buildStations();
    s.running = true;
    s.finished = false;
    s.toSpawn = state.numPassengers;
    // first person enters right away; N(mean, sd) gaps apply between arrivals after that
    s.entranceTimers = gatesOfType("entrance").map((gate) => ({ gate, nextIn: 0 }));
  }
  sim = sims[0];
  plane = null;
  cancelBoardingClip(); // close any lingering boarding page from a prior run
  fitViewToGrid();
  // lock the layout: no placing or deleting machines mid-run
  state.selectedTool = null;
  document.querySelectorAll(".tile-card").forEach((el) => el.classList.remove("active"));
  document.getElementById("tile-list").classList.add("locked");
  document.getElementById("worker-list").classList.add("locked");
  clearGridBtn.disabled = true;
  masterLastTime = performance.now();
  simStartBtn.textContent = t("running");
  scheduleTick();
}

function stopSim() {
  for (const s of sims) s.running = false;
  document.getElementById("tile-list").classList.remove("locked");
  document.getElementById("worker-list").classList.remove("locked");
  clearGridBtn.disabled = false;
  if (masterRafId !== null) cancelAnimationFrame(masterRafId);
  if (masterTimeoutId) clearTimeout(masterTimeoutId);
  masterRafId = null;
  masterTimeoutId = null;
}

function resetSim() {
  stopSim();
  for (const s of sims) {
    s.agents = [];
    s.stations = [];
    s.toSpawn = 0;
    s.entranceTimers = [];
    s.doneCount = 0;
    s.elapsed = 0;
    s.agentIdSeq = 0;
    s.failures = { kiosk: 0, baggage: 0, tagomat: 0 };
    s.overlapTile = false;
    s.overlapQueue = false;
    s.finished = false;
  }
  sim = sims[0];
  plane = null;
  cancelBoardingClip(); // close the boarding page and stop its animation
  if (state.grid) fitViewToGrid();
  document.getElementById("summary-modal").classList.add("hidden");
  statusTimer.textContent = "00:00";
  simStartBtn.textContent = t("start");
}

simStartBtn.addEventListener("click", () => {
  if (sim.running) return;
  startSim();
});

simResetBtn.addEventListener("click", () => {
  resetSim();
  draw();
});

simSpeedBtn.addEventListener("click", () => {
  const next = SPEED_STEPS[(SPEED_STEPS.indexOf(sims[0].speedMul) + 1) % SPEED_STEPS.length];
  for (const s of sims) s.speedMul = next;
  simSpeedBtn.textContent = `${next}x`;
});

