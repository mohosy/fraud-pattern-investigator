const accountInput = document.getElementById("accountInput");
const txInput = document.getElementById("txInput");
const riskInput = document.getElementById("riskInput");
const accountValue = document.getElementById("accountValue");
const txValue = document.getElementById("txValue");
const riskValue = document.getElementById("riskValue");

const generateBtn = document.getElementById("generateBtn");
const analyzeBtn = document.getElementById("analyzeBtn");

const flaggedText = document.getElementById("flaggedText");
const ringsText = document.getElementById("ringsText");
const volumeText = document.getElementById("volumeText");
const listEl = document.getElementById("list");

const canvas = document.getElementById("graph");
const ctx = canvas.getContext("2d");

let accounts = [];
let transactions = [];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function generateData() {
  const n = Number(accountInput.value);
  const txCount = Number(txInput.value);

  accounts = Array.from({ length: n }, (_, i) => ({
    id: `A${String(i + 1).padStart(3, "0")}`,
    x: rand(40, canvas.width - 40),
    y: rand(40, canvas.height - 40),
    incoming: 0,
    outgoing: 0,
    volume: 0,
    lateNightTx: 0,
    roundTripTx: 0,
  }));

  transactions = [];

  // Seed a few suspicious clusters.
  const rings = [];
  for (let i = 0; i < 3; i += 1) {
    const size = 4 + Math.floor(Math.random() * 4);
    const start = Math.floor(rand(0, n - size));
    rings.push(accounts.slice(start, start + size).map((a) => a.id));
  }

  for (let i = 0; i < txCount; i += 1) {
    const from = accounts[Math.floor(Math.random() * n)];
    let to = accounts[Math.floor(Math.random() * n)];
    if (to.id === from.id) to = accounts[(accounts.indexOf(from) + 1) % n];

    let fromId = from.id;
    let toId = to.id;

    let amount = rand(40, 2500);
    let hour = Math.floor(rand(0, 24));

    if (Math.random() < 0.17) {
      const ring = rings[Math.floor(Math.random() * rings.length)];
      const ringFrom = ring[Math.floor(Math.random() * ring.length)];
      const ringTo = ring[Math.floor(Math.random() * ring.length)];
      if (ringFrom !== ringTo) {
        fromId = ringFrom;
        toId = ringTo;
      }
      amount = rand(3200, 14000);
      hour = Math.floor(rand(0, 5));
    }

    transactions.push({ from: fromId, to: toId, amount, hour });
  }

  computeSignals();
  drawGraph([]);
  renderList([]);
  flaggedText.textContent = "0";
  ringsText.textContent = "0";
  volumeText.textContent = "$0";
}

function accountById(id) {
  return accounts.find((a) => a.id === id);
}

function computeSignals() {
  accounts.forEach((a) => {
    a.incoming = 0;
    a.outgoing = 0;
    a.volume = 0;
    a.lateNightTx = 0;
    a.roundTripTx = 0;
  });

  const edgeSet = new Set(transactions.map((t) => `${t.from}->${t.to}`));

  transactions.forEach((tx) => {
    const from = accountById(tx.from);
    const to = accountById(tx.to);

    from.outgoing += 1;
    to.incoming += 1;
    from.volume += tx.amount;
    to.volume += tx.amount;

    if (tx.hour <= 4) {
      from.lateNightTx += 1;
      to.lateNightTx += 1;
    }

    if (edgeSet.has(`${tx.to}->${tx.from}`)) {
      from.roundTripTx += 1;
      to.roundTripTx += 1;
    }
  });
}

function analyze() {
  const sensitivity = Number(riskInput.value);

  const scored = accounts.map((a) => {
    const imbalance = Math.abs(a.incoming - a.outgoing);
    const volumeScore = Math.min(60, a.volume / 1600);
    const behaviorScore = a.lateNightTx * 1.8 + a.roundTripTx * 0.7;
    const centrality = Math.min(30, (a.incoming + a.outgoing) * 0.35);

    const score = (volumeScore + behaviorScore + imbalance * 0.35 + centrality) * sensitivity;
    return { ...a, score };
  });

  const flagged = scored.filter((s) => s.score >= 38).sort((a, b) => b.score - a.score);
  const suspiciousVolume = flagged.reduce((sum, a) => sum + a.volume, 0);

  // crude ring signal: flagged accounts with both high incoming/outgoing and round trips.
  const ringCandidates = flagged.filter((a) => a.roundTripTx > 6 && a.incoming > 5 && a.outgoing > 5);
  const ringCount = Math.max(0, Math.floor(ringCandidates.length / 3));

  flaggedText.textContent = String(flagged.length);
  ringsText.textContent = String(ringCount);
  volumeText.textContent = `$${Math.round(suspiciousVolume).toLocaleString()}`;

  drawGraph(flagged.map((f) => f.id));
  renderList(flagged.slice(0, 18));
}

function drawGraph(flaggedIds) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const flaggedSet = new Set(flaggedIds);

  ctx.strokeStyle = "rgba(255,190,140,0.18)";
  transactions.slice(0, 900).forEach((t) => {
    const a = accountById(t.from);
    const b = accountById(t.to);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  accounts.forEach((a) => {
    const flagged = flaggedSet.has(a.id);
    ctx.beginPath();
    ctx.arc(a.x, a.y, flagged ? 7.5 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = flagged ? "#ff7c7c" : "#ffb27d";
    ctx.fill();

    if (flagged) {
      ctx.strokeStyle = "#ffe2d2";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

function renderList(items) {
  listEl.innerHTML = "";
  if (!items.length) {
    const p = document.createElement("p");
    p.textContent = "Run analysis to populate suspicious entities.";
    p.style.color = "#f4cbbb";
    listEl.appendChild(p);
    return;
  }

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "item";
    div.style.borderLeftColor = item.score > 70 ? "#ff6f8f" : "#ffb27d";
    div.innerHTML = `<strong>${item.id}</strong> | score ${item.score.toFixed(1)}<br/>volume $${Math.round(item.volume).toLocaleString()} | in ${item.incoming} / out ${item.outgoing}`;
    listEl.appendChild(div);
  });
}

function syncLabels() {
  accountValue.textContent = accountInput.value;
  txValue.textContent = txInput.value;
  riskValue.textContent = Number(riskInput.value).toFixed(1);
}

[accountInput, txInput, riskInput].forEach((el) => {
  el.addEventListener("input", syncLabels);
});

generateBtn.addEventListener("click", generateData);
analyzeBtn.addEventListener("click", analyze);

syncLabels();
generateData();
