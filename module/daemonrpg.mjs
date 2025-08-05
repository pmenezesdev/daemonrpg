// Import document classes.
import { DaemonActor } from "./documents/actor.mjs";
import { DaemonItem } from "./documents/item.mjs";

// Import sheet classes.
import { DaemonActorSheet } from "./sheets/actor-sheet.mjs";
import { DaemonItemSheet } from "./sheets/item-sheet.mjs";

// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { DAEMON } from "./helpers/config.mjs";

// Importar folhas de estilo adicionais
const daemonExtensionsCss = "daemon-extensions.css";
const cssPath = "systems/daemonrpg/css/";

/**
 * Função auxiliar para carregar folhas de estilo
 * @param {string} path - Caminho para o arquivo CSS
 */
function loadStylesheet(path) {
  const head = document.getElementsByTagName("head")[0];
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = path;
  link.media = "all";
  head.appendChild(link);
}


/* -------------------------------------------- */
/* Init Hook                                   */
/* -------------------------------------------- */

Hooks.once("init", function () {
  console.log("Daemon RPG | Initializing System");
  
  // Carregar folhas de estilo adicionais
  loadStylesheet(cssPath + daemonExtensionsCss);

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

// ================================================================= //
// ===== HOOKS PARA APLICAÇÃO DE DANO E STATUS DE SAÚDE ============= //
// ================================================================= //

// Este Hook é ativado toda vez que uma mensagem é renderizada no chat.
Hooks.on("renderChatMessage", (chatMessage, html, messageData) => {
  // Encontra qualquer botão com a classe .apply-damage dentro da mensagem
  const applyButton = html.find(".apply-damage");

  // Se encontrar um botão, adiciona um "listener" de clique a ele
  if (applyButton.length > 0) {
    applyButton.on("click", (event) => {
      // Pega a quantidade de dano do atributo 'data-damage' do botão
      const damage = parseInt(event.currentTarget.dataset.damage);

      // Pega todos os tokens que estão selecionados no mapa
      const selectedTokens = canvas.tokens.controlled;

      // Se nenhum token estiver selecionado, exibe um aviso
      if (selectedTokens.length === 0) {
        ui.notifications.warn(
          "Por favor, selecione um ou mais tokens para aplicar o dano."
        );
        return;
      }

      // Itera sobre cada token selecionado para aplicar o dano
      selectedTokens.forEach((token) => {
        const actor = token.actor;
        const ip = actor.system.combat.ip || 0;
        const pv = actor.system.resources.pv;

        // Regra de Dano de Impacto (pág. 25): Dano mínimo de 1, mesmo se o IP absorver tudo.
        const danoFinal = Math.max(1, damage - ip);
        const novosPV = Math.max(0, pv.value - danoFinal);

        // Atualiza os Pontos de Vida do ator
        actor.update({ "system.resources.pv.value": novosPV });

        // Mostra o dano sofrido no token (aqueles números que flutuam)
        token.showFloatyText({ damage: -danoFinal });
        
        // Verifica se o personagem ficou inconsciente (PV <= 0)
        if (novosPV <= 0) {
          // Adiciona o efeito de inconsciente ao token
          const unconsciousEffect = {
            label: "Inconsciente",
            icon: "icons/svg/unconscious.svg",
            changes: [],
            flags: { core: { statusId: "unconscious" } }
          };
          
          // Verifica se o efeito já existe antes de adicionar
          const existingEffect = actor.effects.find(e => e.flags?.core?.statusId === "unconscious");
          if (!existingEffect) {
            actor.createEmbeddedDocuments("ActiveEffect", [unconsciousEffect]);
            ui.notifications.info(`${actor.name} ficou inconsciente!`);
          }
        }
      });
    });
  }
});

// Hook para remover o status de inconsciente quando o personagem recupera PVs acima de 0
Hooks.on("updateActor", (actor, changes, options, userId) => {
  if (!foundry.utils.hasProperty(changes, "system.resources.pv.value")) return;

  const newPV = changes.system.resources.pv.value;
  
  // Se os PVs foram restaurados para acima de 0, remove o efeito de inconsciente
  if (newPV > 0) {
    const unconsciousEffect = actor.effects.find(e => e.flags?.core?.statusId === "unconscious");
    if (unconsciousEffect) {
      actor.deleteEmbeddedDocuments("ActiveEffect", [unconsciousEffect.id]);
      ui.notifications.info(`${actor.name} recuperou a consciência!`);
    }
  }
});
