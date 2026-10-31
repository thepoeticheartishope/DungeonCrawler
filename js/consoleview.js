// COMMAND.SYS, the training console's list of roles (crew roles plan step
// B, `ideas/crew-roles-plan.md` outside the repo): a box over the map like
// CHARGE.SYS, so the clock and the ship stay in view. One button per role
// (roles.js consoleRoles): its name, its game, and where it stands. A role
// still to learn can be picked; one learned, taught or sitting out can't.
// Escape or LEAVE closes it. main.js opens it and passes in what a pick
// and LEAVE do. This only draws and listens.

import { t } from './text.js';

const els = {};
let actions = {};

// Looks up the panel and hooks up its buttons and Escape. Call once, from main.js.
export function initConsoleView({ pick, leave }) {
  actions = { pick, leave };
  els.panel = document.getElementById('consolePanel');
  els.roles = document.getElementById('consoleRoles');
  els.leave = document.getElementById('consoleLeave');
  els.leave.addEventListener('click', () => actions.leave());
  els.roles.addEventListener('click', (e) => {
    const btn = e.target.closest('.console-role');
    if (btn && !btn.disabled) actions.pick(btn.dataset.role);
  });
  document.addEventListener('keydown', (e) => {
    if (!consoleShown() || e.key !== 'Escape') return;
    e.preventDefault();
    actions.leave();
  });
}

// Whether COMMAND.SYS is up.
export function consoleShown() {
  return !!els.panel && !els.panel.hidden;
}

// Opens COMMAND.SYS on `roles` (roles.js consoleRoles), focus on the first
// role still to learn.
export function showConsole(roles) {
  els.roles.innerHTML = roles.map(({ role, minigame, status }) => {
    const game = minigame ? t('mg.' + minigame) : t('console.wires');
    return '<button type="button" class="console-role ' + status + '" data-role="' + role + '"' + (status === 'new' ? '' : ' disabled') + '>' +
      '<span class="console-name">' + t('role.' + role) + '</span>' +
      '<span class="console-game">' + game + '</span>' +
      '<span class="console-status">' + t('console.status.' + status) + '</span></button>';
  }).join('');
  els.panel.hidden = false;
  const first = els.roles.querySelector('.console-role:not([disabled])') || els.leave;
  first.focus({ preventScroll: true });
}

// Closes COMMAND.SYS.
export function hideConsole() {
  if (els.panel) els.panel.hidden = true;
}
