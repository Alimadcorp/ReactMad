lucide.createIcons();

const _reactions = [
  "2H2+O2:2H2O",
  "CH4+2O2:CO2+2H2O",
  "2KClO3:2KCl+3O2",
  "C3H8+5O2:3CO2+4H2O",
  "2Na+Cl2:2NaCl",
  "CaCO3:CaO+CO2",
  "2Al+3Cl2:2AlCl3",
  "Zn+2HCl:ZnCl2+H2",
  "Fe2O3+3H2:2Fe+3H2O",
  "2NH3+3CuO:3Cu+N2+3H2O",
  "4Fe+3O2:2Fe2O3",
  "2C2H6+7O2:4CO2+6H2O",
  "Ca+2H2O:Ca(OH)2+H2",
  "2AgNO3+CaCl2:2AgCl+Ca(NO3)2",
  "N2+3H2:2NH3",
];

function parseReactions(r) {
  return r.map((entry) => {
    const [lhs, rhs] = entry.split(":");
    const parseSide = (side) => {
      return side.split("+").map((comp) => {
        const match = comp.match(/^(\d*)([A-Za-z0-9()]+)$/);
        const coef = match[1] ? parseInt(match[1]) : 1;
        const formula = match[2];
        return { formula, coef };
      });
    };
    const reactantsRaw = parseSide(lhs);
    const productsRaw = parseSide(rhs);
    return {
      reactants: reactantsRaw.map((c) => c.formula),
      products: productsRaw.map((c) => c.formula),
      solution: [...reactantsRaw, ...productsRaw].map((c) => c.coef),
    };
  });
}

let reactions = parseReactions(_reactions);
let currentReaction,
  coeffs,
  timer = 0,
  interval,
  focusedIndex = -1;
const reactionDiv = document.getElementById("reaction");
const timerDiv = document.getElementById("timer");
const overlay = document.getElementById("startOverlay");

function toSubscript(text) {
  return text.replace(/(\d+)/g, "<sub>$1</sub>");
}

function loadNewReaction() {
  currentReaction = reactions[Math.floor(Math.random() * reactions.length)];
  coeffs = Array(
    currentReaction.reactants.length + currentReaction.products.length
  ).fill(1);
  renderReaction();
}

function renderReaction() {
  reactionDiv.innerHTML = "";
  const full = [...currentReaction.reactants, "→", ...currentReaction.products];

  full.forEach((item, i) => {
    if (item === "→") {
      const arrow = document.createElement("span");
      arrow.innerHTML = "→";
      arrow.className = "arrow";
      reactionDiv.appendChild(arrow);
      return;
    }

    const isReactant = i < currentReaction.reactants.length;
    const idx = isReactant ? i : i - 1;

    const compound = document.createElement("div");
    compound.className = "compound";

    const coef = document.createElement("div");
    coef.className = "coef";
    coef.textContent = coeffs[idx];
    coef.setAttribute("tabindex", "0");

    coef.onmousedown = (e) => {
      e.preventDefault();
      focusedIndex = idx;
      if (e.button === 0) coeffs[idx]++;
      else if (e.button === 2) coeffs[idx] = Math.max(1, coeffs[idx] - 1);
      renderReaction();
      checkBalance();
    };

    coef.onwheel = (e) => {
      e.preventDefault();
      focusedIndex = idx;
      if (e.deltaY < 0) coeffs[idx]++;
      else coeffs[idx] = Math.max(1, coeffs[idx] - 1);
      renderReaction();
      checkBalance();
    };

    coef.onfocus = () => (focusedIndex = idx);
    compound.appendChild(coef);

    if (coeffs[idx] > 1) {
      const minus = document.createElement("button");
      minus.className = "minus-btn";
      minus.innerHTML = "−";
      minus.onclick = (e) => {
        e.stopPropagation();
        coeffs[idx] = Math.max(1, coeffs[idx] - 1);
        renderReaction();
        checkBalance();
      };
      compound.appendChild(minus);
    }

    const formula = document.createElement("span");
    formula.innerHTML = toSubscript(item);
    formula.className = "formula";
    compound.appendChild(formula);

    reactionDiv.appendChild(compound);

    const nextIsArrow = full[i + 1] === "→";
    const shouldAddPlus =
      (isReactant && i < currentReaction.reactants.length - 1) ||
      (!isReactant && i < full.length - 1 && !nextIsArrow);

    if (shouldAddPlus) {
      const plus = document.createElement("span");
      plus.textContent = "+";
      plus.className = "plus";
      reactionDiv.appendChild(plus);
    }
  });
}

function checkBalance() {
  const correct = coeffs.every((val, i) => val === currentReaction.solution[i]);
  if (correct) {
    clearInterval(interval);
    reactionDiv.classList.add("success-animation", "balanced-reaction");
    timerDiv.textContent = `Balanced in ${timer.toFixed(2)}s`;
    timerDiv.style.background = "rgba(100, 255, 218, 0.2)";
    timerDiv.style.borderColor = "rgba(100, 255, 218, 0.5)";
    setTimeout(() => {
      overlay.innerHTML =
        '<div><i data-lucide="check-circle"></i> Next Reaction</div>';
      overlay.classList.remove("hidden");
      overlay.onclick = () => {
        overlay.classList.add("hidden");
        overlay.innerHTML =
          '<div><i data-lucide="play-circle"></i> Click to Start</div>';
        loadNewReaction();
        reactionDiv.classList.remove("success-animation", "balanced-reaction");
        timerDiv.style.background = "rgba(100, 255, 218, 0.1)";
        timerDiv.style.borderColor = "rgba(100, 255, 218, 0.3)";
        timer = 0;
        interval = setInterval(() => {
          timer += 0.01;
          timerDiv.textContent = `Time: ${timer.toFixed(2)}s`;
        }, 10);
        lucide.createIcons();
      };
      lucide.createIcons();
    }, 1500);
  }
}

function startGame() {
  overlay.classList.add("hidden");
  loadNewReaction();
  timer = 0;
  interval = setInterval(() => {
    timer += 0.01;
    timerDiv.textContent = `${timer.toFixed(2)}s`;
  }, 10);
}

document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("keydown", (e) => {
  if (focusedIndex >= 0 && /^[1-9]$/.test(e.key)) {
    coeffs[focusedIndex] = parseInt(e.key);
    renderReaction();
    checkBalance();
  }
});
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
});
