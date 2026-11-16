/*
  FridgeIQ behaviour
  ------------------
  This file controls what happens when you TAP things.

  1. Showing the right screen
     Every link in the app points to an address like "#fridge" or "#recipe".
     When the address changes, we hide all screens and show the one whose
     id matches. The bottom bar highlights the matching tab.

  2. "Coming soon" messages
     Buttons that don't have a screen yet show a short pop-up message.
*/

const DEFAULT_SCREEN = "home";

function showScreen() {
  const wanted = location.hash.replace("#", "") || DEFAULT_SCREEN;
  const screen = document.getElementById(wanted) || document.getElementById(DEFAULT_SCREEN);

  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s === screen));

  // Highlight the bottom-bar tab this screen belongs to
  const tab = screen.dataset.tab;
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.tab === tab;
    t.classList.toggle("is-active", active);
    if (active) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });

  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", showScreen);
showScreen();

/* ---------- "Coming soon" pop-up ---------- */
const toast = document.getElementById("toast");
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

// Buttons marked with data-coming-soon="Feature name"
document.querySelectorAll("button[data-coming-soon]").forEach((button) => {
  button.addEventListener("click", () => showToast(`${button.dataset.comingSoon} is coming soon`));
});

// Search boxes: show the message when you press Enter
document.querySelectorAll("input[data-coming-soon]").forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      showToast(`${input.dataset.comingSoon} is coming soon`);
    }
  });
});

// Filter buttons: highlight the one you tap (filtering itself comes later)
document.querySelectorAll(".chips").forEach((group) => {
  group.addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    group.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-selected", c === chip));
  });
});

// "+ Add to My Fridge": saving comes later, so show a message instead
document.getElementById("add-food-form").addEventListener("submit", (event) => {
  event.preventDefault();
  showToast("Saving food is coming soon");
});
