/*
  FridgeIQ + Claude
  -----------------
  This file is the only place the app talks to Claude (Anthropic's AI).
  It does two jobs:
    1. generateRecipes()      – invent new recipes from the food in your fridge
    2. generateInstructions() – write step-by-step cooking instructions for a recipe

  HOW IT CONNECTS
  It uses Anthropic's official library (js/vendor/anthropic-sdk.js) and YOUR
  Claude API key, which you paste on the Profile screen. The key is saved only
  in this browser and is sent only to Anthropic.

  Because the key lives in the browser, this setup is meant for a personal app.
  Before sharing the app publicly, the Claude calls should move to a small
  server so each visitor doesn't need their own key.

  Claude is asked to answer in a fixed JSON format (a "schema"), so the app can
  read the answer reliably.
*/

const CLAUDE_MODEL = "claude-opus-5-5";
const CLAUDE_KEY_STORAGE = "fridgeiq.claudeKey.v1";

function getClaudeKey() {
  try { return localStorage.getItem(CLAUDE_KEY_STORAGE) || ""; } catch (error) { return ""; }
}

function setClaudeKey(key) {
  try {
    if (key) localStorage.setItem(CLAUDE_KEY_STORAGE, key);
    else localStorage.removeItem(CLAUDE_KEY_STORAGE);
  } catch (error) {
    /* saving is blocked (e.g. private browsing) */
  }
}

/* A problem we can explain to the user in plain words */
class ClaudeProblem extends Error {
  constructor(message, needsKey) {
    super(message);
    this.needsKey = Boolean(needsKey);
  }
}

/* Sends one request to Claude and returns its answer as a JavaScript object */
async function askClaudeForJson(systemPrompt, userPrompt, schema) {
  const apiKey = getClaudeKey();
  if (!apiKey) {
    throw new ClaudeProblem("Add your Claude API key on the Profile screen first.", true);
  }

  const Anthropic = AnthropicSDK.default;
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  let message;
  try {
    // Streaming keeps long answers from timing out; finalMessage() waits for the whole answer.
    const stream = client.beta.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      // If Claude declines a request, let Anthropic retry it on its recommended backup model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema },
      },
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    message = await stream.finalMessage();
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new ClaudeProblem("Your Claude API key isn't working. Check it on the Profile screen.", true);
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      throw new ClaudeProblem("Your Claude API key doesn't have access to this model.", true);
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ClaudeProblem("Claude is busy right now. Please try again in a minute.");
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new ClaudeProblem("Couldn't reach Claude. Check your internet connection and try again.");
    }
    if (error instanceof Anthropic.APIError) {
      const detail = (error.error && error.error.error && error.error.error.message) || error.message || "";
      throw new ClaudeProblem(`Claude returned an error${error.status ? ` (${error.status})` : ""}: ${String(detail).slice(0, 160)}`);
    }
    throw new ClaudeProblem("Something went wrong talking to Claude. Please try again.");
  }

  if (message.stop_reason === "refusal") {
    throw new ClaudeProblem("Claude couldn't help with that request. Try different food or filters.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new ClaudeProblem("Claude's answer was too long and got cut off. Please try again.");
  }

  const text = message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ClaudeProblem("Claude's answer couldn't be read. Please try again.");
  }
}

/* ---------- 1. New recipes from your fridge ---------- */

const RECIPE_TAGS = ["High Protein", "Vegetarian", "Vegan", "Quick", "Use Before Lose", "Comfort Food", "Healthy"];

const RECIPES_SCHEMA = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name:        { type: "string", description: "Short recipe name, e.g. 'Broccoli Cheddar Pasta'" },
          emoji:       { type: "string", description: "One food emoji that represents the dish" },
          description: { type: "string", description: "One appetising sentence about the dish" },
          time:        { type: "string", description: "Total time, e.g. '25 min'" },
          servings:    { type: "integer" },
          difficulty:  { type: "string", enum: ["Easy", "Medium", "Hard"] },
          tags:        { type: "array", items: { type: "string", enum: RECIPE_TAGS } },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name:   { type: "string", description: "Plain ingredient name, e.g. 'Cheddar cheese'" },
                amount: { type: "string", description: "Amount, e.g. '1 cup' or '200 g'" },
              },
              required: ["name", "amount"],
              additionalProperties: false,
            },
          },
          steps: { type: "array", items: { type: "string" }, description: "Cooking instructions in order" },
        },
        required: ["name", "emoji", "description", "time", "servings", "difficulty", "tags", "ingredients", "steps"],
        additionalProperties: false,
      },
    },
  },
  required: ["recipes"],
  additionalProperties: false,
};

const RECIPE_SYSTEM_PROMPT = `You are the recipe assistant inside FridgeIQ, a phone app that helps people cook with what they already have and waste less food.

Suggest realistic, tasty home-cooking recipes that a beginner could follow. Build each recipe mainly from the food the user has, and favour food that expires soonest. A recipe may need a few extra ingredients the user doesn't have; keep those to a minimum.

Assume the cook already has salt, pepper, cooking oil and water, and leave those out of the ingredient list. Write ingredient names plainly and briefly (for example "Broccoli", "Cheddar cheese", "Eggs") so the app can match them against the fridge. Give amounts in everyday units.

Write 5 to 10 cooking steps per recipe. Each step is one or two short sentences, in the order the cook does them, and includes temperatures and times where they matter. Mention food-safety points (such as cooking chicken through) when relevant.

Tag a recipe "Use Before Lose" when it uses food expiring within 3 days. Only tag "Vegetarian" or "Vegan" when that is true of every ingredient.`;

/*
  fridgeItems: [{ name, daysLeft }]   (daysLeft can be null)
  options:     { focus: "Broccoli", filter: "Vegetarian", count: 3 }
*/
async function generateRecipes(fridgeItems, options) {
  const count = (options && options.count) || 3;
  const lines = fridgeItems.map((item) => {
    if (item.daysLeft === null || item.daysLeft === undefined) return `- ${item.name}`;
    if (item.daysLeft < 0) return `- ${item.name} (past its date, only use if it still looks and smells fine)`;
    if (item.daysLeft === 0) return `- ${item.name} (expires today)`;
    if (item.daysLeft === 1) return `- ${item.name} (expires tomorrow)`;
    return `- ${item.name} (expires in ${item.daysLeft} days)`;
  });

  let request = `Here is what's in my kitchen right now:\n${lines.join("\n") || "- (nothing yet)"}\n\nPlease suggest ${count} different recipes.`;
  if (options && options.focus) request += ` Every recipe must use ${options.focus}.`;
  if (options && options.filter === "Use Before Lose") request += " Focus on the food that expires soonest.";
  else if (options && options.filter) request += ` Every recipe must be ${options.filter}.`;

  const answer = await askClaudeForJson(RECIPE_SYSTEM_PROMPT, request, RECIPES_SCHEMA);
  return Array.isArray(answer.recipes) ? answer.recipes : [];
}

/* ---------- 2. Cooking instructions for any recipe ---------- */

const STEPS_SCHEMA = {
  type: "object",
  properties: {
    steps: { type: "array", items: { type: "string" }, description: "Cooking instructions in order" },
  },
  required: ["steps"],
  additionalProperties: false,
};

async function generateInstructions(recipe) {
  const ingredients = recipe.ingredients.map((i) => `- ${i.name}: ${i.amount}`).join("\n");
  const request = `Write step-by-step cooking instructions for "${recipe.name}" (serves ${recipe.servings}, about ${recipe.time}, ${String(recipe.difficulty).toLowerCase()}).

Ingredients:
${ingredients}`;

  const answer = await askClaudeForJson(RECIPE_SYSTEM_PROMPT, request, STEPS_SCHEMA);
  return Array.isArray(answer.steps) ? answer.steps.filter((s) => typeof s === "string" && s.trim()) : [];
}
