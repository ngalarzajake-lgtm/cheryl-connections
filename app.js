const GROUPS = [
  {
    id: "likes",
    title: "What Cheryl likes",
    color: "var(--yellow)",
    items: [
      { id: "likes-flowers", label: "Flowers" },
      { id: "likes-letters", label: "Letters" },
      { id: "likes-activities", label: "Activities" },
      { id: "likes-quality-time", label: "Quality Time" },
    ],
  },
  {
    id: "thinks",
    title: "What I think of Cheryl",
    color: "var(--green)",
    items: [
      { id: "thinks-pretty", label: "Pretty" },
      { id: "thinks-smart", label: "Smart" },
      { id: "thinks-kind", label: "Kind" },
      { id: "thinks-caring", label: "Caring" },
    ],
  },
  {
    id: "why",
    title: "Why Cheryl should go with Jake",
    color: "var(--blue)",
    items: [
      { id: "why-handsome", label: "Handsome" },
      { id: "why-smart", label: "Smart" },
      { id: "why-cares", label: "Cares for Her" },
      { id: "why-likes", label: "Likes Her" },
    ],
  },
  {
    id: "question",
    title: "The big question",
    color: "var(--purple)",
    items: [
      { id: "question-will", label: "Will You" },
      { id: "question-be", label: "Be My" },
      { id: "question-girlfriend", label: "Girlfriend" },
    ],
  },
];

const YES_TILE = { id: "yes", label: "Yes" };
const MAX_MISTAKES = 4;
const AUTO_SOLVE_GROUP_IDS = ["likes", "thinks", "why"];
const QUESTION_SEQUENCE_IDS = ["question-will", "question-be", "question-girlfriend"];
const AUTO_INITIAL_DELAY = 650;
const AUTO_CLICK_DELAY = 430;
const AUTO_SUBMIT_DELAY = 520;
const AUTO_GROUP_PAUSE = 850;
const AUTO_FINAL_PROMPT_DELAY = 360;

const elements = {
  grid: document.querySelector("#tile-grid"),
  solved: document.querySelector("#solved-groups"),
  questionStage: document.querySelector("#question-stage"),
  yesButton: document.querySelector("#yes-button"),
  mistakes: document.querySelector("#mistake-dots"),
  shuffle: document.querySelector("#shuffle-button"),
  deselect: document.querySelector("#deselect-button"),
  submit: document.querySelector("#submit-button"),
  live: document.querySelector("#live-region"),
  toast: document.querySelector("#toast"),
  gameOver: document.querySelector("#game-over"),
  restart: document.querySelector("#restart-button"),
  celebration: document.querySelector("#celebration"),
  heartField: document.querySelector("#heart-field"),
  playAgain: document.querySelector("#play-again-button"),
};

let state;
let toastTimer;
let autoTimers = [];
let autoRunId = 0;

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function getGroup(groupId) {
  return GROUPS.find((candidate) => candidate.id === groupId);
}

function getTileById(tileId) {
  return state.tiles.find((tile) => tile.id === tileId);
}

function getInitialTiles() {
  const autoSolvedTiles = AUTO_SOLVE_GROUP_IDS.flatMap((groupId) =>
    getGroup(groupId).items.map((item) => ({ ...item, groupId })),
  );

  const questionTiles = QUESTION_SEQUENCE_IDS.map((tileId) => {
    const item = getGroup("question").items.find((candidate) => candidate.id === tileId);
    return { ...item, groupId: "question" };
  });

  return [...shuffle(autoSolvedTiles), ...questionTiles, { ...YES_TILE, groupId: "question" }];
}

function resetGame() {
  stopAutoPlay();

  state = {
    tiles: getInitialTiles(),
    selected: new Set(),
    lockedSelected: new Set(),
    solvedIds: [],
    mistakesRemaining: MAX_MISTAKES,
    isAutoPlaying: true,
    autoClickedId: null,
  };

  elements.gameOver.hidden = true;
  elements.celebration.hidden = true;
  elements.questionStage.hidden = true;
  elements.grid.hidden = false;
  elements.shuffle.hidden = false;
  elements.deselect.hidden = false;
  elements.submit.hidden = false;
  elements.mistakes.closest(".mistakes").hidden = false;
  render();
  startAutoPlay();
}

function render() {
  renderSolvedGroups();
  renderTiles();
  renderMistakes();
  updateControls();
}

function groupDisplayLabels(group) {
  const labels = group.items.map((item) => item.label);
  return group.id === "question" ? [...labels, YES_TILE.label] : labels;
}

function renderSolvedGroups() {
  elements.solved.innerHTML = state.solvedIds
    .map((groupId) => {
      const group = getGroup(groupId);
      const labels = groupDisplayLabels(group).join(", ");
      return `
        <article class="solved-group paper-texture" style="--group-color: ${group.color}">
          <h2>${group.title}</h2>
          <p>${labels}</p>
        </article>
      `;
    })
    .join("");
}

function renderTiles() {
  const solvedItemIds = new Set(
    GROUPS.filter((group) => state.solvedIds.includes(group.id)).flatMap((group) =>
      group.items.map((item) => item.id),
    ),
  );

  if (state.solvedIds.includes("question")) solvedItemIds.add(YES_TILE.id);

  const remainingTiles = state.tiles.filter((tile) => !solvedItemIds.has(tile.id));

  elements.grid.innerHTML = remainingTiles
    .map((tile) => {
      const selected = state.selected.has(tile.id);
      const locked = state.lockedSelected.has(tile.id);
      const autoClicked = state.autoClickedId === tile.id;
      const disabled = locked || state.isAutoPlaying;
      return `
        <button
          class="tile${selected ? " is-selected" : ""}${locked ? " is-locked" : ""}${autoClicked ? " is-auto-clicked" : ""}"
          type="button"
          data-tile-id="${tile.id}"
          aria-pressed="${selected}"
          ${disabled ? "disabled" : ""}
        >${tile.label}</button>
      `;
    })
    .join("");

  elements.grid.querySelectorAll(".tile").forEach((button) => {
    button.addEventListener("click", () => toggleTile(button.dataset.tileId));
  });
}

function renderMistakes() {
  elements.mistakes.innerHTML = Array.from({ length: MAX_MISTAKES }, (_, index) => {
    const isUsed = index >= state.mistakesRemaining;
    return `<span class="mistake-dot${isUsed ? " is-used" : ""}"></span>`;
  }).join("");
}

function requiredSelectionCount() {
  return 4;
}

function updateControls() {
  const solved = state.solvedIds.length === GROUPS.length;
  const required = requiredSelectionCount();
  const hasRemovableSelection = [...state.selected].some((id) => !state.lockedSelected.has(id));
  const lockedByAuto = state.isAutoPlaying;

  elements.submit.disabled = lockedByAuto || solved || state.selected.size !== required;
  elements.deselect.disabled = lockedByAuto || solved || !hasRemovableSelection;
  elements.shuffle.disabled = lockedByAuto || solved || state.solvedIds.length >= 3;
  elements.grid.setAttribute("aria-busy", state.isAutoPlaying ? "true" : "false");

  elements.shuffle.hidden = solved;
  elements.deselect.hidden = solved;
  elements.submit.hidden = solved;
  elements.mistakes.closest(".mistakes").hidden = solved;
}

function toggleTile(tileId) {
  if (state.isAutoPlaying || state.lockedSelected.has(tileId)) return;

  const required = requiredSelectionCount();

  if (state.selected.has(tileId)) {
    state.selected.delete(tileId);
  } else if (state.selected.size < required) {
    state.selected.add(tileId);
  } else {
    showToast(`Choose ${required} items.`);
    return;
  }

  renderTiles();
  updateControls();
}

function submitSelection() {
  if (state.isAutoPlaying) return;

  const selectedIds = [...state.selected];
  const expectedCount = requiredSelectionCount();

  if (selectedIds.length !== expectedCount) {
    showToast(`Choose ${expectedCount} items.`);
    return;
  }

  const finalIds = new Set([...QUESTION_SEQUENCE_IDS, YES_TILE.id]);
  const isFinalAnswer =
    state.solvedIds.length === AUTO_SOLVE_GROUP_IDS.length &&
    selectedIds.length === finalIds.size &&
    selectedIds.every((id) => finalIds.has(id));

  if (isFinalAnswer) {
    solveFinalQuestion();
    return;
  }

  const match = GROUPS.find((group) => {
    if (state.solvedIds.includes(group.id) || group.id === "question") return false;
    const groupIds = new Set(group.items.map((item) => item.id));
    return selectedIds.length === group.items.length && selectedIds.every((id) => groupIds.has(id));
  });

  if (match) {
    solveGroup(match);
    return;
  }

  registerMistake(selectedIds);
}

function solveGroup(group) {
  if (state.solvedIds.includes(group.id)) return;

  state.solvedIds.push(group.id);
  state.selected.clear();
  state.lockedSelected.clear();
  announce(`${group.title}: ${groupDisplayLabels(group).join(", ")}`);
  render();
}

function solveFinalQuestion() {
  if (state.solvedIds.includes("question")) return;

  const group = getGroup("question");
  state.selected.clear();
  state.lockedSelected.clear();
  state.solvedIds.push(group.id);

  announce("Will you be my girlfriend? Yes.");
  render();
  window.setTimeout(celebrate, 560);
}

function registerMistake(selectedIds) {
  const oneAway = GROUPS.some((group) => {
    if (state.solvedIds.includes(group.id)) return false;
    const groupIds = new Set(group.items.map((item) => item.id));
    return selectedIds.filter((id) => groupIds.has(id)).length === group.items.length - 1;
  });

  state.mistakesRemaining -= 1;
  elements.grid.classList.remove("is-shaking");
  void elements.grid.offsetWidth;
  elements.grid.classList.add("is-shaking");
  renderMistakes();

  if (state.mistakesRemaining === 0) {
    window.setTimeout(() => {
      elements.gameOver.hidden = false;
      elements.restart.focus();
    }, 430);
    return;
  }

  showToast(oneAway ? "One away…" : "Not quite.");
}

function startAutoPlay() {
  const runId = autoRunId;
  let delay = AUTO_INITIAL_DELAY;

  AUTO_SOLVE_GROUP_IDS.forEach((groupId) => {
    const group = getGroup(groupId);

    group.items.forEach((item) => {
      scheduleAutoStep(() => autoSelectTile(item.id, runId), delay);
      delay += AUTO_CLICK_DELAY;
    });

    scheduleAutoStep(() => autoSolveGroup(groupId, runId), delay + AUTO_SUBMIT_DELAY);
    delay += AUTO_SUBMIT_DELAY + AUTO_GROUP_PAUSE;
  });

  QUESTION_SEQUENCE_IDS.forEach((tileId) => {
    scheduleAutoStep(() => autoSelectTile(tileId, runId, { lock: true }), delay);
    delay += AUTO_CLICK_DELAY;
  });

  scheduleAutoStep(() => finishAutoPrompt(runId), delay + AUTO_FINAL_PROMPT_DELAY);
}

function scheduleAutoStep(callback, delay) {
  const timer = window.setTimeout(callback, delay);
  autoTimers.push(timer);
}

function isCurrentAutoRun(runId) {
  return state && state.isAutoPlaying && runId === autoRunId;
}

function autoSelectTile(tileId, runId, options = {}) {
  if (!isCurrentAutoRun(runId)) return;

  state.selected.add(tileId);
  if (options.lock) state.lockedSelected.add(tileId);
  state.autoClickedId = tileId;
  announce(getTileById(tileId)?.label ?? "Selected");
  renderTiles();
  updateControls();

  scheduleAutoStep(() => {
    if (!state || runId !== autoRunId) return;
    state.autoClickedId = null;
    renderTiles();
  }, 310);
}

function autoSolveGroup(groupId, runId) {
  if (!isCurrentAutoRun(runId)) return;
  solveGroup(getGroup(groupId));
}

function finishAutoPrompt(runId) {
  if (!isCurrentAutoRun(runId)) return;

  state.isAutoPlaying = false;
  state.selected = new Set(QUESTION_SEQUENCE_IDS);
  state.lockedSelected = new Set(QUESTION_SEQUENCE_IDS);
  state.autoClickedId = null;

  announce("Will you be my girlfriend? Select Yes, then Submit.");
  render();
  const yesTile = elements.grid.querySelector('[data-tile-id="yes"]');
  yesTile?.focus();
}

function stopAutoPlay() {
  autoTimers.forEach((timer) => window.clearTimeout(timer));
  autoTimers = [];
  autoRunId += 1;
}

function celebrate() {
  createHeartField();
  elements.celebration.hidden = false;
  elements.playAgain.focus();
  announce("Best connection ever. Cheryl plus Jake.");
}

function createHeartField() {
  elements.heartField.innerHTML = Array.from({ length: 22 }, (_, index) => {
    const left = 2 + ((index * 37) % 96);
    const size = 16 + ((index * 11) % 25);
    const duration = 4.6 + ((index * 7) % 24) / 10;
    const delay = -((index * 13) % 60) / 10;
    return `<span class="floating-heart" style="left:${left}%;--heart-size:${size}px;--heart-duration:${duration}s;--heart-delay:${delay}s">♥</span>`;
  }).join("");
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 1600);
  announce(message);
}

function announce(message) {
  elements.live.textContent = "";
  window.setTimeout(() => {
    elements.live.textContent = message;
  }, 20);
}

elements.shuffle.addEventListener("click", () => {
  if (state.isAutoPlaying) return;

  const solvedItemIds = new Set(
    GROUPS.filter((group) => state.solvedIds.includes(group.id)).flatMap((group) =>
      group.items.map((item) => item.id),
    ),
  );
  const solved = state.tiles.filter((tile) => solvedItemIds.has(tile.id));
  const remaining = shuffle(state.tiles.filter((tile) => !solvedItemIds.has(tile.id)));
  state.tiles = [...solved, ...remaining];
  state.selected.clear();
  renderTiles();
  updateControls();
});

elements.deselect.addEventListener("click", () => {
  if (state.isAutoPlaying) return;

  state.selected = new Set(state.lockedSelected);
  renderTiles();
  updateControls();
});

elements.submit.addEventListener("click", submitSelection);
elements.yesButton.addEventListener("click", () => toggleTile(YES_TILE.id));
elements.restart.addEventListener("click", resetGame);
elements.playAgain.addEventListener("click", resetGame);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!elements.celebration.hidden || !elements.gameOver.hidden) resetGame();
  }
});

resetGame();
