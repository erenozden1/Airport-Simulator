// app.reports.js: post-run result reporting — loaded right after
// app.simulation.js. The Simulation Summary card grid and the per-tile
// usage-percent breakdown popup opened from it.

// ---------- Shared per-run report data ----------
// Both the general Simulation Summary and the Detailed Report read from this
// single computation, so the two views can never disagree with each other.
function computeRunStats() {
  const avg = (arr) => arr.reduce((x, y) => x + y, 0) / arr.length;
  const stationDesc = (st) => `${shortLabel(st.type)}${st.tile.num} — ${t(TILE_TYPES[st.type].labelKey)} (${st.tile.x},${st.tile.y})`;

  const runTimes = sims.map((s) => s.elapsed);
  const generatedPerRun = sims.map((s) => s.agents.length);
  const exitedPerRun = sims.map((s) => s.agents.filter((a) => a.done).length);
  const gaveUpPerRun = sims.map((s) => s.agents.filter((a) => a.state === "wandering").length);
  const usedKioskPerRun = sims.map((s) => s.agents.filter((a) => a.used.kiosk).length);
  const usedBaggagePerRun = sims.map((s) => s.agents.filter((a) => a.used.baggage).length);
  const usedCounterPerRun = sims.map((s) => s.agents.filter((a) => a.used.counter).length);
  const usedTagomatPerRun = sims.map((s) => s.agents.filter((a) => a.used.tagomat).length);
  const unusedPerRun = sims.map((s) => s.stations.filter((st) => st.served === 0).length);
  const kioskFailPerRun = sims.map((s) => s.failures.kiosk);
  const bagFailPerRun = sims.map((s) => s.failures.baggage);
  const tagomatFailPerRun = sims.map((s) => s.failures.tagomat);
  const anyFailed = gaveUpPerRun.some((n) => n > 0);

  // failure rate = failed attempts / total attempts at that machine type,
  // per run (a.used[type] is set on every visit, success or fail, so it's
  // the attempt count). failPctPerRun keeps every run's individual rate
  // (null where that run never used the machine); failPct averages those
  // for the general summary's single card.
  const failPctPerRun = (failArr, usedArr) => failArr.map((f, i) => (usedArr[i] > 0 ? (f / usedArr[i]) * 100 : null));
  const failPct = (failArr, usedArr) => {
    const valid = failPctPerRun(failArr, usedArr).filter((p) => p !== null);
    return valid.length ? (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1) + "%" : t("sNone");
  };

  // ---------- extremes: not the single worst case, but the PER-RUN worst case, averaged
  // across all runs — plus how often the very same station turns up as that run's worst,
  // which points at a structural bottleneck rather than one unlucky run's randomness ----------
  // stations are rebuilt fresh from the shared state.tiles every run, so the station
  // *wrapper* objects differ run to run even for the same physical machine — key
  // recurrence off `station.tile`, which is the one thing that's actually shared.
  function runExtreme(pick) {
    const perRun = sims.map((s) => pick(s)); // { value, station } | null, one per sim, run order preserved
    const entries = perRun.filter(Boolean);
    if (!entries.length) return { avgValue: null, topStation: null, topCount: 0, runCount: 0, perRun };
    const avgValue = entries.reduce((sum, e) => sum + e.value, 0) / entries.length;
    const counts = new Map(); // tile -> { count, station }
    for (const e of entries) {
      if (!e.station) continue;
      const rec = counts.get(e.station.tile);
      if (rec) rec.count++;
      else counts.set(e.station.tile, { count: 1, station: e.station });
    }
    let top = null;
    for (const rec of counts.values()) if (!top || rec.count > top.count) top = rec;
    return { avgValue, topStation: top ? top.station : null, topCount: top ? top.count : 0, runCount: entries.length, perRun };
  }
  const recurNote = (ex) =>
    ex && ex.topStation ? `${stationDesc(ex.topStation)} (${ex.topCount}/${ex.runCount} ${t("sRuns")})` : "";

  const queueExtreme = runExtreme((s) => {
    let best = null;
    for (const st of s.stations) if (st.peakQueue > 0 && (!best || st.peakQueue > best.peakQueue)) best = st;
    return best ? { value: best.peakQueue, station: best } : null;
  });
  const waitExtreme = runExtreme((s) => {
    let best = null;
    for (const a of s.agents) if (a.queueTime > 0 && (!best || a.queueTime > best.queueTime)) best = a;
    if (!best) return null;
    let bestSecs = 0, bestStation = null;
    for (const [st, secs] of best.queueByStation) if (secs > bestSecs) { bestSecs = secs; bestStation = st; }
    return { value: best.queueTime, station: bestStation };
  });
  const slowExtreme = runExtreme((s) => {
    let best = null;
    for (const a of s.agents) if (a.done && (!best || a.doneTime - a.spawnTime > best.doneTime - best.spawnTime)) best = a;
    if (!best) return null;
    let bestSecs = 0, bestStation = null;
    for (const [st, secs] of best.queueByStation) if (secs > bestSecs) { bestSecs = secs; bestStation = st; }
    return { value: best.doneTime - best.spawnTime, station: bestStation };
  });
  // operating cost: the layout's hourly rate is fixed (same tiles/workers
  // every run), so per-run cost only varies with that run's elapsed time.
  // Billed in whole hours (any part of an hour counts as a full hour) — an
  // 1h30m run costs hourly rate * 2, not * 1.5.
  const layoutHourlyCost = [...state.tiles.values()].reduce((sum, tl) => sum + effectiveCostPerHour(tl.type), 0);
  const costPerRun = runTimes.map((secs) => layoutHourlyCost * Math.max(1, Math.ceil(secs / 3600)));
  const costPerCustomerPerRun = costPerRun.map((cost, i) => (generatedPerRun[i] > 0 ? cost / generatedPerRun[i] : null));

  // overlaps: did any run overlap tiles / other queues? overlapKey is the
  // "ever, across all runs" flag for the general summary; overlapPerRun keeps
  // each run's own category for the detailed report.
  const overlapTile = sims.some((s) => s.overlapTile);
  const overlapQueue = sims.some((s) => s.overlapQueue);
  const overlapKey = overlapTile && overlapQueue ? "oBoth" : overlapTile ? "oTiles" : overlapQueue ? "oQueues" : "oNone";
  const overlapPerRun = sims.map((s) => (s.overlapTile && s.overlapQueue ? "oBoth" : s.overlapTile ? "oTiles" : s.overlapQueue ? "oQueues" : "oNone"));

  return {
    avg, stationDesc, runTimes, generatedPerRun, exitedPerRun, gaveUpPerRun,
    usedKioskPerRun, usedBaggagePerRun, usedCounterPerRun, usedTagomatPerRun, unusedPerRun,
    kioskFailPerRun, bagFailPerRun, tagomatFailPerRun, anyFailed, failPct, failPctPerRun,
    queueExtreme, waitExtreme, slowExtreme, recurNote,
    layoutHourlyCost, costPerRun, costPerCustomerPerRun, overlapKey, overlapPerRun,
  };
}

// ---------- Final summary ----------
function showSummary() {
  const content = document.getElementById("summary-content");
  const card = (label, value, note) =>
    `<div class="summary-card"><div class="summary-card-label">${label}</div><div class="summary-card-value">${value}</div>${
      note ? `<div class="summary-card-note">${note}</div>` : ""
    }</div>`;
  const section = (title, cardsHtml) =>
    `<div class="summary-section-title">${title}</div><div class="summary-grid">${cardsHtml}</div>`;

  const {
    avg, runTimes, generatedPerRun, exitedPerRun, gaveUpPerRun,
    usedKioskPerRun, usedBaggagePerRun, usedCounterPerRun, usedTagomatPerRun, unusedPerRun,
    kioskFailPerRun, bagFailPerRun, tagomatFailPerRun, anyFailed, failPct,
    queueExtreme, waitExtreme, slowExtreme, recurNote,
    layoutHourlyCost, costPerRun, costPerCustomerPerRun, overlapKey,
  } = computeRunStats();

  const banner = anyFailed ? `<div class="summary-failed">${t("sFailedBanner")}</div>` : "";

  content.innerHTML = [
    banner,
    `<div class="summary-hero">
      <div class="summary-hero-label">${tn("sAvgTime", sims.length)}</div>
      <div class="summary-hero-value">${formatSimTime(avg(runTimes))}</div>
    </div>`,
    section(
      tn("sMainRun", sims.length),
      [
        card(t("sGenerated"), Math.round(avg(generatedPerRun))),
        card(t("sExited"), avg(exitedPerRun).toFixed(1)),
        card(t("sGaveUp"), avg(gaveUpPerRun).toFixed(1)),
      ].join("")
    ),
    section(
      t("layoutCost"),
      [
        card(t("sTotalCost"), `${formatCost(avg(costPerRun))} TL`, tn("costPerHour", formatCost(layoutHourlyCost))),
        card(
          t("sCostPerCustomer"),
          costPerCustomerPerRun.some((v) => v !== null)
            ? `${formatCost(avg(costPerCustomerPerRun.filter((v) => v !== null)))} TL`
            : t("sNone"),
          t("sCostPerCustomerNote")
        ),
      ].join("")
    ),
    section(
      t("sSectionUsage"),
      [
        card(t("sUsedKiosk"), avg(usedKioskPerRun).toFixed(1)),
        card(t("sUsedBaggage"), avg(usedBaggagePerRun).toFixed(1)),
        card(t("sUsedCounter"), avg(usedCounterPerRun).toFixed(1)),
        card(t("sUsedTagomat"), avg(usedTagomatPerRun).toFixed(1)),
        card(t("sUnused"), avg(unusedPerRun).toFixed(1)),
      ].join("")
    ),
    section(
      t("sSectionFailures"),
      [
        card(t("sKioskFailures"), failPct(kioskFailPerRun, usedKioskPerRun)),
        card(t("sBagdropFailures"), failPct(bagFailPerRun, usedBaggagePerRun)),
        card(t("sTagomatFailures"), failPct(tagomatFailPerRun, usedTagomatPerRun)),
      ].join("")
    ),
    section(
      t("sSectionBottlenecks"),
      [
        card(
          t("sLongestQueue"),
          queueExtreme.avgValue !== null ? `${queueExtreme.avgValue.toFixed(1)} ${t("usageAvg")}` : t("sNone"),
          queueExtreme.avgValue !== null ? recurNote(queueExtreme) : ""
        ),
        card(
          t("sLongestWait"),
          waitExtreme.avgValue !== null ? `${formatSimTime(waitExtreme.avgValue)} ${t("usageAvg")}` : t("sNone"),
          waitExtreme.avgValue !== null ? recurNote(waitExtreme) : ""
        ),
        card(
          t("sSlowest"),
          slowExtreme.avgValue !== null ? `${formatSimTime(slowExtreme.avgValue)} ${t("usageAvg")}` : t("sNone"),
          slowExtreme.avgValue !== null ? recurNote(slowExtreme) : ""
        ),
        card(t("sOverlaps"), t(overlapKey)),
      ].join("")
    ),
  ].join("");

  // suggestions: why passengers gave up and how to fix the layout. giveUpReason is
  // either "counter", or the step they were stuck needing (checkin/pass/tag/drop/exit);
  // several steps share a suggestion, so dedupe by the resulting message, not the reason.
  const reasonMsg = { counter: "rNeedCounter", checkin: "rNeedKiosk", pass: "rNeedKiosk", tag: "rNeedBaggage", drop: "rNeedBaggage", exit: "rNeedExit" };
  const order = ["rNeedCounter", "rNeedKiosk", "rNeedBaggage", "rNeedExit"];
  const reasons = new Set(
    sims
      .flatMap((s) => s.agents.filter((a) => a.state === "wandering").map((a) => reasonMsg[a.giveUpReason]))
      .filter(Boolean)
  );
  if (reasons.size) {
    const items = order.filter((k) => reasons.has(k)).map((k) => `<li>${t(k)}</li>`).join("");
    content.innerHTML += `<div class="summary-section-title summary-section-title-warn">${t("sReasons")}</div><div class="summary-suggest-card"><ul class="summary-suggest">${items}</ul></div>`;
  }

  // section: open the per-tile usage breakdown popup
  content.innerHTML += `<button id="usage-btn" class="primary-btn summary-usage-btn">${tn("usageBtn", sims.length)}</button>`;
  document.getElementById("usage-btn").addEventListener("click", showUsage);

  document.getElementById("summary-modal").classList.remove("hidden");
}

document.getElementById("summary-close").addEventListener("click", () => {
  document.getElementById("summary-modal").classList.add("hidden");
});
document.getElementById("summary-close-bottom").addEventListener("click", () => {
  document.getElementById("summary-modal").classList.add("hidden");
});
document.getElementById("summary-modal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("summary-modal")) e.target.classList.add("hidden");
});

// ---------- Tile usage popup ----------
// per machine: what percent of the run's total elapsed time it spent actively
// serving someone (busySeconds / that run's total elapsed time).
const usageModal = document.getElementById("usage-modal");
const usageContent = document.getElementById("usage-content");

function showUsage() {
  const {
    avg, runTimes, exitedPerRun, gaveUpPerRun,
    usedKioskPerRun, usedBaggagePerRun, usedCounterPerRun, usedTagomatPerRun, unusedPerRun,
    kioskFailPerRun, bagFailPerRun, tagomatFailPerRun, failPctPerRun,
    queueExtreme, waitExtreme, slowExtreme, overlapPerRun,
  } = computeRunStats();

  const groupHeader = (title, note) =>
    `<tr class="usage-type-row"><td colspan="${sims.length + 2}">${title}${
      note ? `<span class="usage-section-note">${note}</span>` : ""
    }</td></tr>`;
  // one row: label + an Avg column + one column per run. `perRunValues` may
  // contain null for a run with no meaningful value (shown as —, excluded
  // from the average).
  const statRow = (label, perRunValues, formatFn) => {
    const valid = perRunValues.filter((v) => v !== null && v !== undefined);
    const avgTxt = valid.length ? formatFn(valid.reduce((a, b) => a + b, 0) / valid.length) : "—";
    let row = `<tr><td>${label}</td><td class="avg-col">${avgTxt}</td>`;
    row += perRunValues.map((v) => `<td>${v === null || v === undefined ? "—" : formatFn(v)}</td>`).join("");
    return row + `</tr>`;
  };
  const countFmt = (v) => v.toFixed(1);
  const pctFmt = (v) => v.toFixed(1) + "%";

  let rowsHtml = `<tr class="usage-total-row"><td>${t("usageTotalTime")}</td>`;
  rowsHtml += `<td class="avg-col">${formatSimTime(avg(runTimes))}</td>`;
  rowsHtml += runTimes.map((secs) => `<td>${formatSimTime(secs)}</td>`).join("");
  rowsHtml += `</tr>`;

  rowsHtml += groupHeader(tn("sMainRun", sims.length));
  rowsHtml += statRow(t("sExited"), exitedPerRun, countFmt);
  rowsHtml += statRow(t("sGaveUp"), gaveUpPerRun, countFmt);

  rowsHtml += groupHeader(t("sSectionUsage"), t("sSectionUsageNote"));
  rowsHtml += statRow(t("sUsedKiosk"), usedKioskPerRun, countFmt);
  rowsHtml += statRow(t("sUsedBaggage"), usedBaggagePerRun, countFmt);
  rowsHtml += statRow(t("sUsedCounter"), usedCounterPerRun, countFmt);
  rowsHtml += statRow(t("sUsedTagomat"), usedTagomatPerRun, countFmt);
  rowsHtml += statRow(t("sUnused"), unusedPerRun, countFmt);

  rowsHtml += groupHeader(t("sSectionFailures"));
  rowsHtml += statRow(t("sKioskFailures"), failPctPerRun(kioskFailPerRun, usedKioskPerRun), pctFmt);
  rowsHtml += statRow(t("sBagdropFailures"), failPctPerRun(bagFailPerRun, usedBaggagePerRun), pctFmt);
  rowsHtml += statRow(t("sTagomatFailures"), failPctPerRun(tagomatFailPerRun, usedTagomatPerRun), pctFmt);

  rowsHtml += groupHeader(t("sSectionBottlenecks"));
  rowsHtml += statRow(t("sLongestQueueDetail"), queueExtreme.perRun.map((e) => (e ? e.value : null)), countFmt);
  rowsHtml += statRow(t("sLongestWaitDetail"), waitExtreme.perRun.map((e) => (e ? e.value : null)), formatSimTime);
  rowsHtml += statRow(t("sSlowestDetail"), slowExtreme.perRun.map((e) => (e ? e.value : null)), formatSimTime);
  rowsHtml += `<tr><td>${t("sOverlaps")}</td><td class="avg-col">—</td>`;
  rowsHtml += overlapPerRun.map((key) => `<td>${t(key)}</td>`).join("");
  rowsHtml += `</tr>`;

  rowsHtml += groupHeader(t("sSectionTileLoad"), t("sSectionTileLoadNote"));
  const typeOrder = ["kiosk", "baggage", "counter", "tagomat"];
  const busyOf = (s, tile) => {
    const st = s.stations.find((x) => x.tile === tile);
    return st ? st.busySeconds : 0;
  };
  let anyTiles = false;
  for (const type of typeOrder) {
    const tiles = [...state.tiles.values()].filter((tl) => tl.type === type);
    if (!tiles.length) continue;
    anyTiles = true;
    const def = TILE_TYPES[type];
    rowsHtml += `<tr class="usage-tile-row"><td colspan="${sims.length + 2}" style="color:${def.color}">${t(def.labelKey)}</td></tr>`;
    for (const tl of tiles) {
      const pcts = sims.map((s) => (s.elapsed > 0 ? (busyOf(s, tl) / s.elapsed) * 100 : null));
      rowsHtml += statRow(`${shortLabel(type)}${tl.num} (${tl.x},${tl.y})`, pcts, pctFmt);
    }
  }
  if (!anyTiles) {
    rowsHtml += `<tr class="usage-tile-row"><td colspan="${sims.length + 2}">${t("usageNoTiles")}</td></tr>`;
  }

  let head = `<tr><th></th><th class="avg-col">${t("usageAvg")}</th>`;
  for (let i = 0; i < sims.length; i++) head += `<th>#${i + 1}</th>`;
  head += `</tr>`;
  usageContent.innerHTML =
    `<p class="usage-note">${t("usageNote")}</p>` +
    `<div class="usage-table-scroll"><table class="usage-table"><thead>${head}</thead><tbody>${rowsHtml}</tbody></table></div>`;
  usageModal.classList.remove("hidden");
}

document.getElementById("usage-close").addEventListener("click", () => usageModal.classList.add("hidden"));
usageModal.addEventListener("click", (e) => {
  if (e.target === usageModal) usageModal.classList.add("hidden");
});

