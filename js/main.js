import { state, key } from './state.js';
import { generateDungeonLayout } from './dungeon.js';
import {
  MAX_HEARTS, ROOM_COUNT, BOSS_HP, GRID_SIZES, CHAMBER_TARGETS,
  DIFFICULTY_COIN_REWARD, DIRECTION_ARROWS, BATTLE_CHOICE_COUNT,
  MINIONS_PER_ROOM, MINION_MIN_START_DISTANCE, DARK_MISS_COST, DARK_GOLD_MULTIPLIER
} from './config.js';
import {
  defaultSample, shuffle, parseListInput, pickQuestion, escapeHtml,
  buildChoices, normalizeSpaces, buildHint, poolFor, glyphForCategory,
  resolveImageSrc, buildCategoryChoices, categoryLabel
} from './quiz.js';
import {
  initRender, showScreen, buildGridTiles, renderWalls, computeVisibility,
  renderFog, positionActor, renderHearts, renderCombatStatus, renderTargeting,
  formatTime, startTimer, updateCamera, renderLightEye
} from './render.js';
import {
  initCombat, isAdjacentToPlayer, refreshTargetValidity, advanceMonsters,
  spawnMinion
} from './combat.js';
import { initBossLight, extinguishLight, lightConsumed } from './light.js';
import {
  fetchManifest, fetchBundledSet, listSavedSets, saveSet, loadSavedSet, deleteSet
} from './sets.js';
import { t, setTextArea, applyStaticText } from './text.js';
import { initDataView } from './dataview.js';

const startScreen = document.getElementById('startScreen');
const introGlitch = document.getElementById('introGlitch');
const glitchCode = document.getElementById('glitchCode');
const revealToggle = document.getElementById('revealToggle');
const toggleLoaderBtn = document.getElementById('toggleLoader');
const loaderPanel = document.getElementById('loaderPanel');
const fileInput = document.getElementById('fileInput');
const dataInput = document.getElementById('dataInput');
const loadListBtn = document.getElementById('loadListBtn');
const resetListBtn = document.getElementById('resetListBtn');
const loaderStatus = document.getElementById('loaderStatus');
const builtinSetSelect = document.getElementById('builtinSetSelect');
const loadBuiltinBtn = document.getElementById('loadBuiltinBtn');
const saveSetName = document.getElementById('saveSetName');
const saveSetBtn = document.getElementById('saveSetBtn');
const savedSetsList = document.getElementById('savedSetsList');
let builtinSets = [];
const roomScreen = document.getElementById('roomScreen');
const battleScreen = document.getElementById('battleScreen');
const battleGlyphEl = document.getElementById('battleGlyph');
const winScreen = document.getElementById('winScreen');
const loseScreen = document.getElementById('loseScreen');

const roomNumEl = document.getElementById('roomNum');
const roomTotalEl = document.getElementById('roomTotal');
const devToggleBtn = document.getElementById('devToggleBtn');
const devPanel = document.getElementById('devPanel');
const devSkipBtn = document.getElementById('devSkipBtn');
const devFogBtn = document.getElementById('devFogBtn');
const combatStatusEl = document.getElementById('combatStatus');
const timerEl = document.getElementById('timer');
const heartsEl = document.getElementById('hearts');
const statsEl = document.getElementById('statsBar');
const turnCountEl = document.getElementById('turnCount');
const coinsTotalEl = document.getElementById('coinsTotal');

const grid = document.getElementById('grid');
const playerActor = document.getElementById('playerActor');
const bossActor = document.getElementById('bossActor');
const coinActor = document.getElementById('coinActor');
const chestActor = document.getElementById('chestActor');
const runeActor = document.getElementById('runeActor');
const stairsActor = document.getElementById('stairsActor');

const choicePanel = document.getElementById('choicePanel');
const choiceListEl = document.getElementById('choiceList');
const queryPanel = document.getElementById('queryPanel');
const enemyName = document.getElementById('enemyName');
const queryImage = document.getElementById('queryImage');
const targetLabelEl = document.getElementById('targetLabel');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const attackBtn = document.getElementById('attackBtn');
const mcOptionsEl = document.getElementById('mcOptions');
const encounterLogEl = document.getElementById('encounterLog');
const endPanel = document.getElementById('endPanel');
const continueBtn = document.getElementById('continueBtn');
const roomFeedback = document.getElementById('roomFeedback');

const winStats = document.getElementById('winStats');
const loseStats = document.getElementById('loseStats');
const loseTitle = document.getElementById('loseTitle');
const lightEyeEl = document.getElementById('lightEye');
const lightHintEls = {
  n: document.getElementById('lightHintN'),
  s: document.getElementById('lightHintS'),
  e: document.getElementById('lightHintE'),
  w: document.getElementById('lightHintW'),
};

const dpadButtons = {
  N: document.getElementById('btnN'),
  S: document.getElementById('btnS'),
  E: document.getElementById('btnE'),
  W: document.getElementById('btnW'),
  Skip: document.getElementById('btnSkip')
};

initRender({
  startScreen, introGlitch, roomScreen, battleScreen, winScreen, loseScreen,
  grid, playerActor, bossActor, coinActor, chestActor, runeActor, stairsActor,
  heartsEl, timerEl, combatStatusEl, targetLabelEl, attackBtn, statsEl,
  lightEyeEl, lightHintEls
});

initCombat({ grid, playerActor, turnCountEl });
initDataView({ startScreen });

applyStaticText();

// ---- Remember the reveal/multiple-choice option toggles across sessions ----
// localStorage access is wrapped in try/catch — private browsing or disabled
// storage should degrade to "just use the checkbox defaults" rather than
// break the start screen.
const OPTION_STORAGE_KEY = 'noesisProtocol.options';

function loadSavedOptions() {
  try {
    const raw = localStorage.getItem(OPTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveOptions() {
  try {
    localStorage.setItem(OPTION_STORAGE_KEY, JSON.stringify({
      revealOnWrong: revealToggle.checked,
    }));
  } catch (e) {
    // Storage unavailable — the checkboxes still work for this session.
  }
}

const savedOptions = loadSavedOptions();
if (typeof savedOptions.revealOnWrong === 'boolean') revealToggle.checked = savedOptions.revealOnWrong;

revealToggle.addEventListener('change', saveOptions);

toggleLoaderBtn.addEventListener('click', () => {
  loaderPanel.classList.toggle('show');
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { dataInput.value = reader.result; };
  reader.onerror = () => {
    loaderStatus.innerHTML = '<span class="loader-error">Could not read that file.</span>';
  };
  reader.readAsText(file);
});

loadListBtn.addEventListener('click', () => {
  const result = parseListInput(dataInput.value);
  if (result.error) {
    loaderStatus.innerHTML = '<span class="loader-error">' + result.error + '</span>';
    return;
  }
  state.activeData = result.data;
  state.usingSample = false;
  let msg = 'Loaded ' + state.activeData.length + ' items — this set will be used for the next run.';
  if (result.warning) msg += ' ' + result.warning;
  loaderStatus.innerHTML = '<span class="loader-ok">' + msg + '</span>';
});

function showSampleStatus() {
  loaderStatus.innerHTML = '<span class="loader-ok">Using the built-in multiple choice sample list (' +
    defaultSample(true).length + ' items).</span>';
}

resetListBtn.addEventListener('click', () => {
  state.usingSample = true;
  state.activeData = defaultSample(true);
  dataInput.value = '';
  fileInput.value = '';
  showSampleStatus();
});

// ---- Built-in and saved item sets ----

builtinSetSelect.addEventListener('change', () => {
  loadBuiltinBtn.disabled = !builtinSetSelect.value;
});
loadBuiltinBtn.disabled = true;

fetchManifest().then((sets) => {
  builtinSets = sets;
  sets.forEach((set) => {
    const opt = document.createElement('option');
    opt.value = set.id;
    opt.textContent = set.name;
    if (set.description) opt.title = set.description;
    builtinSetSelect.appendChild(opt);
  });
});

loadBuiltinBtn.addEventListener('click', async () => {
  const chosen = builtinSets.find((set) => set.id === builtinSetSelect.value);
  if (!chosen) return;
  loaderStatus.innerHTML = '<span class="loader-ok">Loading ' + escapeHtml(chosen.name) + '…</span>';
  const data = await fetchBundledSet(chosen.file);
  if (!data) {
    loaderStatus.innerHTML = '<span class="loader-error">Could not load that set. Try again.</span>';
    return;
  }
  state.activeData = data;
  state.usingSample = false;
  loaderStatus.innerHTML = '<span class="loader-ok">Loaded "' + escapeHtml(chosen.name) + '" (' +
    data.length + ' items) — this set will be used for the next run.</span>';
});

function renderSavedSets() {
  const sets = listSavedSets();
  if (sets.length === 0) {
    savedSetsList.innerHTML = '<p class="saved-sets-empty">Nothing saved yet — load a set above and save it to reuse later.</p>';
    return;
  }
  savedSetsList.innerHTML = '';
  sets.forEach((set) => {
    const row = document.createElement('div');
    row.className = 'saved-set-row';
    row.innerHTML = '<span class="saved-set-name">' + escapeHtml(set.name) + '</span>' +
      '<span class="saved-set-count">' + set.count + '</span>' +
      '<button type="button" class="ghost load-saved-set">Load</button>' +
      '<button type="button" class="ghost delete-saved-set">Delete</button>';
    row.querySelector('.load-saved-set').addEventListener('click', () => {
      const data = loadSavedSet(set.name);
      if (!data) return;
      state.activeData = data;
      state.usingSample = false;
      loaderStatus.innerHTML = '<span class="loader-ok">Loaded "' + escapeHtml(set.name) + '" (' +
        data.length + ' items) — this set will be used for the next run.</span>';
    });
    row.querySelector('.delete-saved-set').addEventListener('click', () => {
      deleteSet(set.name);
      renderSavedSets();
    });
    savedSetsList.appendChild(row);
  });
}

saveSetBtn.addEventListener('click', () => {
  const name = saveSetName.value.trim();
  if (!name) {
    loaderStatus.innerHTML = '<span class="loader-error">Give this set a name first.</span>';
    return;
  }
  if (state.usingSample || !state.activeData || state.activeData.length === 0) {
    loaderStatus.innerHTML = '<span class="loader-error">Load a set (built-in, pasted, or a file) before saving.</span>';
    return;
  }
  saveSet(name, state.activeData);
  saveSetName.value = '';
  loaderStatus.innerHTML = '<span class="loader-ok">Saved "' + escapeHtml(name) + '" — it now appears under My saved sets.</span>';
  renderSavedSets();
});

renderSavedSets();

function renderChoices() {
  const letters = ['A', 'B', 'C', 'D'];
  mcOptionsEl.innerHTML = '';
  state.currentChoices.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-option';
    btn.innerHTML = '<span class="letter">' + letters[i] + '</span>' + escapeHtml(opt);
    btn.addEventListener('click', () => attemptAnswerMC(opt));
    mcOptionsEl.appendChild(btn);
  });
}

// Sets the active question, and (in MC mode) its answer choices.
// Types `text` into `el` one character at a time, terminal-style, instead
// of setting it all at once. Cancels any typing already in progress on
// that element first, so rapid-fire question changes (a quick correct
// answer against the boss, say) never leave two runs racing each other.
const typewriterTimers = new WeakMap();
// A fixed per-character delay made short answers ("CPU") finish in ~50ms —
// too fast to read as typing at all. Instead, aim for a roughly constant
// total reveal time and derive the per-character delay from the string's
// length, clamped so short strings type slowly enough to notice and long
// ones don't drag.
function typeText(el, text, targetDurationMs = 450) {
  const speedMs = Math.min(140, Math.max(12, targetDurationMs / Math.max(text.length, 1)));
  const existing = typewriterTimers.get(el);
  if (existing) clearInterval(existing);
  el.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    i++;
    el.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(timer);
      typewriterTimers.delete(el);
    }
  }, speedMs);
  typewriterTimers.set(el, timer);
}

function setQuestion(q) {
  state.currentQuestion = q;
  typeText(enemyName, q.term);
  answerInput.value = '';
  const imageSrc = resolveImageSrc(q.image);
  if (imageSrc) {
    queryImage.src = imageSrc;
    queryImage.hidden = false;
  } else {
    queryImage.hidden = true;
    queryImage.removeAttribute('src');
  }
  if (state.mcMode) {
    state.currentChoices = buildChoices(q);
    renderChoices();
  }
}

function nextQuestion() {
  setQuestion(pickQuestion(state.currentQuestion, poolFor(state.selectedTarget)));
}

// If the current target changed (a fresh click, or an auto-pick after a
// move/turn) and the showing question isn't from that target's pool — e.g.
// it's a leftover boss/global question but an encounter is now targeted, or
// vice versa — reroll it from the right pool. A no-op the rest of the time.
function syncQuestionForTarget() {
  const pool = poolFor(state.selectedTarget);
  if (!pool.includes(state.currentQuestion)) {
    setQuestion(pickQuestion(state.currentQuestion, pool));
  }
}

// Switches between the room/map view and the battle screen to match whether
// something is currently targeted — battle screen while state.selectedTarget
// is set (an encounter is engaged), room screen once it's null (nothing left
// adjacent). Call this anywhere state.selectedTarget might have just changed;
// it's a no-op if the right screen is already showing. Also refreshes the
// battle screen's opponent glyph/HP display for whichever target is current,
// so resolving one adjacent thing and chaining straight into the next (e.g.
// boxed in by two minions) updates in place without a spurious round trip
// through the room screen.
// Clear correct/wrong signal on the battle screen itself. The room's own
// hit-flash/shake effects live on the grid and player icon, which sit
// behind (and are invisible during) the battle screen, so a fight needs
// its own visible feedback distinct from the feedback text alone.
function flashBattleResult(isCorrect) {
  const cls = isCorrect ? 'flash-correct' : 'flash-wrong';
  battleGlyphEl.classList.remove('flash-correct', 'flash-wrong');
  void battleGlyphEl.offsetWidth;
  battleGlyphEl.classList.add(cls);
  if (!isCorrect) {
    heartsEl.classList.remove('hit-flash');
    void heartsEl.offsetWidth;
    heartsEl.classList.add('hit-flash');
  }
}

// Scrambles `text` into glitch characters, then resolves it left to right —
// the category-choice labels "decode" into place rather than just appearing.
// Spaces stay put so the label's shape is readable from the first frame.
const decodeTimers = new WeakMap();
const DECODE_CHARS = '01{}[]<>/\\;:=+*#$%&^~ABCDEF';
const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function decodeText(el, text, durationMs = 520) {
  const existing = decodeTimers.get(el);
  if (existing) clearInterval(existing);
  if (reduceMotion) { el.textContent = text; return; }
  const frameMs = 35;
  const frames = Math.max(1, Math.round(durationMs / frameMs));
  let frame = 0;
  const render = () => {
    const settled = Math.floor((frame / frames) * text.length);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      out += i < settled || text[i] === ' '
        ? text[i]
        : DECODE_CHARS[Math.floor(Math.random() * DECODE_CHARS.length)];
    }
    el.textContent = out;
  };
  render();
  const timer = setInterval(() => {
    frame++;
    if (frame >= frames) {
      clearInterval(timer);
      decodeTimers.delete(el);
      el.textContent = text;
      return;
    }
    render();
  }, frameMs);
  decodeTimers.set(el, timer);
}

// ---- Encounter log ----
// The battle screen's transcript of the current encounter: what it is,
// its rules, each query vector chosen, each input and its outcome. It is
// the battle screen's only feedback channel — cleared when a new encounter
// starts, kept across every round of a boss fight. Line kinds map onto the
// phosphor's intensities: 'sys' (dim), normal, 'bright', and 'alert'
// (inverse video, reserved for a miss or the end of the run).
const LOG_MAX_LINES = 40;

function logLine(text, kind) {
  const line = document.createElement('div');
  line.className = 'log-line' + (kind ? ' log-' + kind : '');
  line.textContent = text;
  encounterLogEl.appendChild(line);
  while (encounterLogEl.children.length > LOG_MAX_LINES) encounterLogEl.firstChild.remove();
  ageLog();
  encounterLogEl.scrollTop = encounterLogEl.scrollHeight;
}

// Transcript aging: the newest few lines keep their own intensity; older
// ones drop to dim and fade a step per line, so history recedes behind the
// current prompt instead of competing with it.
const LOG_FRESH_LINES = 3;

function ageLog() {
  const lines = encounterLogEl.children;
  for (let i = 0; i < lines.length; i++) {
    const age = lines.length - 1 - i;
    lines[i].classList.toggle('log-old', age >= LOG_FRESH_LINES);
    // Floor kept high enough that the oldest (small, dim) line stays readable.
    lines[i].style.opacity = String(Math.max(0.45, 1 - age * 0.07));
  }
}

function clearLog() {
  encounterLogEl.innerHTML = '';
}

// Opening lines for a new encounter: what it is and what's at stake.
// Wording is per target kind (boss / minion / chest / rune / encounter)
// under log.start.* and log.rules.* in text.js.
function logEncounterStart(target) {
  clearLog();
  const vars = { queries: BOSS_HP, category: target.category ? categoryLabel(target.category) : '' };
  logLine(t('log.start.' + target.kind, vars), 'bright');
  logLine(t('log.rules.' + target.kind, vars), 'sys');
}

// Shows whichever part of the battle screen matches state.battlePhase: the
// category choices, the question and its answer input, or (once the
// encounter is settled) the prompt to continue.
function showBattlePhase() {
  choicePanel.hidden = state.battlePhase !== 'choosing';
  queryPanel.hidden = state.battlePhase !== 'answering';
  endPanel.hidden = state.battlePhase !== 'ended';
}

function renderCategoryChoices() {
  choiceListEl.innerHTML = '';
  state.categoryChoices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-option';
    const hinted = state.runeHint && choice.pool.includes(state.runeHint);
    btn.innerHTML = '<span class="letter">[' + (i + 1) + ']</span><span class="choice-label"></span>' +
      (hinted ? '<span class="choice-hint" title="' + escapeHtml(t('battle.runeHintMark')) + '">◊</span>' : '');
    decodeText(btn.querySelector('.choice-label'), choice.label);
    btn.addEventListener('click', () => chooseCategory(i));
    choiceListEl.appendChild(btn);
  });
}

// Sets up one turn of whatever's on the battle screen. A boss or minion
// fight opens with a choice of query categories (the player picks what
// kind of question they face); chests, runes and category encounters are
// puzzles, not fights, and go straight to their question — as does any
// fight whose pool can't offer at least two distinct choices.
function startBattleTurn() {
  const target = state.selectedTarget;
  const isFight = target.kind === 'boss' || target.kind === 'minion';
  state.categoryChoices = isFight
    ? buildCategoryChoices(poolFor(target), BATTLE_CHOICE_COUNT, state.runeHint)
    : [];

  if (state.categoryChoices.length >= 2) {
    state.battlePhase = 'choosing';
    renderCategoryChoices();
  } else {
    state.battlePhase = 'answering';
    // No choice to route the rune's hint through, so ask it directly if
    // this target's pool holds it.
    if (state.runeHint && poolFor(target).includes(state.runeHint)) {
      setQuestion(state.runeHint);
      state.runeHint = null;
    } else {
      syncQuestionForTarget();
    }
    // The question was very likely set well before this moment, off-screen
    // (loadRoom() sets one at room load), so re-type it fresh every time a
    // turn starts rather than letting the effect be skipped.
    typeText(enemyName, state.currentQuestion.term);
    if (!state.mcMode) answerInput.focus();
  }
  showBattlePhase();
}

function chooseCategory(i) {
  if (state.turnLocked || state.battlePhase !== 'choosing') return;
  const choice = state.categoryChoices[i];
  if (!choice) return;
  let q;
  if (state.runeHint && choice.pool.includes(state.runeHint)) {
    q = state.runeHint;
    state.runeHint = null;
  } else {
    q = pickQuestion(state.currentQuestion, choice.pool);
  }
  logLine(t('log.vector', { n: i + 1, label: choice.label }), 'sys');
  state.battlePhase = 'answering';
  setQuestion(q);
  showBattlePhase();
  if (!state.mcMode) answerInput.focus();
}

function syncBattleScreen() {
  if (state.selectedTarget) {
    const target = state.selectedTarget;
    battleGlyphEl.textContent = target.el ? target.el.textContent : bossActor.textContent;
    renderCombatStatus();
    const entering = !battleScreen.classList.contains('show');
    if (entering) {
      showScreen(battleScreen);
      battleScreen.classList.remove('glitch-in');
      void battleScreen.offsetWidth;
      battleScreen.classList.add('glitch-in');
    }
    // A new encounter starts on entering, and whenever the player moves
    // on from a settled one straight into another adjacent target.
    if (entering || state.battleTarget !== target) {
      state.battleTarget = target;
      logEncounterStart(target);
      startBattleTurn();
    }
  } else {
    state.battleTarget = null;
    if (battleScreen.classList.contains('show')) showScreen(roomScreen);
  }
}

// The encounter is settled: its target is gone (or opened/spent), and the
// battle screen holds on the log until the player continues, so the
// outcome is read rather than flashing past as the screen switches back.
function endEncounter() {
  state.selectedTarget = null;
  state.battlePhase = 'ended';
  showBattlePhase();
  continueBtn.focus();
}

// Leaves a settled encounter: straight into the next one if something
// else is adjacent, otherwise back to the room.
function leaveEncounter() {
  if (state.battlePhase !== 'ended') return;
  state.battlePhase = 'answering';
  state.battleTarget = null;
  refreshTargetValidity();
  nextQuestion();
  syncBattleScreen();
}

// Re-places every actor at its current world position relative to the
// camera. Needed whenever the camera itself moves — the boss, minions,
// coin, chest, and rune haven't moved in world space, but the viewport
// window that maps world coordinates onto the screen has.
function repositionActors() {
  positionActor(playerActor, state.playerRow, state.playerCol, true);
  if (state.boss) positionActor(bossActor, state.boss.row, state.boss.col, true);
  state.minions.forEach(m => positionActor(m.el, m.row, m.col, true));
  if (state.coin) positionActor(coinActor, state.coin.row, state.coin.col, true);
  if (state.stairs) positionActor(stairsActor, state.stairs.row, state.stairs.col, true);
  if (state.chest) positionActor(chestActor, state.chest.row, state.chest.col, true);
  if (state.rune) positionActor(runeActor, state.rune.row, state.rune.col, true);
  state.encounters.forEach(e => positionActor(e.el, e.row, e.col, true));
}

// Picks a random open floor tile, avoiding walls and any tile in avoidList.
function pickCoinTile(walls, avoidList, allowedTiles) {
  const candidates = [];
  for (let r = 0; r < state.GRID_SIZE; r++) {
    for (let c = 0; c < state.GRID_SIZE; c++) {
      const k = key(r, c);
      if (walls.has(k)) continue;
      if (allowedTiles && !allowedTiles.has(k)) continue;
      if (avoidList.some(p => p.row === r && p.col === c)) continue;
      candidates.push({ row: r, col: c });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Walkable steps from the player's start to every tile they can reach
// without passing the boss — i.e. everything outside the boss chamber.
function stepsFromStart() {
  const blocked = new Set(state.wallSet);
  blocked.add(key(state.boss.row, state.boss.col));
  const dist = new Map([[key(state.PLAYER_START.row, state.PLAYER_START.col), 0]]);
  const queue = [state.PLAYER_START];
  while (queue.length) {
    const cur = queue.shift();
    const d = dist.get(key(cur.row, cur.col));
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = cur.row + dr, nc = cur.col + dc;
      if (nr < 0 || nr >= state.GRID_SIZE || nc < 0 || nc >= state.GRID_SIZE) continue;
      const k = key(nr, nc);
      if (dist.has(k) || blocked.has(k)) continue;
      dist.set(k, d + 1);
      queue.push({ row: nr, col: nc });
    }
  }
  return dist;
}

// The room's fixed set of minions (MINIONS_PER_ROOM), placed on room tiles
// outside the boss chamber and at least MINION_MIN_START_DISTANCE steps
// from the player's start, so a room never opens with one in the player's
// face. Falls back to any free reachable room tile if a small room can't
// fit them that far away.
function placeMinions(roomTiles, takenTiles) {
  const count = MINIONS_PER_ROOM[Math.min(state.roomIndex, MINIONS_PER_ROOM.length - 1)];
  const dist = stepsFromStart();
  const isTaken = (k) => takenTiles.some(p => key(p.row, p.col) === k);
  const free = [...dist.keys()].filter(k => roomTiles.has(k) && !isTaken(k));
  const far = shuffle(free.filter(k => dist.get(k) >= MINION_MIN_START_DISTANCE));
  const near = shuffle(free.filter(k => dist.get(k) < MINION_MIN_START_DISTANCE && dist.get(k) >= 3));
  [...far, ...near].slice(0, count).forEach(k => {
    const [row, col] = k.split(',').map(Number);
    spawnMinion({ row, col });
  });
}

const INTRO_GLITCH_DURATION_MS = 2000;
const GLITCH_CHARS = '01{}[]<>/\\;:=+*#$%&^~ABCDEF0123456789';

// Fills the intro glitch screen's backdrop with a block of random
// code-like garbage, tall enough that the CSS scroll animation (which
// moves it by a third of its own height) never runs out of content mid-loop.
function randomGlitchCode() {
  const lines = [];
  for (let i = 0; i < 90; i++) {
    let line = '';
    const len = 40 + Math.floor(Math.random() * 20);
    for (let j = 0; j < len; j++) {
      line += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function startGame() {
  state.order = shuffle(state.activeData).slice(0, Math.min(ROOM_COUNT, state.activeData.length));
  state.roomIndex = 0;
  state.runEnded = false;
  state.attempts = 0;
  state.extraSpaceCount = 0;
  state.hearts = MAX_HEARTS;
  state.turnCount = 0;
  state.coinsTotal = 0;
  state.revealOnWrong = revealToggle.checked;
  // Every run is multiple choice. The typing path (answerForm,
  // attemptAnswer, TYPING_SAMPLE_DATA) is parked, not deleted: it becomes a
  // per-question "type it in" modifier once question modifiers are designed.
  state.mcMode = true;
  answerForm.style.display = state.mcMode ? 'none' : 'flex';
  mcOptionsEl.classList.toggle('show', state.mcMode);
  renderHearts();
  turnCountEl.textContent = state.turnCount;
  coinsTotalEl.textContent = state.coinsTotal;
  roomTotalEl.textContent = state.order.length;

  // Room setup happens immediately (invisibly, behind the glitch screen) so
  // there's no added real loading time — only a deliberate dramatic pause
  // before the player actually sees the room. The elapsed-time clock starts
  // once that pause ends, not before, so it isn't charged against the player.
  loadRoom();
  glitchCode.textContent = randomGlitchCode();
  showScreen(introGlitch);
  setTimeout(() => {
    showScreen(roomScreen);
    startTimer();
  }, INTRO_GLITCH_DURATION_MS);
}

// Map glyphs for the one-per-room actors, from their term.*.symbol lines in
// text.js (so a room's AREAS overrides can change them too). Minions get
// theirs as they spawn (combat.js).
function applyActorSymbols() {
  bossActor.textContent = t('term.boss.symbol');
  chestActor.textContent = t('term.chest.symbol');
  runeActor.textContent = t('term.rune.symbol');
  coinActor.textContent = t('term.gold.symbol');
  stairsActor.textContent = t('term.exit.symbol');
}

function loadRoom() {
  roomNumEl.textContent = state.roomIndex + 1;
  // Per-room wording overrides (text.js AREAS) apply from here on.
  setTextArea(state.roomIndex + 1);
  applyStaticText();
  applyActorSymbols();

  state.GRID_SIZE = GRID_SIZES[Math.min(state.roomIndex, GRID_SIZES.length - 1)];
  state.CHAMBER_TARGET = CHAMBER_TARGETS[Math.min(state.roomIndex, CHAMBER_TARGETS.length - 1)];
  state.PLAYER_START = { row: state.GRID_SIZE - 1, col: Math.floor(state.GRID_SIZE / 2) };
  buildGridTiles();

  state.minions.forEach(m => m.el.remove());
  state.minions = [];

  state.encounters.forEach(e => e.el.remove());
  state.encounters = [];
  state.runeHint = null;

  state.playerRow = state.PLAYER_START.row;
  state.playerCol = state.PLAYER_START.col;
  state.facing = 'N';
  playerActor.textContent = DIRECTION_ARROWS[state.facing];
  updateCamera();
  positionActor(playerActor, state.playerRow, state.playerCol, true);

  const layout = generateDungeonLayout(state.PLAYER_START, state.GRID_SIZE, state.CHAMBER_TARGET);
  state.wallSet = layout.walls;
  renderWalls();

  state.boss = { row: layout.spawn.row, col: layout.spawn.col, hp: BOSS_HP, kind: 'boss' };
  bossActor.classList.remove('gone');
  positionActor(bossActor, state.boss.row, state.boss.col, true);

  // The boss stands on the chamber's one doorway, so the stairs behind it
  // are unreachable until it's defeated and state.boss is nulled.
  state.stairs = { row: layout.stairs.row, col: layout.stairs.col };
  stairsActor.classList.remove('gone');
  positionActor(stairsActor, state.stairs.row, state.stairs.col, true);

  // Coin and the room's one special item only ever land in an actual room
  // tile, never a hallway — a hallway is one tile wide, so an object
  // sitting in one would force answering it (with a wrong-answer trap, for
  // a chest/rune/encounter) just to get past. No fallback to non-room
  // tiles: if a room is too packed to fit one, it simply doesn't spawn.
  const roomTiles = layout.roomTiles;
  const pickRoomTile = (avoidList) => pickCoinTile(state.wallSet, avoidList, roomTiles);

  const coinTile = pickRoomTile([state.PLAYER_START, { row: state.boss.row, col: state.boss.col }, state.stairs]);
  state.coin = coinTile ? { row: coinTile.row, col: coinTile.col } : null;
  coinActor.classList.toggle('gone', !state.coin);
  if (state.coin) positionActor(coinActor, state.coin.row, state.coin.col, true);

  const takenTiles = [state.PLAYER_START, { row: state.boss.row, col: state.boss.col }, state.stairs];
  if (state.coin) takenTiles.push(state.coin);

  // Exactly one special interactive extra per room — a chest, a rune, or a
  // single category encounter, picked at random from whichever are
  // eligible. Never more than one at once, so the room's one bonus/gamble
  // stays meaningful instead of being buried among several.
  state.chest = null;
  chestActor.classList.add('gone');
  state.rune = null;
  runeActor.classList.add('gone');

  const byCategory = new Map();
  state.activeData.forEach(item => {
    if (!item.category) return;
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  });

  const specialTile = pickRoomTile(takenTiles);
  if (specialTile) {
    const candidates = [
      { type: 'chest' },
      { type: 'rune' },
      ...Array.from(byCategory.keys()).map(category => ({ type: 'encounter', category })),
    ];
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    if (chosen.type === 'chest') {
      state.chest = { row: specialTile.row, col: specialTile.col, el: chestActor, kind: 'chest' };
      chestActor.classList.remove('gone');
      positionActor(chestActor, specialTile.row, specialTile.col, true);
    } else if (chosen.type === 'rune') {
      state.rune = { row: specialTile.row, col: specialTile.col, el: runeActor, kind: 'rune' };
      runeActor.classList.remove('gone');
      positionActor(runeActor, specialTile.row, specialTile.col, true);
    } else {
      const glyph = glyphForCategory(chosen.category);
      const el = document.createElement('div');
      el.className = 'actor encounter';
      el.textContent = glyph;
      grid.appendChild(el);
      const encounter = {
        row: specialTile.row, col: specialTile.col, el, kind: 'encounter',
        category: chosen.category, pool: byCategory.get(chosen.category),
      };
      positionActor(el, specialTile.row, specialTile.col, true);
      state.encounters.push(encounter);
    }
  }

  const minionTaken = takenTiles.slice();
  [state.chest, state.rune, ...state.encounters].forEach(item => { if (item) minionTaken.push(item); });
  placeMinions(roomTiles, minionTaken);

  state.darkness = false;
  initBossLight();
  state.visibleSet = new Set();
  state.exploredSet = new Set();
  computeVisibility();
  renderFog();
  renderLightEye();

  state.selectedTarget = null;
  renderTargeting();
  syncBattleScreen(); // nothing's adjacent at spawn — makes sure we're back on the room screen

  setQuestion(pickQuestion(null));
  renderCombatStatus();
  clearLog();
  roomFeedback.innerHTML = '';
  answerInput.value = '';
  setControlsEnabled(true);
  answerInput.focus();
}

// Shared by the stairs (reaching them mid-move) and the dev skip button.
function advanceRoom() {
  state.roomIndex++;
  if (state.roomIndex >= state.order.length) {
    endWin();
  } else {
    loadRoom();
  }
}

function setControlsEnabled(enabled) {
  answerInput.disabled = !enabled;
  attackBtn.disabled = !enabled;
  Object.values(dpadButtons).forEach(b => b.disabled = !enabled);
  mcOptionsEl.querySelectorAll('button').forEach(b => b.disabled = !enabled);
  choiceListEl.querySelectorAll('button').forEach(b => b.disabled = !enabled);
  continueBtn.disabled = !enabled;
}

// One line on the room screen under the map. Escaped, since some wording
// carries values from custom lists (category names).
function showRoomNote(cls, text) {
  roomFeedback.innerHTML = '<span class="' + cls + '">' + escapeHtml(text) + '</span>';
}

function applyTurnOutcome(actionMessage) {
  const notes = advanceMonsters();
  if (lightConsumed()) {
    loseToLight();
    return;
  }
  syncQuestionForTarget();
  syncBattleScreen();
  const text = [actionMessage, notes.engageNote].filter(Boolean).join(' ');
  showRoomNote(notes.engageNote ? 'warn-msg' : 'move-msg', text);
}

// The boss light has reached this floor's LIGHT_LOSS_COVERAGE: the run
// ends where the player stands, after a beat to see it.
function loseToLight() {
  state.runEnded = true;
  showRoomNote('warn-msg', t('room.light.consumed'));
  setControlsEnabled(false);
  clearInterval(state.timerHandle);
  setTimeout(() => endLose('light'), 1400);
}

function movePlayer(dRow, dCol, dirName) {
  if (state.turnLocked || state.runEnded) return;

  // Facing updates (and the fog cone with it) even on a blocked move — the
  // player can "turn to look" a direction without spending a turn, since
  // the collision checks below return before any turn-advancing code runs.
  const facing = dRow === -1 ? 'N' : dRow === 1 ? 'S' : dCol === 1 ? 'E' : 'W';
  if (state.facing !== facing) {
    state.facing = facing;
    playerActor.textContent = DIRECTION_ARROWS[facing];
  }
  computeVisibility();
  renderFog();

  const newRow = state.playerRow + dRow;
  const newCol = state.playerCol + dCol;

  if (newRow < 0 || newRow >= state.GRID_SIZE || newCol < 0 || newCol >= state.GRID_SIZE) {
    showRoomNote('block-msg', t('room.blocked.wall'));
    return;
  }
  if (state.wallSet.has(key(newRow, newCol))) {
    showRoomNote('block-msg', t('room.blocked.wall'));
    return;
  }
  if (state.boss && state.boss.row === newRow && state.boss.col === newCol) {
    showRoomNote('block-msg', t('room.blocked.boss'));
    return;
  }
  if (state.minions.some(m => m.row === newRow && m.col === newCol)) {
    showRoomNote('block-msg', t('room.blocked.minion'));
    return;
  }
  if (state.chest && state.chest.row === newRow && state.chest.col === newCol) {
    showRoomNote('block-msg', t('room.blocked.chest'));
    return;
  }
  if (state.rune && state.rune.row === newRow && state.rune.col === newCol) {
    showRoomNote('block-msg', t('room.blocked.rune'));
    return;
  }
  const blockingEncounter = state.encounters.find(e => e.row === newRow && e.col === newCol);
  if (blockingEncounter) {
    showRoomNote('block-msg', t('room.blocked.encounter', { category: categoryLabel(blockingEncounter.category) }));
    return;
  }

  state.turnLocked = true;
  state.playerRow = newRow;
  state.playerCol = newCol;
  updateCamera();
  renderWalls();
  repositionActors();
  computeVisibility();
  renderFog();

  if (state.stairs && state.playerRow === state.stairs.row && state.playerCol === state.stairs.col) {
    state.turnLocked = false;
    advanceRoom();
    return;
  }

  let actionMessage = t('room.move', { direction: t('room.dir.' + dirName) });
  if (state.coin && state.coin.row === state.playerRow && state.coin.col === state.playerCol) {
    state.coin = null;
    coinActor.classList.add('gone');
    state.coinsTotal += goldReward(1);
    coinsTotalEl.textContent = state.coinsTotal;
    actionMessage += ' ' + t('room.coin');
  }

  applyTurnOutcome(actionMessage);
  state.turnLocked = false;
}

function skipTurn() {
  if (state.turnLocked || state.runEnded) return;
  state.turnLocked = true;
  applyTurnOutcome(t('room.wait'));
  state.turnLocked = false;
}

// Shared outcome handler for both typed answers and multiple-choice taps.
// Assumes the caller already confirmed adjacency, set turnLocked = true,
// and counted the attempt. `given` is the player's answer, echoed to the log.
//
// One answer settles a minion, chest, rune or category challenge, right or
// wrong: it's cleared and the encounter ends. Only a boss fight goes on
// past an answer, until its HP runs out. A miss always costs 1 HP.
function applyAnswerResult(isCorrect, hadExtraSpace, given) {
  const target = state.selectedTarget;
  const q = state.currentQuestion;

  logLine(t('log.input', { answer: given }));
  if (isCorrect) {
    logLine(t('log.accepted'), 'bright');
    if (hadExtraSpace) {
      state.extraSpaceCount++;
      logLine(t('log.extraSpaces'), 'sys');
    }
  } else {
    const cost = state.darkness ? DARK_MISS_COST : 1;
    state.hearts -= cost;
    renderHearts();
    logLine(t('log.rejected', { cost }), 'alert');
    if (state.revealOnWrong) {
      logLine(t('log.expected', { answer: q.meaning }), 'sys');
      if (q.source) logLine(t('log.source', { source: q.source }), 'sys');
    }
  }
  flashBattleResult(isCorrect);

  if (state.hearts <= 0) {
    logLine(t('log.signalLost'), 'alert');
    setControlsEnabled(false);
    clearInterval(state.timerHandle);
    setTimeout(endLose, 900);
    state.turnLocked = false;
    return;
  }

  if (target.kind === 'boss') resolveBossAnswer(isCorrect);
  else resolveOneShot(target, isCorrect, q);
  state.turnLocked = false;
}

// Boss fights are the one encounter that outlasts an answer: a correct one
// takes 1 HP off the boss, a miss doesn't, and either way it's back to the
// category choice until the boss is cleared. Other minions stay frozen
// while this goes on, so missing a query is the only way to take damage.
function resolveBossAnswer(isCorrect) {
  if (isCorrect) {
    state.boss.hp--;
    renderCombatStatus();
    if (state.boss.hp <= 0) {
      bossActor.classList.add('gone');
      state.boss = null; // clears the doorway it was blocking
      // Its light dies with it, and the floor goes dark: explored tiles
      // are forgotten, the minions left start hunting, misses cost more
      // and gold pays more (DARK_* in config.js).
      extinguishLight();
      state.darkness = true;
      state.exploredSet = new Set();
      computeVisibility();
      renderFog();
      renderLightEye();
      logLine(t('log.boss.cleared'), 'bright');
      logLine(t('log.darkness'), 'alert');
      endEncounter();
      return;
    }
    logLine(t('log.boss.integrity', { hp: state.boss.hp, max: BOSS_HP }));
  } else {
    logLine(t('log.boss.holds'));
  }
  nextQuestion();
  startBattleTurn();
}

// Gold pays DARK_GOLD_MULTIPLIER times as much in the darkness after the boss.
function goldReward(base) {
  return state.darkness ? base * DARK_GOLD_MULTIPLIER : base;
}

// Everything but the boss is settled by a single answer. Success pays out
// (coins for a chest or category challenge, a hint for a rune); a miss has
// already cost its heart. Either way the target is cleared or spent.
function resolveOneShot(target, isCorrect, q) {
  if (target.kind === 'minion') {
    target.el.remove();
    state.minions = state.minions.filter(m => m !== target);
    logLine(t(isCorrect ? 'log.minion.cleared' : 'log.minion.disperses'), isCorrect ? 'bright' : undefined);
    endEncounter();
    return;
  }

  target.el.classList.add('gone');
  if (target.kind === 'chest') state.chest = null;
  else if (target.kind === 'rune') state.rune = null;
  else if (target.kind === 'encounter') state.encounters = state.encounters.filter(e => e !== target);

  const category = target.category ? categoryLabel(target.category) : '';
  if (!isCorrect) {
    logLine(t('log.' + target.kind + '.trapped', { category }));
  } else if (target.kind === 'chest') {
    const gold = goldReward(2);
    state.coinsTotal += gold;
    coinsTotalEl.textContent = state.coinsTotal;
    logLine(t('log.chest.opened', { gold }), 'bright');
  } else if (target.kind === 'encounter') {
    const reward = goldReward(DIFFICULTY_COIN_REWARD[q.difficulty] || DIFFICULTY_COIN_REWARD.medium);
    state.coinsTotal += reward;
    coinsTotalEl.textContent = state.coinsTotal;
    logLine(t('log.encounter.mastered', { category, gold: reward }), 'bright');
  } else {
    // The hinted question stays in reserve until it's asked: the next
    // fight always offers its category (marked ◊), so the hint can't be
    // spent on a question the player never chooses.
    state.runeHint = pickQuestion(q);
    const hint = buildHint(state.runeHint);
    logLine(state.runeHint.category
      ? t('log.rune.decoded', { category: categoryLabel(state.runeHint.category), hint })
      : t('log.rune.decodedUncategorized', { hint }), 'bright');
  }
  endEncounter();
}

function attemptAnswer() {
  if (state.turnLocked || state.battlePhase !== 'answering') return;
  if (!state.selectedTarget || !isAdjacentToPlayer(state.selectedTarget)) {
    logLine(t('log.outOfRange'), 'sys');
    return;
  }
  const raw = answerInput.value;
  if (!raw.trim()) return;

  state.turnLocked = true;
  state.attempts++;
  const hadExtraSpace = raw !== raw.trim() || /\s{2,}/.test(raw);
  const cleanInput = normalizeSpaces(raw).toLowerCase();
  const cleanAnswer = normalizeSpaces(state.currentQuestion.meaning).toLowerCase();
  applyAnswerResult(cleanInput === cleanAnswer, hadExtraSpace, normalizeSpaces(raw));
}

function attemptAnswerMC(choice) {
  if (state.turnLocked || state.battlePhase !== 'answering') return;
  if (!state.selectedTarget || !isAdjacentToPlayer(state.selectedTarget)) {
    logLine(t('log.outOfRange'), 'sys');
    return;
  }
  state.turnLocked = true;
  state.attempts++;
  const isCorrect = normalizeSpaces(choice).toLowerCase() === normalizeSpaces(state.currentQuestion.meaning).toLowerCase();
  applyAnswerResult(isCorrect, false, choice);
}

attackBtn.addEventListener('click', attemptAnswer);
continueBtn.addEventListener('click', leaveEncounter);

answerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    attemptAnswer();
  }
});

answerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  attemptAnswer();
});

dpadButtons.N.addEventListener('click', () => movePlayer(-1, 0, 'north'));
dpadButtons.S.addEventListener('click', () => movePlayer(1, 0, 'south'));
dpadButtons.E.addEventListener('click', () => movePlayer(0, 1, 'east'));
dpadButtons.W.addEventListener('click', () => movePlayer(0, -1, 'west'));
dpadButtons.Skip.addEventListener('click', skipTurn);

// Arrow-key support on desktop, ignored while typing in the answer box.
document.addEventListener('keydown', (e) => {
  if (document.activeElement === answerInput) return;
  if (!roomScreen.classList.contains('show')) return;
  if (e.key === 'ArrowUp') { e.preventDefault(); movePlayer(-1, 0, 'north'); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); movePlayer(1, 0, 'south'); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); movePlayer(0, -1, 'west'); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); movePlayer(0, 1, 'east'); }
  else if (state.mcMode && ['1', '2', '3', '4', 'a', 'A', 'b', 'B', 'c', 'C', 'd', 'D'].includes(e.key)) {
    const idxMap = { 1: 0, a: 0, 2: 1, b: 1, 3: 2, c: 2, 4: 3, d: 3 };
    const idx = idxMap[e.key.toLowerCase()];
    const btn = mcOptionsEl.children[idx];
    if (btn && !btn.disabled) btn.click();
  }
});

// Number keys pick a category while the battle screen is offering a choice;
// Enter or Space moves on from a settled encounter even if the continue
// button lost focus.
document.addEventListener('keydown', (e) => {
  if (!battleScreen.classList.contains('show')) return;
  if (state.battlePhase === 'ended' && (e.key === 'Enter' || e.key === ' ') && document.activeElement !== continueBtn) {
    e.preventDefault();
    if (!continueBtn.disabled) leaveEncounter();
    return;
  }
  if (state.battlePhase !== 'choosing') return;
  const idx = ['1', '2', '3'].indexOf(e.key);
  const btn = idx === -1 ? null : choiceListEl.children[idx];
  if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
});

devToggleBtn.addEventListener('click', () => {
  devPanel.classList.toggle('show');
});

// Dev tool: jump to the next room instantly, skipping combat, for
// faster testing of dungeon generation across levels.
devSkipBtn.addEventListener('click', () => {
  if (state.hearts <= 0) return;
  advanceRoom();
});

// Dev tool: reveal the whole map instantly, to check that the layout,
// boss placement, and entities are generating correctly under the fog.
devFogBtn.addEventListener('click', () => {
  state.fogEnabled = !state.fogEnabled;
  devFogBtn.textContent = state.fogEnabled ? 'Fog: ON (dev)' : 'Fog: OFF (dev)';
  renderFog();
});

function endWin() {
  clearInterval(state.timerHandle);
  let msg = t('end.win.stats', {
    bosses: state.order.length, time: formatTime(state.seconds), turns: state.turnCount,
    attempts: state.attempts, hearts: state.hearts, coins: state.coinsTotal,
  });
  if (state.extraSpaceCount > 0) {
    msg += ' ' + t('end.win.spacing', { count: state.extraSpaceCount });
  }
  winStats.textContent = msg;
  showScreen(winScreen);
}

// `reason` is 'light' when the boss light consumed the floor; anything else
// (running out of hearts) keeps the usual title.
function endLose(reason) {
  loseTitle.textContent = t(reason === 'light' ? 'end.lose.light.title' : 'end.lose.title');
  loseStats.textContent = t('end.lose.stats', {
    room: state.roomIndex + 1, rooms: state.order.length, time: formatTime(state.seconds),
    turns: state.turnCount, coins: state.coinsTotal,
  });
  showScreen(loseScreen);
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('retryBtn').addEventListener('click', startGame);

// PWA: register the service worker so the game caches for offline use.
// Runs only over HTTPS (or localhost) — browsers block service workers
// on plain http:// or file:// for security reasons.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      // Check for a newer service-worker.js right away, since browsers
      // don't always do this on their own before serving cached content.
      reg.update();
    }).catch(() => {
      // Offline support just won't be available; the game still works normally.
    });
  });

  // Once a new service worker takes over, reload so the page actually
  // picks up the files it just cached (skipWaiting alone doesn't do this).
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });
}
