'use strict';

/* =========================================================
   Repaso ADL Villena — tarjetas tipo test con comodines
   Datos: data/temas.json (índice) y data/NN.json (preguntas).
   En cada pregunta, o[0] es la respuesta correcta; el orden
   se baraja al mostrarla.
   ========================================================= */

const STORE_KEY = 'repasoOpos.v1';

// Retorno de una pregunta fallada o acertada "por suerte": entre 5 y 10 preguntas después
const REQUEUE_MIN = 5;
const REQUEUE_MAX = 10;

// Puntos por acierto: 10 con la primera, +5 por cada acierto seguido, máx. 60
const BASE_POINTS = 10;
const STREAK_STEP = 5;
const MAX_POINTS = 60;

const LIFELINES = {
  fifty:    { name: '50%',     ico: '½' },
  audience: { name: 'Público', ico: '👥' },
  phone:    { name: 'Llamada', ico: '📞' },
};

const SHOP = [
  { id: 'fifty',    ico: '½',  name: 'Comodín 50%',       desc: 'Elimina dos respuestas incorrectas.',                       price: 300,  give: { fifty: 1 } },
  { id: 'audience', ico: '👥', name: 'Comodín del público', desc: 'El público vota. Suele acertar… pero no siempre.',        price: 400,  give: { audience: 1 } },
  { id: 'phone',    ico: '📞', name: 'Comodín de llamada', desc: 'Llamas a una compañera opositora. Acierta casi siempre.', price: 500,  give: { phone: 1 } },
  { id: 'double',   ico: '✖2', name: 'Puntos dobles',     desc: 'Tus 5 próximos aciertos valen el doble.',                  price: 450,  give: { double: 5 } },
  { id: 'shield',   ico: '🛡️', name: 'Escudo de racha',   desc: 'Si fallas, no pierdes la racha (se gasta en el fallo).',   price: 600,  give: { shield: 1 } },
  { id: 'pack50',   ico: '🎁', name: 'Pack 3 × 50%',       desc: 'Tres comodines 50% con descuento.',                        price: 800,  give: { fifty: 3 } },
  { id: 'trio',     ico: '💼', name: 'Pack trío',          desc: 'Un 50%, un Público y una Llamada.',                        price: 1050, give: { fifty: 1, audience: 1, phone: 1 } },
  { id: 'megapack', ico: '👑', name: 'Megapack',           desc: '2 de cada comodín + 1 escudo.',                            price: 2300, give: { fifty: 2, audience: 2, phone: 2, shield: 1 } },
];

/* ---------------- estado persistente ---------------- */

function defaultState() {
  return {
    points: 0, streak: 0, bestStreak: 0, totalCorrect: 0, totalAnswered: 0,
    inv: { fifty: 1, audience: 1, phone: 1, shield: 0, double: 0 }, // regalo de bienvenida
    topics: {},
  };
}

let S = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* almacenamiento no disponible */ }
  return defaultState();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignorar */ }
  renderWallet();
}
function topicState(id) {
  if (!S.topics[id]) S.topics[id] = { mastered: [], queue: [], answered: 0, correct: 0 };
  return S.topics[id];
}

/* ---------------- utilidades ---------------- */

const $ = (sel) => document.querySelector(sel);
const view = $('#view');
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const LETTERS = ['A', 'B', 'C', 'D'];

function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms);
}
function modal(html) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; }
$('#modalClose').onclick = () => { $('#modal').hidden = true; };
$('#modal').onclick = (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; };

function renderWallet(bump) {
  $('#points').textContent = S.points;
  $('#streak').textContent = S.streak;
  if (bump) { const p = $('#btnShop'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
}

/* ---------------- datos ---------------- */

let TEMAS = [];
const cache = {};

async function loadIndex() {
  const r = await fetch('data/temas.json', { cache: 'no-cache' });
  TEMAS = await r.json();
}
async function loadTopic(id) {
  if (!cache[id]) {
    const r = await fetch(`data/${id}.json`, { cache: 'no-cache' });
    cache[id] = await r.json();
  }
  return cache[id];
}

/* ---------------- navegación ---------------- */

window.addEventListener('hashchange', route);
$('#btnBack').onclick = () => { location.hash = ''; };
$('#btnShop').onclick = () => { location.hash = '#tienda'; };

function setHeader(title, back) {
  $('#title').textContent = title;
  $('#btnBack').hidden = !back;
}

async function route() {
  $('#modal').hidden = true;
  const h = location.hash.slice(1);
  if (h === 'tienda') return renderShop();
  if (h.startsWith('tema/')) return renderPlay(h.slice(5));
  renderHome();
}

/* ---------------- inicio ---------------- */

function renderHome() {
  setHeader('Repaso ADL Villena', false);
  const mastered = Object.values(S.topics).reduce((n, t) => n + t.mastered.length, 0);
  const pct = S.totalAnswered ? Math.round((S.totalCorrect / S.totalAnswered) * 100) : 0;
  view.innerHTML = `
    <section class="hero">
      <p>Oposición Agente de Desarrollo Local · Ayuntamiento de Villena</p>
    </section>
    <section class="stats">
      <div class="stat"><b>${mastered}</b><span>preguntas dominadas</span></div>
      <div class="stat"><b>${pct}%</b><span>aciertos</span></div>
      <div class="stat"><b>${S.bestStreak}</b><span>mejor racha</span></div>
    </section>
    <input class="search" id="search" type="search" placeholder="Buscar tema…" autocomplete="off">
    <section class="topics" id="topics"></section>`;
  const list = $('#topics');
  const draw = (filter) => {
    const f = (filter || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    list.innerHTML = TEMAS.filter((t) => !f || (`${t.n} ${t.title}`).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(f))
      .map((t) => {
        const id = pad(t.n);
        const ts = S.topics[id];
        const m = ts ? ts.mastered.length : 0;
        const avail = t.count > 0;
        const meta = avail ? `${m}/${t.count} dominadas` : 'Preguntas en preparación';
        return `<button class="topic" data-id="${id}" ${avail ? '' : 'disabled'}>
          <span class="num">${t.n}</span>
          <span class="info"><div class="name">${esc(t.title)}</div>
          <div class="meta">${meta}</div>
          ${avail ? `<div class="bar"><i style="width:${Math.round((m / t.count) * 100)}%"></i></div>` : ''}</span>
        </button>`;
      }).join('');
  };
  draw('');
  $('#search').oninput = (e) => draw(e.target.value);
  list.onclick = (e) => { const b = e.target.closest('.topic'); if (b && !b.disabled) location.hash = `#tema/${b.dataset.id}`; };
}

/* ---------------- juego ---------------- */

let G = null; // partida en curso

async function renderPlay(id) {
  const meta = TEMAS.find((t) => pad(t.n) === id);
  if (!meta) { location.hash = ''; return; }
  setHeader(`Tema ${meta.n}`, true);
  view.innerHTML = '<p style="text-align:center">Cargando…</p>';
  let qs;
  try { qs = await loadTopic(id); } catch (e) { view.innerHTML = '<p>No se pudieron cargar las preguntas. Comprueba la conexión.</p>'; return; }
  const ts = topicState(id);
  // limpiar la cola de índices que ya no existan o estén dominados
  ts.queue = ts.queue.filter((i) => i < qs.length && !ts.mastered.includes(i));
  if (!ts.queue.length) ts.queue = shuffle(qs.map((_, i) => i).filter((i) => !ts.mastered.includes(i)));
  save();
  G = { id, meta, qs, ts };
  nextCard();
}

function nextCard() {
  const { ts, qs } = G;
  if (!ts.queue.length) return renderDone();
  const qi = ts.queue[0];
  G.cur = { qi, order: shuffle([0, 1, 2, 3]), removed: [], used: {}, answered: false, peeked: false };
  drawCard();
}

function drawCard() {
  const { qs, ts, cur, meta } = G;
  const q = qs[cur.qi];
  view.innerHTML = `
    <div class="progress"><span>${esc(meta.title)}</span></div>
    <div class="progress"><span>✔ Dominadas ${ts.mastered.length}/${qs.length}</span><span>Pendientes ${ts.queue.length}</span></div>
    <div class="flip" id="flip">
      <div class="flip-inner">
        <div class="face front" id="front">
          <span class="tag">Pregunta · toca la tarjeta para girarla</span>
          <div class="q">${esc(q.q)}</div>
          <div class="options" id="options">
            ${cur.order.map((oi, pos) => `<button class="opt" data-oi="${oi}"><span class="l">${LETTERS[pos]}</span><span>${esc(q.o[oi])}</span></button>`).join('')}
          </div>
          <div class="hint">Si giras la tarjeta antes de responder, contará como fallo.</div>
        </div>
        <div class="face back" id="back">
          <span class="tag">Respuesta correcta</span>
          <div class="ans">${esc(q.o[0])}</div>
          <div class="exp">${esc(q.e || '')}</div>
          <div class="hint">Toca para volver a la pregunta</div>
        </div>
      </div>
    </div>
    <div class="lifelines" id="lifelines"></div>
    <div id="fb"></div>
    <div style="text-align:center"><button class="link" id="goShop">Ir a la tienda de comodines</button></div>`;
  drawLifelines();
  $('#options').onclick = (e) => { const b = e.target.closest('.opt'); if (b) { e.stopPropagation(); answer(+b.dataset.oi); } };
  $('#front').onclick = (e) => { if (!e.target.closest('.opt')) flip(); };
  $('#back').onclick = () => flip();
  $('#goShop').onclick = () => { location.hash = '#tienda'; };
}

function drawLifelines() {
  const { cur } = G;
  $('#lifelines').innerHTML = Object.entries(LIFELINES).map(([k, l]) => {
    const n = S.inv[k] || 0;
    const off = cur.answered || cur.peeked || cur.used[k] || n === 0;
    return `<button class="life" data-k="${k}" ${off ? 'disabled' : ''}><span class="ico">${l.ico}</span>${l.name}<span class="cnt">${n}</span></button>`;
  }).join('');
  $('#lifelines').onclick = (e) => {
    const b = e.target.closest('.life');
    if (!b) return;
    if (b.disabled) { if (!S.inv[b.dataset.k]) toast('No te quedan. Consíguelos en la tienda.'); return; }
    useLifeline(b.dataset.k);
  };
}

function flip() {
  const { cur } = G;
  const f = $('#flip');
  const turningToBack = !f.classList.contains('flipped');
  if (turningToBack && !cur.answered && !cur.peeked) {
    cur.peeked = true;
    registerMiss('Has consultado la respuesta: la volverás a ver más adelante.');
  }
  f.classList.toggle('flipped');
}

function revealOptions(chosen) {
  document.querySelectorAll('.opt').forEach((b) => {
    const oi = +b.dataset.oi;
    b.disabled = true;
    if (oi === 0) b.classList.add('ok');
    else if (oi === chosen) b.classList.add('bad');
  });
}

function requeueCurrent() {
  const { ts, cur } = G;
  ts.queue = ts.queue.filter((i) => i !== cur.qi);
  const pos = Math.min(rand(REQUEUE_MIN, REQUEUE_MAX), ts.queue.length);
  ts.queue.splice(pos, 0, cur.qi);
  return pos;
}

function loseStreak() {
  if (S.streak > 0 && S.inv.shield > 0) {
    S.inv.shield--;
    toast('🛡️ El escudo ha salvado tu racha');
    return;
  }
  S.streak = 0;
}

function registerMiss(msg) {
  const { ts, cur } = G;
  cur.answered = true;
  ts.answered++; S.totalAnswered++;
  loseStreak();
  const pos = requeueCurrent();
  save();
  revealOptions(-1);
  drawLifelines();
  $('#fb').innerHTML = `<div class="feedback"><h3>👀 Respuesta consultada</h3>
    <p>${esc(msg)} (dentro de ${pos} pregunta${pos === 1 ? '' : 's'})</p>
    <button class="btn" id="next">Siguiente pregunta</button></div>`;
  $('#next').onclick = nextCard;
}

function answer(oi) {
  const { ts, cur } = G;
  if (cur.answered) return;
  cur.answered = true;
  ts.answered++; S.totalAnswered++;
  revealOptions(oi);
  drawLifelines();

  if (oi !== 0) {
    loseStreak();
    const pos = requeueCurrent();
    save();
    if (navigator.vibrate) navigator.vibrate(120);
    $('#fb').innerHTML = `<div class="feedback"><h3>❌ Incorrecta</h3>
      <p>Te la volveré a preguntar dentro de ${pos} pregunta${pos === 1 ? '' : 's'}. Toca la tarjeta para ver la explicación.</p>
      <button class="btn" id="next">Siguiente pregunta</button></div>`;
    $('#next').onclick = nextCard;
    return;
  }

  // acierto
  S.streak++; ts.correct++; S.totalCorrect++;
  S.bestStreak = Math.max(S.bestStreak, S.streak);
  let pts = Math.min(BASE_POINTS + STREAK_STEP * (S.streak - 1), MAX_POINTS);
  let extra = '';
  if (S.inv.double > 0) { pts *= 2; S.inv.double--; extra = ' (×2)'; }
  S.points += pts;
  save(); renderWallet(true);
  $('#fb').innerHTML = `<div class="feedback"><h3>✅ ¡Correcta! +${pts} puntos${extra}</h3>
    <p>Racha: ${S.streak} 🔥 · ¿Te la sabías o fue suerte?</p>
    <div class="row"><button class="btn ok" id="knew">Me la sabía</button><button class="btn alt" id="luck">Fue suerte</button></div></div>`;
  $('#knew').onclick = () => {
    ts.queue = ts.queue.filter((i) => i !== cur.qi);
    if (!ts.mastered.includes(cur.qi)) ts.mastered.push(cur.qi);
    save(); nextCard();
  };
  $('#luck').onclick = () => {
    const pos = requeueCurrent(); save();
    toast(`Volverá dentro de ${pos} pregunta${pos === 1 ? '' : 's'}`);
    nextCard();
  };
}

/* ---------------- comodines ---------------- */

function useLifeline(k) {
  const { cur } = G;
  if (cur.answered || cur.used[k] || !S.inv[k]) return;
  S.inv[k]--; cur.used[k] = true; save();
  const alive = [0, 1, 2, 3].filter((oi) => !cur.removed.includes(oi));
  const letterOf = (oi) => LETTERS[cur.order.indexOf(oi)];

  if (k === 'fifty') {
    const wrong = shuffle(alive.filter((oi) => oi !== 0));
    cur.removed.push(...wrong.slice(0, Math.max(0, alive.length - 2)));
    document.querySelectorAll('.opt').forEach((b) => { if (cur.removed.includes(+b.dataset.oi)) b.classList.add('gone'); });
  }

  if (k === 'audience') {
    // el público acierta (opción más votada) el 85 % de las veces
    const right = Math.random() < 0.85;
    const fav = right ? 0 : shuffle(alive.filter((oi) => oi !== 0))[0];
    const w = {};
    alive.forEach((oi) => { w[oi] = oi === fav ? rand(45, 70) : rand(5, 25); });
    const total = alive.reduce((s, oi) => s + w[oi], 0);
    const pct = {};
    alive.forEach((oi) => { pct[oi] = Math.round((w[oi] / total) * 100); });
    modal(`<h3>👥 El público ha votado</h3><div class="aud">
      ${cur.order.map((oi, pos) => `<div><b>${pct[oi] != null ? pct[oi] + '%' : '–'}</b><i style="height:${(pct[oi] || 0) * 1.3}px"></i>${LETTERS[pos]}</div>`).join('')}
      </div>`);
  }

  if (k === 'phone') {
    // la compañera acierta el 80 % de las veces
    const right = Math.random() < 0.8;
    const pick = right ? 0 : shuffle(alive.filter((oi) => oi !== 0))[0];
    const sure = right ? rand(0, 2) : rand(1, 2);
    const lines = [
      `¡Esta me la sé! Es la <b>${letterOf(pick)}</b>, segurísimo.`,
      `Creo que es la <b>${letterOf(pick)}</b>… lo repasé la semana pasada.`,
      `Uf, no estoy segura… yo diría la <b>${letterOf(pick)}</b>, pero no pongas la mano en el fuego.`,
    ];
    modal(`<h3>📞 Llamada a una compañera</h3><div class="call">«${lines[sure]}»</div>`);
  }
  drawLifelines();
}

function renderDone() {
  const { meta, id } = G;
  view.innerHTML = `<div class="done"><div class="big">🏆</div>
    <h2>¡Tema ${meta.n} dominado!</h2>
    <p>Has marcado como sabidas todas las preguntas de este tema.</p>
    <div class="row" style="margin-top:20px"><button class="btn alt" id="home">Volver a los temas</button>
    <button class="btn" id="reset">Repasar de nuevo</button></div></div>`;
  $('#home').onclick = () => { location.hash = ''; };
  $('#reset').onclick = () => {
    if (!confirm('¿Reiniciar el progreso de este tema? Tus puntos y comodines se conservan.')) return;
    delete S.topics[id]; save(); renderPlay(id);
  };
}

/* ---------------- tienda ---------------- */

function renderShop() {
  setHeader('Tienda de comodines', true);
  const inv = [['fifty', '½ 50%'], ['audience', '👥 Público'], ['phone', '📞 Llamada'], ['shield', '🛡️ Escudo'], ['double', '✖2 Dobles']]
    .map(([k, l]) => `<span class="pill">${l}: <b>${S.inv[k] || 0}</b></span>`).join('');
  view.innerHTML = `
    <section class="shop-head">
      <h2 style="margin:0">★ ${S.points} puntos</h2>
      <p>Gana puntos acertando. Cuantas más seguidas aciertes, más vale cada pregunta.</p>
      <div class="inv">${inv}</div>
    </section>
    <section class="items">
      ${SHOP.map((it) => `<div class="item"><span class="ico">${it.ico}</span>
        <span class="info"><b>${esc(it.name)}</b><span>${esc(it.desc)}</span></span>
        <button class="btn small" data-id="${it.id}" ${S.points < it.price ? 'disabled style="opacity:.45"' : ''}>★ ${it.price}</button></div>`).join('')}
    </section>
    <section class="rules">
      <b>¿Cómo se ganan puntos?</b><br>
      1.º acierto seguido: 10 · 2.º: 15 · 3.º: 20 … hasta 60 puntos por pregunta a partir del 11.º acierto seguido.
      Fallar (o girar la tarjeta antes de responder) reinicia la racha.<br><br>
      <b>Repaso inteligente:</b> las preguntas falladas o acertadas «por suerte» vuelven entre 5 y 10 preguntas después.
      Las que «te sabías» quedan dominadas y no se repiten.
      <div style="margin-top:14px"><button class="link" id="wipe">Borrar todo mi progreso</button></div>
    </section>`;
  view.querySelector('.items').onclick = (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    const it = SHOP.find((x) => x.id === b.dataset.id);
    if (S.points < it.price) { toast(`Te faltan ${it.price - S.points} puntos`); return; }
    S.points -= it.price;
    Object.entries(it.give).forEach(([k, n]) => { S.inv[k] = (S.inv[k] || 0) + n; });
    save(); toast(`¡Comprado: ${it.name}!`); renderShop();
  };
  $('#wipe').onclick = () => {
    if (!confirm('Se borrarán puntos, comodines y progreso de todos los temas. ¿Seguro?')) return;
    S = defaultState(); save(); toast('Progreso borrado'); renderShop();
  };
}

/* ---------------- arranque ---------------- */

(async function init() {
  renderWallet();
  try { await loadIndex(); } catch (e) { view.innerHTML = '<p>No se pudo cargar el índice de temas.</p>'; return; }
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
