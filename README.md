# FridgeIQ

A phone-friendly website that helps you keep track of the food in your fridge
and find recipes that use it before it goes bad.

FridgeIQ runs entirely in the browser. There's no account, no server, no AI service
and no paid API. Your food, shopping list and profile are saved in the browser on
your device.

## Where your data is saved

Everything is saved in the browser's **localStorage**, which belongs to this website,
in that one browser, on that one device:

- **Each browser and device has its own separate data.** Your phone, your laptop, and a
  friend's phone each have their own fridge. Nothing is shared or synced.
- **Nothing is sent to a server.** The only thing loaded from the internet is the font.
- **It saves automatically** every time you add, edit or delete food, change the shopping
  list, or change your profile, theme, sort order or recipe filter.
- **It loads automatically** when you open the app, and survives refreshing and closing the browser.
- **New users start with an empty fridge.** The food list in `js/data.js` only provides
  choices for the Add Food screen.
- **Open in two tabs?** They stay in sync and never overwrite each other.

| Saved under | What |
|---|---|
| `fridgeiq.items.v1` | Food: names, categories, storage, quantities, units, expiration dates |
| `fridgeiq.shopping.v1` | Shopping list |
| `fridgeiq.profile.v1` | Name, email, colour theme |
| `fridgeiq.prefs.v1` | Sort order and filters |

**If something goes wrong**, a yellow message appears at the top:
- *Saving is blocked* (e.g. private browsing): the app works but can't keep changes.
- *Storage is full*: the latest change wasn't saved, and everything saved before is untouched.
- *Saved data couldn't be read*: readable entries are kept and the original is copied to a
  `.backup` entry, so nothing is silently erased.

To remove everything: **Profile → Privacy Settings → Delete all my data**. This only affects the
current browser. Data stored by a different website address (for example the GitHub Pages link
vs. the Vercel link) is separate, even on the same phone.

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
- **Recipes:** 100 built-in recipes (breakfast, lunch, dinner and snacks), ranked by how well
  they fit your fridge (see below). The best 20 show first; "Show more" loads the rest.
  Filters: All, Use Before Lose, Can Make Now, Quick. Search by recipe name or ingredient.
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
| `js/storage.js` | **Saving and loading**: the only file that touches the browser's storage, with safety checks |
| `js/data.js` | The **food choices** for Add Food (not anyone's actual food) |
| `js/recipes.js` | The **recipe database** (first 29 recipes + ingredient matching rules). Copy one recipe block to add a new recipe |
| `js/recipes-more.js` | The **rest of the recipes** (71 more) |
| `js/photo-credits.js` | Who took each **recipe photo** and its license (shown on Profile → Photo Credits) |
| `js/app.js` | The **behaviour**: saving, recipe matching, and what every button does |
| `images/` | Photos and arrows from the Figma file |
| `images/recipes/` | One photo per recipe, from Wikimedia Commons |

## Notes

- **Recipe photos** are free-licensed photos from Wikimedia Commons (CC0, public domain,
  CC BY or CC BY-SA). Their licenses allow use in the app **as long as each photographer is
  credited**, which the Photo Credits screen does. When adding or replacing a photo, add its
  credit to `js/photo-credits.js`. Don't use photos copied from Google image search: most are
  copyrighted. If a photo is missing, the recipe shows an emoji tile instead.
- The cheese and yogurt photos look like stock-photo previews. Replace them before
  launching publicly.
