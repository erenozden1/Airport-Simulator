// app.startup.js: app shell & first-run flow — loaded last, right after
// app.reports.js. The Assumptions modal, language switching, and the
// language -> assumptions -> tile operations -> simulation startup wizard.

// ---------- Assumptions modal ----------
const assumptionsBtn = document.getElementById("assumptions-btn");
const assumptionsModal = document.getElementById("assumptions-modal");
const assumptionsClose = document.getElementById("assumptions-close");

assumptionsBtn.addEventListener("click", () => assumptionsModal.classList.remove("hidden"));
assumptionsClose.addEventListener("click", () => assumptionsModal.classList.add("hidden"));
assumptionsModal.addEventListener("click", (e) => {
  if (e.target === assumptionsModal) assumptionsModal.classList.add("hidden"); // click outside the panel closes
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    assumptionsModal.classList.add("hidden");
    document.getElementById("summary-modal").classList.add("hidden");
    usageModal.classList.add("hidden");
    settingsModal.classList.add("hidden");
    operationsModal.classList.add("hidden");
  }
});

// ---------- Language switching ----------
function applyLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  // static elements
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  // assumptions list
  const list = document.getElementById("assumptions-list");
  list.innerHTML = "";
  for (const item of t("assumptionItems")) {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  }
  // dynamic texts
  simStartBtn.textContent = sim.running ? t("running") : t("start");
  buildPalette(); // tile names, placed counts, rotate buttons
  updateTileCounts();
  buildTileOpsGrid(); // re-localize operation labels, keep checked/disabled state
  if (sim.running) {
    document.getElementById("tile-list").classList.add("locked");
    document.getElementById("worker-list").classList.add("locked");
  }
  if (!document.getElementById("summary-modal").classList.contains("hidden")) showSummary(); // re-render in new language
  if (!usageModal.classList.contains("hidden")) showUsage();
  draw(); // gate labels
}

// ---------- Startup flow: language -> assumptions -> tile operations -> simulation ----------
// On first open the user picks a language on the kiosk's screen, reads the
// assumptions in that language, then sees the Tile Operations page
// (preselected to the default set — see DEFAULT_TILE_OPS), and the "Continue"
// button on that last step reveals the editor.
function initStartup() {
  const overlay = document.getElementById("startup-overlay");
  const langStep = document.getElementById("startup-lang");
  const asmStep = document.getElementById("startup-assumptions");
  const asmList = document.getElementById("startup-assumptions-list");
  const tileopsStep = document.getElementById("startup-tileops");
  const startupTileOpsBody = document.getElementById("startup-tile-ops-body");
  tileOpsContainers.push(startupTileOpsBody);
  renderTileOpsGrid(startupTileOpsBody); // populate immediately, preselected to the defaults

  overlay.querySelectorAll(".startup-lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyLanguage(btn.dataset.lang); // translates every [data-i18n], incl. this overlay
      asmList.innerHTML = "";
      for (const item of t("assumptionItems")) {
        const li = document.createElement("li");
        li.textContent = item;
        asmList.appendChild(li);
      }
      langStep.classList.add("hidden");
      asmStep.classList.remove("hidden");
    });
  });

  document.getElementById("startup-tileops-next").addEventListener("click", () => {
    asmStep.classList.add("hidden");
    tileopsStep.classList.remove("hidden");
  });

  document.getElementById("startup-continue").addEventListener("click", () => {
    overlay.classList.add("hidden"); // reveal the (unchanged) simulation page
    resizeCanvas(); // fit the grid canvas now that the editor is actually visible
    fitViewToGrid(); // recompute zoom/pan against the now-visible canvas size
    draw();
  });
}

// build the initial grid on load
generateGrid();
applyLanguage("en");
initStartup();
