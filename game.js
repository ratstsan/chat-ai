// ==========================================================
// WARUNG MASAK - MVP
// Isi: pelanggan + gameplay masak + pergantian hari
// ==========================================================

// ---------- 1. DATA ----------
const INGREDIENTS = {
  nasi:   { emoji: "🍚", name: "Nasi" },
  telur:  { emoji: "🥚", name: "Telur" },
  kecap:  { emoji: "🥫", name: "Kecap" },
  mie:    { emoji: "🍜", name: "Mie" },
  sayur:  { emoji: "🥬", name: "Sayur" },
  ayam:   { emoji: "🍗", name: "Ayam" },
  tepung: { emoji: "🌾", name: "Tepung" },
  teh:    { emoji: "🍵", name: "Teh" },
  jeruk:  { emoji: "🍊", name: "Jeruk" },
  es:     { emoji: "🧊", name: "Es batu" },
};

// price dalam ribuan rupiah, cook = lama masak (detik)
const RECIPES = [
  { id: "nasgor", name: "Nasi Goreng", emoji: "🍛", type: "food",  price: 20, cook: 3,   ing: ["nasi", "telur", "kecap"] },
  { id: "migor",  name: "Mie Goreng",  emoji: "🍝", type: "food",  price: 18, cook: 3,   ing: ["mie", "telur", "sayur"] },
  { id: "ayam",   name: "Ayam Goreng", emoji: "🍖", type: "food",  price: 22, cook: 4,   ing: ["ayam", "tepung"] },
  { id: "esteh",  name: "Es Teh",      emoji: "🧋", type: "drink", price: 8,  cook: 1.5, ing: ["teh", "es"] },
  { id: "jus",    name: "Jus Jeruk",   emoji: "🥤", type: "drink", price: 10, cook: 1.5, ing: ["jeruk", "es"] },
];

const FACES = ["🧑", "👩", "👨", "👧", "👴", "👵", "🧔", "👱"];

const DAY_LENGTH = 90;   // detik per hari
const MAX_CUSTOMERS = 3; // maksimal pelanggan menunggu
const MAX_PLATE = 4;     // maksimal bahan di piring
const MAX_READY = 5;     // maksimal makanan di meja saji

// ---------- 2. STATE ----------
const state = {
  day: 1,
  money: 0,
  rating: 5,
  timeLeft: 0,
  running: false,
  customers: [],
  plate: [],
  ready: [],
  selected: null,   // index item di meja saji yang dipilih
  cooking: null,    // { recipe, progress }
  nextSpawn: 0,
  nextId: 1,
  dayStats: { served: 0, left: 0, earned: 0, tips: 0 },
};

let timer = null;
const $ = (id) => document.getElementById(id);
const recipeById = (id) => RECIPES.find((r) => r.id === id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- 3. ALUR HARI ----------
function startDay() {
  state.timeLeft = DAY_LENGTH;
  state.customers = [];
  state.plate = [];
  state.ready = [];
  state.selected = null;
  state.cooking = null;
  state.nextSpawn = 1;
  state.dayStats = { served: 0, left: 0, earned: 0, tips: 0 };
  state.running = true;

  $("overlay").classList.remove("show");
  say("Warung buka! Tunggu pelanggan pertama...");
  renderAll();

  clearInterval(timer);
  timer = setInterval(() => tick(0.1), 100);
}

function endDay() {
  state.running = false;
  clearInterval(timer);
  const s = state.dayStats;
  showCard(`
    <h2>Hari ${state.day} selesai!</h2>
    <p>Pelanggan terlayani: <b>${s.served}</b></p>
    <p>Pelanggan pergi: <b>${s.left}</b></p>
    <p>Pendapatan: <b>Rp ${s.earned}rb</b> (tip Rp ${s.tips}rb)</p>
    <p>Total uang: <b>Rp ${state.money}rb</b></p>
    <p>Rating: <b>⭐ ${state.rating.toFixed(1)}</b></p>
    <button class="btn primary" id="nextDayBtn">Mulai hari ${state.day + 1}</button>
  `);
  $("nextDayBtn").addEventListener("click", () => {
    state.day += 1;
    startDay();
  });
}

function tick(dt) {
  if (!state.running) return;

  state.timeLeft = Math.max(0, state.timeLeft - dt);

  // munculkan pelanggan baru selama hari masih berjalan
  if (state.timeLeft > 0) {
    state.nextSpawn -= dt;
    if (state.nextSpawn <= 0) {
      if (state.customers.length < MAX_CUSTOMERS) {
        spawnCustomer();
        // makin tinggi hari, makin cepat pelanggan datang
        state.nextSpawn = rand(Math.max(4, 10 - state.day * 0.7), Math.max(6, 14 - state.day * 0.7));
      } else {
        state.nextSpawn = 1; // penuh, coba lagi sebentar lagi
      }
    }
  }

  // kesabaran pelanggan berkurang
  let changed = false;
  for (const c of [...state.customers]) {
    c.patience -= dt;
    if (c.patience <= 0) {
      customerLeaves(c);
      changed = true;
    }
  }

  // progres masak
  if (state.cooking) {
    state.cooking.progress += dt;
    if (state.cooking.progress >= state.cooking.recipe.cook) finishCooking();
  }

  if (changed) renderCustomers();
  updateLive();

  // hari berakhir kalau waktu habis dan tidak ada pelanggan tersisa
  if (state.timeLeft <= 0 && state.customers.length === 0) endDay();
}

// ---------- 4. PELANGGAN ----------
function spawnCustomer() {
  const order = [pick(RECIPES.filter((r) => r.type === "food")).id];
  // 40% pelanggan juga pesan minum
  if (Math.random() < 0.4) order.push(pick(RECIPES.filter((r) => r.type === "drink")).id);

  // makin tinggi hari, makin tidak sabar (minimal 25 detik)
  const base = Math.max(25, 45 - (state.day - 1) * 3);
  const maxPatience = base + (order.length - 1) * 20;

  state.customers.push({
    id: state.nextId++,
    face: pick(FACES),
    order,
    served: order.map(() => false),
    patience: maxPatience,
    maxPatience,
  });
  renderCustomers();
}

function customerLeaves(c) {
  state.customers = state.customers.filter((x) => x.id !== c.id);
  state.rating = Math.max(1, state.rating - 0.3);
  state.dayStats.left += 1;
  say("😡 Ada pelanggan pergi karena kelamaan! Rating turun.");
  renderStats();
}

function serveTo(customerId) {
  const c = state.customers.find((x) => x.id === customerId);
  if (!c) return;
  if (state.selected === null) {
    say("Pilih dulu makanan di meja saji.");
    return;
  }
  const itemId = state.ready[state.selected];
  const slot = c.order.findIndex((id, i) => id === itemId && !c.served[i]);
  if (slot === -1) {
    say("Pelanggan ini tidak memesan itu.");
    return;
  }

  c.served[slot] = true;
  state.ready.splice(state.selected, 1);
  state.selected = null;

  if (c.served.every(Boolean)) payCustomer(c);
  renderCustomers();
  renderReady();
}

function payCustomer(c) {
  const price = c.order.reduce((sum, id) => sum + recipeById(id).price, 0);
  const ratio = c.patience / c.maxPatience;
  const tipRate = ratio > 0.66 ? 0.5 : ratio > 0.33 ? 0.2 : 0;
  const tip = Math.round(price * tipRate);

  state.money += price + tip;
  state.rating = Math.min(5, state.rating + (ratio > 0.33 ? 0.1 : 0.02));
  state.dayStats.served += 1;
  state.dayStats.earned += price + tip;
  state.dayStats.tips += tip;
  state.customers = state.customers.filter((x) => x.id !== c.id);

  say(tip > 0 ? `😋 Pelanggan puas! +Rp ${price}rb, tip Rp ${tip}rb` : `🙂 Pelanggan bayar Rp ${price}rb`);
  renderStats();
}

// ---------- 5. DAPUR ----------
function addIngredient(id) {
  if (!state.running || state.cooking) return;
  if (state.plate.length >= MAX_PLATE) {
    say("Piring penuh. Masak atau buang dulu.");
    return;
  }
  state.plate.push(id);
  renderPlate();
}

function clearPlate() {
  if (state.cooking) return;
  state.plate = [];
  renderPlate();
}

function startCooking() {
  if (!state.running || state.cooking) return;
  if (state.plate.length === 0) {
    say("Piring masih kosong.");
    return;
  }
  if (state.ready.length >= MAX_READY) {
    say("Meja saji penuh. Sajikan dulu ke pelanggan.");
    return;
  }

  // cocokkan bahan di piring dengan resep (urutan tidak penting)
  const key = [...state.plate].sort().join(",");
  const recipe = RECIPES.find((r) => [...r.ing].sort().join(",") === key);

  if (!recipe) {
    state.plate = [];
    renderPlate();
    say("💥 Gosong! Kombinasi bahan salah, cek buku resep.");
    return;
  }

  state.plate = [];
  state.cooking = { recipe, progress: 0 };
  renderPlate();
  say(`Memasak ${recipe.name}...`);
}

function finishCooking() {
  const recipe = state.cooking.recipe;
  state.cooking = null;
  state.ready.push(recipe.id);
  $("cookbar").style.width = "0%";
  say(`✅ ${recipe.name} siap!`);
  renderReady();
}

// ---------- 6. TAMPILAN ----------
function say(text) {
  $("msg").textContent = text;
}

function renderAll() {
  renderStats();
  renderCustomers();
  renderReady();
  renderPlate();
  updateLive();
}

function renderStats() {
  $("day").textContent = state.day;
  $("money").textContent = state.money;
  $("rating").textContent = state.rating.toFixed(1);
}

function renderCustomers() {
  const box = $("customers");
  if (state.customers.length === 0) {
    box.innerHTML = '<p class="empty">Belum ada pelanggan...</p>';
    return;
  }
  box.innerHTML = state.customers
    .map((c) => {
      const chips = c.order
        .map((id, i) => {
          const r = recipeById(id);
          return `<span class="chip ${c.served[i] ? "done" : ""}">${r.emoji} ${r.name}</span>`;
        })
        .join("");
      return `
        <div class="customer" data-id="${c.id}">
          <span class="face" id="face-${c.id}">${c.face}</span>
          <div class="order">${chips}</div>
          <div class="patience"><div id="pat-${c.id}"></div></div>
        </div>`;
    })
    .join("");
  updateLive();
}

function renderReady() {
  const box = $("ready");
  if (state.ready.length === 0) {
    box.innerHTML = '<span class="empty">Belum ada masakan jadi.</span>';
    return;
  }
  box.innerHTML = state.ready
    .map((id, i) => {
      const r = recipeById(id);
      return `<button class="item ${state.selected === i ? "selected" : ""}" data-i="${i}">${r.emoji}<small>${r.name}</small></button>`;
    })
    .join("");
}

function renderPlate() {
  const plate = $("plate");
  if (state.cooking) {
    plate.innerHTML = `<span>${state.cooking.recipe.emoji}</span><span class="placeholder">sedang dimasak...</span>`;
  } else if (state.plate.length === 0) {
    plate.innerHTML = '<span class="placeholder">Piring kosong</span>';
  } else {
    plate.innerHTML = state.plate.map((id) => INGREDIENTS[id].emoji).join("");
  }
}

// bagian yang berubah tiap tick: bar kesabaran, timer, bar masak
function updateLive() {
  $("time").textContent = Math.ceil(state.timeLeft);

  for (const c of state.customers) {
    const ratio = Math.max(0, c.patience / c.maxPatience);
    const bar = $("pat-" + c.id);
    const face = $("face-" + c.id);
    if (bar) {
      bar.style.width = ratio * 100 + "%";
      bar.className = ratio > 0.5 ? "" : ratio > 0.25 ? "mid" : "low";
    }
    if (face) face.textContent = ratio > 0.5 ? c.face : ratio > 0.25 ? "😐" : "😡";
  }

  if (state.cooking) {
    $("cookbar").style.width = (state.cooking.progress / state.cooking.recipe.cook) * 100 + "%";
  }
}

function renderShelf() {
  $("shelf").innerHTML = Object.entries(INGREDIENTS)
    .map(([id, ing]) => `<button class="item" data-ing="${id}">${ing.emoji}<small>${ing.name}</small></button>`)
    .join("");
}

function renderRecipeBook() {
  $("recipes").innerHTML = RECIPES.map(
    (r) => `<li>${r.emoji} <b>${r.name}</b> (Rp ${r.price}rb): ${r.ing.map((i) => INGREDIENTS[i].name).join(" + ")}</li>`
  ).join("");
}

function showCard(html) {
  $("card").innerHTML = html;
  $("overlay").classList.add("show");
}

// ---------- 7. EVENT ----------
$("shelf").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-ing]");
  if (btn) addIngredient(btn.dataset.ing);
});

$("ready").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-i]");
  if (!btn) return;
  const i = Number(btn.dataset.i);
  state.selected = state.selected === i ? null : i;
  renderReady();
});

$("customers").addEventListener("click", (e) => {
  const card = e.target.closest("[data-id]");
  if (card) serveTo(Number(card.dataset.id));
});

$("cookBtn").addEventListener("click", startCooking);
$("clearBtn").addEventListener("click", clearPlate);

// ---------- 8. MULAI ----------
renderShelf();
renderRecipeBook();
renderAll();
showCard(`
  <h1>🍳 Warung Masak</h1>
  <p>Terima pesanan, masak sesuai resep, dan sajikan sebelum pelanggan kehilangan kesabaran.</p>
  <button class="btn primary" id="startBtn">Buka warung</button>
`);
$("startBtn").addEventListener("click", startDay);