lucide.createIcons();

const _reactions = [
  "2H2+O2:2H2O",
  "N2+3H2:2NH3",
  "2Na+Cl2:2NaCl",
  "4Fe+3O2:2Fe2O3",
  "2KClO3:2KCl+3O2",
  "2Al+3Cl2:2AlCl3",
  "CH4+2O2:CO2+2H2O",
  "Zn+2HCl:ZnCl2+H2",
  "Fe2O3+3H2:2Fe+3H2O",
  "Ca+2H2O:Ca(OH)2+H2",
  "C3H8+5O2:3CO2+4H2O",
  "2C2H6+7O2:4CO2+6H2O",
  "2NH3+3CuO:3Cu+N2+3H2O",
  "Pb(NO3)2+2KI:PbI2+2KNO3",
  "C6H12O6+6O2:6CO2+6H2O",
  "2NaHCO3:Na2CO3+H2O+CO2",
  "C2H5OH+3O2:2CO2+3H2O",
  "CaCO3+2HCl:CaCl2+H2O+CO2",
  "Na2CO3+2HCl:2NaCl+H2O+CO2",
  "2AgNO3+CaCl2:2AgCl+Ca(NO3)2",
  "Al2(SO4)3+6NaOH:2Al(OH)3+3Na2SO4",
  "2C4H10+13O2:8CO2+10H2O",
];

const scoreDiv = document.getElementById("score");

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
let timeLeft = 20;
let score = parseInt(localStorage.getItem("reaction_score")) || 0;
let scoreLerp = 0;
let index = localStorage.getItem("reaction_index") || 0; //next reaction to show

function toSubscript(text) {
  return text.replace(/(\d+)/g, "<sub>$1</sub>");
}

function loadNewReaction() {
  if (index == reactions.length) {
    index--;
    localStorage.setItem("reaction_index", index);
    socket.send(
      JSON.stringify({
        type: "won",
        username: myUsername,
      })
    );
    custom_prompt(
      "Congretulationz, you won. All other online player were rickrolled. Please leave a review for the dev:",
      (i) => {
        fetch(
          "https://madlog.vercel.app/api/log>channel=reacctmadreview&text=" +
            encodeURIComponent(i)
        );
        alert("Pank you.");
        custom_prompt("Would you like to reset? Y/N", (j) => {
          if (j.toLowerCase().trim() == "y") {
            index = 0;
            localStorage.setItem("reaction_index", index);
          }
        });
      }
    );
    return;
  }
  currentReaction = reactions[index];
  coeffs = Array(
    currentReaction.reactants.length + currentReaction.products.length
  ).fill(1);
  renderReaction();
  reactionDiv.style.display = "flex";
  setBar("bar2", ((parseInt(index) + 1) / reactions.length) * 100);
}

const srdihtml = reactionDiv.innerHTML;

function renderReaction() {
  reactionDiv.innerHTML = srdihtml;
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

setInterval(() => {
  scoreLerp = Math.ceil(lerp(scoreLerp, score, 0.2));
  scoreDiv.textContent = `Score: ${scoreLerp}`;
}, 20);

function checkBalance() {
  const correct = coeffs.every((val, i) => val === currentReaction.solution[i]);
  if (correct) {
    clearInterval(interval);
    score += timeLeft * 100 + parseInt(index) * 50;
    localStorage.setItem("reaction_score", score);
    index++;
    localStorage.setItem("reaction_index", index);
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
        resetInterval();
        lucide.createIcons();
      };
      lucide.createIcons();
    }, 1500);
  }
}

function startGame() {
  overlay.classList.add("hidden");
  loadNewReaction();
  resetInterval();
}

function resetInterval() {
  timeLeft = index < 3 ? 25 : 20;
  timer = 0;
  interval = setInterval(() => {
    timeLeft -= 0.01;
    let perc = timeLeft / (index < 3 ? 25 : 20);
    setBar("bar1", perc * 100);
    if (timeLeft < 0) {
      timeLeft = 0;
      timer += 0.01;
      timerDiv.textContent = `Time Over`;
      timerDiv.style.backgroundColor = "#f009";
      setTimeout(() => {
        overlay.innerHTML =
          '<div><i data-lucide="rotate-ccw"></i> Restart</div>';
        overlay.classList.remove("hidden");
        overlay.onclick = () => {
          location.reload();
          lucide.createIcons();
        };
        lucide.createIcons();
      }, 1500);
      return;
    }
    timer += 0.01;
    timerDiv.textContent = `${timeLeft.toFixed(2)}s left`;
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

function setBar(barId, percent) {
  if (percent <= 0) return;
  document.getElementById(`${barId}-fill`).style.width = percent + "%";
}

function custom_prompt(message, callback) {
  const overlay = document.getElementById("customPromptOverlay");
  const label = document.getElementById("customPromptLabel");
  const input = document.getElementById("customPromptInput");
  const submit = document.getElementById("customPromptSubmit");

  label.textContent = message;
  input.value = "";
  overlay.classList.remove("hidden");
  input.focus();

  const handleSubmit = () => {
    if (input.value.trim().length <= 0) return;
    overlay.classList.add("hidden");
    callback(input.value);
    submit.removeEventListener("click", handleSubmit);
    input.removeEventListener("keydown", handleKeydown);
  };

  const handleKeydown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  submit.addEventListener("click", handleSubmit);
  input.addEventListener("keydown", handleKeydown);
}
