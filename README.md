# FridgeIQ

A phone-friendly website that helps you keep track of the food in your fridge
and find recipes that use it before it goes bad.

FridgeIQ runs entirely in the browser. There's no account, no server, no AI service
and no paid API. Your food, shopping list and profile are saved in the browser on
your device.

## How to open it

Download the project, **extract the ZIP** (right-click → Extract All), then double-click
`index.html`. To see it at phone size on a computer, make the browser window narrow.

## The screens

| Screen | How to get there |
|---|---|
| My Profile | The app opens here. The person icon at the top right of every screen brings you back |
| Home | "Home" in the bottom bar |
| My Fridge | "My Fridge" in the bottom bar |
| Add / Edit Food | "+ Add Food" on My Fridge, or tap any food to edit it |
| Recipe Finder | "Recipes" in the bottom bar |
| Recipe Details | Tap any recipe card |
| Shopping List | "Shopping" in the bottom bar |

## What works

- **My Fridge:** add, edit and delete food; search, category filters, sorting
  (Expiration / Name / Newest). Tags show Fresh, days left, or Expired.
- **Add Food:** pick from about 130 foods (Quick pick grid or type-ahead suggestions),
  which fills in the category, storage and a suggested expiration date. Any other food can be typed in.
- **Home:** item count, food that needs attention, **Expiring Soon**, today's best
  **Recipe Pick for You**, and a link to the shopping list.
- **Recipes:** 29 built-in recipes, ranked by how well they fit your fridge (see below).
  Filters: All, Can Make Now, Use Before Lose, Breakfast, Lunch, Dinner, Vegetarian,
  High Protein, Quick. Search by recipe name or ingredient.
- **Recipe Details:** every ingredient marked Have / Missing / Use soon, full cooking
  instructions, and **Add Missing Items to Shopping List**.
- **Shopping:** add items yourself or from recipes. Tap ✓ when you buy something and it
  moves into My Fridge with a suggested expiration date.
- **Profile:** your name (used in the greeting), 4 colour schemes, privacy settings
  (Delete all my data) and Log Out.

## How recipe matching works

For each recipe, FridgeIQ checks every required ingredient against My Fridge
(optional extras such as garnishes don't count against you). Similar foods count as a
match, for example any cheese works for "Cheese" and Greek yogurt works for "Yogurt".
These are listed in `INGREDIENT_ALIASES` in `js/recipes.js`.

Recipes are then sorted by:
1. how many of the ingredients you already have,
2. a big boost for each of your foods expiring in the next 3 days,
3. a bonus when you have everything.

Each card says why it's recommended, for example "Uses your Milk and Broccoli before
they expire. Just get Garlic". Everything updates as soon as your food changes.

Salt, pepper, cooking oil and water are assumed to be in every kitchen.

## What each file does

| File | What it's for |
|---|---|
| `index.html` | The **content**: all the screens, their text, pictures and buttons |
| `css/styles.css` | The **looks**: colours, sizes, spacing. The colours at the top come from Figma |
| `js/data.js` | The **food list** for Add Food, and the starting example food |
| `js/recipes.js` | The **recipe database**. Copy one recipe block to add a new recipe |
| `js/app.js` | The **behaviour**: saving, recipe matching, and what every button does |
| `images/` | Photos and arrows from the Figma file |

## Notes

- Most recipes use a food emoji on a coloured tile as their picture. Only Broccoli Cheddar
  Pasta has real photos so far. To add a photo, put it in `images/` and set
  `image: { photo: "images/your-photo.jpg" }` on that recipe.
- The cheese and yogurt photos look like stock-photo previews. Replace them before
  launching publicly.
- Data is saved per browser and device. It isn't shared between your phone and computer.
