/**
 * searchMode.js — Perplexity-style search mode dropdown
 *
 * Exposes window.searchMode = { setMode, getMode, init }
 * Modes: 'search' | 'research' | 'chat'
 */

import Storage from './storage.js';

const LABELS = {
  search:   'Search',
  research: 'Deep research',
  chat:     'Search Off',   // no web + no research — the "off" state, never "Chat"
};

// Trigger icons per mode (the magnifier for search/chat, the research glyph for
// deep research) — keeps the single Perplexity-style control self-describing.
const ICONS = {
  search:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  chat:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  research: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
};

function _el(id) { return document.getElementById(id); }

/** Derive mode from the two hidden checkboxes */
function getMode() {
  const webChk = _el('web-toggle');
  const resChk = _el('research-toggle');
  if (resChk && resChk.checked) return 'research';
  if (webChk && webChk.checked) return 'search';
  return 'chat';
}

/**
 * Update the dropdown label + checkmarks to reflect `mode`.
 * Does NOT touch checkboxes or pills — call this after syncing those.
 */
function _updateDropdownUI(mode) {
  const label = _el('search-mode-label');
  if (label) label.textContent = LABELS[mode] || LABELS.chat;

  const icon = _el('search-mode-icon');
  if (icon) icon.innerHTML = ICONS[mode] || ICONS.chat;

  document.querySelectorAll('.search-mode-item').forEach(item => {
    item.classList.toggle('checked', item.dataset.mode === mode);
  });

  const btn = _el('search-mode-btn');
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    // "on" pill state when a mode is active (Search / Deep research), like the
    // other toolbar tool pills — plain Chat shows the muted/off look.
    btn.classList.toggle('active', mode !== 'chat');
  }
}

/**
 * Sync the visible web-toggle-btn pill state.
 * Mirrors what setupToggle / app.js does when the checkbox changes.
 */
function _syncWebBtn(active) {
  const btn = _el('web-toggle-btn');
  if (!btn) return;
  btn.classList.toggle('active', active);
  btn.setAttribute('aria-pressed', String(active));
}

/**
 * Set the search mode.
 * mode ∈ 'search' | 'research' | 'chat'
 * Re-clicking the already-active mode clears to 'chat'.
 */
function setMode(mode) {
  const current = getMode();
  // Re-clicking active item clears to 'chat'
  if (mode === current && mode !== 'chat') mode = 'chat';

  const webChk = _el('web-toggle');
  const resChk = _el('research-toggle');

  if (mode === 'search') {
    if (webChk) webChk.checked = true;
    if (resChk) resChk.checked = false;
    Storage.setToggle('web', true);
    Storage.setToggle('research', false);
    _syncWebBtn(true);
    if (window._syncResearchIndicator) window._syncResearchIndicator(false);
  } else if (mode === 'research') {
    if (webChk) webChk.checked = false;
    if (resChk) resChk.checked = true;
    Storage.setToggle('web', false);
    Storage.setToggle('research', true);
    _syncWebBtn(false);
    if (window._syncResearchIndicator) window._syncResearchIndicator(true);
  } else {
    // 'chat' — both off
    if (webChk) webChk.checked = false;
    if (resChk) resChk.checked = false;
    Storage.setToggle('web', false);
    Storage.setToggle('research', false);
    _syncWebBtn(false);
    if (window._syncResearchIndicator) window._syncResearchIndicator(false);
  }

  _updateDropdownUI(mode);
}

// The menu is portaled to <body> while open. .chat-input-left clips overflow
// and .chat-input-bar (container-type: inline-size) traps fixed descendants, so
// an in-place menu is clipped/hidden. Mirrors the overflow-menu portal in app.js.
let _menuOwner = null; // original parent, to restore on close

/** Pin the menu's bottom 8px above the search-mode button (viewport-relative). */
function _positionMenu() {
  const menu = _el('search-mode-menu');
  const btn  = _el('search-mode-btn');
  if (!menu || !btn) return;
  const r = btn.getBoundingClientRect();
  const h = menu.scrollHeight;
  menu.style.left = r.left + 'px';
  menu.style.right = 'auto';
  menu.style.top = (r.top - 8 - h) + 'px';
}

/** Open or close the dropdown menu */
function _toggleMenu(open) {
  const menu = _el('search-mode-menu');
  const btn  = _el('search-mode-btn');
  if (!menu) return;
  if (open === undefined) open = menu.classList.contains('hidden');

  if (open) {
    if (!_menuOwner) _menuOwner = menu.parentElement;
    document.body.appendChild(menu);   // portal out of the clipped composer
    menu.classList.remove('hidden');
    _positionMenu();
  } else {
    menu.classList.add('hidden');
    if (_menuOwner) { _menuOwner.appendChild(menu); _menuOwner = null; }
  }
  if (btn) btn.setAttribute('aria-expanded', String(open));
}

/** Wire up all DOM event listeners and restore persisted state */
function init() {
  const btn  = _el('search-mode-btn');
  const menu = _el('search-mode-menu');
  if (!btn || !menu) return;

  // Caret button: toggle open/close
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    _toggleMenu(menu.classList.contains('hidden'));
  });

  // Item clicks
  menu.querySelectorAll('.search-mode-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      setMode(item.dataset.mode);
      _toggleMenu(false);
    });
  });

  // Outside-click: close
  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('hidden') &&
        !menu.contains(e.target) &&
        e.target !== btn &&
        !e.target.closest('.search-mode-wrap')) {
      _toggleMenu(false);
    }
  });

  // Escape: close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.classList.contains('hidden')) {
      _toggleMenu(false);
    }
  });

  // Reflect persisted state on load
  const mode = getMode();
  _updateDropdownUI(mode);
}

/** Re-sync the dropdown label/icon/checkmarks from the current checkbox state. */
function refresh() { _updateDropdownUI(getMode()); }

const searchMode = { setMode, getMode, init, refresh };
window.searchMode = searchMode;

export default searchMode;
