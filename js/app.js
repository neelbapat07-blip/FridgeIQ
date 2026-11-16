/*
  FridgeIQ behaviour
  ------------------
  This file controls what happens when you TAP things, and builds the parts
  of each screen that change (lists, counts, tags).

  It is split into numbered parts:
    1. Saving & loading your food (kept in this browser on this device)
    2. Date helpers ("Expires in 2 days")
    3. Small helpers (pictures, pop-up messages)
    4. Screen switching
    5. Home screen
    6. My Fridge screen
    7. Add Food screen
    8. Recipe screens
*/

/* =========================================================
   1. SAVING & LOADING YOUR FOOD
   Your food list is saved in the browser ("localStorage"), so it is still
   there when you close and reopen the page on the same device and browser.
   ========================================================= */
const STORAGE_KEY = "fridgeiq.items.v1";
let items = loadItems();

function loadItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (error) {
    /* nothing saved yet, or the browser blocks saving: use the example food */
  }
  return makeExampleItems();
}

function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    /* saving is blocked (e.g. private browsing): the app still works until you close it */
  }
}

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

function newId() {
  return "item-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

/* =========================================================
   2. DATE HELPERS
   Dates are stored as text like "2026-11-18".
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

/* Text like "Expires in 2 days" for the Home screen */
function expiryText(item) {
  const days = daysUntil(item.expires);
  if (days === null) return "No expiration date";
  if (days < -1) return `Expired ${-days} days ago`;
  if (days === -1) return "Expired yesterday";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

/* The little coloured tag: Fresh / 2 days left / Expired */
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

/* Finds a food in the catalog by name (ignores capital letters) */
function findCatalogFood(name) {
  const wanted = String(name).trim().toLowerCase();
  return FOOD_CATALOG.find((food) => food.name.toLowerCase() === wanted);
}

const CATEGORY_EMOJI = {
  "Meats": "🥩", "Seafood": "🐟", "Dairy": "🧀", "Fruits": "🍎", "Vegetables": "🥦",
  "Grains & Bread": "🍞", "Drinks": "🧃", "Sauces & Condiments": "🫙", "Leftovers": "🍱", "Other": "🛒",
};

/* The picture for a food: a photo if we have one, otherwise an emoji */
function foodPicture(item, extraClass) {
  const food = findCatalogFood(item.name);
  if (food && food.photo) {
    return `<div class="photo ${extraClass}"><img src="${food.photo}" alt="${esc(item.name)}"></div>`;
  }
  const emoji = (food && food.emoji) || CATEGORY_EMOJI[item.category] || "🛒";
  return `<div class="photo photo--emoji ${extraClass}" role="img" aria-label="${esc(item.name)}">${emoji}</div>`;
}

/* Pop-up message at the bottom. Optionally with an "Undo" button. */
const toast = document.getElementById("toast");
const toastText = document.getElementById("toast-text");
const toastAction = document.getElementById("toast-action");
let toastTimer;
let toastUndo = null;

function showToast(message, undo) {
  toastText.textContent = message;
  toastUndo = undo || null;
  toastAction.hidden = !undo;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), undo ? 4500 : 2200);
}

toastAction.addEventListener("click", () => {
  if (toastUndo) toastUndo();
  toastUndo = null;
  toast.classList.remove("is-visible");
});

/* Buttons that don't have a screen yet */
document.querySelectorAll("button[data-coming-soon]").forEach((button) => {
  button.addEventListener("click", () => showToast(`${button.dataset.comingSoon} is coming soon`));
});

/* =========================================================
   4. SCREEN SWITCHING
   The web address decides the screen:
     #home               Home
     #fridge             My Fridge
     #fridge/ITEM-ID     My Fridge, with one food highlighted
     #add-food           Add Food
     #recipes            Recipe Finder
     #recipes/broccoli   Recipe Finder, showing recipes that use broccoli
     #recipe/RECIPE-ID   Recipe Details
   ========================================================= */
const DEFAULT_SCREEN = "home";

function readAddress() {
  const [name, ...rest] = location.hash.replace("#", "").split("/");
  return { name: name || DEFAULT_SCREEN, detail: decodeURIComponent(rest.join("/")) };
}

function showScreen() {
  const { name, detail } = readAddress();
  const screen = document.getElementById(name) || document.getElementById(DEFAULT_SCREEN);

  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-active", s === screen));

  const tab = screen.dataset.tab;
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.tab === tab;
    t.classList.toggle("is-active", active);
    if (active) t.setAttribute("aria-current", "page");
    else t.removeAttribute("aria-current");
  });

  window.scrollTo(0, 0);

  // Rebuild the screen so it always shows your latest food
  if (screen.id === "home") renderHome();
  if (screen.id === "fridge") renderFridge(detail);
  if (screen.id === "add-food") prepareAddFood();
  if (screen.id === "recipes") openRecipeFinder(detail);
  if (screen.id === "recipe") renderRecipe(detail);
}

window.addEventListener("hashchange", showScreen);

/* =========================================================
   5. HOME SCREEN
   ========================================================= */
function renderHome() {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  document.getElementById("greeting").textContent = `Good ${timeOfDay} Neel!`;

  const attention = items.filter(needsAttention);
  document.getElementById("home-count").textContent = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  document.getElementById("home-attention").textContent =
    attention.length === 0 ? "Everything looks fresh"
    : `${attention.length} ${attention.length === 1 ? "item needs" : "items need"} your attention`;

  const list = document.getElementById("expiring-list");
  const soonest = attention.sort((a, b) => daysUntil(a.expires) - daysUntil(b.expires));

  if (soonest.length === 0) {
    list.innerHTML = `<div class="empty-card">Nothing is expiring in the next ${SOON_DAYS} days 🎉</div>`;
    return;
  }

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

/* "Used it" buttons on Home remove the food (with Undo) */
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

/* =========================================================
   6. MY FRIDGE SCREEN
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
  // Only show categories you actually have food in
  const used = CATEGORIES.filter((c) => items.some((item) => item.category === c));
  if (fridgeView.category !== "All" && !used.includes(fridgeView.category)) fridgeView.category = "All";

  document.getElementById("fridge-chips").innerHTML = ["All", ...used].map((c) =>
    `<button class="chip ${c === fridgeView.category ? "is-selected" : ""}" type="button" data-category="${esc(c)}">${esc(c)}</button>`
  ).join("");
}

function renderFridgeList(highlightId) {
  const search = fridgeView.search.trim().toLowerCase();
  let shown = items.filter((item) =>
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
   7. ADD FOOD SCREEN
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

// Fill the drop-down menus from the lists in data.js
categorySelect.insertAdjacentHTML("beforeend", CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join(""));
storageSelect.insertAdjacentHTML("beforeend", STORAGE_PLACES.map((s) => `<option>${esc(s)}</option>`).join(""));
unitSelect.innerHTML = UNITS.map((u) => `<option>${esc(u)}</option>`).join("");
expiresInput.min = dateFromToday(-30);

function prepareAddFood() {
  renderBrowse();
  hideSuggestions();
}

/* --- Quick pick grid --- */
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

/* --- Choosing a known food fills in the rest of the form --- */
function chooseFood(food) {
  if (!food) return;
  nameInput.value = food.name;
  categorySelect.value = food.category;
  storageSelect.value = food.storage;
  expiresInput.value = dateFromToday(food.days);
  updateExpiryHint();
  hideSuggestions();
  clearError(nameInput);
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

/* --- Suggestions while typing the food name --- */
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
  // If the typed name exactly matches a known food, fill in the rest
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

// "mousedown" so the choice happens before the box loses focus
suggestions.addEventListener("mousedown", (event) => {
  const option = event.target.closest("[data-food]");
  if (!option) return;
  event.preventDefault();
  chooseFood(findCatalogFood(option.dataset.food));
});

storageSelect.addEventListener("change", () => {
  // Moving food to a different place changes how long it lasts (roughly)
  const food = findCatalogFood(nameInput.value);
  if (food) {
    const factor = { Freezer: 30, Pantry: 1, Counter: 0.5, Fridge: 1 };
    let days = food.days;
    if (storageSelect.value !== food.storage) {
      days = storageSelect.value === "Freezer" ? Math.max(food.days, 90)
           : Math.max(1, Math.round(food.days * (factor[storageSelect.value] || 1)));
    }
    expiresInput.value = dateFromToday(days);
  }
  updateExpiryHint();
});

/* --- Checking the form and saving --- */
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

  // Use the catalog's spelling if it's a known food (e.g. "milk" -> "Milk")
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

  form.reset();
  categorySelect.value = "";
  storageSelect.value = "";
  expiryHint.textContent = "";

  showToast(`Added ${item.name} to your fridge`);
  location.hash = "#fridge/" + encodeURIComponent(item.id);
});

/* =========================================================
   8. RECIPE SCREENS
   ========================================================= */
const recipeView = { filter: "all" };
const recipeSearch = document.getElementById("recipe-search");

/* Is this ingredient in your fridge? (e.g. "Cheddar Cheese" matches "Cheese") */
function simplify(name) {
  return name.toLowerCase().trim().replace(/(es|s)$/, "");
}

function findInFridge(ingredientName) {
  const wanted = simplify(ingredientName);
  return items.find((item) => {
    const have = simplify(item.name);
    return have === wanted || wanted.includes(have) || have.includes(wanted);
  });
}

function openRecipeFinder(ingredient) {
  // Coming from "Add to a recipe" on Home: search for that ingredient
  if (ingredient) recipeSearch.value = ingredient;
  renderRecipes();
}

function renderRecipes() {
  const search = recipeSearch.value.trim().toLowerCase();
  const soonItems = items.filter(needsAttention);

  const shown = RECIPES.filter((recipe) => {
    const text = [recipe.name, ...recipe.ingredients.map((i) => i.name)].join(" ").toLowerCase();
    const matchesSearch = !search || text.includes(search) ||
      recipe.ingredients.some((i) => simplify(search).includes(simplify(i.name)) || simplify(i.name).includes(simplify(search)));
    let matchesFilter = true;
    if (recipeView.filter === "use-soon") {
      matchesFilter = recipe.ingredients.some((i) => soonItems.includes(findInFridge(i.name)));
    } else if (recipeView.filter !== "all") {
      matchesFilter = recipe.tags.includes(recipeView.filter);
    }
    return matchesSearch && matchesFilter;
  });

  document.getElementById("recipes-heading").textContent = search
    ? `Recipes with “${recipeSearch.value.trim()}”`
    : "Use It Before You Lose It";

  const list = document.getElementById("recipe-list");
  if (shown.length === 0) {
    list.innerHTML = `
      <div class="empty-card">
        No recipes found${search ? ` with “${esc(recipeSearch.value.trim())}”` : ""} yet.
        ${search ? `<button class="text-button" type="button" id="clear-recipe-search">Show all recipes</button>` : ""}
      </div>`;
    return;
  }

  list.innerHTML = shown.map((recipe) => {
    const have = recipe.ingredients.filter((i) => findInFridge(i.name)).length;
    return `
      <div class="recipe-card">
        <img class="recipe-card__photo" src="${recipe.photo}" alt="${esc(recipe.name)}">
        <div class="recipe-card__footer">
          <p class="recipe-card__name">${esc(recipe.name)}</p>
          <p class="recipe-card__have">You have ${have} of ${recipe.ingredients.length} ingredients</p>
          <a class="recipe-card__button" href="#recipe/${encodeURIComponent(recipe.id)}">
            View Recipe <img src="images/arrow-right.svg" alt="" class="arrow">
          </a>
        </div>
      </div>`;
  }).join("");
}

recipeSearch.addEventListener("input", renderRecipes);

document.getElementById("recipe-list").addEventListener("click", (event) => {
  if (event.target.id === "clear-recipe-search") {
    recipeSearch.value = "";
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

function renderRecipe(recipeId) {
  const recipe = RECIPES.find((r) => r.id === recipeId) || RECIPES[0];
  const hero = document.getElementById("recipe-hero");
  hero.src = recipe.heroPhoto || recipe.photo;
  hero.alt = recipe.name;
  document.getElementById("recipe-name").textContent = recipe.name;
  document.getElementById("recipe-time").textContent = recipe.time;
  document.getElementById("recipe-servings").textContent = recipe.servings;
  document.getElementById("recipe-difficulty").textContent = recipe.difficulty;

  // Yes / No depends on what's in your fridge right now
  document.getElementById("recipe-ingredients").innerHTML = recipe.ingredients.map((ingredient) => {
    const have = findInFridge(ingredient.name);
    return `
      <li>
        <span>${esc(ingredient.name)}<br>${esc(ingredient.amount)}</span>
        <span class="tag ${have ? "tag--yes" : "tag--no"}">${have ? "Yes" : "No"}</span>
      </li>`;
  }).join("");
}

/* Start the app */
showScreen();
