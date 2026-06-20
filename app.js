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

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function getInitialTiles() {
  const groupTiles = GROUPS.flatMap((group) =>
    group.items.map((item) => ({ ...item, groupId: group.id })),
  );
  return shuffle([...groupTiles, { ...YES_TILE, groupId: "answer" }]);
}

function resetGame() {
  state = {
    tiles: getInitialTiles(),
    selected: new Set(),
    solvedIds: ["likes", "thinks", "why"],
    mistakesRemaining: MAX_MISTAKES,
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
}

function render() {
  renderSolvedGroups();
  renderTiles();
  renderMistakes();
  updateControls();
}

function renderSolvedGroups() {
  elements.solved.innerHTML = state.solvedIds
    .map((groupId) => {
      const group = GROUPS.find((candidate) => candidate.id === groupId);
      const labels = group.items.map((item) => item.label).join(", ");
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

  const remainingTiles = state.tiles.filter((tile) => !solvedItemIds.has(tile.id));

  elements.grid.innerHTML = remainingTiles
    .map((tile) => {
      const selected = state.selected.has(tile.id);
      return `
        <button
          class="tile${selected ? " is-selected" : ""}"
          type="button"
          data-tile-id="${tile.id}"
          aria-pressed="${selected}"
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
  return state.solvedIds.length === 3 ? 3 : 4;
}

function updateControls() {
  const solved = state.solvedIds.length === GROUPS.length;
  const required = requiredSelectionCount();
  elements.submit.disabled = solved || state.selected.size !== required;
  elements.deselect.disabled = solved || state.selected.size === 0;
  elements.shuffle.disabled = solved;
}

function toggleTile(tileId) {
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
  const selectedIds = [...state.selected];
  const expectedCount = requiredSelectionCount();

  if (selectedIds.length !== expectedCount) {
    showToast(`Choose ${expectedCount} items.`);
    return;
  }

  const match = GROUPS.find((group) => {
    if (state.solvedIds.includes(group.id)) return false;
    const groupIds = new Set(group.items.map((item) => item.id));
    return selectedIds.length === group.items.length && selectedIds.every((id) => groupIds.has(id));
  });

  if (match && (match.id !== "question" || state.solvedIds.length === 3)) {
    solveGroup(match);
    return;
  }

  registerMistake(selectedIds);
}

function solveGroup(group) {
  state.solvedIds.push(group.id);
  state.selected.clear();
  announce(`${group.title}: ${group.items.map((item) => item.label).join(", ")}`);
  render();

  if (group.id === "question") {
    window.setTimeout(revealYes, 460);
  }
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

function revealYes() {
  elements.grid.hidden = true;
  elements.questionStage.hidden = false;
  elements.yesButton.focus();
  announce("Only one answer remains: Yes.");
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
  state.selected.clear();
  renderTiles();
  updateControls();
});

elements.submit.addEventListener("click", submitSelection);
elements.yesButton.addEventListener("click", celebrate);
elements.restart.addEventListener("click", resetGame);
elements.playAgain.addEventListener("click", resetGame);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (!elements.celebration.hidden || !elements.gameOver.hidden) resetGame();
  }
});

resetGame();
