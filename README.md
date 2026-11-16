# FridgeIQ

A phone-friendly website that helps you keep track of the food in your fridge
and find recipes that use it before it goes bad.

The screens follow the Figma designs, and the app **works**: food you add is saved,
and every screen updates to match.

## How to open it

Double-click `index.html`, or drag it into any web browser.
To see it at phone size on a computer, make the browser window narrow.

## The screens

| Screen | How to get there |
|---|---|
| My Profile | The app opens here. The person icon at the top right of every screen brings you back |
| Home | "Home" in the bottom bar |
| My Fridge | "My Fridge" in the bottom bar |
| Add Food | "+ Add Food" on My Fridge |
| Recipe Finder | "Recipes" in the bottom bar |
| Recipe Details | "View Recipe" on Recipe Finder, or "Add to a recipe" on Home |

## What works

- **Add Food:** pick from about 120 foods (Quick pick grid, or start typing for suggestions).
  Picking one fills in the category, storage and a suggested expiration date. You can also
  type any food that isn't on the list.
- **My Fridge:** search, category filters, sorting (Expiration / Name / Newest), and a
  **Used** button to remove food (with **Undo**). Tags show Fresh, days left, or Expired.
- **Home:** the item count, "need your attention" and **Expiring Soon** update by themselves.
  Tap a food to see it in My Fridge, "Add to a recipe" to find recipes that use it,
  or "Used it" to remove it.
- **Recipes:** search and filters work, and Recipe Details shows **Yes / No** based on
  what's actually in your fridge.
- **Claude recipes:** "✨ Get new recipe ideas from Claude" sends your food list (with
  expiry dates) to Claude, which invents 3 recipes with ingredients and instructions.
  Searching first (e.g. "Broccoli") or picking a filter (Vegetarian, High Protein,
  Use Before Lose) steers what Claude makes.
- **Cooking Instructions:** every recipe has them. If a recipe doesn't have instructions
  yet, Claude writes them when you tap the button, and they're saved.
- **Shopping list (on Home):** "+ Add Missing Items" on a recipe adds what you don't have.
  Tap ✓ when you buy it and it moves into your fridge.
- **Profile:** your name (used in the greeting), 4 colour schemes, your Claude API key,
  privacy settings ("Delete all my data") and Log Out.

### Setting up Claude

1. Create an API key at console.anthropic.com (Anthropic bills API use separately from
   a Claude subscription).
2. In FridgeIQ, open **My Profile → Recipe AI**, paste the key and tap **Save key**.

The key is saved only in that browser and sent only to Anthropic. Because it lives in the
browser, this setup is for **personal use**. Before sharing the app publicly, move the Claude
calls to a small server so the key isn't in visitors' browsers.

Your food is saved **in the browser on that device**. It stays when you close the page,
but it isn't shared between devices or browsers yet. "Reset to example food" at the bottom
of My Fridge puts back the starting food.



## What each file does

| File | What it's for |
|---|---|
| `index.html` | The **content**: all five screens, their text, pictures and buttons |
| `css/styles.css` | The **looks**: colors, sizes, spacing. The colors at the top come from Figma |
| `js/data.js` | The **lists**: all the food choices, the recipes, and the starting example food. Add a food choice here |
| `js/app.js` | The **behaviour**: saving food, building the lists, and what every button does |
| `js/claude.js` | Everything that **talks to Claude**: the instructions Claude gets and the answer format |
| `js/vendor/` | Anthropic's official Claude library (version 1.4.0), packed into one file so no install is needed |
| `images/` | The photos and arrows from the Figma file |

## Notes

- The cheese and yogurt photos look like stock-photo previews. They're fine for a
  private prototype, but replace them before the app goes public.
