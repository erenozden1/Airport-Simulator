"use strict";

// app.js is split by theme into app.config.js, app.editor.js, app.boarding.js,
// app.simulation.js, app.reports.js, app.startup.js (each <=1000 lines),
// loaded in that exact order as classic (non-module) scripts sharing one
// global scope — order matters, since later files reference consts/functions
// defined in earlier ones.
//
// app.config.js: foundational data & setup, nothing here renders or runs a
// simulation — i18n strings, tile/worker type & cost/success-rate config,
// app+sim state init, DOM refs, setup-screen bindings, Tile Operations grid,
// settings modal, grid init, palette cost helpers.

// ---------- Localization ----------
const I18N = {
  en: {
    language: "Language",
    simTime: "Simulation time",
    settings: "Advanced Settings",
    tileOpsBtn: "Tile Operations",
    tileOpsTitle: "Tile Operations",
    tileOpsNote: "Which operations each tile type can perform. Locked (greyed-out) boxes are either physically impossible for that machine, or — for the staffed counter — always on, since it handles everything by design.",
    opCheckin: "Check-in",
    opPass: "Boarding pass",
    opTag: "Bag tag",
    opDrop: "Bag drop",
    grid: "Grid",
    width: "Width (cols)",
    height: "Height (rows)",
    generate: "Generate Grid",
    passengers: "Passengers",
    numPassengers: "Number of Passengers",
    pctOnline: "Online check-in %",
    pctKioskOnline: "Online checked-in passengers printing a boarding pass %",
    pctCabin: "Cabin-bag only %",
    successRateLabel: "Success rate",
    processTime: "Process time",
    opCheckinMean: "Check-in mean (s)",
    opCheckinStd: "Check-in std (s)",
    opPassMean: "Boarding pass print mean (s)",
    opPassStd: "Boarding pass print std (s)",
    opTagMean: "Baggage tag print mean (s)",
    opTagStd: "Baggage tag print std (s)",
    opDropMean: "Baggage drop mean (s)",
    opDropStd: "Baggage drop std (s)",
    moodHappy: "Happy mood under (min)",
    moodAngry: "Angry mood over (min)",
    boarding: "Now boarding",
    gate: "Gate",
    simulation: "Simulation",
    numRuns: "Number of Runs",
    start: "Start",
    running: "Running...",
    reset: "Reset",
    tiles: "Tiles",
    leftClickRotate: "Left-click: rotate",
    rightClickDelete: "Right-click: delete",
    clearGrid: "Clear grid",
    assumptions: "Assumptions",
    startContinue: "Continue to simulation",
    startNext: "Next",
    placed: "Placed:",
    rotateH: "Rotate (currently horizontal)",
    rotateV: "Rotate (currently vertical)",
    tileKiosk: "Self Check-in Kiosk",
    tileBaggage: "Self Baggage-Drop",
    tileCounter: "Staffed Counter",
    tileTagomat: "Tagomat",
    countKiosk: ["kiosk", "kiosks"],
    countBaggage: ["bag drop", "bag drops"],
    countCounter: ["counter", "counters"],
    countTagomat: ["tagomat", "tagomats"],
    workersTitle: "Workers",
    workersNote: "Interns and officers don't process passengers themselves — they speed up nearby machines' visit times.",
    workerIntern: "Intern",
    workerOfficer: "Officer",
    countIntern: ["intern", "interns"],
    countOfficer: ["officer", "officers"],
    costPerHour: "{n} TL/h",
    layoutCost: "Cost",
    sTotalCost: "Operating cost",
    sCostPerCustomer: "Cost per customer",
    sCostPerCustomerNote: "Billed in whole hours — any part of an hour counts as a full hour",
    entrance: "ENTRANCE",
    exit: "EXIT",
    errDims: "Enter valid dimensions between 20 and 30.",
    errPassengers: "Enter a number of passengers between 10 and 500.",
    summaryTitle: "Simulation Summary",
    close: "Close",
    waveCaption: "Bon voyage!",
    run: "Run",
    sAvgTime: "Average total time ({n} runs)",
    sAvgExited: "Average exited (per run)",
    sAvgGaveUp: "Average gave up (per run)",
    sMainRun: "Averages across {n} runs",
    sSectionUsage: "Tile usage",
    sSectionUsageNote: "how many passengers used each machine type",
    sSectionFailures: "Failures",
    sSectionBottlenecks: "Bottlenecks",
    sSectionTileLoad: "Machine load",
    sSectionTileLoadNote: "% of the run each individual machine spent actively busy",
    usageTitle: "Detailed Report",
    usageBtn: "Detailed report (all {n} runs)",
    usageNote: "Per-run total time, and the percent of each run's time every machine spent actively serving a passenger.",
    usageTotalTime: "Total time",
    usageAvg: "Avg",
    usageNoTiles: "No machines on the grid.",
    sFailedBanner: "FAILED TO COMPLETE",
    sTotalTime: "Total simulation time",
    sGenerated: "Passengers generated",
    sExited: "Exited",
    sGaveUp: "Gave up (wandering)",
    sUsedKiosk: "Used a self check-in kiosk",
    sUsedBaggage: "Used a self baggage-drop",
    sUsedCounter: "Used a staffed counter",
    sUsedTagomat: "Used a tagomat",
    sKioskFailures: "Kiosk failures",
    sBagdropFailures: "Bag-drop failures",
    sTagomatFailures: "Tagomat failures",
    sUnused: "Unused machines",
    sLongestQueue: "Avg. longest queue",
    sLongestWait: "Avg. longest wait in line",
    sSlowest: "Avg. slowest overall process",
    sLongestQueueDetail: "Longest queue",
    sLongestWaitDetail: "Longest wait in line",
    sSlowestDetail: "Slowest overall process",
    sRuns: "runs",
    sOverlaps: "Queue overlaps",
    sReasons: "Suggestions",
    rNeedCounter: "Add a staffed counter — passengers had a failed transaction or couldn't reach a counter to fix it.",
    rNeedKiosk: "Add a reachable check-in kiosk — passengers couldn't reach one to check in.",
    rNeedBaggage: "Add a reachable self baggage-drop — passengers with baggage couldn't reach one.",
    rNeedExit: "Make the exit reachable — passengers couldn't find a way out.",
    passenger: "Passenger",
    sNone: "-",
    oNone: "None",
    oTiles: "Overlapped tiles",
    oQueues: "Overlapped other queues",
    oBoth: "Overlapped tiles and other queues",
    assumptionItems: [
      "Each passenger's walking pace is fixed at spawn: crossing one grid cell takes on average 10 seconds (std 5, minimum 2).",
      "New passengers enter through each entrance gate independently, with gaps of on average 20 seconds (std 5) between arrivals; the first passenger at each gate enters immediately.",
      "Passengers don't aim for a specific machine type. At every moment they head for the closest/least-queued reachable station that can perform their earliest outstanding step — check-in (skipped if already checked in online), boarding-pass printing (skipped unless needed), baggage-tag printing (only with a checked bag), then bag drop (only with a checked bag) — and complete every later step that same station can also perform in the same visit, so one stop often clears more than one step at once.",
      "A visit's duration is the sum of the operations conducted there, each drawn from the normal distribution set in the Process time panel. Which operations each tile type performs is set on the Tile Operations page: some combinations are locked (a kiosk can't drop a bag; a tagomat only ever prints tags; a staffed counter always does everything), the rest are toggled freely — check-in and boarding-pass printing at a baggage drop are off by default but can be turned on there. Each operation takes at least 5 seconds.",
      "Kiosks, baggage drops, and tagomats succeed at the user-set success rates. A failed transaction would fail again at any machine, so the passenger goes to a staffed counter; if no counter is reachable, they give up and wander around the hall aimlessly.",
      "A failed machine transaction leaves all of the passenger's operations outstanding; the counter worker then performs everything that remains and always succeeds.",
      "A staffed counter handles everything at once: after counter service the passenger goes straight to the exit.",
      "Passengers pick the station with the least queue; ties go to the closest. Passengers who walk slower than the slow-pace threshold always pick the closest station instead.",
      "If a staffed counter is empty, people go straight to it; otherwise they use the self-service machines first and only queue at a counter when no machine is available.",
      "If check-in and boarding-pass printing are turned on for the baggage drop (Tile Operations), a baggage drop becomes a valid stop for those steps too, for everyone, even cabin-bag-only passengers. A passenger with baggage might then get everything done at one baggage drop, or split the steps across a kiosk and a baggage drop — whichever is closer or has the shorter queue at each step.",
      "When a usable machine becomes empty, people waiting in other queues leave the line and walk to it. Only those that are too slow choose waiting in line over walking to the empty machine.",
      "If a passenger cannot reach any required station (and no counter exists), they wait in place and look again every few seconds; after 10 minutes of waiting they run out of patience, give up, and wander off (counted as a failure).",
      "Interns and officers are placeable staff that speed up nearby machines rather than serving passengers themselves. An intern cuts the visit duration of every machine in the 8 cells around it plus one more cell straight out in each direction (12 cells total) by 20% — 30% if that intern is itself within an officer's reach. An officer cuts visit duration by 40%, in every cell within 2 steps (minus the 4 far diagonal corners) plus one more cell straight out in each direction (24 cells total). Where regions overlap, only the single strongest bonus applies, not a stacked total.",
    ],
  },
  tr: {
    language: "Dil",
    simTime: "Simülasyon süresi",
    settings: "Gelişmiş Ayarlar",
    tileOpsBtn: "Birim İşlemleri",
    tileOpsTitle: "Birim İşlemleri",
    tileOpsNote: "Her birim türünün hangi işlemleri yapabileceği. Kilitli (gri) kutular ya o makine için fiziksel olarak imkansızdır ya da — görevli kontuar için — tasarım gereği her şeyi hallettiğinden her zaman açıktır.",
    opCheckin: "Check-in",
    opPass: "Biniş kartı",
    opTag: "Bagaj etiketi",
    opDrop: "Bagaj bırakma",
    grid: "Grid",
    width: "Genişlik (sütun)",
    height: "Yükseklik (satır)",
    generate: "Grid Oluştur",
    passengers: "Yolcular",
    numPassengers: "Yolcu Sayısı",
    pctOnline: "Online check-in %",
    pctKioskOnline: "Online check-in yapanlarda biniş kartı yazdırma %",
    pctCabin: "Sadece kabin bagajı %",
    successRateLabel: "Başarı oranı",
    processTime: "İşlem süresi",
    opCheckinMean: "Check-in ortalama (sn)",
    opCheckinStd: "Check-in std (sn)",
    opPassMean: "Biniş kartı yazdırma ortalama (sn)",
    opPassStd: "Biniş kartı yazdırma std (sn)",
    opTagMean: "Bagaj etiketi yazdırma ortalama (sn)",
    opTagStd: "Bagaj etiketi yazdırma std (sn)",
    opDropMean: "Bagaj bırakma ortalama (sn)",
    opDropStd: "Bagaj bırakma std (sn)",
    moodHappy: "Kaç dk altında mutlu",
    moodAngry: "Kaç dk üstünde sinirli",
    boarding: "Uçağa biniş",
    gate: "Kapı",
    simulation: "Simülasyon",
    numRuns: "Koşu Sayısı",
    start: "Başlat",
    running: "Çalışıyor...",
    reset: "Sıfırla",
    tiles: "Birimler",
    leftClickRotate: "Sol tık: döndür",
    rightClickDelete: "Sağ tık: sil",
    clearGrid: "Izgarayı temizle",
    assumptions: "Varsayımlar",
    startContinue: "Simülasyona devam et",
    startNext: "İleri",
    placed: "Yerleştirilen:",
    rotateH: "Döndür (şu an yatay)",
    rotateV: "Döndür (şu an dikey)",
    tileKiosk: "Self Check-in Kiosku",
    tileBaggage: "Self Bagagge Drop",
    tileCounter: "Görevlili Kontuar",
    tileTagomat: "Tagomat",
    countKiosk: ["kiosk", "kiosk"],
    countBaggage: ["bagaj bırakma", "bagaj bırakma"],
    countCounter: ["kontuar", "kontuar"],
    countTagomat: ["tagomat", "tagomat"],
    workersTitle: "Personel",
    workersNote: "Stajyerler ve görevliler yolcularla doğrudan ilgilenmez — yakındaki makinelerin işlem süresini hızlandırırlar.",
    workerIntern: "Stajyer",
    workerOfficer: "Görevli",
    countIntern: ["stajyer", "stajyer"],
    countOfficer: ["görevli", "görevli"],
    costPerHour: "{n} TL/saat",
    layoutCost: "Maliyet",
    sTotalCost: "İşletme maliyeti",
    sCostPerCustomer: "Müşteri başına maliyet",
    sCostPerCustomerNote: "Tam saat üzerinden faturalandırılır — bir saatin herhangi bir kısmı tam saat sayılır",
    entrance: "GİRİŞ",
    exit: "ÇIKIŞ",
    errDims: "20 ile 30 arasında geçerli boyutlar girin.",
    errPassengers: "10 ile 500 arasında bir yolcu sayısı girin.",
    summaryTitle: "Simülasyon Özeti",
    close: "Kapat",
    waveCaption: "İyi yolculuklar!",
    run: "Koşu",
    sAvgTime: "Ortalama toplam süre ({n} koşu)",
    sAvgExited: "Ortalama çıkış yapan (koşu başına)",
    sAvgGaveUp: "Ortalama vazgeçen (koşu başına)",
    sMainRun: "{n} koşunun ortalaması",
    sSectionUsage: "Birim kullanımı",
    sSectionUsageNote: "her makine tipini kaç yolcunun kullandığı",
    sSectionFailures: "Hatalar",
    sSectionBottlenecks: "Darboğazlar",
    sSectionTileLoad: "Makine yükü",
    sSectionTileLoadNote: "her bir makinenin, koşu süresinin yüzde kaçında aktif olarak meşgul olduğu",
    usageTitle: "Detaylı Rapor",
    usageBtn: "Detaylı rapor ({n} koşu)",
    usageNote: "Koşu başına toplam süre ve her makinenin, koşunun süresinin yüzde kaçında aktif olarak bir yolcuya hizmet verdiği.",
    usageTotalTime: "Toplam süre",
    usageAvg: "Ort",
    usageNoTiles: "Izgarada makine yok.",
    sFailedBanner: "TAMAMLANAMADI",
    sTotalTime: "Toplam simülasyon süresi",
    sGenerated: "Oluşturulan yolcu",
    sExited: "Çıkış yapan",
    sGaveUp: "Vazgeçip dolaşan",
    sUsedKiosk: "Self check-in kiosku kullanan",
    sUsedBaggage: "Self bagaj bırakma kullanan",
    sUsedCounter: "Görevli kontuar kullanan",
    sUsedTagomat: "Tagomat kullanan",
    sKioskFailures: "Kiosk hatası",
    sBagdropFailures: "Bagagge drop hatası",
    sTagomatFailures: "Tagomat hatası",
    sUnused: "Kullanılmayan makineler",
    sLongestQueue: "Ort. en uzun kuyruk",
    sLongestWait: "Ort. sırada en uzun bekleyen",
    sSlowest: "Ort. en yavaş toplam süreç",
    sLongestQueueDetail: "En uzun kuyruk",
    sLongestWaitDetail: "Sırada en uzun bekleyen",
    sSlowestDetail: "En yavaş toplam süreç",
    sRuns: "koşu",
    sOverlaps: "Kuyruk çakışmaları",
    sReasons: "Öneriler",
    rNeedCounter: "Görevli kontuar ekleyin — yolcuların işlemi başarısız oldu ya da düzeltecek bir kontuara ulaşamadılar.",
    rNeedKiosk: "Ulaşılabilir bir check-in kiosku ekleyin — yolcular check-in için birine ulaşamadı.",
    rNeedBaggage: "Ulaşılabilir bir self bagaj bırakma ekleyin — bagajı olan yolcular birine ulaşamadı.",
    rNeedExit: "Çıkışı ulaşılabilir yapın — yolcular dışarı çıkacak yol bulamadı.",
    passenger: "Yolcu",
    sNone: "-",
    oNone: "Yok",
    oTiles: "Kuyruk makineler ile çakıştı",
    oQueues: "Diğer kuyruklarla çakıştı",
    oBoth: "Birimler ve diğer kuyruklarla çakıştı",
    assumptionItems: [
      "Her yolcunun yürüme hızı girişte belirlenir: bir kareyi geçmek ortalama 10 saniye sürer (std 5, en az 2).",
      "Yeni yolcular her giriş kapısından bağımsız olarak, aralarında ortalama 20 saniye (std 5) boşlukla girer; her kapıdaki ilk yolcu hemen girer.",
      "Yolcular belirli bir makine türünü hedeflemez. Her an, eksik olan en erken adımlarını gerçekleştirebilecek en yakın/en kısa kuyruklu ulaşılabilir istasyona yönelirler — check-in (online check-in yapılmışsa atlanır), biniş kartı yazdırma (gerekmiyorsa atlanır), bagaj etiketi yazdırma (yalnızca bagajı olanlar), ardından bagaj bırakma (yalnızca bagajı olanlar) — ve o istasyonun aynı ziyarette gerçekleştirebileceği sonraki tüm adımları da tamamlarlar; bu yüzden tek bir durak genelde birden fazla adımı birden halleder.",
      "Bir ziyaretin süresi, orada yapılan işlemlerin toplamıdır; her işlem İşlem süresi panelinde ayarlanan normal dağılımdan çekilir. Her birim türünün hangi işlemleri yaptığı Birim İşlemleri sayfasında ayarlanır: bazı kombinasyonlar kilitlidir (bir kiosk bagaj bırakamaz; bir tagomat yalnızca etiket yazdırır; görevlili kontuar her zaman her şeyi yapar), geri kalanı serbestçe açılıp kapatılabilir — bagaj bırakma noktasında check-in ve biniş kartı yazdırma varsayılan olarak kapalıdır ama oradan açılabilir. Her işlem en az 5 saniye sürer.",
      "Kiosklar, bagagge drop üniteleri ve tagomatlar kullanıcının belirlediği başarı oranlarıyla çalışır. Başarısız bir işlem makinede yine başarısız olacağından yolcu görevlili kontuara gider; ulaşılabilir kontuar yoksa vazgeçip ortalıkta amaçsızca dolaşır.",
      "Başarısız bir makine işlemi yolcunun tüm işlemlerini yapılmamış bırakır; kontuar görevlisi kalan her şeyi yapar ve her zaman başarılıdır.",
      "Görevlili kontuar her şeyi tek seferde halleder: kontuar hizmetinden sonra yolcu doğrudan çıkışa gider.",
      "Yolcular en kısa kuyruğa sahip istasyonu seçer; eşitlikte en yakın olan tercih edilir. Yavaş yürüme eşiğinin altındaki yolcular her zaman en yakın istasyonu seçer.",
      "Görevlili kontuar boşsa insanlar doğrudan oraya gider; aksi halde önce self servis makinelerini kullanır ve yalnızca hiçbir makine yoksa kontuarda sıraya girer.",
      "Bagaj bırakma için check-in ve biniş kartı yazdırma açılırsa (Birim İşlemleri), bagaj bırakma herkes için (kabin bagajı olanlar dahil) bu adımlar için de geçerli bir durak olur. Bagajı olan bir yolcu her şeyi tek bir bagaj bırakma noktasında halledebilir ya da adımları, her adımda hangisi daha yakın veya kuyruğu daha kısaysa ona göre kiosk ve bagaj bırakma arasında bölebilir.",
      "Kullanılabilir bir makine boşaldığında, diğer kuyruklarda bekleyenler sıradan ayrılıp oraya yürür. Yalnızca çok yavaş olanlar boş makineye yürümek yerine sırada beklemeyi seçer.",
      "Bir yolcu gerekli hiçbir istasyona ulaşamıyorsa (ve kontuar yoksa), olduğu yerde bekler ve birkaç saniyede bir yeniden bakar; 10 dakika bekledikten sonra sabrı tükenir, vazgeçip dolaşmaya başlar (hata olarak sayılır).",
      "Stajyerler ve görevliler yolculara doğrudan hizmet vermez, yakındaki makineleri hızlandırır. Bir stajyer, etrafındaki 8 kareyi ve her yönde bir kare daha ötesini (toplam 12 kare) %20 hızlandırır — bir görevlinin etki alanındaysa bu oran %30'a çıkar. Bir görevli, 2 kareye kadar her yönü (4 uzak çapraz köşe hariç) ve her yönde bir kare daha ötesini (toplam 24 kare) %40 hızlandırır. Etki alanları çakıştığında oranlar toplanmaz, yalnızca en güçlü tekil bonus uygulanır.",
    ],
  },
};

let currentLang = "en";

function t(key) {
  const v = I18N[currentLang][key];
  return v !== undefined ? v : I18N.en[key];
}

// like t(), but substitutes a run count into the "{n}" placeholder
function tn(key, n) {
  return t(key).replace("{n}", n);
}

// ---------- Tile type definitions ----------
const TILE_TYPES = {
  kiosk: { labelKey: "tileKiosk", countKey: "countKiosk", color: "#5b8cff", baseW: 1, baseH: 1, orientable: false, costPerHour: 0.95 },
  baggage: { labelKey: "tileBaggage", countKey: "countBaggage", color: "#ffb648", baseW: 2, baseH: 1, orientable: true, costPerHour: 1.5 },
  counter: { labelKey: "tileCounter", countKey: "countCounter", color: "#b78bff", baseW: 2, baseH: 1, orientable: true, costPerHour: 11.2 },
  tagomat: { labelKey: "tileTagomat", countKey: "countTagomat", color: "#2dd4bf", baseW: 1, baseH: 1, orientable: false, costPerHour: 0.4 },
};

// per-tile-type, per-operation availability. User-configurable on the Tile
// Operations settings page. TILE_OP_LOCK marks combinations that are locked
// (the checkbox is disabled and forced to this value) because they're either
// physically impossible for that machine (e.g. a kiosk can't drop a bag) or,
// for the staffed counter, because "handles everything" is a hardcoded,
// unconditional assumption elsewhere in the simulation (see the serving-loop
// branch for st.type === "counter") — letting that drift out of sync with
// these checkboxes would silently break the counter's behavior.
const DEFAULT_TILE_OPS = {
  kiosk: { checkin: true, pass: true, tag: true, drop: false },
  baggage: { checkin: false, pass: false, tag: true, drop: true },
  counter: { checkin: true, pass: true, tag: true, drop: true },
  tagomat: { checkin: false, pass: false, tag: true, drop: false },
};
const TILE_OP_LOCK = {
  kiosk: { drop: false },
  baggage: {},
  counter: { checkin: true, pass: true, tag: true, drop: true },
  tagomat: { checkin: false, pass: false, drop: false },
};

// ---------- Worker type definitions ----------
// Workers occupy a grid cell like a machine tile (and block movement the same
// way) but don't process passengers themselves — instead they speed up the
// visit duration of any machine whose tile falls within their effect region.
const WORKER_TYPES = {
  intern: { labelKey: "workerIntern", countKey: "countIntern", color: "#a3e635", baseW: 1, baseH: 1, orientable: false, basePct: 20, boostedPct: 30, costPerHour: 3.2 },
  officer: { labelKey: "workerOfficer", countKey: "countOfficer", color: "#f472b6", baseW: 1, baseH: 1, orientable: false, basePct: 40, costPerHour: 9 },
};
// fixed (non-random) look for each worker role — unlike passengers, every
// intern looks identical to every other intern, reading as a uniform rather
// than a randomly-dressed traveller
const WORKER_LOOK = {
  intern: { shirt: WORKER_TYPES.intern.color, skin: "#f1c9a5", hair: "#2b2118" },
  officer: { shirt: WORKER_TYPES.officer.color, skin: "#e0ac7e", hair: "#1a1a1a" },
};
// combined lookup for anything generic (placement sizing, rendering) that
// doesn't care whether a tile is a machine or a worker
const PLACEABLE_TYPES = { ...TILE_TYPES, ...WORKER_TYPES };

// cell offsets (relative to the worker's own cell) covered by its speed bonus.
// Intern: the 8 surrounding cells (3x3 minus center) + one more cell straight
// out in each of the 4 cardinal directions (distance 2) = 12 cells.
const INTERN_CELLS = [];
for (let dy = -1; dy <= 1; dy++) {
  for (let dx = -1; dx <= 1; dx++) {
    if (dx !== 0 || dy !== 0) INTERN_CELLS.push([dx, dy]);
  }
}
INTERN_CELLS.push([0, -2], [0, 2], [-2, 0], [2, 0]);

// Officer: every cell within 2 steps (incl. diagonals) except the 4 far
// diagonal corners — a "rounded" 5x5 square, 20 cells — + one more cell
// straight out in each of the 4 cardinal directions (distance 3) = 24 cells.
const OFFICER_CELLS = [];
for (let dy = -2; dy <= 2; dy++) {
  for (let dx = -2; dx <= 2; dx++) {
    if (dx === 0 && dy === 0) continue;
    if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
    OFFICER_CELLS.push([dx, dy]);
  }
}
OFFICER_CELLS.push([0, -3], [0, 3], [-3, 0], [3, 0]);

const WORKER_EFFECT_CELLS = { intern: INTERN_CELLS, officer: OFFICER_CELLS };

// true if (x,y) is one of the cells the given worker's effect region reaches
function inWorkerEffect(workerType, wx, wy, x, y) {
  return WORKER_EFFECT_CELLS[workerType].some(([dx, dy]) => wx + dx === x && wy + dy === y);
}

// every worker currently on the grid
function listWorkers() {
  const out = [];
  for (const tile of state.tiles.values()) {
    if (tile.type === "intern" || tile.type === "officer") out.push(tile);
  }
  return out;
}

// speed multiplier (<=1, applied to visit duration) for a station tile, from
// every worker whose effect region covers any cell that tile occupies.
// Overlapping workers don't stack — the single strongest bonus applies. An
// intern standing inside an officer's effect region works faster itself
// (20% -> 30%) before that comparison is made.
// the strongest single worker bonus (%) reaching this tile — see
// speedMultiplierFor for the overlap rule (strongest wins, no stacking)
function boostPctFor(tile) {
  // a staffed counter already has its own worker built into its process time —
  // interns/officers don't speed it up further
  if (tile.type === "counter") return 0;
  const workers = listWorkers();
  let bestPct = 0;
  for (const w of workers) {
    const pct =
      w.type === "officer"
        ? WORKER_TYPES.officer.basePct
        : workers.some((o) => o.type === "officer" && inWorkerEffect("officer", o.x, o.y, w.x, w.y))
        ? WORKER_TYPES.intern.boostedPct
        : WORKER_TYPES.intern.basePct;
    if (pct <= bestPct) continue;
    let reaches = false;
    for (let dy = 0; dy < tile.h && !reaches; dy++) {
      for (let dx = 0; dx < tile.w && !reaches; dx++) {
        if (inWorkerEffect(w.type, w.x, w.y, tile.x + dx, tile.y + dy)) reaches = true;
      }
    }
    if (reaches) bestPct = pct;
  }
  return bestPct;
}

function speedMultiplierFor(tile) {
  return 1 - boostPctFor(tile) / 100;
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// tint every cell a worker's speed bonus reaches, so its effect size is
// visible at a glance instead of having to remember the shape from memory
function drawWorkerEffectOverlay(type, wx, wy, alpha) {
  ctx.fillStyle = hexToRgba(WORKER_TYPES[type].color, alpha);
  for (const [dx, dy] of WORKER_EFFECT_CELLS[type]) {
    const x = wx + dx, y = wy + dy;
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) continue;
    ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }
}

// maps a boost % to a colour: mild bonuses (20%, a lone intern) read as a
// calm gold, climbing through amber to a hot red-orange at the officer's 40%
// — same lightning motif throughout, just hotter-coloured for a bigger boost
const BOOST_COLOR_STOPS = [
  { pct: 20, rgb: [255, 232, 70] }, // yellow
  { pct: 30, rgb: [255, 140, 30] }, // orange
  { pct: 40, rgb: [235, 45, 45] }, // red
];
function boostColorForPct(pct) {
  const stops = BOOST_COLOR_STOPS;
  if (pct <= stops[0].pct) return stops[0].rgb;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (pct <= b.pct) {
      const f = (pct - a.pct) / (b.pct - a.pct);
      return a.rgb.map((v, idx) => Math.round(v + (b.rgb[idx] - v) * f));
    }
  }
  return stops[stops.length - 1].rgb;
}

// a small circular "boost" badge with a lightning-bolt glyph — lightning
// reads unambiguously as speed/energy (unlike fire, which reads as damage),
// and a corner badge doesn't collide with tiles above it in a dense layout
function drawBoostBadge(cx, cy, r, t, rgb) {
  const [R, G, B] = rgb;
  const dark = `rgb(${Math.round(R * 0.35)},${Math.round(G * 0.35)},${Math.round(B * 0.35)})`;
  const pulse = 0.5 + 0.5 * Math.sin(t / 480);
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = `rgba(${R},${G},${B},0.85)`;
  ctx.shadowBlur = r * (1.3 + pulse * 0.6);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  const badge = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  badge.addColorStop(0, "#fff6d0");
  badge.addColorStop(0.55, `rgb(${R},${G},${B})`);
  badge.addColorStop(1, `rgb(${Math.round(R * 0.75)},${Math.round(G * 0.6)},${Math.round(B * 0.55)})`);
  ctx.fillStyle = badge;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.strokeStyle = dark;
  ctx.stroke();

  // the bolt glyph itself, a standard zigzag silhouette
  const b = r * 0.58;
  ctx.beginPath();
  ctx.moveTo(b * 0.15, -b);
  ctx.lineTo(-b * 0.55, b * 0.15);
  ctx.lineTo(-b * 0.05, b * 0.15);
  ctx.lineTo(-b * 0.35, b);
  ctx.lineTo(b * 0.55, -b * 0.1);
  ctx.lineTo(b * 0.05, -b * 0.1);
  ctx.closePath();
  ctx.fillStyle = dark;
  ctx.fill();

  ctx.restore();
}

// pulsing colored outline around a machine currently sped up by a nearby worker
function drawBoostGlow(x, y, w, h, t, rgb) {
  const [R, G, B] = rgb;
  const pulse = 0.5 + 0.5 * Math.sin(t / 480);
  ctx.save();
  ctx.shadowColor = `rgba(${R},${G},${B},0.75)`;
  ctx.shadowBlur = 4 + pulse * 5;
  ctx.strokeStyle = `rgba(${R},${G},${B},${(0.55 + pulse * 0.3).toFixed(2)})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.restore();
}

const GATE_COLORS = { entrance: "#1f9d55", exit: "#ff6b6b" };

const CELL_SIZE = 24; // base px per cell at zoom = 1
const MIN_ZOOM = 0.08;

// ---------- App state ----------
const state = {
  width: 0,
  height: 0,
  numPassengers: 0,
  pctOnline: 50,
  pctKioskAmongOnline: 30,
  pctCabinOnly: 40,
  // one of SUCCESS_RATE_OPTIONS; set via the success-rate buttons on each
  // tile's palette card, defaulting to the tier the listed prices are for
  kioskSuccessPct: 70,
  bagdropSuccessPct: 70,
  tagomatSuccessPct: 70,
  // which operations each tile type performs; user-configurable on the Tile
  // Operations page, seeded from DEFAULT_TILE_OPS (deep-cloned so editing one
  // run's state never mutates the shared default)
  tileOps: JSON.parse(JSON.stringify(DEFAULT_TILE_OPS)),
  // per-OPERATION process times ~ N(mean, sd), configurable in the UI.
  // A tile visit's duration is the sum of the operations conducted there.
  ops: {
    checkin: { mean: 90, sd: 45 }, // check in (non-online passengers)
    pass: { mean: 20, sd: 10 }, // print boarding pass
    tag: { mean: 20, sd: 10 }, // print baggage tag
    drop: { mean: 80, sd: 40 }, // hand over the bag
  },
  grid: null, // Int32Array, -1 = empty, else tile id
  tiles: new Map(), // id -> { type, x, y, w, h }
  nextTileId: 1,
  counts: {}, // type -> { placed }
  orientation: {}, // type -> 'h' | 'v' (for orientable tiles)
  selectedTool: null, // tile type key or null
  zoom: 1,
  panX: 0,
  panY: 0,
  hoverCell: null,
  gates: [], // border-segment gates, set by computeGates()
};

// ---------- Simulation state ----------
// N independent runs of the same layout: run 1 is the big main view, runs 2-N
// render in the mini panels, laid out as a horizontally scrollable strip so
// the count is uncapped. Only the random draws differ between them, so the
// spread (and the average) shows how much of a result is luck vs. layout. The
// run count is user-selectable (numRunsInput), see rebuildRuns() below.
const MIN_RUNS = 1;
const DEFAULT_RUNS = 5;

function makeSim() {
  return {
    running: false,
    finished: false, // this run reached its end condition
    agents: [],
    stations: [], // kiosk/baggage tiles with queues
    toSpawn: 0,
    entranceTimers: [], // per-entrance arrival clocks, gaps ~ N(SPAWN_GAP_MEAN, SPAWN_GAP_SD)
    doneCount: 0,
    elapsed: 0, // simulated seconds since Start
    agentIdSeq: 0,
    failures: { kiosk: 0, baggage: 0, tagomat: 0 }, // failed transactions per machine type
    overlapTile: false, // a queue extended over a machine tile at some point
    overlapQueue: false, // two queues overlapped at some point
    speedMul: 1, // simulation time multiplier (1x/2x/4x/8x)
  };
}

let sims = Array.from({ length: DEFAULT_RUNS }, makeSim);
// `sim` is the run the engine functions currently operate on; the master tick
// swaps it across all runs each frame, and it points back at the main run
// (sims[0]) everywhere else (drawing, editing, summary details).
let sim = sims[0];

const SPEED_STEPS = [1, 4, 20, 25, 50, 128, 150, 500];

// walking: crossing one cell takes N(3s, 1s) per person (their pace is fixed at spawn)
const WALK_SECONDS_MEAN = 3;
const WALK_SECONDS_SD = 1;
const WALK_SECONDS_MIN = 2; // clamp so nobody teleports on an extreme sample
// service: a visit's duration is the sum of the operations conducted there.
// Per-operation defaults (seconds); the UI sliders start from these.
const OP_DEFAULTS = {
  checkin: { mean: 90, sd: 45 },
  pass: { mean: 20, sd: 10 },
  tag: { mean: 20, sd: 10 },
  drop: { mean: 80, sd: 40 },
};
const OP_SECONDS_MIN = 5; // each operation takes at least this long
const SERVICE_SECONDS_MIN = 10; // fallback visit time when no operation applies
// how long a person with nowhere to go waits before looking for stations again
const RETRY_SECONDS = 5;
// total patience: after this long stuck waiting with nowhere to go, they give up
const MAX_WAIT_SECONDS = 600;
// looks for the top-view people illustrations
// muted, everyday clothing tones rather than candy-bright ones
const SHIRT_COLORS = ["#2c3e60", "#4a4e57", "#7a3b46", "#5c6b47", "#4f6d8c", "#c9a227", "#b5654a", "#3f6b52", "#6b4e71", "#b8a88a", "#4d7c74", "#8a8478"];
const HAIR_COLORS = ["#2b2118", "#4a3320", "#7a5c3d", "#b08d57", "#d9c187", "#888888", "#c9c9c9", "#1a1a1a", "#5d4037"];
const SKIN_COLORS = ["#f1c9a5", "#e0ac7e", "#c68863", "#a0673f", "#ffdbac"];
const ELDERLY_HAIR_COLORS = ["#ffffff", "#ececec", "#d8d8d8"]; // slow walkers are elderly: white hair + walking stick
const BAG_COLORS = ["#3e4a5e", "#6d4c41", "#7b1fa2", "#00695c", "#bf360c", "#263238", "#9c27b0", "#1565c0"];
// arrivals: each entrance gate lets a new person in every N(20s, 5s)
const SPAWN_GAP_MEAN = 20;
const SPAWN_GAP_SD = 5;
const SPAWN_GAP_MIN = 1;
// below this pace (cells/s) people are "elderly": head to the closest station instead
// of the shortest queue. elderly = needs 1.5 SD more time per cell than average
const SLOW_PACE_THRESHOLD = 1 / (WALK_SECONDS_MEAN + 1.5 * WALK_SECONDS_SD);

// ---------- DOM refs ----------
const widthInput = document.getElementById("grid-width");
const heightInput = document.getElementById("grid-height");
const widthSlider = document.getElementById("grid-width-slider");
const heightSlider = document.getElementById("grid-height-slider");
const widthSliderValue = document.getElementById("grid-width-slider-value");
const heightSliderValue = document.getElementById("grid-height-slider-value");
const passengersInput = document.getElementById("num-passengers");
const pctOnlineInput = document.getElementById("pct-online");
const pctOnlineSlider = document.getElementById("pct-online-slider");
const pctOnlineSliderValue = document.getElementById("pct-online-slider-value");
const pctKioskOnlineInput = document.getElementById("pct-kiosk-online");
const pctKioskOnlineSlider = document.getElementById("pct-kiosk-online-slider");
const pctKioskOnlineSliderValue = document.getElementById("pct-kiosk-online-slider-value");
const pctCabinInput = document.getElementById("pct-cabin");
const pctCabinSlider = document.getElementById("pct-cabin-slider");
const pctCabinSliderValue = document.getElementById("pct-cabin-slider-value");
// process-time inputs: one mean/std pair per operation
const opInputs = {};
for (const [op, base] of Object.entries({ checkin: "op-checkin", pass: "op-pass", tag: "op-tag", drop: "op-drop" })) {
  opInputs[op] = {
    mean: document.getElementById(`${base}-mean`),
    sd: document.getElementById(`${base}-std`),
    meanSlider: document.getElementById(`${base}-mean-slider`),
    sdSlider: document.getElementById(`${base}-std-slider`),
    meanValue: document.getElementById(`${base}-mean-slider-value`),
    sdValue: document.getElementById(`${base}-std-slider-value`),
  };
}
const moodHappyInput = document.getElementById("mood-happy");
const moodHappySlider = document.getElementById("mood-happy-slider");
const moodHappySliderValue = document.getElementById("mood-happy-slider-value");
const moodAngryInput = document.getElementById("mood-angry");
const moodAngrySlider = document.getElementById("mood-angry-slider");
const moodAngrySliderValue = document.getElementById("mood-angry-slider-value");
const numRunsInput = document.getElementById("num-runs");
const generateBtn = document.getElementById("generate-btn");
const setupError = document.getElementById("setup-error");
const tileListEl = document.getElementById("tile-list");
const statusTimer = document.getElementById("status-timer");
const simStartBtn = document.getElementById("sim-start");
const simSpeedBtn = document.getElementById("sim-speed");
const simResetBtn = document.getElementById("sim-reset");
const simError = document.getElementById("sim-error");
const canvas = document.getElementById("grid-canvas");
const ctx = canvas.getContext("2d");

// ---------- Setup screen ----------
// keep number input, slider, and live readout for grid dimensions in sync
function bindDimSync(numberEl, sliderEl, valueEl) {
  const syncFromSlider = () => {
    numberEl.value = sliderEl.value;
    valueEl.textContent = sliderEl.value;
  };
  const syncFromNumber = () => {
    if (numberEl.value === "") return;
    const clamped = Math.min(Number(numberEl.value), Number(sliderEl.max));
    sliderEl.value = clamped;
    valueEl.textContent = sliderEl.value;
  };
  sliderEl.addEventListener("input", syncFromSlider);
  sliderEl.addEventListener("change", syncFromSlider);
  numberEl.addEventListener("input", syncFromNumber);
  numberEl.addEventListener("change", syncFromNumber);
}
bindDimSync(widthInput, widthSlider, widthSliderValue);
bindDimSync(heightInput, heightSlider, heightSliderValue);
bindDimSync(pctOnlineInput, pctOnlineSlider, pctOnlineSliderValue);
bindDimSync(pctKioskOnlineInput, pctKioskOnlineSlider, pctKioskOnlineSliderValue);
bindDimSync(pctCabinInput, pctCabinSlider, pctCabinSliderValue);
for (const op of Object.keys(opInputs)) {
  bindDimSync(opInputs[op].mean, opInputs[op].meanSlider, opInputs[op].meanValue);
  bindDimSync(opInputs[op].sd, opInputs[op].sdSlider, opInputs[op].sdValue);
}
bindDimSync(moodHappyInput, moodHappySlider, moodHappySliderValue);
bindDimSync(moodAngryInput, moodAngrySlider, moodAngrySliderValue);

// quick-select buttons for a common passenger count, in place of a slider
document.querySelectorAll(".preset-btn[data-passengers]").forEach((btn) => {
  btn.addEventListener("click", () => { passengersInput.value = btn.dataset.passengers; });
});

// quick-select buttons for a common run count, in place of a slider
document.querySelectorAll(".preset-btn[data-runs]").forEach((btn) => {
  btn.addEventListener("click", () => {
    numRunsInput.value = btn.dataset.runs;
    rebuildRuns(Number(btn.dataset.runs));
  });
});

// ---------- Tile Operations: which ops each tile type performs ----------
// Shown both as a settings-page modal (editable any time) and as a step in
// the first-run startup flow (preselected to DEFAULT_TILE_OPS); both render
// into their own container but read/write the same state.tileOps, so a
// change in either place is kept in sync in the other.
const OP_LABEL_KEYS = { checkin: "opCheckin", pass: "opPass", tag: "opTag", drop: "opDrop" };
const TILE_IMAGES = {
  kiosk: "kiosk-tile.webp",
  baggage: "self-bag-drop.webp",
  counter: "counter-pov.webp",
  tagomat: "tagomat.webp",
};
// each tile's image is scaled inside its (equally sized) frame to roughly
// reflect the real machine's size relative to the others — e.g. a tagomat is
// a small dedicated printer, visibly smaller than a full check-in kiosk.
const TILE_IMAGE_SCALE = {
  kiosk: 0.9,
  baggage: 0.98,
  counter: 1,
  tagomat: 0.68,
};
const operationsBtn = document.getElementById("operations-btn");
const operationsModal = document.getElementById("operations-modal");
const operationsClose = document.getElementById("operations-close");
const tileOpsBody = document.getElementById("tile-ops-body");
const tileOpsContainers = [tileOpsBody];

function renderTileOpsGrid(container) {
  const types = Object.keys(TILE_TYPES);
  let html = '<table class="tile-ops-table"><thead><tr><th></th>';
  for (const type of types) {
    const def = TILE_TYPES[type];
    const img = TILE_IMAGES[type];
    const scalePct = Math.round((TILE_IMAGE_SCALE[type] ?? 1) * 100);
    html += `<th><div class="tile-ops-head"><span class="tile-ops-swatch" style="background:${def.color}"></span>${t(def.labelKey)}</div>`;
    html += `<div class="tile-ops-img-frame">`;
    html += img
      ? `<img class="tile-ops-img" src="${img}" alt="${t(def.labelKey)}" style="max-width:${scalePct}%;max-height:${scalePct}%">`
      : `<div class="tile-ops-img-placeholder" style="background:${def.color};width:${scalePct}%;height:${scalePct}%"></div>`;
    html += `</div></th>`;
  }
  html += "</tr></thead><tbody>";
  for (const op of Object.keys(OP_LABEL_KEYS)) {
    html += `<tr><td>${t(OP_LABEL_KEYS[op])}</td>`;
    for (const type of types) {
      const locked = Object.prototype.hasOwnProperty.call(TILE_OP_LOCK[type], op);
      const checked = state.tileOps[type][op];
      html += `<td><input type="checkbox" data-type="${type}" data-op="${op}"${checked ? " checked" : ""}${locked ? " disabled" : ""}></td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  container.innerHTML = html;
  container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      state.tileOps[cb.dataset.type][cb.dataset.op] = cb.checked;
      buildPalette(); // a tile type with zero ops enabled disappears from the palette
      buildTileOpsGrid(); // reflect the change in every other rendered copy too
    });
  });
}
function buildTileOpsGrid() {
  for (const container of tileOpsContainers) renderTileOpsGrid(container);
}
buildTileOpsGrid();

operationsBtn.addEventListener("click", () => operationsModal.classList.remove("hidden"));
operationsClose.addEventListener("click", () => operationsModal.classList.add("hidden"));
operationsModal.addEventListener("click", (e) => {
  if (e.target === operationsModal) operationsModal.classList.add("hidden"); // click outside the panel closes
});

// ---------- Settings modal (grid size + process time) ----------
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsClose = document.getElementById("settings-close");

settingsBtn.addEventListener("click", () => settingsModal.classList.remove("hidden"));
settingsClose.addEventListener("click", () => settingsModal.classList.add("hidden"));
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) settingsModal.classList.add("hidden"); // click outside the panel closes
});

function readPct(input) {
  const v = parseInt(input.value, 10);
  return Number.isInteger(v) ? Math.min(100, Math.max(0, v)) : 0;
}

// clamped numeric reader for the process-time inputs
function readNum(input, lo, hi, dflt) {
  const v = parseFloat(input.value);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
}

function generateGrid() {
  const w = parseInt(widthInput.value, 10);
  const h = parseInt(heightInput.value, 10);
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 20 || h < 20 || w > 30 || h > 30) {
    setupError.textContent = t("errDims");
    return;
  }
  setupError.textContent = "";
  initGrid(w, h);
  resizeCanvas();
  fitViewToGrid();
  draw();
}

generateBtn.addEventListener("click", generateGrid);

// ---------- Grid init ----------
function initGrid(w, h) {
  state.width = w;
  state.height = h;
  state.grid = new Int32Array(w * h).fill(-1);
  state.tiles.clear();
  state.nextTileId = 1;
  state.counts = {};
  state.orientation = {};
  for (const key of Object.keys(PLACEABLE_TYPES)) {
    state.counts[key] = { placed: 0 };
    state.orientation[key] = "h";
  }
  state.selectedTool = null;
  resetSim();
  buildPalette();
  updateStatusTool();
  computeGates();
}

// Gates live on the grid border, not in cells: each is a 3-cell-long colored
// segment of the borderline. `cell` is the walkable cell just inside the border
// where people appear (entrance) or leave (exit).
function computeGates() {
  const w = state.width, h = state.height;
  const lenW = Math.min(3, w); // segments shrink on very small grids
  const lenH = Math.min(3, h);
  const topStart = Math.max(0, Math.min(w - lenW, Math.round(w * 0.75)));
  const rightStart = Math.max(0, Math.min(h - lenH, Math.round(h / 2) - 1));
  const leftStart = Math.max(0, Math.min(h - lenH, Math.round(h * 0.85)));
  state.gates = [
    { type: "entrance", side: "top", start: topStart, len: lenW, cell: { x: Math.min(w - 1, topStart + 1), y: 0 } },
    { type: "entrance", side: "right", start: rightStart, len: lenH, cell: { x: w - 1, y: Math.min(h - 1, rightStart + 1) } },
    { type: "exit", side: "left", start: leftStart, len: lenH, cell: { x: 0, y: Math.min(h - 1, leftStart + 1) } },
  ];
}

// scale the grid (up or down) so it always fills the screen, centered,
// with a margin for the gate labels outside the border
function fitViewToGrid() {
  const rect = canvas.getBoundingClientRect();
  const worldW = state.width * CELL_SIZE;
  const worldH = state.height * CELL_SIZE;
  // reserve a fixed amount of space (in grid cells, not a % of the grid) on every
  // side for the gate labels drawn outside the border, so they stay on-screen no
  // matter how small the grid is
  const labelMarginCells = 2;
  const zoomX = rect.width / (worldW + labelMarginCells * 2 * CELL_SIZE);
  const zoomY = rect.height / (worldH + labelMarginCells * 2 * CELL_SIZE);
  state.zoom = Math.max(Math.min(zoomX, zoomY), MIN_ZOOM);
  state.panX = (rect.width - worldW * state.zoom) / 2;
  state.panY = (rect.height - worldH * state.zoom) / 2;
}

// ---------- Palette ----------
// trims a cost to at most 2 decimals without leaving trailing zeros
// (0.95 -> "0.95", 9 -> "9", 1.50 -> "1.5")
function formatCost(v) {
  return Number(v.toFixed(2)).toString();
}
function costLine(costPerHour) {
  const el = document.createElement("div");
  el.className = "tile-cost";
  el.textContent = tn("costPerHour", formatCost(costPerHour));
  return el;
}

