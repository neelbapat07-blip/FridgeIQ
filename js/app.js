/*
  FridgeIQ behaviour
  ------------------
  This file controls what happens when you TAP things, and builds the parts
  of each screen that change (lists, counts, tags).

  It is split into numbered parts:
    1. Saving & loading (everything is kept in this browser on this device)
    2. Date helpers ("Expires in 2 days")
    3. Small helpers (pictures, pop-up messages)
    4. Screen switching + the profile button on every screen
    5. Profile screen (name, colour scheme, Claude key, privacy, log out)
    6. Home screen (+ shopping list)
    7. My Fridge screen
    8. Add Food screen
    9. Recipe Finder (+ asking Claude for new recipes)
   10. Recipe Details (+ asking Claude for cooking instructions)

  The Claude parts live in js/claude.js.
*/

/* =========================================================
   1. SAVING & LOADING
   ========================================================= */
const KEYS = {
  items:    "fridgeiq.items.v1",
  profile:  "fridgeiq.profile.v1",
  shopping: "fridgeiq.shopping.v1",
  recipes:  "fridgeiq.recipes.v1",   // recipes Claude made for you
  steps:    "fridgeiq.steps.v1",     // Claude's instructions for the built-in recipes
};

function load(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    /* saving is blocked (e.g. private browsing): the app still works until you close it */
  }
}

const DEFAULT_PROFILE = { name: "", email: "", theme: "green" };

let items = load(KEYS.items, null) || makeExampleItems();
let profile = { ...DEFAULT_PROFILE, ...load(KEYS.profile, {}) };
let shoppingList = load(KEYS.shopping, []);
let myRecipes = load(KEYS.recipes, []);
let builtInSteps = load(KEYS.steps, {});

const saveItems = () => save(KEYS.items, items);
const saveProfile = () => save(KEYS.profile, profile);
const saveShopping = () => save(KEYS.shopping, shoppingList);
const saveRecipes = () => { save(KEYS.recipes, myRecipes); save(KEYS.steps, builtInSteps); };

function makeExampleItems() {
  return EXAMPLE_ITEMS.map((example, index) => ({
    id: "example-" + index,
    name: example.name,
    category: example.category,
    storage: example.storage,
    quantity: null,
    unit: "",
    expires: dateFromToday(example.daysLeft),
    added: Date.now() - index * 1000,
  }));
}

function newId(prefix) {
  return (prefix || "item") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

/* All recipes: Claude's newest first, then the built-in ones */
function allRecipes() {
  return [...myRecipes, ...RECIPES.map((r) => ({ ...r, steps: builtInSteps[r.id] || r.steps || [] }))];
}

/* =========================================================
   2. DATE HELPERS
   ========================================================= */
function toDateText(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateText(date);
}

/* How many days until a date: 0 = today, 1 = tomorrow, -1 = yesterday, null = no date */
function daysUntil(dateText) {
  if (!dateText) return null;
  const [y, m, d] = dateText.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

/* Food that expires within this many days "needs your attention" */
const SOON_DAYS = 3;

function needsAttention(item) {
  const days = daysUntil(item.expires);
  return days !== null && days <= SOON_DAYS;
}

function expiryText(item) {
  const days = daysUntil(item.expires);
  if (days === null) return "No expiration date";
  if (days < -1) return `Expired ${-days} days ago`;
  if (days === -1) return "Expired yesterday";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

function statusTag(item) {
  const days = daysUntil(item.expires);
  if (days === null) return { text: "No date", style: "tag--none" };
  if (days < 0) return { text: "Expired", style: "tag--expired" };
  if (days === 0) return { text: "Today", style: "tag--soon" };
  if (days <= SOON_DAYS) return { text: days === 1 ? "1 day left" : `${days} days left`, style: "tag--soon" };
  return { text: "Fresh", style: "tag--fresh" };
}

/* =========================================================
   3. SMALL HELPERS
   ========================================================= */

/* Makes text safe to put inside the page (so a food called "<b>" can't break it) */
function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function findCatalogFood(name) {
  const wanted = String(name).trim().toLowerCase();
  return FOOD_CATALOG.find((food) => food.name.toLowerCase() === wanted);
}

const CATEGORY_EMOJI = {
  "Meats": "🥩", "Seafood": "🐟", "Dairy": "🧀", "Fruits": "🍎", "Vegetables": "🥦",
  "Grains & Bread": "🍞", "Drinks": "🧃", "Sauces & Condiments": "🫙", "Leftovers": "🍱", "Other": "🛒",
};

function foodPicture(item, extraClass) {
  const food = findCatalogFood(item.name);
  if (food && food.photo) {
    return `<div class="photo ${extraClass}"><img src="${food.photo}" alt="${esc(item.name)}"></div>`;
  }
  const emoji = (food && food.emoji) || CATEGORY_EMOJI[item.category] || "🛒";
  return `<div class="photo photo--emoji ${extraClass}" role="img" aria-label="${esc(item.name)}">${emoji}</div>`;
}

/* A recipe's picture: its photo, or a big emoji on a coloured background */
function recipePicture(recipe, className) {
  if (recipe.photo) return `<img class="${className}" src="${recipe.photo}" alt="${esc(recipe.name)}">`;
  const emoji = esc(String(recipe.emoji || "🍽️").slice(0, 8));
  return `<div class="${className} recipe-emoji" role="img" aria-label="${esc(recipe.name)}">${emoji}</div>`;
}

/* Pop-up message at the bottom. Optionally with an "Undo" (or other) button. */
const toast = document.getElementById("toast");
const toastText = document.getElementById("toast-text");
const toastAction = document.getElementById("toast-action");
let toastTimer;
let toastCallback = null;

function showToast(message, action, actionLabel) {
  toastText.textContent = message;
  toastCallback = action || null;
  toastAction.hidden = !action;
  toastAction.textContent = actionLabel || "Undo";
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), action ? 5000 : 2600);
}

toastAction.addEventListener("click", () => {
  if (toastCallback) toastCallback();
  toastCallback = null;
  toast.classList.remove("is-visible");
});

/* Shows a Claude problem; if it's about the API key, offers a button to the Profile */
function showClaudeProblem(error) {
  const message = error instanceof ClaudeProblem ? error.message : "Something went wrong talking to Claude.";
  if (error && error.needsKey) showToast(message, () => { location.hash = "#profile/ai"; }, "Open Profile");
  else showToast(message);
}

/* =========================================================
   4. SCREEN SWITCHING
   The web address decides the screen:
     #profile              Profile (the start screen)
     #home                 Home
     #fridge/ITEM-ID       My Fridge, with one food highlighted
     #add-food             Add Food
     #recipes/broccoli     Recipe Finder, showing recipes that use broccoli
     #recipe/RECIPE-ID     Recipe Details
   ========================================================= */
const START_SCREEN = "profile";

// Put the profile button in the top-right corner of every screen
const PROFILE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1"/></svg>`;
document.querySelectorAll(".screen").forEach((screen) => {
  screen.insertAdjacentHTML("afterbegin",
    `<a class="profile-button" href="#profile" aria-label="My Profile">${PROFILE_ICON}</a>`);
});

function readAddress() {
  const [name, ...rest] = location.hash.replace("#", "").split("/");
  return { name: name || START_SCREEN, detail: decodeURIComponent(rest.join("/")) };
}

function showScreen() {
  const { name, detail } = readAddress();
  const screen = document.getElementById(name) || document.getElementById(START_SCREEN);

  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s === screen));

  const tab = screen.dataset.tab;
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.tab === tab;
    t.classList.toggle("is-active", active);
    if (active) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });
  document.querySelectorAll(".profile-button").forEach((b) => b.classList.toggle("is-active", screen.id === "profile"));

  window.scrollTo(0, 0);

  if (screen.id === "profile") renderProfile(detail);
  if (screen.id === "home") renderHome();
  if (screen.id === "fridge") renderFridge(detail);
  if (screen.id === "add-food") prepareAddFood();
  if (screen.id === "recipes") openRecipeFinder(detail);
  if (screen.id === "recipe") renderRecipe(detail);
}

window.addEventListener("hashchange", showScreen);

/* =========================================================
   5. PROFILE SCREEN
   ========================================================= */
const THEME_COLORS = { green: "#c1fbb0", peach: "#ffe4d2", lavender: "#ebe3ff", ocean: "#d6ecff" };

function applyTheme() {
  const theme = THEME_COLORS[profile.theme] ? profile.theme : "green";
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').setAttribute("content", THEME_COLORS[theme]);
}

function firstName() {
  return profile.name.trim().split(/\s+/)[0] || "";
}

function renderProfile(detail) {
  const name = profile.name.trim();
  document.getElementById("profile-name").textContent = name || "Your Name";
  document.getElementById("profile-email").textContent = profile.email.trim() || "Tap Edit Profile to add your details";
  document.getElementById("profile-avatar").textContent =
    name ? name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() : "?";

  document.querySelectorAll("[data-theme-choice]").forEach((tile) => {
    const selected = tile.dataset.themeChoice === profile.theme;
    tile.classList.toggle("is-selected", selected);
    tile.setAttribute("aria-pressed", selected);
  });

  const hasKey = Boolean(getClaudeKey());
  const status = document.getElementById("ai-status");
  status.textContent = hasKey ? "Connected" : "Not set up";
  status.classList.toggle("is-on", hasKey);
  document.getElementById("ai-key-input").placeholder = hasKey ? "•••••••• (saved, paste a new key to replace)" : "sk-ant-…";
  document.getElementById("ai-key-remove").hidden = !hasKey;

  if (detail === "ai") {
    document.getElementById("ai-card").scrollIntoView({ block: "center" });
    document.getElementById("ai-key-input").focus({ preventScroll: true });
  }
}

/* Edit Profile */
const profileForm = document.getElementById("profile-form");
document.getElementById("profile-edit").addEventListener("click", () => {
  document.getElementById("profile-name-input").value = profile.name;
  document.getElementById("profile-email-input").value = profile.email;
  profileForm.hidden = !profileForm.hidden;
  if (!profileForm.hidden) document.getElementById("profile-name-input").focus();
});
document.getElementById("profile-cancel").addEventListener("click", () => { profileForm.hidden = true; });
profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const emailInput = document.getElementById("profile-email-input");
  if (emailInput.value && !emailInput.checkValidity()) {
    showToast("That email address doesn't look right");
    emailInput.focus();
    return;
  }
  profile.name = document.getElementById("profile-name-input").value.trim();
  profile.email = emailInput.value.trim();
  saveProfile();
  profileForm.hidden = true;
  renderProfile();
  showToast(profile.name ? `Hi ${firstName()}! Profile saved` : "Profile saved");
});

/* Colour scheme */
document.getElementById("theme-grid").addEventListener("click", (event) => {
  const tile = event.target.closest("[data-theme-choice]");
  if (!tile) return;
  profile.theme = tile.dataset.themeChoice;
  saveProfile();
  applyTheme();
  renderProfile();
});

/* Claude API key */
document.getElementById("ai-key-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("ai-key-input");
  const key = input.value.trim();
  if (!key) { showToast("Paste your Claude API key first"); return; }
  if (!key.startsWith("sk-ant-")) { showToast("Claude API keys start with “sk-ant-”"); return; }
  setClaudeKey(key);
  input.value = "";
  renderProfile();
  showToast("Claude is connected. Try it on the Recipes screen", () => { location.hash = "#recipes"; }, "Go");
});
document.getElementById("ai-key-remove").addEventListener("click", () => {
  setClaudeKey("");
  renderProfile();
  showToast("Claude API key removed from this device");
});

/* Privacy settings */
document.getElementById("privacy-toggle").addEventListener("click", (event) => {
  const panel = document.getElementById("privacy-panel");
  panel.hidden = !panel.hidden;
  event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
  event.currentTarget.classList.toggle("is-open", !panel.hidden);
});
document.getElementById("delete-data").addEventListener("click", () => {
  if (!confirm("Delete all FridgeIQ data on this device? This removes your food, shopping list, recipes, profile and Claude key, and can't be undone.")) return;
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("fridgeiq.")).forEach((k) => localStorage.removeItem(k));
  } catch (error) { /* nothing saved */ }
  location.hash = "#profile";
  location.reload();
});

/* Log out: forget who you are and your Claude key, keep the food */
document.getElementById("log-out").addEventListener("click", () => {
  if (!confirm("Log out? This removes your name, email and Claude API key from this device. Your food stays.")) return;
  profile = { ...DEFAULT_PROFILE, theme: profile.theme };
  saveProfile();
  setClaudeKey("");
  profileForm.hidden = true;
  renderProfile();
  showToast("You're logged out");
});

/* =========================================================
   6. HOME SCREEN
   ========================================================= */
function renderHome() {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  document.getElementById("greeting").textContent = `Good ${timeOfDay}${firstName() ? " " + firstName() : ""}!`;

  const attention = items.filter(needsAttention);
  document.getElementById("home-count").textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  document.getElementById("home-attention").textContent =
    attention.length === 0 ? "Everything looks fresh"
    : `${attention.length} ${attention.length === 1 ? "item needs" : "items need"} your attention`;

  const list = document.getElementById("expiring-list");
  const soonest = attention.sort((a, b) => daysUntil(a.expires) - daysUntil(b.expires));

  if (soonest.length === 0) {
    list.innerHTML = `<div class="empty-card">Nothing is expiring in the next ${SOON_DAYS} days 🎉</div>`;
  } else {
    const shown = soonest.slice(0, 3);
    list.innerHTML = shown.map((item) => {
      const expired = daysUntil(item.expires) < 0;
      return `
        <div class="expiring-card">
          <a href="#fridge/${encodeURIComponent(item.id)}" class="expiring-card__photo-link" aria-label="See ${esc(item.name)} in My Fridge">
            ${foodPicture(item, "expiring-card__photo")}
          </a>
          <div class="expiring-card__text">
            <a class="expiring-card__name" href="#fridge/${encodeURIComponent(item.id)}">${esc(item.name)}</a>
            <p class="expiring-card__when ${expired ? "is-expired" : ""}">${expiryText(item)}</p>
            <a class="expiring-card__link" href="#recipes/${encodeURIComponent(item.name)}">
              Add to a recipe <img src="images/arrow-right.svg" alt="" class="arrow">
            </a>
            <button class="expiring-card__used" type="button" data-used="${esc(item.id)}">✓ Used it</button>
          </div>
        </div>`;
    }).join("");
    if (soonest.length > shown.length) {
      list.insertAdjacentHTML("beforeend",
        `<a class="more-link" href="#fridge">+ ${soonest.length - shown.length} more in My Fridge</a>`);
    }
  }

  renderShoppingList();
}

document.getElementById("expiring-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-used]");
  if (button) removeItem(button.dataset.used, renderHome);
});

function removeItem(id, refresh) {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return;
  const [removed] = items.splice(index, 1);
  saveItems();
  refresh();
  showToast(`Removed ${removed.name}`, () => {
    items.splice(index, 0, removed);
    saveItems();
    refresh();
  });
}

/* Adds a food to the fridge using the catalog's usual category, storage and shelf life */
function addFoodByName(name) {
  const food = findCatalogFood(name);
  const item = {
    id: newId(),
    name: food ? food.name : name,
    category: food ? food.category : "Other",
    storage: food ? food.storage : "Fridge",
    quantity: null,
    unit: "",
    expires: food ? dateFromToday(food.days) : null,
    added: Date.now(),
  };
  items.push(item);
  saveItems();
  return item;
}

/* --- Shopping list --- */
function renderShoppingList() {
  const box = document.getElementById("shopping-list");
  if (shoppingList.length === 0) {
    box.innerHTML = `<div class="empty-card empty-card--small">Nothing to buy. Missing recipe ingredients will show up here.</div>`;
    return;
  }
  box.innerHTML = `<ul class="shopping">${shoppingList.map((entry) => `
    <li>
      <span class="shopping__name">${esc(entry.name)}${entry.recipe ? `<small>for ${esc(entry.recipe)}</small>` : ""}</span>
      <button class="shopping__got" type="button" data-bought="${esc(entry.id)}" aria-label="Bought ${esc(entry.name)}">✓</button>
      <button class="shopping__remove" type="button" data-unlist="${esc(entry.id)}" aria-label="Remove ${esc(entry.name)} from list">×</button>
    </li>`).join("")}</ul>`;
}

document.getElementById("shopping-list").addEventListener("click", (event) => {
  const bought = event.target.closest("[data-bought]");
  const unlist = event.target.closest("[data-unlist]");
  const id = (bought || unlist || {}).dataset?.bought || (unlist && unlist.dataset.unlist);
  if (!id) return;
  const entry = shoppingList.find((e) => e.id === id);
  shoppingList = shoppingList.filter((e) => e.id !== id);
  saveShopping();
  if (bought && entry) {
    const item = addFoodByName(entry.name);
    renderHome();
    showToast(`${item.name} added to your fridge`, () => { location.hash = "#fridge/" + encodeURIComponent(item.id); }, "See it");
  } else {
    renderHome();
  }
});

/* =========================================================
   7. MY FRIDGE SCREEN
   ========================================================= */
const fridgeView = { category: "All", search: "", sort: "expiration" };
const SORTS = [
  { key: "expiration", label: "Expiration" },
  { key: "name",       label: "Name" },
  { key: "added",      label: "Newest" },
];

function renderFridge(highlightId) {
  renderFridgeChips();
  renderFridgeList(highlightId);
}

function renderFridgeChips() {
  const used = CATEGORIES.filter((c) => items.some((item) => item.category === c));
  if (fridgeView.category !== "All" && !used.includes(fridgeView.category)) fridgeView.category = "All";
  document.getElementById("fridge-chips").innerHTML = ["All", ...used].map((c) =>
    `<button class="chip ${c === fridgeView.category ? "is-selected" : ""}" type="button" data-category="${esc(c)}">${esc(c)}</button>`
  ).join("");
}

function renderFridgeList(highlightId) {
  const search = fridgeView.search.trim().toLowerCase();
  const shown = items.filter((item) =>
    (fridgeView.category === "All" || item.category === fridgeView.category) &&
    (!search || item.name.toLowerCase().includes(search))
  );

  if (fridgeView.sort === "expiration") {
    const order = (item) => { const d = daysUntil(item.expires); return d === null ? Infinity : d; };
    shown.sort((a, b) => order(a) - order(b));
  } else if (fridgeView.sort === "name") {
    shown.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    shown.sort((a, b) => b.added - a.added);
  }

  document.getElementById("fridge-count").textContent = `Your Items (${items.length})`;
  document.getElementById("fridge-sort-label").textContent = SORTS.find((s) => s.key === fridgeView.sort).label;

  const list = document.getElementById("fridge-list");
  if (items.length === 0) {
    list.innerHTML = `<p class="empty-text">Your fridge is empty. Tap “+ Add Food” to add something.</p>`;
    return;
  }
  if (shown.length === 0) {
    list.innerHTML = `<p class="empty-text">No food matches your search.</p>`;
    return;
  }

  list.innerHTML = shown.map((item) => {
    const tag = statusTag(item);
    const amount = item.quantity ? `${item.quantity} ${item.unit || ""}`.trim() : "";
    const details = [item.storage, amount].filter(Boolean).join(" · ");
    return `
      <div class="item ${item.id === highlightId ? "is-highlighted" : ""}" id="item-${esc(item.id)}">
        ${foodPicture(item, "item__photo")}
        <div class="item__info">
          <p class="item__name">${esc(item.name)}</p>
          <p class="item__details">${esc(details)}</p>
          <span class="tag ${tag.style}">${tag.text}</span>
          <a class="item__recipes" href="#recipes/${encodeURIComponent(item.name)}">Recipes →</a>
        </div>
        <button class="item__remove" type="button" data-remove="${esc(item.id)}" aria-label="Remove ${esc(item.name)}">✓<span>Used</span></button>
      </div>`;
  }).join("");

  if (highlightId) {
    const row = document.getElementById("item-" + highlightId);
    if (row) row.scrollIntoView({ block: "center" });
  }
}

document.getElementById("fridge-chips").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-category]");
  if (!chip) return;
  fridgeView.category = chip.dataset.category;
  renderFridge();
});

document.getElementById("fridge-search").addEventListener("input", (event) => {
  fridgeView.search = event.target.value;
  renderFridgeList();
});

document.getElementById("fridge-sort").addEventListener("click", () => {
  const next = (SORTS.findIndex((s) => s.key === fridgeView.sort) + 1) % SORTS.length;
  fridgeView.sort = SORTS[next].key;
  renderFridgeList();
});

document.getElementById("fridge-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (button) removeItem(button.dataset.remove, () => renderFridge());
});

document.getElementById("reset-example").addEventListener("click", () => {
  if (!confirm("Replace your food with the example food?")) return;
  items = makeExampleItems();
  saveItems();
  renderFridge();
  showToast("Example food restored");
});

/* =========================================================
   8. ADD FOOD SCREEN
   ========================================================= */
const form = document.getElementById("add-food-form");
const nameInput = document.getElementById("food-name");
const categorySelect = document.getElementById("food-category");
const storageSelect = document.getElementById("food-storage");
const quantityInput = document.getElementById("food-quantity");
const unitSelect = document.getElementById("food-unit");
const expiresInput = document.getElementById("food-expires");
const expiryHint = document.getElementById("expiry-hint");
const suggestions = document.getElementById("food-suggestions");
let browseCategory = "Popular";

categorySelect.insertAdjacentHTML("beforeend", CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join(""));
storageSelect.insertAdjacentHTML("beforeend", STORAGE_PLACES.map((s) => `<option>${esc(s)}</option>`).join(""));
unitSelect.innerHTML = UNITS.map((u) => `<option>${esc(u)}</option>`).join("");
expiresInput.min = dateFromToday(-30);

function prepareAddFood() {
  renderBrowse();
  hideSuggestions();
}

const POPULAR = ["Milk", "Eggs", "Chicken breast", "Bread", "Cheese", "Yogurt", "Apples", "Bananas",
                 "Broccoli", "Carrots", "Spinach", "Ground beef", "Salmon", "Butter", "Tomatoes", "Orange juice"];

function renderBrowse() {
  document.getElementById("browse-chips").innerHTML = ["Popular", ...CATEGORIES].map((c) =>
    `<button class="chip ${c === browseCategory ? "is-selected" : ""}" type="button" data-browse="${esc(c)}">${esc(c)}</button>`
  ).join("");

  const foods = browseCategory === "Popular"
    ? POPULAR.map(findCatalogFood).filter(Boolean)
    : FOOD_CATALOG.filter((food) => food.category === browseCategory);

  document.getElementById("browse-grid").innerHTML = foods.map((food) =>
    `<button class="food-tile" type="button" data-food="${esc(food.name)}">
       <span class="food-tile__emoji">${food.emoji}</span>
       <span class="food-tile__name">${esc(food.name)}</span>
     </button>`
  ).join("");
}

document.getElementById("browse-chips").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-browse]");
  if (!chip) return;
  browseCategory = chip.dataset.browse;
  renderBrowse();
});

document.getElementById("browse-grid").addEventListener("click", (event) => {
  const tile = event.target.closest("[data-food]");
  if (!tile) return;
  chooseFood(findCatalogFood(tile.dataset.food));
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});

function chooseFood(food) {
  if (!food) return;
  nameInput.value = food.name;
  categorySelect.value = food.category;
  storageSelect.value = food.storage;
  expiresInput.value = dateFromToday(food.days);
  updateExpiryHint();
  hideSuggestions();
  [nameInput, categorySelect, storageSelect].forEach(clearError);
}

function updateExpiryHint() {
  const food = findCatalogFood(nameInput.value);
  if (food && storageSelect.value === food.storage) {
    expiryHint.textContent = `Suggested: usually good for about ${readableDays(food.days)} in the ${food.storage.toLowerCase()}. Change it if your package says otherwise.`;
  } else {
    expiryHint.textContent = "";
  }
}

function readableDays(days) {
  if (days >= 365) return `${Math.round(days / 365)} year${days >= 730 ? "s" : ""}`;
  if (days >= 60) return `${Math.round(days / 30)} months`;
  if (days >= 14) return `${Math.round(days / 7)} weeks`;
  return days === 1 ? "1 day" : `${days} days`;
}

function showSuggestions() {
  const typed = nameInput.value.trim().toLowerCase();
  if (!typed) { hideSuggestions(); return; }

  const matches = FOOD_CATALOG
    .filter((food) => food.name.toLowerCase().includes(typed))
    .sort((a, b) => a.name.toLowerCase().indexOf(typed) - b.name.toLowerCase().indexOf(typed))
    .slice(0, 6);

  if (matches.length === 0 || (matches.length === 1 && matches[0].name.toLowerCase() === typed)) {
    hideSuggestions();
    return;
  }
  suggestions.innerHTML = matches.map((food) =>
    `<li><button type="button" data-food="${esc(food.name)}"><span>${food.emoji}</span>${esc(food.name)}<small>${esc(food.category)}</small></button></li>`
  ).join("");
  suggestions.hidden = false;
}

function hideSuggestions() {
  suggestions.hidden = true;
}

nameInput.addEventListener("input", () => {
  clearError(nameInput);
  showSuggestions();
  const exact = findCatalogFood(nameInput.value);
  if (exact) {
    if (!categorySelect.value) categorySelect.value = exact.category;
    if (!storageSelect.value) storageSelect.value = exact.storage;
    if (!expiresInput.value) expiresInput.value = dateFromToday(exact.days);
  }
  updateExpiryHint();
});
nameInput.addEventListener("focus", showSuggestions);
nameInput.addEventListener("blur", () => setTimeout(hideSuggestions, 150));

suggestions.addEventListener("mousedown", (event) => {
  const option = event.target.closest("[data-food]");
  if (!option) return;
  event.preventDefault();
  chooseFood(findCatalogFood(option.dataset.food));
});

storageSelect.addEventListener("change", () => {
  const food = findCatalogFood(nameInput.value);
  if (food) {
    let days = food.days;
    if (storageSelect.value !== food.storage) {
      if (storageSelect.value === "Freezer") days = Math.max(food.days, 90);
      else if (storageSelect.value === "Counter") days = Math.max(1, Math.round(food.days / 2));
    }
    expiresInput.value = dateFromToday(days);
  }
  updateExpiryHint();
});

function showError(input, message) {
  clearError(input);
  input.classList.add("has-error");
  input.closest(".field").insertAdjacentHTML("beforeend", `<p class="field__error">${esc(message)}</p>`);
}

function clearError(input) {
  input.classList.remove("has-error");
  const field = input.closest(".field");
  const old = field && field.querySelector(".field__error");
  if (old) old.remove();
}

[categorySelect, storageSelect].forEach((select) => select.addEventListener("change", () => clearError(select)));

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  let ok = true;
  if (!name) { showError(nameInput, "Please enter a food name"); ok = false; }
  if (!categorySelect.value) { showError(categorySelect, "Please choose a category"); ok = false; }
  if (!storageSelect.value) { showError(storageSelect, "Please choose where it's stored"); ok = false; }
  if (!ok) {
    form.querySelector(".has-error").focus();
    return;
  }

  const known = findCatalogFood(name);
  const item = {
    id: newId(),
    name: known ? known.name : name.charAt(0).toUpperCase() + name.slice(1),
    category: categorySelect.value,
    storage: storageSelect.value,
    quantity: quantityInput.value ? Number(quantityInput.value) : null,
    unit: quantityInput.value ? unitSelect.value : "",
    expires: expiresInput.value || null,
    added: Date.now(),
  };

  items.push(item);
  saveItems();

  // If this was on the shopping list, take it off
  shoppingList = shoppingList.filter((e) => simplify(e.name) !== simplify(item.name));
  saveShopping();

  form.reset();
  categorySelect.value = "";
  storageSelect.value = "";
  expiryHint.textContent = "";

  showToast(`Added ${item.name} to your fridge`);
  location.hash = "#fridge/" + encodeURIComponent(item.id);
});

/* =========================================================
   9. RECIPE FINDER
   ========================================================= */
const recipeView = { filter: "all" };
const recipeSearch = document.getElementById("recipe-search");
const generateButton = document.getElementById("generate-recipes");
let generating = false;

/* Is this ingredient in your fridge? (e.g. "Cheddar Cheese" matches "Cheese") */
function simplify(name) {
  return String(name).toLowerCase().trim().replace(/(es|s)$/, "");
}

function findInFridge(ingredientName) {
  const wanted = simplify(ingredientName);
  if (!wanted) return undefined;
  return items.find((item) => {
    const have = simplify(item.name);
    return have === wanted || wanted.includes(have) || have.includes(wanted);
  });
}

function recipeMatchesSearch(recipe, search) {
  if (!search) return true;
  const text = [recipe.name, ...recipe.ingredients.map((i) => i.name)].join(" ").toLowerCase();
  return text.includes(search) ||
    recipe.ingredients.some((i) => simplify(search).includes(simplify(i.name)) || simplify(i.name).includes(simplify(search)));
}

function openRecipeFinder(ingredient) {
  if (ingredient) recipeSearch.value = ingredient;
  renderRecipes();
}

function renderRecipes() {
  const searchText = recipeSearch.value.trim();
  const search = searchText.toLowerCase();
  const soonItems = items.filter(needsAttention);

  const shown = allRecipes().filter((recipe) => {
    let matchesFilter = true;
    if (recipeView.filter === "use-soon") {
      matchesFilter = recipe.ingredients.some((i) => soonItems.includes(findInFridge(i.name)));
    } else if (recipeView.filter !== "all") {
      matchesFilter = (recipe.tags || []).includes(recipeView.filter);
    }
    return recipeMatchesSearch(recipe, search) && matchesFilter;
  });

  // Small line under the filters when you're searching
  const status = document.getElementById("recipes-status");
  status.hidden = !searchText;
  status.innerHTML = searchText
    ? `Recipes with “${esc(searchText)}” <button class="text-button text-button--inline" type="button" data-clear-search>Clear</button>`
    : "";

  // The Claude button changes to match what you're looking at
  if (!generating) {
    generateButton.textContent = searchText
      ? `✨ Ask Claude for recipes with ${searchText}`
      : "✨ Get new recipe ideas from Claude";
  }

  const list = document.getElementById("recipe-list");
  if (shown.length === 0) {
    list.innerHTML = `
      <div class="empty-card">
        No saved recipes${searchText ? ` with “${esc(searchText)}”` : " match this filter"} yet.<br>
        Tap the ✨ button above and Claude will create some.
      </div>`;
    return;
  }

  list.innerHTML = shown.map((recipe) => {
    const have = recipe.ingredients.filter((i) => findInFridge(i.name)).length;
    const tags = (recipe.tags || []).slice(0, 3).map((t) => `<span class="mini-tag">${esc(t)}</span>`).join("");
    return `
      <div class="recipe-card">
        <a href="#recipe/${encodeURIComponent(recipe.id)}" class="recipe-card__picture-link">${recipePicture(recipe, "recipe-card__photo")}</a>
        <div class="recipe-card__footer">
          <p class="recipe-card__name">${esc(recipe.name)}</p>
          <p class="recipe-card__have">You have ${have} of ${recipe.ingredients.length} ingredients · ${esc(recipe.time)}${recipe.byClaude ? " · ✨ by Claude" : ""}</p>
          ${tags ? `<p class="recipe-card__tags">${tags}</p>` : ""}
          <a class="recipe-card__button" href="#recipe/${encodeURIComponent(recipe.id)}">
            View Recipe <img src="images/arrow-right.svg" alt="" class="arrow">
          </a>
        </div>
      </div>`;
  }).join("");
}

recipeSearch.addEventListener("input", renderRecipes);

document.getElementById("recipes-status").addEventListener("click", (event) => {
  if (event.target.closest("[data-clear-search]")) {
    recipeSearch.value = "";
    if (location.hash !== "#recipes") history.replaceState(null, "", "#recipes");
    renderRecipes();
  }
});

document.getElementById("recipe-chips").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-filter]");
  if (!chip) return;
  recipeView.filter = chip.dataset.filter;
  document.querySelectorAll("#recipe-chips .chip").forEach((c) => c.classList.toggle("is-selected", c === chip));
  renderRecipes();
});

/* Ask Claude for new recipes */
generateButton.addEventListener("click", async () => {
  if (generating) return;
  if (!getClaudeKey()) {
    showClaudeProblem(new ClaudeProblem("Add your Claude API key on the Profile screen to get recipe ideas.", true));
    return;
  }

  const focus = recipeSearch.value.trim();
  const filterNames = { "use-soon": "Use Before Lose", "High Protein": "High Protein", "Vegetarian": "Vegetarian" };
  const fridge = items.map((item) => ({ name: item.name, daysLeft: daysUntil(item.expires) }));

  setGenerating(true, "Claude is cooking up ideas… this can take up to a minute.");
  try {
    const recipes = await generateRecipes(fridge, { focus, filter: filterNames[recipeView.filter], count: 3 });
    const cleaned = recipes.map(cleanClaudeRecipe).filter(Boolean);
    if (cleaned.length === 0) throw new ClaudeProblem("Claude didn't come back with any recipes. Please try again.");
    myRecipes = [...cleaned, ...myRecipes];
    saveRecipes();
    renderRecipes();
    showToast(`Claude made ${cleaned.length} new recipe${cleaned.length === 1 ? "" : "s"} for you`);
    document.getElementById("recipe-list").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showClaudeProblem(error);
  } finally {
    setGenerating(false);
  }
});

function setGenerating(on, note) {
  generating = on;
  generateButton.disabled = on;
  generateButton.classList.toggle("is-loading", on);
  if (on) generateButton.textContent = "Asking Claude…";
  document.getElementById("generate-note").textContent =
    note || "Claude looks at what's in your fridge, especially food expiring soon.";
  if (!on) renderRecipes();
}

/* Makes sure a recipe from Claude has everything the app needs */
function cleanClaudeRecipe(recipe) {
  if (!recipe || typeof recipe.name !== "string" || !Array.isArray(recipe.ingredients)) return null;
  const text = (value, max) => String(value ?? "").trim().slice(0, max);
  return {
    id: newId("claude"),
    byClaude: true,
    name: text(recipe.name, 80) || "Recipe",
    emoji: text(recipe.emoji, 8) || "🍽️",
    description: text(recipe.description, 300),
    time: text(recipe.time, 20) || "—",
    servings: Number.isFinite(recipe.servings) ? recipe.servings : 2,
    difficulty: ["Easy", "Medium", "Hard"].includes(recipe.difficulty) ? recipe.difficulty : "Easy",
    tags: Array.isArray(recipe.tags) ? recipe.tags.filter((t) => RECIPE_TAGS.includes(t)) : [],
    ingredients: recipe.ingredients
      .filter((i) => i && i.name)
      .map((i) => ({ name: text(i.name, 60), amount: text(i.amount, 40) })),
    steps: Array.isArray(recipe.steps) ? recipe.steps.map((s) => text(s, 600)).filter(Boolean) : [],
    created: Date.now(),
  };
}

/* =========================================================
   10. RECIPE DETAILS
   ========================================================= */
let currentRecipeId = null;
let loadingSteps = false;

function findRecipe(id) {
  const recipes = allRecipes();
  return recipes.find((r) => r.id === id) || recipes[recipes.length - 1];
}

function renderRecipe(recipeId) {
  const recipe = findRecipe(recipeId);
  currentRecipeId = recipe.id;

  const heroSource = recipe.heroPhoto ? { ...recipe, photo: recipe.heroPhoto } : recipe;
  document.getElementById("recipe-hero-wrap").innerHTML = recipePicture(heroSource, "recipe-hero");
  document.getElementById("recipe-name").textContent = recipe.name;
  const description = document.getElementById("recipe-description");
  description.textContent = recipe.description || "";
  description.hidden = !recipe.description;
  document.getElementById("recipe-time").textContent = recipe.time;
  document.getElementById("recipe-servings").textContent = recipe.servings;
  document.getElementById("recipe-difficulty").textContent = recipe.difficulty;

  document.getElementById("recipe-ingredients").innerHTML = recipe.ingredients.map((ingredient) => {
    const have = findInFridge(ingredient.name);
    return `
      <li>
        <span>${esc(ingredient.name)}<br>${esc(ingredient.amount)}</span>
        <span class="tag ${have ? "tag--yes" : "tag--no"}">${have ? "Yes" : "No"}</span>
      </li>`;
  }).join("");

  const missing = recipe.ingredients.filter((i) => !findInFridge(i.name)).length;
  document.getElementById("add-missing").textContent = missing
    ? `+ Add ${missing} Missing Item${missing === 1 ? "" : "s"} to Shopping List`
    : "✓ You have everything for this recipe";

  // Instructions start hidden; "Cooking Instructions" shows them (asking Claude if needed)
  document.getElementById("steps-card").hidden = true;
  updateStepsButton(recipe);
  document.getElementById("delete-recipe").hidden = !recipe.byClaude;
}

function updateStepsButton(recipe) {
  const button = document.getElementById("show-steps");
  if (loadingSteps) return;
  const showing = !document.getElementById("steps-card").hidden;
  button.textContent = showing ? "Hide Cooking Instructions"
    : recipe.steps && recipe.steps.length ? "Cooking Instructions"
    : "✨ Cooking Instructions (written by Claude)";
}

function showSteps(recipe) {
  document.getElementById("recipe-steps").innerHTML = recipe.steps.map((step) => `<li>${esc(step)}</li>`).join("");
  const card = document.getElementById("steps-card");
  card.hidden = false;
  updateStepsButton(recipe);
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("show-steps").addEventListener("click", async () => {
  if (loadingSteps) return;
  const recipe = findRecipe(currentRecipeId);
  const card = document.getElementById("steps-card");

  if (!card.hidden) {           // already showing: hide them
    card.hidden = true;
    updateStepsButton(recipe);
    return;
  }
  if (recipe.steps && recipe.steps.length) {
    showSteps(recipe);
    return;
  }

  // No instructions yet: ask Claude to write them, then save them
  const button = document.getElementById("show-steps");
  loadingSteps = true;
  button.disabled = true;
  button.classList.add("is-loading");
  button.textContent = "Claude is writing the steps…";
  try {
    const steps = (await generateInstructions(recipe)).map((s) => s.slice(0, 600));
    if (steps.length === 0) throw new ClaudeProblem("Claude didn't send any steps. Please try again.");
    const mine = myRecipes.find((r) => r.id === recipe.id);
    if (mine) mine.steps = steps;
    else builtInSteps[recipe.id] = steps;
    saveRecipes();
    loadingSteps = false;
    if (currentRecipeId === recipe.id && readAddress().name === "recipe") showSteps({ ...recipe, steps });
  } catch (error) {
    showClaudeProblem(error);
  } finally {
    loadingSteps = false;
    button.disabled = false;
    button.classList.remove("is-loading");
    updateStepsButton(findRecipe(currentRecipeId));
  }
});

document.getElementById("add-missing").addEventListener("click", () => {
  const recipe = findRecipe(currentRecipeId);
  const missing = recipe.ingredients.filter((i) => !findInFridge(i.name));
  if (missing.length === 0) {
    showToast("You already have everything. Time to cook! 🍳");
    return;
  }
  const added = missing.filter((i) => !shoppingList.some((e) => simplify(e.name) === simplify(i.name)));
  added.forEach((i) => shoppingList.push({ id: newId("shop"), name: i.name, recipe: recipe.name }));
  saveShopping();
  showToast(
    added.length ? `Added ${added.map((i) => i.name).join(", ")} to your shopping list` : "Those are already on your shopping list",
    () => { location.hash = "#home"; setTimeout(() => document.getElementById("shopping-list").scrollIntoView({ block: "center" }), 50); },
    "View list"
  );
});

document.getElementById("delete-recipe").addEventListener("click", () => {
  const recipe = findRecipe(currentRecipeId);
  if (!recipe.byClaude || !confirm(`Delete “${recipe.name}”?`)) return;
  myRecipes = myRecipes.filter((r) => r.id !== recipe.id);
  saveRecipes();
  location.hash = "#recipes";
  showToast("Recipe deleted");
});

/* Start the app */
applyTheme();
showScreen();
