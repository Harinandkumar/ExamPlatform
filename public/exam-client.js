let secondsLeft, timer, warnings = 0, manualSubmitting = false;

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


function renderQuestions() {
  const qDiv = document.getElementById("questions");
  qDiv.innerHTML = "";
  questions.forEach((q, i) => {
    const div = document.createElement("div");
    div.className = "question";
    div.innerHTML = `
      <p><b>Q${i + 1}.</b></p>
      <pre><code class="language-c">${escapeHTML(q.text)}</code></pre>
    ` +
      q.choices.map((c, ci) =>
        `<label><input type='radio' name='q${i}' value='${ci}'> ${c}</label><br>`
      ).join("");
    qDiv.appendChild(div);
  });
  // 👇 Highlight all newly added code blocks
  hljs.highlightAll();
}


function updateTimer() {
  const t = document.getElementById("timeLeft");
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  t.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
}

function startTimer() {
  secondsLeft = exam.duration * 60;
  updateTimer();
  timer = setInterval(() => {
    secondsLeft--;
    updateTimer();
    if (secondsLeft <= 0) submitExam("Time up");
  }, 1000);
}

function collectAnswers() {
  return questions.map((_, i) => {
    const el = document.querySelector(`input[name=q${i}]:checked`);
    return el ? parseInt(el.value) : null;
  });
}

async function submitExam(reason) {
  manualSubmitting = true; // prevent false warnings
  clearInterval(timer);

  const body = new URLSearchParams({
    name: document.getElementById("name").value,
    roll: document.getElementById("roll").value,
    answersJson: JSON.stringify(collectAnswers())
  });

  const r = await fetch(location.pathname + "/submit", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
    body
  });

  const d = await r.json();
  if (d.ok) {
    window.location.href = d.redirect; // redirect to thank you page
  } else {
    alert("Submission failed! Please try again.");
  }
}

function warn() {
  if (manualSubmitting) return;
  warnings++;
  document.getElementById("warnings").textContent = warnings;
  if (warnings >= 3) submitExam("Too many warnings");
  else alert(`Warning ${warnings}/3: Stay in fullscreen`);
}

function startExam() {
  document.getElementById("startForm").style.display = "none";
  document.getElementById("examContainer").style.display = "block";
  renderQuestions();
  startTimer();
  document.documentElement.requestFullscreen();
}

const themeLink = document.getElementById("hljs-theme");
const themeBtn = document.getElementById("themeBtn");
const themePopup = document.getElementById("themePopup");
const themeButtons = document.querySelectorAll(".theme-btn");

// Load saved theme
const savedTheme = localStorage.getItem("hljs-theme");
if(savedTheme) themeLink.href = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${savedTheme}.min.css`;

// Toggle popup on main button click
themeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  themePopup.classList.toggle("hidden");
});

// Change theme on button click
themeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const theme = btn.dataset.theme;
    themeLink.href = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/${theme}.min.css`;
    localStorage.setItem("hljs-theme", theme);
    hljs.highlightAll();
    themePopup.classList.add("hidden"); // close popup
  });
});

// Close popup if clicked outside
document.body.addEventListener("click", () => {
  themePopup.classList.add("hidden");
});



document.getElementById("startForm").onsubmit = e => {
  e.preventDefault();
  startExam();
};

document.addEventListener("visibilitychange", () => {
  if (!manualSubmitting && document.hidden) warn();
});

document.addEventListener("fullscreenchange", () => {
  if (!manualSubmitting && !document.fullscreenElement) warn();
});

document.getElementById("submitBtn").onclick = () => {
  manualSubmitting = true;
  submitExam("Manual submit");
};
