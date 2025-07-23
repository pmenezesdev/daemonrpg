// Import document classes.
import { DaemonActor } from "./documents/actor.mjs";
import { DaemonItem } from "./documents/item.mjs";

// Import sheet classes.
import { DaemonActorSheet } from "./sheets/actor-sheet.mjs";
import { DaemonItemSheet } from "./sheets/item-sheet.mjs";

// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { DAEMON } from "./helpers/config.mjs";

/* -------------------------------------------- */
/* Init Hook                                   */
/* -------------------------------------------- */

Hooks.once("init", function () {
  console.log("Daemon RPG | Initializing System");

  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.daemonrpg = {
    DaemonActor,
    DaemonItem,
    rollItemMacro,
  };

  // Add custom constants for configuration.
  CONFIG.DAEMON = DAEMON;

  /**
   * Set an initiative formula for the system
   * @type {String}
   *
   * A fórmula do Sistema Daemon é 1d10 + Agilidade.
   * O @attributes.agi.value pega o valor do atributo 'agi' do personagem.
   */
  CONFIG.Combat.initiative = {
    formula: "1d10 + @attributes.agi.value",
    decimals: 0, // Não precisamos de casas decimais para a iniciativa.
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = DaemonActor;
  CONFIG.Item.documentClass = DaemonItem;

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("daemonrpg", DaemonActorSheet, {
    makeDefault: true,
    label: "daemonrpg.SheetLabels.Actor", // Usaremos chaves de localização
  });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("daemonrpg", DaemonItemSheet, {
    makeDefault: true,
    label: "daemonrpg.SheetLabels.Item", // Usaremos chaves de localização
  });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/* Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper("toLowerCase", function (str) {
  return str.toLowerCase();
});

/* -------------------------------------------- */
/* Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));
});

/* -------------------------------------------- */
/* Hotbar Macros                               */
/* -------------------------------------------- */
/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== "Item") return;
  if (!data.uuid.includes("Actor.") && !data.uuid.includes("Token.")) {
    return ui.notifications.warn(
      "You can only create macro buttons for owned Items"
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);
  // Create the macro command using the uuid.
  const command = `game.daemonrpg.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "daemonrpg.itemMacro": true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}
/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: "Item",
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }
    // Trigger the item roll
    item.roll();
  });
}
