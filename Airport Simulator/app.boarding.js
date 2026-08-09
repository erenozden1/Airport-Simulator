// app.boarding.js: the post-run boarding animation — loaded right after
// app.editor.js. The full-screen boarding page's rendering, plus the plane/
// seat-assignment state and clip playback logic that drives it.

// ---------- Boarding page rendering ----------
// Full-screen boarding "page": a Turkish-Airlines airliner banked at an angle
// on the LEFT of the page (a real product photo, background removed), with
// its passenger door forward of the wing. To its right, two horizontal lines
// of passengers stream in from two gates and MERGE into a single jet-bridge
// that bends around to reach that door.

// The tail-fin roundel PNG the user supplied. Drawn upright (never rotated with
// the plane) once it has loaded.
const thyLogo = new Image();
thyLogo.src = "thy-logo.png";
let thyLogoReady = false;
thyLogo.onload = () => {
  thyLogoReady = true;
  if (!boardingModal.classList.contains("hidden")) drawBoardingPage();
};

// Turkish Airlines product photo (background removed) used as the plane on
// the boarding page. It's a 3/4 banked shot, not a straight top-down view, so
// the door anchor below is hand-picked in the image's own pixel space rather
// than derived from the fuselage geometry.
const planeTopImg = new Image();
planeTopImg.src = "plane-thy.png";
let planeTopReady = false;
planeTopImg.onload = () => {
  planeTopReady = true;
  if (!boardingModal.classList.contains("hidden")) drawBoardingPage();
};
// boarding-door position in the source image's own pixel coordinates, on the
// aft fuselage near the tail. Picked (not just eyeballed) as the centre of the
// tallest run of pixels that stays unbroken all the way out to the plane's
// silhouette edge at that height — every other candidate spot on this banked
// photo has the wing or tail poking a gap in front of it, which would leave
// the jet bridge visibly cutting across open background before the fuselage.
const PLANE_DOOR_IMG = { x: 460, y: 235 };

// interpolate a point at fraction t (0..1) along a polyline of {x,y} points
function pointAlong(pts, t) {
  let total = 0;
  const segLen = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLen.push(l);
    total += l;
  }
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segLen.length; i++) {
    if (d <= segLen[i] || i === segLen.length - 1) {
      const f = segLen[i] ? d / segLen[i] : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f };
    }
    d -= segLen[i];
  }
  return pts[pts.length - 1];
}

function drawBoardingPage() {
  const rect = boardingCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.round(rect.width * dpr);
  const ph = Math.round(rect.height * dpr);
  if (boardingCanvas.width !== pw || boardingCanvas.height !== ph) {
    boardingCanvas.width = pw;
    boardingCanvas.height = ph;
  }
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bctx.clearRect(0, 0, rect.width, rect.height);
  if (!plane) return;
  const g = bctx;
  const W = rect.width;
  const H = rect.height;

  // apron tarmac backdrop — the plane is parked on the ground, not in the sky
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#767b83");
  bg.addColorStop(1, "#5c616a");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // concrete slab joints, for a real apron surface
  g.strokeStyle = "rgba(0,0,0,0.10)";
  g.lineWidth = 1;
  g.beginPath();
  const slab = 66;
  for (let x = 0; x <= W; x += slab) {
    g.moveTo(x, 0);
    g.lineTo(x, H);
  }
  for (let y = 0; y <= H; y += slab) {
    g.moveTo(0, y);
    g.lineTo(W, y);
  }
  g.stroke();

  // --- real Turkish Airlines jet on the LEFT, banked at an angle ---
  // (drawn further down, AFTER the jet-bridge tunnel, so the plane always
  // sits on top and the tunnel never visibly covers any part of it)
  const imgAR = planeTopReady ? planeTopImg.width / planeTopImg.height : 900 / 401;
  const maxPlaneW = W * 0.74; // horizontal footprint for the plane (it's a wide/landscape shot)
  const maxPlaneH = H * 0.95;
  let drawW = maxPlaneW;
  let drawH = drawW / imgAR;
  if (drawH > maxPlaneH) {
    drawH = maxPlaneH;
    drawW = drawH * imgAR;
  }
  const planeX = -W * 0.1; // shifted further left, letting it bleed off the edge
  const planeY = (H - drawH) / 2; // centre vertically
  const imgScale = planeTopReady ? drawW / planeTopImg.width : drawW / 900;
  const drawPlane = () => {
    if (!planeTopReady) return;
    g.save();
    g.shadowColor = "rgba(20,35,70,0.30)";
    g.shadowBlur = 22;
    g.drawImage(planeTopImg, planeX, planeY, drawW, drawH);
    g.restore();
  };

  // (boarding progress is shown by the queues, the walking passengers, and the
  // "boarded / total" counter — the realistic hull is left clean)

  // boarding door forward of the wing, on the fuselage's near side, mapped
  // from the source photo's pixel space into this frame. Two anchors kept
  // so the merge logic stays unchanged (both collapse to the same point).
  const doorPt = { x: planeX + PLANE_DOOR_IMG.x * imgScale, y: planeY + PLANE_DOOR_IMG.y * imgScale };
  const doors = [
    { x: doorPt.x, y: doorPt.y - 6 },
    { x: doorPt.x, y: doorPt.y + 6 },
  ];
  const boardDoor = { x: (doors[0].x + doors[1].x) / 2, y: (doors[0].y + doors[1].y) / 2 };

  // --- gate scene on the right: a grid-style airport hall, two rectangular
  // boarding gates, and a jet-bridge tunnel back to the plane ---
  const gates = boarding ? boarding.gates : [null, null];
  const areaL = planeX + drawW; // right edge of the plane region (wing tip)
  const yMid = boardDoor.y;

  // grid-style airport hall on the right (same look as the editor grid)
  const hallLeft = areaL + (W - areaL) * 0.14; // tunnel shortened, hall pulled closer for a longer linear queue
  const hallRight = W - 14;
  const hallTop = H * 0.06;
  const hallBot = H * 0.94;
  const yTop = H * 0.32;
  const yBot = H * 0.68;
  const laneYs = [yTop, yBot];

  g.save();
  g.beginPath(); // clip so grid lines stay inside the hall
  g.rect(hallLeft, hallTop, hallRight - hallLeft, hallBot - hallTop);
  g.clip();
  g.fillStyle = "#1b1f27"; // dark grid floor
  g.fillRect(hallLeft, hallTop, hallRight - hallLeft, hallBot - hallTop);
  g.strokeStyle = "rgba(255,255,255,0.06)"; // faint grid lines
  g.lineWidth = 1;
  g.beginPath();
  for (let x = hallLeft; x <= hallRight; x += CELL_SIZE) {
    g.moveTo(x, hallTop);
    g.lineTo(x, hallBot);
  }
  for (let y = hallTop; y <= hallBot; y += CELL_SIZE) {
    g.moveTo(hallLeft, y);
    g.lineTo(hallRight, y);
  }
  g.stroke();
  g.restore();
  // hall border
  g.strokeStyle = "rgba(255,255,255,0.25)";
  g.lineWidth = 2;
  g.strokeRect(hallLeft, hallTop, hallRight - hallLeft, hallBot - hallTop);

  // green "entrance" gate segments on the right wall — passengers arrive here,
  // exactly like the entrance gates on the editor grid
  g.strokeStyle = GATE_COLORS.entrance;
  g.lineWidth = 6;
  g.lineCap = "butt";
  for (const ly of laneYs) {
    g.beginPath();
    g.moveTo(hallRight, ly - CELL_SIZE * 1.2);
    g.lineTo(hallRight, ly + CELL_SIZE * 1.2);
    g.stroke();
  }

  // --- jet-bridge tunnel: an arm from each boarding gate merges into one tube
  // that links to the plane door ---
  const mx = areaL + (hallLeft - areaL) * 0.55; // Y-junction of the two arms
  const gateQueueX = hallLeft + 46; // front of the queue, just inside the hall
  const paths = laneYs.map((ly) => [
    { x: gateQueueX, y: ly }, // front of the in-hall queue
    { x: hallLeft, y: ly }, // through the boarding gate
    { x: mx, y: yMid }, // into the shared tube
    { x: boardDoor.x, y: yMid }, // to the plane door
  ]);
  const tubePaths = laneYs.map((ly) => [
    { x: hallLeft, y: ly },
    { x: mx, y: yMid },
    { x: boardDoor.x, y: yMid },
  ]);
  const strokePath = (pts, w, color) => {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
  };
  for (const p of tubePaths) strokePath(p, 30, "#7c8698"); // tube walls (dark)
  for (const p of tubePaths) strokePath(p, 24, "#e4e9f0"); // tube floor (light)
  // accordion ribs along the shared tube (door -> junction)
  g.strokeStyle = "rgba(90,100,120,0.5)";
  g.lineWidth = 1.5;
  const ribN = 8;
  for (let i = 1; i < ribN; i++) {
    const rx = boardDoor.x + (mx - boardDoor.x) * (i / ribN);
    g.beginPath();
    g.moveTo(rx, yMid - 11);
    g.lineTo(rx, yMid + 11);
    g.stroke();
  }

  for (let gi = 0; gi < 2; gi++) {
    const ly = laneYs[gi];
    const gate = gates[gi];

    // boarding gate rendered like a grid tile: a solid, labelled rectangle
    // sitting on the hall's left wall where the tunnel connects
    const gw = CELL_SIZE * 1.6;
    const gh = CELL_SIZE * 2.4;
    const gx = hallLeft;
    const gy = ly - gh / 2;
    g.fillStyle = "#4dd0e1";
    g.fillRect(gx + 1, gy + 1, gw - 2, gh - 2); // same inset the grid tiles use
    g.fillStyle = "#0b0d12"; // dark label, exactly like the grid tiles
    g.font = `bold ${Math.round(CELL_SIZE * 0.5)}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(`G${gi + 1}`, gx + gw / 2, ly);

    // waiting passengers queue inside the hall, to the right of the gate —
    // a single line (the tunnel/plane layout gives it plenty of room)
    const waiting = gate ? gate.count - gate.seated - (gate.walker ? 1 : 0) : 0;
    const qGap = 26;
    const qStart = gateQueueX + 14;
    const qEnd = hallRight - 20;
    const maxShown = Math.max(0, Math.floor((qEnd - qStart) / qGap));
    const shown = Math.min(waiting, maxShown);
    for (let k = 0; k < shown; k++) {
      const px = qStart + k * qGap;
      const bob = (k % 2 === 0 ? -1 : 1) * 4;
      // face left, toward the boarding gate (body front is +x)
      drawBoardingFigure(g, px, ly + bob, gate.colors[gate.seated + (gate.walker ? 1 : 0) + k], 13, Math.PI);
    }
    if (waiting > shown) {
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.font = "600 12px 'Segoe UI', system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      g.fillText(`+${waiting - shown}`, qStart + shown * qGap + 6, ly - 14);
    }

    // the passenger currently walking: queue -> gate -> tunnel -> door
    if (gate && gate.walker) {
      const p = Math.max(0, Math.min(1, gate.walkerProg || 0));
      const pos = pointAlong(paths[gi], p);
      const pa = pointAlong(paths[gi], Math.max(0, p - 0.02));
      const pb = pointAlong(paths[gi], Math.min(1, p + 0.02));
      const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
      const bob = Math.sin(p * Math.PI * 8) * 1.6;
      drawBoardingFigure(g, pos.x, pos.y + bob, gate.walker, 13, ang);
    }
  }

  // plane goes on top of everything drawn so far -- the tunnel's connecting
  // end and any passenger figure that overlaps it are covered by the
  // aircraft's silhouette, instead of drawing over any part of the plane
  drawPlane();
}

// a boarding-scene passenger — identical top-view body to the grid view, plus
// an upright mood face for passengers whose airport process was very slow/fast
const FALLBACK_LOOK = { shirt: "#8aa0c6", skin: "#e8d3b0", hair: "#5b4636" };
function drawBoardingFigure(g, x, y, look, r, angle) {
  g.save();
  g.translate(x, y);
  g.rotate(angle || 0);
  drawPersonBody(g, r, look || FALLBACK_LOOK);
  g.restore();
  if (look && look.mood) drawMoodFace(g, x, y - r * 1.9, r * 0.82, look.mood);
}

// small upright emoji-style face floating above a passenger:
// "angry" (red frown) if their process was slow, "happy" (green smile) if fast
function drawMoodFace(g, cx, cy, fr, mood) {
  const angry = mood === "angry";
  g.fillStyle = angry ? "#e53935" : "#2fb457";
  g.beginPath();
  g.arc(cx, cy, fr, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#ffffff";
  g.lineWidth = Math.max(1, fr * 0.15);
  g.stroke();
  const ex = fr * 0.38;
  const ey = -fr * 0.12;
  const er = fr * 0.14;
  g.fillStyle = "#1a1a1a";
  g.beginPath();
  g.arc(cx - ex, cy + ey, er, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(cx + ex, cy + ey, er, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#1a1a1a";
  g.lineWidth = Math.max(1, fr * 0.16);
  g.lineCap = "round";
  g.beginPath();
  if (angry) {
    g.arc(cx, cy + fr * 0.62, fr * 0.42, Math.PI * 1.2, Math.PI * 1.8); // frown
  } else {
    g.arc(cx, cy + fr * 0.12, fr * 0.44, Math.PI * 0.2, Math.PI * 0.8); // smile
  }
  g.stroke();
  if (angry) {
    // angry eyebrows slanting inward
    g.beginPath();
    g.moveTo(cx - ex - er, cy + ey - fr * 0.42);
    g.lineTo(cx - ex + er, cy + ey - fr * 0.14);
    g.moveTo(cx + ex + er, cy + ey - fr * 0.42);
    g.lineTo(cx + ex - er, cy + ey - fr * 0.14);
    g.stroke();
  }
  g.lineCap = "butt";
}

// Draw the airliner + seat map fitted into (W x H) on the given context.
// Horizontal layout: nose to the RIGHT, tail (red fin) to the LEFT. The cabin
// sits inside the white fuselage; front rows are toward the nose (right).
function drawPlaneOn(g, W, H) {
  const { abreast, aisles, rows, capacity } = plane;
  const aisleGap = 0.6; // extra vertical space per aisle, in seat-heights
  const seatUnitsY = abreast + aisles.length * aisleGap; // vertical seat units across the body

  // --- overall body box (the straight-walled cabin section) ---
  const bodyLen = W * 0.62; // straight fuselage length (cabin)
  const noseLen = W * 0.13; // rounded nose to the right
  const tailLen = W * 0.14; // tapered tail to the left
  const bodyH = Math.min(H * 0.34, (bodyLen / rows) * seatUnitsY * 0.62);

  const cyMid = H * 0.52; // nudge down a touch to leave room for the tall fin
  const bodyLeft = (W - bodyLen) / 2 + W * 0.03; // shift right slightly (fin needs left room)
  const bodyRight = bodyLeft + bodyLen;
  const bodyTop = cyMid - bodyH / 2;
  const bodyBot = cyMid + bodyH / 2;
  const noseTip = bodyRight + noseLen;
  const tailTip = bodyLeft - tailLen;

  // seat cell metrics (cabin inset inside the body)
  const insetX = bodyLen * 0.06;
  const insetY = bodyH * 0.14;
  const cabinLeft = bodyLeft + insetX;
  const cabinRight = bodyRight - insetX;
  const cabinTop = bodyTop + insetY;
  const cabinH = bodyH - insetY * 2;
  const cabinW = cabinRight - cabinLeft;
  const colStep = cabinW / rows; // per seat-row (front-back)
  const rowStep = cabinH / seatUnitsY; // per seat (across)
  const seatW = colStep * 0.72;
  const seatH = rowStep * 0.78;

  // ---- main wings: sweep back (toward the tail/left) from mid-body ----
  const wingSpan = H * 0.31;
  const wingRootX = bodyLeft + bodyLen * 0.55;
  const wingRootChord = bodyLen * 0.34; // long root chord
  const wingTipChord = bodyLen * 0.09; // slim tip
  const wingSweep = bodyLen * 0.22; // trailing edge sweeps back
  g.lineJoin = "round";
  for (const dir of [-1, 1]) {
    const rootY = dir < 0 ? bodyTop + 3 : bodyBot - 3;
    const tipY = rootY + dir * wingSpan;
    const leadRootX = wingRootX + wingRootChord * 0.5;
    const trailRootX = wingRootX - wingRootChord * 0.5;
    const leadTipX = leadRootX - wingSweep * 0.5;
    const trailTipX = trailRootX - wingSweep;
    g.fillStyle = "#eef2f7";
    g.strokeStyle = "#c4ccd8";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(leadRootX, rootY);
    g.lineTo(trailRootX, rootY);
    g.lineTo(trailTipX, tipY);
    g.lineTo(trailTipX + wingTipChord, tipY);
    g.closePath();
    g.fill();
    g.stroke();
    // engine nacelle mounted on the leading edge, partway out
    g.fillStyle = "#d3d9e2";
    g.strokeStyle = "#b7bfcb";
    const engT = 0.44;
    const engX = leadRootX + (leadTipX - leadRootX) * engT;
    const engY = rootY + dir * wingSpan * engT;
    roundRect(g, engX - colStep * 0.42, engY - rowStep * 0.75, colStep * 0.84, rowStep * 1.5, colStep * 0.34);
    g.fill();
    g.stroke();
    // red upturned winglet at the tip
    g.fillStyle = "#e2231a";
    g.beginPath();
    g.moveTo(trailTipX + wingTipChord, tipY);
    g.lineTo(trailTipX + wingTipChord - colStep * 0.35, tipY + dir * rowStep * 1.7);
    g.lineTo(trailTipX + wingTipChord * 0.4, tipY + dir * rowStep * 0.5);
    g.closePath();
    g.fill();
  }

  // ---- rear wing (horizontal stabilizer) near the tail — carries the logo ----
  const rwSpan = H * 0.2; // how far each side reaches out from the body
  const rwRootX = bodyLeft + tailLen * 0.12; // chord centre, sitting on the tail
  const rwChord = tailLen * 0.95; // long root chord
  const rwSweep = tailLen * 0.5; // edges sweep back toward the tail
  for (const dir of [-1, 1]) {
    const rootY = dir < 0 ? bodyTop + bodyH * 0.12 : bodyBot - bodyH * 0.12;
    const tipY = rootY + dir * rwSpan;
    const leadRootX = rwRootX + rwChord * 0.5;
    const trailRootX = rwRootX - rwChord * 0.5;
    const leadTipX = leadRootX - rwSweep * 0.45;
    const trailTipX = trailRootX - rwSweep;
    g.fillStyle = "#eef2f7";
    g.strokeStyle = "#c4ccd8";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(leadRootX, rootY);
    g.lineTo(trailRootX, rootY);
    g.lineTo(trailTipX, tipY);
    g.lineTo(leadTipX, tipY);
    g.closePath();
    g.fill();
    g.stroke();
    // red winglet at the tip to match the Turkish livery
    g.fillStyle = "#e2231a";
    g.beginPath();
    g.moveTo(leadTipX, tipY);
    g.lineTo(trailTipX, tipY);
    g.lineTo(trailTipX + (leadTipX - trailTipX) * 0.5, tipY + dir * rwSpan * 0.24);
    g.closePath();
    g.fill();
  }

  // ---- fuselage body: white capsule, rounded nose (right), tapered tail (left) ----
  g.beginPath();
  // start at nose tip, go along top to the tail, around the tail, back along bottom
  g.moveTo(noseTip, cyMid);
  g.quadraticCurveTo(bodyRight + noseLen * 0.35, bodyTop, bodyRight, bodyTop);
  g.lineTo(bodyLeft, bodyTop);
  g.quadraticCurveTo(tailTip + tailLen * 0.3, bodyTop, tailTip, cyMid - bodyH * 0.06); // tail top
  g.quadraticCurveTo(tailTip + tailLen * 0.3, bodyBot, bodyLeft, bodyBot); // tail bottom
  g.lineTo(bodyRight, bodyBot);
  g.quadraticCurveTo(bodyRight + noseLen * 0.35, bodyBot, noseTip, cyMid);
  g.closePath();
  // soft drop shadow so the white jet reads against the pale apron
  g.save();
  g.shadowColor = "rgba(24,44,82,0.30)";
  g.shadowBlur = 26;
  g.fillStyle = "#f8fafc";
  g.fill();
  g.restore();
  g.strokeStyle = "#c8d0dc";
  g.lineWidth = 1.5;
  g.stroke();

  // ---- red tail fin (vertical stabilizer) sweeping UP from the tail ----
  const finRootBackX = tailTip + tailLen * 0.15;
  const finRootFrontX = bodyLeft + bodyLen * 0.04;
  const finTipBackX = tailTip + tailLen * 0.05;
  const finTipFrontX = bodyLeft - tailLen * 0.05;
  const finTopY = bodyTop - H * 0.2;
  g.fillStyle = "#e2231a";
  g.beginPath();
  g.moveTo(finRootFrontX, bodyTop + 1); // root front (on the body)
  g.lineTo(finRootBackX, bodyTop + 1); // root back
  g.quadraticCurveTo(finTipBackX, finTopY + H * 0.05, finTipBackX + tailLen * 0.12, finTopY); // swept up the back
  g.lineTo(finTipFrontX + tailLen * 0.5, finTopY + H * 0.01); // fin tip top
  g.quadraticCurveTo(finRootFrontX + tailLen * 0.2, bodyTop - H * 0.08, finRootFrontX, bodyTop + 1); // leading edge back to root
  g.closePath();
  g.fill();

  // Logo anchor (in plane-local coords): centred on the rear wing where it meets
  // the fuselage. The actual PNG roundel is drawn upright in page space by
  // drawBoardingPage, so it isn't rotated with the plane.
  const rR = Math.max(16, H * 0.085);
  const rX = rwRootX;
  const rY = cyMid;
  plane._fin = { x: rX, y: rY, r: rR };

  // ---- cockpit windows near the nose ----
  g.fillStyle = "#2b3a55";
  g.beginPath();
  g.ellipse(bodyRight + noseLen * 0.5, cyMid, noseLen * 0.3, bodyH * 0.17, 0, 0, Math.PI * 2);
  g.fill();

  // ---- boarding doors on the lower fuselage edge (recorded for the gate scene) ----
  const doorXs = [bodyLeft + bodyLen * 0.34, bodyLeft + bodyLen * 0.66];
  plane._doors = doorXs.map((dx) => ({ x: dx, y: bodyBot }));
  g.fillStyle = "#2b3a55";
  for (const dx of doorXs) {
    roundRect(g, dx - colStep * 0.28, bodyBot - rowStep * 0.16, colStep * 0.56, rowStep * 0.32, 2);
    g.fill();
  }

  // ---- seats (cabin), front rows toward the nose (right) ----
  for (let s = 0; s < capacity; s++) {
    const row = Math.floor(s / abreast); // 0 = front
    const col = s % abreast; // across the body
    let off = col;
    for (const a of aisles) if (col >= a) off += aisleGap;
    const x = cabinLeft + (rows - 1 - row) * colStep + (colStep - seatW) / 2; // front = right
    const y = cabinTop + off * rowStep + (rowStep - seatH) / 2;
    const color = plane.seats[s];
    g.fillStyle = color || "#e2e7ee";
    roundRect(g, x, y, seatW, seatH, Math.min(3, seatW * 0.28));
    g.fill();
    if (!color) {
      g.strokeStyle = "#c4ccd8";
      g.lineWidth = 1;
      roundRect(g, x + 0.5, y + 0.5, seatW - 1, seatH - 1, Math.min(3, seatW * 0.28));
      g.stroke();
    }
  }
}

// small rounded-rect path helper
function roundRect(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}


// ---------- Airplane boarding (post-run) ----------
// After the simulation finishes, a dedicated full-screen boarding page fills the
// airplane seat map with the passengers who flew, then the results appear.
// The plane always has COMPLETE rows: rows = ceil(passengers / abreast); any
// surplus seats stay randomly empty, so no row is ever shown half-built.
let plane = null; // { total, capacity, abreast, aisles, rows, seats:[color|null], order:[seatIdx], boarded }

function planeAbreast(n) {
  return n <= 120 ? 6 : 10; // narrow-body 3-3, else wide-body 3-4-3
}

function setupPlane() {
  const n = state.numPassengers;
  const abreast = planeAbreast(n);
  const rows = Math.ceil(n / abreast);
  const capacity = rows * abreast; // full rows only
  // choose which seats stay empty (capacity - n of them), scattered at random
  const idx = Array.from({ length: capacity }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const order = idx.slice(0, n); // the n seats that WILL be filled, in boarding order
  plane = {
    total: n,
    capacity,
    abreast,
    aisles: abreast === 6 ? [3] : [3, 7],
    rows,
    seats: new Array(capacity).fill(null),
    order,
    boarded: 0,
  };
}

// --- Boarding clip: fills the plane on the boarding page, then calls onDone ---
const boardingModal = document.getElementById("boarding-modal");
const boardingCanvas = document.getElementById("boarding-canvas");
const bctx = boardingCanvas.getContext("2d");
const boardingCountVal = document.getElementById("boarding-count-val");
const boardingTotalVal = document.getElementById("boarding-total-val");
const waveOverlay = document.getElementById("wave-overlay");
const WAVE_DURATION_MS = 1600;

// a big farewell wave shown between the plane finishing boarding and the
// report appearing, so the two don't cut directly into one another
function showHandWave(onDone) {
  waveOverlay.classList.remove("hidden");
  setTimeout(() => {
    waveOverlay.classList.add("hidden");
    onDone && onDone();
  }, WAVE_DURATION_MS);
}

let boarding = null;
let boardingRafId = null;
let boardingLastTime = 0;
// base pace: 2 passengers every second, split across 2 gates
// => each gate boards one passenger every 1.0s at 1x
const BOARD_PER_GATE = 1.0;
const boardingSpeed = 8; // boarding always plays back at 8x, independent of sim speed

// classify a passenger's total airport process time (in simulated seconds):
// over the angry threshold -> angry (red), under the happy threshold -> happy
// (green), otherwise neutral. Both thresholds (in minutes) are set on the
// Advanced Settings > Process time panel and read live here, at boarding time.
function moodForProcess(seconds) {
  const happyMin = Number(moodHappyInput.value) || 3;
  const angryMin = Number(moodAngryInput.value) || 8;
  if (seconds > angryMin * 60) return "angry";
  if (seconds < happyMin * 60) return "happy";
  return null;
}

// compact copies of the same two thresholds, shown right on the boarding page
// so they can be tweaked without leaving it — kept in sync with the Advanced
// Settings inputs (the single source of truth) in both directions.
const boardingMoodHappySlider = document.getElementById("boarding-mood-happy-slider");
const boardingMoodHappyValue = document.getElementById("boarding-mood-happy-value");
const boardingMoodAngrySlider = document.getElementById("boarding-mood-angry-slider");
const boardingMoodAngryValue = document.getElementById("boarding-mood-angry-value");

function syncBoardingMoodSliders() {
  boardingMoodHappySlider.value = moodHappyInput.value;
  boardingMoodHappyValue.textContent = moodHappyInput.value;
  boardingMoodAngrySlider.value = moodAngryInput.value;
  boardingMoodAngryValue.textContent = moodAngryInput.value;
}

// re-classify everyone still queued or mid-walk (already-seated passengers
// don't show a mood face, so they don't need touching) and redraw immediately
function recomputeBoardingMoods() {
  if (!boarding) return;
  for (const gate of boarding.gates) {
    for (const look of gate.colors) look.mood = moodForProcess(look.processSeconds);
  }
  drawBoardingPage();
}

boardingMoodHappySlider.addEventListener("input", () => {
  boardingMoodHappyValue.textContent = boardingMoodHappySlider.value;
  moodHappyInput.value = boardingMoodHappySlider.value;
  moodHappyInput.dispatchEvent(new Event("change"));
  recomputeBoardingMoods();
});
boardingMoodAngrySlider.addEventListener("input", () => {
  boardingMoodAngryValue.textContent = boardingMoodAngrySlider.value;
  moodAngryInput.value = boardingMoodAngrySlider.value;
  moodAngryInput.dispatchEvent(new Event("change"));
  recomputeBoardingMoods();
});

function startBoardingClip(onDone) {
  setupPlane();
  boardingModal.classList.remove("hidden"); // open the boarding "page"
  boardingCountVal.textContent = "0";

  // Only passengers who finished the whole airport process board the plane.
  // Anyone who could not check in, or could not drop their non-cabin baggage,
  // gave up and is still wandering the hall — they miss the flight, so the
  // plane leaves with their seats empty.
  const boardable = sims[0].agents.filter((a) => a.done && !a.needsCheckin && !a.needsDrop);
  const total = Math.min(boardable.length, plane.order.length);
  boardingTotalVal.textContent = total;
  const gateLooks = [[], []];
  for (let i = 0; i < total; i++) {
    const donor = boardable[i];
    // reuse the flown passenger's exact appearance (shirt/skin/hair) and mood.
    // processSeconds is kept around so the boarding page's own mood sliders can
    // re-classify everyone still queued/walking if the thresholds change mid-clip.
    const processSeconds = donor.doneTime - donor.spawnTime;
    const look = { shirt: donor.shirt, skin: donor.skin, hair: donor.hair, processSeconds, mood: moodForProcess(processSeconds) };
    gateLooks[i % 2].push(look);
  }
  const gates = gateLooks.map((colors) => ({
    colors, // appearance {shirt,skin,hair} per passenger assigned to this gate, in order
    count: colors.length,
    seated: 0, // how many have reached a seat
    nextArrival: BOARD_PER_GATE, // clock time the current walker reaches the plane
    walker: colors.length ? colors[0] : null, // color of the person currently walking
  }));

  boarding = { gates, clock: 0, seatCursor: 0, onDone };
  syncBoardingMoodSliders(); // reflect whatever thresholds are currently set
  drawBoardingPage(); // size the canvas now that the overlay is visible
  boardingLastTime = performance.now();
  boardingStep(performance.now());
}

function boardingStep(now) {
  if (!boarding) return;
  // fixed per-gate pace; the speed multiplier scales the animation clock
  const dt = Math.min((now - boardingLastTime) / 1000, 0.05) * boardingSpeed;
  boardingLastTime = now;
  boarding.clock += dt;

  for (const gate of boarding.gates) {
    // seat everyone whose walk has completed by now
    while (gate.seated < gate.count && boarding.clock >= gate.nextArrival) {
      plane.seats[plane.order[boarding.seatCursor++]] = gate.walker.shirt; // seat = shirt color
      plane.boarded++;
      gate.seated++;
      gate.walker = gate.seated < gate.count ? gate.colors[gate.seated] : null;
      gate.nextArrival += BOARD_PER_GATE;
    }
    // 0..1 progress of the current walker from the gate up to the plane door
    gate.walkerProg = gate.walker ? 1 - (gate.nextArrival - boarding.clock) / BOARD_PER_GATE : 0;
  }

  boardingCountVal.textContent = plane.boarded;
  drawBoardingPage();

  if (boarding.gates.every((gt) => gt.seated >= gt.count)) {
    const done = boarding.onDone;
    boarding = null;
    if (boardingRafId !== null) cancelAnimationFrame(boardingRafId);
    boardingRafId = null;
    // hold on the full cabin, then close the page, wave the plane off, and reveal the results
    setTimeout(() => {
      boardingModal.classList.add("hidden");
      showHandWave(done);
    }, 900);
    return;
  }
  boardingRafId = requestAnimationFrame(boardingStep);
}

function cancelBoardingClip() {
  if (boardingRafId !== null) cancelAnimationFrame(boardingRafId);
  boardingRafId = null;
  boarding = null;
  boardingModal.classList.add("hidden");
  waveOverlay.classList.add("hidden"); // in case a reset lands mid-wave
}

