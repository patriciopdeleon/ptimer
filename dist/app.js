const DEFAULT_TIMERS = [
  { name: 'A little moment', duration: 60 },
  { name: 'Find your rhythm', duration: 180 },
  { name: 'Take your time', duration: 300 },
  { name: 'Settle in', duration: 600 },
  { name: 'Stay with it', duration: 900 },
];

const STORAGE_KEYS = {
  presets: 'ptimer-presets',
  legacyPresets: 'tap-presets',
  timerCount: 'ptimer-count',
  sound: 'ptimer-sound',
  legacySound: 'tap-sound',
};

const MAX_DURATION_SECONDS = 59_999;
const MIN_TIMER_COUNT = 1;
const MAX_TIMER_COUNT = 5;
const DEFAULT_TIMER_COUNT = 3;
const DOUBLE_TAP_DELAY_MS = 320;
const COMPLETION_DELAY_MS = 1_000;
const TICK_INTERVAL_MS = 100;

const pencilIcon = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path d="m5 19 1-4L16 5l3 3L9 18l-4 1Z" />
  </svg>`;

const checkmarkIcon = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path d="m5 12 4 4L19 6" />
  </svg>`;

const loopIcon = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11V9a3 3 0 0 1 3-3h15" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v2a3 3 0 0 1-3 3H3" />
  </svg>`;

const cascadeIcon = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path d="M12 4v16" />
    <path d="m8 11 4 4 4-4" />
  </svg>`;

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The timer still works when storage is unavailable or full.
  }
}

function readSavedPresets() {
  const stored = readStorage(STORAGE_KEYS.presets) ?? readStorage(STORAGE_KEYS.legacyPresets);
  if (!stored) return [];

  try {
    const presets = JSON.parse(stored);
    return Array.isArray(presets) ? presets : [];
  } catch {
    return [];
  }
}

function validPreset(candidate, fallback) {
  if (
    candidate &&
    typeof candidate.name === 'string' &&
    Number.isInteger(candidate.duration) &&
    candidate.duration > 0 &&
    candidate.duration <= MAX_DURATION_SECONDS
  ) {
    return {
      name: candidate.name.slice(0, 24),
      duration: candidate.duration,
      loop: candidate.loop === true,
      cascade: candidate.cascade === true,
    };
  }

  return { ...fallback, loop: false, cascade: false };
}

function readTimerCount() {
  const stored = Number(readStorage(STORAGE_KEYS.timerCount));
  return Number.isInteger(stored) && stored >= MIN_TIMER_COUNT && stored <= MAX_TIMER_COUNT
    ? stored
    : DEFAULT_TIMER_COUNT;
}

function readSoundPreference() {
  const stored = readStorage(STORAGE_KEYS.sound) ?? readStorage(STORAGE_KEYS.legacySound);
  return stored !== 'off';
}

const savedPresets = readSavedPresets();
const timers = DEFAULT_TIMERS.map((fallback, index) => {
  const preset = validPreset(savedPresets[index], fallback);
  return {
    ...preset,
    state: 'ready',
    remainingMs: preset.duration * 1_000,
    deadline: 0,
    resetTimeout: null,
  };
});

let soundEnabled = readSoundPreference();
let activeTimerCount = readTimerCount();
let audioContext = null;
let editingIndex = null;
let tickInterval = null;

const timersContainer = document.querySelector('#timers');
const soundButton = document.querySelector('#sound');
const paneCountButton = document.querySelector('#pane-count-toggle');
const paneMenu = document.querySelector('#pane-menu');
const announcements = document.querySelector('#announcements');

timersContainer.innerHTML = timers
  .map(
    (_, index) => `
      <section class="timer" data-state="ready">
        <div class="progress"></div>
        <div class="tile-top">
          <button class="edit" type="button" aria-label="Edit timer ${index + 1}">${pencilIcon}</button>
        </div>
        <button class="timer-main" type="button">
          <span class="time"></span>
        </button>
        <form class="inline-editor" hidden aria-label="Edit timer ${index + 1}">
          <div class="inline-time">
            <label class="inline-field">
              <input class="edit-minutes" aria-label="Minutes" inputmode="numeric" type="text" pattern="[0-9]{1,3}" maxlength="3" required autocomplete="off" enterkeyhint="done">
            </label>
            <span aria-hidden="true">:</span>
            <label class="inline-field">
              <input class="edit-seconds" aria-label="Seconds" inputmode="numeric" type="text" pattern="[0-9]{1,2}" maxlength="2" required autocomplete="off" enterkeyhint="done">
            </label>
          </div>
          <div class="editor-options">
            <button class="setting-toggle loop-toggle editor-control" type="button" aria-label="Loop timer" title="Loop timer">${loopIcon}</button>
            <button class="setting-toggle cascade-toggle editor-control" type="button" aria-label="Start next timer when finished" title="Cascade to next timer">${cascadeIcon}</button>
          </div>
        </form>
      </section>`,
  )
  .join('');

const timerElements = [...document.querySelectorAll('.timer')];

function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function visibleSeconds(timer) {
  return timer.state === 'ready' ? timer.duration : Math.ceil(timer.remainingMs / 1_000);
}

function renderPaneControls() {
  paneMenu.querySelectorAll('.pane-option').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.count) === activeTimerCount));
  });
  paneCountButton.setAttribute('aria-label', `${activeTimerCount} timer panes. Choose a different count.`);
}

function renderEditorControls(index) {
  const timer = timers[index];
  const element = timerElements[index];
  const loopButton = element.querySelector('.loop-toggle');
  const cascadeButton = element.querySelector('.cascade-toggle');

  loopButton.setAttribute('aria-pressed', String(timer.loop));
  cascadeButton.setAttribute('aria-pressed', String(timer.cascade));
  loopButton.setAttribute('aria-label', `${timer.loop ? 'Disable' : 'Enable'} loop for timer ${index + 1}`);
  cascadeButton.setAttribute(
    'aria-label',
    `${timer.cascade ? 'Disable' : 'Enable'} cascade from timer ${index + 1} to the next timer`,
  );
}

function renderTimer(index) {
  const timer = timers[index];
  const element = timerElements[index];
  const seconds = visibleSeconds(timer);
  const time = element.querySelector('.time');
  const mainButton = element.querySelector('.timer-main');
  const editButton = element.querySelector('.edit');
  const progress = element.querySelector('.progress');

  const actions = {
    ready: 'Tap to start',
    running: 'Tap to pause',
    paused: 'Tap to resume',
    done: 'Tap to go again',
  };

  element.dataset.state = timer.state;
  if (seconds >= 6_000) element.dataset.longTime = '';
  else delete element.dataset.longTime;
  time.textContent = formatTime(seconds);
  mainButton.setAttribute(
    'aria-label',
    `${timer.name}, ${formatTime(seconds)}. ${actions[timer.state]}. Double tap to reset.`,
  );
  editButton.setAttribute('aria-label', `${editingIndex === index ? 'Save' : 'Edit'} ${timer.name}`);

  const elapsedRatio = timer.state === 'ready'
    ? 0
    : 1 - timer.remainingMs / (timer.duration * 1_000);
  progress.style.width = `${Math.max(0, Math.min(100, elapsedRatio * 100))}%`;
  renderEditorControls(index);
}

function unlockAudio() {
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch {
    // Audio is optional and may be blocked by the browser.
  }
}

function ring() {
  if (!soundEnabled || !audioContext) return;

  try {
    [0, 0.22, 0.44].forEach((delay, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const startAt = audioContext.currentTime + delay;

      oscillator.type = 'sine';
      oscillator.frequency.value = [660, 830, 990][index];
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.22, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.6);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.65);
    });
  } catch {
    // A failed chime must not interrupt timer completion.
  }
}

function syncTicker() {
  const needsTicks = timers.some((timer) => timer.state === 'running');

  if (needsTicks && tickInterval === null) {
    tickInterval = window.setInterval(tick, TICK_INTERVAL_MS);
  } else if (!needsTicks && tickInterval !== null) {
    window.clearInterval(tickInterval);
    tickInterval = null;
  }
}

function startTimer(index, { restart = false } = {}) {
  if (index < 0 || index >= activeTimerCount) return false;
  if (editingIndex === index && !saveInlineEditor(index, { focus: false })) return false;

  const timer = timers[index];
  window.clearTimeout(timer.resetTimeout);
  timer.resetTimeout = null;
  if (restart || timer.state !== 'paused') timer.remainingMs = timer.duration * 1_000;
  timer.deadline = Date.now() + timer.remainingMs;
  timer.state = 'running';
  renderTimer(index);
  syncTicker();
  return true;
}

function finishTimer(index) {
  const timer = timers[index];
  timer.state = 'done';
  timer.remainingMs = 0;
  ring();
  renderTimer(index);
  syncTicker();
  announcements.textContent = `${timer.name} finished. Tap to start again.`;

  const nextIndex = (index + 1) % activeTimerCount;
  const cascadeRestartsSelf = timer.cascade && nextIndex === index;
  if (timer.cascade && !cascadeRestartsSelf) startTimer(nextIndex, { restart: true });

  timer.resetTimeout = window.setTimeout(() => {
    if (timer.state !== 'done') return;
    if (timer.loop || cascadeRestartsSelf) startTimer(index, { restart: true });
    else resetTimer(index);
  }, COMPLETION_DELAY_MS);
}

function tick() {
  const now = Date.now();

  timers.forEach((timer, index) => {
    if (timer.state !== 'running') return;

    timer.remainingMs = Math.max(
      0,
      Math.min(timer.duration * 1_000, timer.deadline - now),
    );
    if (timer.remainingMs === 0) finishTimer(index);
    else renderTimer(index);
  });
}

function toggleTimer(index) {
  unlockAudio();
  tick();

  const timer = timers[index];
  window.clearTimeout(timer.resetTimeout);
  timer.resetTimeout = null;

  if (timer.state === 'running') {
    timer.state = 'paused';
    renderTimer(index);
    syncTicker();
  } else {
    startTimer(index);
  }
}

function resetTimer(index) {
  const timer = timers[index];
  window.clearTimeout(timer.resetTimeout);
  timer.resetTimeout = null;
  timer.state = 'ready';
  timer.remainingMs = timer.duration * 1_000;
  renderTimer(index);
  syncTicker();
}

function saveSettings() {
  const presets = timers.map(({ name, duration, loop, cascade }) => ({
    name,
    duration,
    loop,
    cascade,
  }));
  writeStorage(STORAGE_KEYS.presets, JSON.stringify(presets));
  writeStorage(STORAGE_KEYS.timerCount, String(activeTimerCount));
}

function setActiveTimerCount(count) {
  if (!Number.isInteger(count) || count < MIN_TIMER_COUNT || count > MAX_TIMER_COUNT) return;

  const previousEditingIndex = editingIndex;
  const editorWillBeHidden = previousEditingIndex !== null && previousEditingIndex >= count;
  if (editorWillBeHidden && !applyInlineEditor(previousEditingIndex)) return false;
  if (editorWillBeHidden) closeInlineEditor(previousEditingIndex);

  activeTimerCount = count;
  timersContainer.style.setProperty('--timer-count', String(count));
  timersContainer.dataset.count = String(count);

  timerElements.forEach((element, index) => {
    element.hidden = index >= count;
    if (element.hidden) resetTimer(index);
    else renderTimer(index);
  });

  renderPaneControls();
  saveSettings();
  if (editorWillBeHidden) openInlineEditor(count - 1);
  return true;
}

function closeInlineEditor(index) {
  const element = timerElements[index];
  editingIndex = null;
  delete element.dataset.editing;
  element.querySelector('.inline-editor').hidden = true;
  element.querySelector('.timer-main').hidden = false;
  element.querySelector('.edit').innerHTML = pencilIcon;
  renderTimer(index);
}

function applyInlineEditor(index) {
  const element = timerElements[index];
  const form = element.querySelector('.inline-editor');
  const minutesInput = element.querySelector('.edit-minutes');
  const secondsInput = element.querySelector('.edit-seconds');
  const minutes = Number(minutesInput.value);
  const seconds = Number(secondsInput.value);

  minutesInput.setCustomValidity('');
  secondsInput.setCustomValidity('');

  if (!/^[0-9]{1,3}$/.test(minutesInput.value)) {
    minutesInput.setCustomValidity('Enter minutes from 0 to 999.');
  }
  if (!/^[0-9]{1,2}$/.test(secondsInput.value) || seconds > 59) {
    secondsInput.setCustomValidity('Enter seconds from 0 to 59.');
  }
  if (minutes === 0 && seconds === 0) {
    secondsInput.setCustomValidity('Choose a duration of at least one second.');
  }
  if (!form.reportValidity()) return false;

  timers[index].duration = minutes * 60 + seconds;
  resetTimer(index);
  saveSettings();
  return true;
}

function saveInlineEditor(index, { focus = true } = {}) {
  const element = timerElements[index];
  if (!applyInlineEditor(index)) return false;

  closeInlineEditor(index);
  if (focus) element.querySelector('.edit').focus();
  return true;
}

function selectInputValue(input) {
  input.select();
  window.requestAnimationFrame(() => input.select());
}

function openInlineEditor(index) {
  if (editingIndex !== null && !saveInlineEditor(editingIndex)) return;

  tick();
  const timer = timers[index];
  const element = timerElements[index];

  if (timer.state === 'running') timer.state = 'paused';
  window.clearTimeout(timer.resetTimeout);
  timer.resetTimeout = null;
  editingIndex = index;
  element.dataset.editing = 'true';
  element.querySelector('.timer-main').hidden = true;
  element.querySelector('.inline-editor').hidden = false;
  element.querySelector('.edit').innerHTML = checkmarkIcon;

  const minutesInput = element.querySelector('.edit-minutes');
  const secondsInput = element.querySelector('.edit-seconds');
  minutesInput.value = String(Math.floor(timer.duration / 60));
  secondsInput.value = String(timer.duration % 60).padStart(2, '0');

  [minutesInput, secondsInput].forEach((input) => {
    input.setCustomValidity('');
    input.style.width = `${Math.max(1, input.value.length)}ch`;
  });

  renderTimer(index);
  syncTicker();
  minutesInput.focus();
  selectInputValue(minutesInput);
}

timerElements.forEach((element, index) => {
  let lastTapAt = -Infinity;
  const mainButton = element.querySelector('.timer-main');
  const editButton = element.querySelector('.edit');
  const editor = element.querySelector('.inline-editor');
  const editorInputs = element.querySelectorAll('.inline-editor input');
  const loopButton = element.querySelector('.loop-toggle');
  const cascadeButton = element.querySelector('.cascade-toggle');

  mainButton.addEventListener('click', (event) => {
    const now = performance.now();
    if (event.detail !== 0 && now - lastTapAt < DOUBLE_TAP_DELAY_MS) {
      resetTimer(index);
      lastTapAt = -Infinity;
    } else {
      toggleTimer(index);
      lastTapAt = event.detail === 0 ? -Infinity : now;
    }
  });

  editButton.addEventListener('click', () => {
    lastTapAt = -Infinity;
    if (editingIndex === index) saveInlineEditor(index);
    else openInlineEditor(index);
  });

  editor.addEventListener('submit', (event) => {
    event.preventDefault();
    saveInlineEditor(index);
  });

  loopButton.addEventListener('click', () => {
    timers[index].loop = !timers[index].loop;
    renderEditorControls(index);
    saveSettings();
  });

  cascadeButton.addEventListener('click', () => {
    timers[index].cascade = !timers[index].cascade;
    renderEditorControls(index);
    saveSettings();
  });

  editorInputs.forEach((input) => {
    input.addEventListener('focus', () => selectInputValue(input));
    input.addEventListener('input', () => {
      editorInputs.forEach((field) => field.setCustomValidity(''));
      input.style.width = `${Math.max(1, input.value.length)}ch`;
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeInlineEditor(index);
        if (timers[index].state === 'done') resetTimer(index);
        editButton.focus();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        saveInlineEditor(index);
      }
    });
  });

  renderTimer(index);
});

setActiveTimerCount(activeTimerCount);

function setPaneMenuOpen(open) {
  paneMenu.hidden = !open;
  paneCountButton.setAttribute('aria-expanded', String(open));
}

paneCountButton.addEventListener('click', () => {
  setPaneMenuOpen(paneMenu.hidden);
});

paneMenu.addEventListener('click', (event) => {
  const option = event.target instanceof Element ? event.target.closest('.pane-option') : null;
  if (!option) return;

  const count = Number(option.dataset.count);
  if (count !== activeTimerCount && !setActiveTimerCount(count)) return;
  setPaneMenuOpen(false);
  paneCountButton.focus();
});

document.addEventListener('click', (event) => {
  if (
    !paneMenu.hidden &&
    event.target instanceof Element &&
    !event.target.closest('.pane-picker')
  ) {
    setPaneMenuOpen(false);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !paneMenu.hidden) {
    event.preventDefault();
    setPaneMenuOpen(false);
    paneCountButton.focus();
  }
});

// A tap on the edited pane commits its value. Controls on other panes keep
// working without closing the editor.
function isEditedPaneBackground(target) {
  return (
    editingIndex !== null &&
    target instanceof Element &&
    timerElements[editingIndex].contains(target) &&
    !target.closest('.inline-field, .editor-control')
  );
}

function commitEditedPaneTap(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  saveInlineEditor(editingIndex);
}

document.addEventListener(
  'click',
  (event) => {
    if (isEditedPaneBackground(event.target)) commitEditedPaneTap(event);
  },
  true,
);

// iOS does not always synthesize a click on blank form areas, so complete a
// short touch directly and suppress the later synthetic click.
let editTouchStart = null;
document.addEventListener(
  'touchstart',
  (event) => {
    editTouchStart = event.touches.length === 1
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : null;
  },
  { capture: true, passive: true },
);
document.addEventListener(
  'touchend',
  (event) => {
    const start = editTouchStart;
    editTouchStart = null;
    if (!start || event.changedTouches.length !== 1 || !isEditedPaneBackground(event.target)) return;

    const touch = event.changedTouches[0];
    if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 12) return;
    commitEditedPaneTap(event);
  },
  { capture: true, passive: false },
);
document.addEventListener('touchcancel', () => {
  editTouchStart = null;
}, { passive: true });

function updateSoundButton() {
  soundButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
      <path d="M12 5 7 9H4v6h3l5 4Z" />
      ${
        soundEnabled
          ? '<path d="M17 9a5 5 0 0 1 0 6" />'
          : '<path d="m17 10 4 4m0-4-4 4" />'
      }
    </svg>`;
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  soundButton.setAttribute('aria-label', `Sound ${soundEnabled ? 'on' : 'off'}`);
}

soundButton.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  unlockAudio();
  updateSoundButton();
  writeStorage(STORAGE_KEYS.sound, soundEnabled ? 'on' : 'off');
});
updateSoundButton();

document.addEventListener('keydown', (event) => {
  if (
    editingIndex !== null ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)
  ) {
    return;
  }

  if (/^[1-5]$/.test(event.key) && Number(event.key) <= activeTimerCount) {
    event.preventDefault();
    toggleTimer(Number(event.key) - 1);
  }
});

document.addEventListener('visibilitychange', tick);

if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: 'control_timer',
        description: 'Start, pause, resume or reset one of the visible repeat timers.',
        inputSchema: {
          type: 'object',
          properties: {
            timer: { type: 'integer', minimum: 1, maximum: 5 },
            action: { type: 'string', enum: ['start', 'pause', 'resume', 'reset'] },
          },
          required: ['timer', 'action'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: ({ timer, action }) => {
          if (
            !Number.isInteger(timer) ||
            timer < 1 ||
            timer > activeTimerCount ||
            !['start', 'pause', 'resume', 'reset'].includes(action)
          ) {
            throw new Error('Invalid timer or action');
          }

          const index = timer - 1;
          const selected = timers[index];
          if (editingIndex === index) throw new Error('Finish editing this timer first');

          tick();
          if (action === 'reset') resetTimer(index);
          else if (action === 'start') {
            startTimer(index, { restart: true });
          } else if (
            (action === 'pause' && selected.state === 'running') ||
            (action === 'resume' && selected.state === 'paused')
          ) {
            toggleTimer(index);
          } else {
            throw new Error('Action does not match timer state');
          }

          return {
            timer,
            state: selected.state,
            remainingSeconds: Math.ceil(selected.remainingMs / 1_000),
          };
        },
      }),
    ).catch(() => {});
  } catch {
    // WebMCP is optional and unavailable in most browsers.
  }
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch((error) => console.warn('Offline setup failed:', error));
  });
}

// Touch taps should not leave keyboard focus outlines behind.
document.addEventListener(
  'pointerdown',
  (event) => {
    if (event.pointerType === 'touch') document.documentElement.setAttribute('data-touch-input', '');
    else document.documentElement.removeAttribute('data-touch-input');
  },
  true,
);
document.addEventListener(
  'keydown',
  () => document.documentElement.removeAttribute('data-touch-input'),
  true,
);
