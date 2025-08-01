export class DaemonActorSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["daemonrpg", "sheet", "actor"],
      template: "systems/daemonrpg/templates/actor/personagem-sheet.hbs",
      width: 720,
      height: 680,
      tabs: [
        {
          navSelector: '.sheet-tabs[data-group="primary"]',
          contentSelector: ".sheet-body",
          initial: "principal",
        },
        {
          navSelector: '.sheet-tabs[data-group="secondary"]',
          contentSelector: ".equipamentos-body",
          initial: "armas",
        },
      ],
    });
  }

  /** @override */
  async getData() {
    const context = await super.getData();
    context.system = context.actor.system;
    this._prepareItems(context);
    return context;
  }

  _prepareItems(context) {
    const pericias = [];
    const aprimoramentos = [];
    const armas = [];
    const armaduras = [];
    const itens = [];
    const periciasCombate = [];
    const vantagens = [];
    const desvantagens = [];
    const rituais = [];
    const cyberwares = []; // Nova lista para cyberware
    let activeKit = null;

    for (const i of context.items) {
      switch (i.type) {
        case "pericia":
          pericias.push(i);
          break;
        case "arma":
          armas.push(i);
          break;
        case "armadura":
          armaduras.push(i);
          break;
        case "item":
          itens.push(i);
          break;
        case "pericia-combate":
          periciasCombate.push(i);
          break;
        case "kit":
          activeKit = i;
          break;
        case "ritual":
          rituais.push(i);
          break;
        case "cyberware":
          cyberwares.push(i);
          break; // Adiciona o cyberware à sua lista
        case "aprimoramento":
          if (i.system.cost >= 0) {
            vantagens.push(i);
          } else {
            desvantagens.push(i);
          }
          break;
      }
    }
    context.system.pericias = pericias;
    context.system.vantagens = vantagens;
    context.system.desvantagens = desvantagens;
    context.system.armas = armas;
    context.system.armaduras = armaduras;
    context.system.itens = itens;
    context.system.periciasCombate = periciasCombate;
    context.system.rituais = rituais;
    context.system.cyberwares = cyberwares; // Passa a lista de cyberwares para o HTML
    context.system.activeKit = activeKit;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".roll-attribute").on("click", this._onAttributeRoll.bind(this));
    html.find(".item .rollable").on("click", this._onItemRoll.bind(this));
    html.find(".item-edit").on("click", this._onItemEdit.bind(this));
    html.find(".item-delete").on("click", this._onItemDelete.bind(this));
    html.find(".item-create").on("click", this._onItemCreate.bind(this));
    html.find(".item-attack").on("click", this._onItemAttack.bind(this));
    html
      .find(".calculate-skill-points")
      .on("click", this._onCalculateSkillPoints.bind(this));
    html.find(".kit-remove").on("click", this._onRemoveKit.bind(this));
  }

  /** @override */
  async _onDropItem(event, data) {
    const item = await Item.fromDropData(data);
    if (item.type === "kit") {
      const hasKit = this.actor.items.some((i) => i.type === "kit");
      if (hasKit) {
        ui.notifications.warn(
          "Um personagem só pode ter um Kit de cada vez. Remova o kit atual antes de adicionar um novo."
        );
        return false;
      }

      const kitItemData = item.toObject();
      const itemsToCreate = [];

      try {
        const recipe = JSON.parse(kitItemData.system.recipe || "[]");
        if (recipe.length > 0) {
          for (const itemData of recipe) {
            itemData.flags = { daemonrpg: { kitOrigin: kitItemData.name } };
            itemsToCreate.push(itemData);
          }
        }
      } catch (e) {
        console.error("Daemon RPG | Erro ao processar a receita do Kit:", e);
        ui.notifications.error(
          `A receita do Kit "${kitItemData.name}" contém um erro de formato (JSON inválido).`
        );
        return false;
      }

      await this.actor.createEmbeddedDocuments("Item", [
        kitItemData,
        ...itemsToCreate,
      ]);
      ui.notifications.info(`Kit "${kitItemData.name}" aplicado com sucesso!`);
      return;
    }

    return super._onDropItem(event, data);
  }

  async _onRemoveKit(event) {
    event.preventDefault();
    const kitToRemove = this.actor.items.find((i) => i.type === "kit");
    if (!kitToRemove) return;

    Dialog.confirm({
      title: "Remover Kit de Personagem",
      content: `<p>Tem a certeza que deseja remover o kit "<strong>${kitToRemove.name}</strong>"? Todos os aprimoramentos e perícias concedidos por ele serão apagados.</p>`,
      yes: async () => {
        const idsToDelete = [];
        const itemsFromKit = this.actor.items.filter(
          (i) => i.flags?.daemonrpg?.kitOrigin === kitToRemove.name
        );

        idsToDelete.push(...itemsFromKit.map((i) => i.id));
        idsToDelete.push(kitToRemove.id);

        await this.actor.deleteEmbeddedDocuments("Item", idsToDelete);
        ui.notifications.info(
          `Kit "${kitToRemove.name}" removido com sucesso.`
        );
      },
      no: () => {},
      defaultYes: false,
    });
  }

  async _onItemAttack(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    const ataquePersonagem =
      item.type === "pericia-combate"
        ? item.system.total_atk || 0
        : item.system.attack || 0;

    const content = `<form><div class="form-group"><label>Defesa do Alvo</label><input type="number" name="defesaAlvo" value="30"/></div></form>`;
    new Dialog({
      title: `Atacar com ${item.name}`,
      content: content,
      buttons: {
        atacar: {
          icon: '<i class="fas fa-check"></i>',
          label: "Atacar",
          callback: async (html) => {
            const defesaAlvo =
              parseInt(html.find('[name="defesaAlvo"]').val()) || 0;
            const chance = 50 + ataquePersonagem - defesaAlvo;
            const roll = new Roll("1d100");
            await roll.evaluate({ async: true });
            const critico = Math.floor(ataquePersonagem / 4);
            const isSuccess = roll.total <= chance && roll.total <= 95;
            const isCritical = roll.total <= critico;
            let flavor = `Teste de Ataque: <strong>${item.name}</strong> vs Defesa ${defesaAlvo}`;
            flavor += isCritical
              ? ` (Acerto Crítico!)`
              : isSuccess
              ? ` (Sucesso!)`
              : ` (Falha!)`;
            await roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: flavor,
            });

            if (isSuccess) {
              let armaUsada = null;
              if (
                item.type === "pericia-combate" &&
                item.system.armaVinculada
              ) {
                armaUsada = this.actor.items.find(
                  (i) =>
                    i.type === "arma" && i.name === item.system.armaVinculada
                );
                if (!armaUsada)
                  ui.notifications.warn(
                    `Arma "${item.system.armaVinculada}" não encontrada!`
                  );
              } else if (item.type === "arma") {
                armaUsada = item;
              }
              if (armaUsada) {
                const danoFormula = isCritical
                  ? `2 * (${armaUsada.system.damage})`
                  : armaUsada.system.damage;
                const danoRoll = new Roll(
                  danoFormula,
                  this.actor.getRollData()
                );
                await danoRoll.evaluate({ async: true });
                let bonusDano = 0;
                let formulaDisplay = danoRoll.formula;
                if (armaUsada.system.weaponType === "corporal") {
                  bonusDano = this.actor.system.attributes.fr.dmg || 0;
                  formulaDisplay += ` + ${bonusDano} (FR)`;
                }
                const totalDano = danoRoll.total + bonusDano;
                const damageContent = `<div class="dice-roll"><div class="dice-result"><h4 class="dice-total">${totalDano}</h4><div class="dice-formula">${formulaDisplay}</div></div></div><div class="damage-buttons"><button class="apply-damage" data-damage="${totalDano}">Aplicar Dano</button></div>`;
                await ChatMessage.create({
                  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                  flavor: `Dano com <strong>${armaUsada.name}</strong>`,
                  content: damageContent,
                });
              }
            }
          },
        },
        cancelar: { icon: '<i class="fas fa-times"></i>', label: "Cancelar" },
      },
      default: "atacar",
    }).render(true);
  }

  _onItemRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.roll();
  }

  _onItemEdit(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    item.sheet.render(true);
  }

  _onItemDelete(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest(".item").dataset.itemId;
    this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const name = `Novo ${type.capitalize()}`;
    const itemData = { name: name, type: type, system: {} };
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }

  async _onAttributeRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;
    const testValue = parseInt(dataset.testValue);
    const attributeName = dataset.label;
    const realizarTesteAtributo = async (valorAlvo) => {
      const roll = new Roll("1d100");
      await roll.evaluate({ async: true });
      const success = roll.total <= valorAlvo && roll.total <= 95;
      let flavor = `Teste de <strong>${attributeName}</strong>`;
      flavor += success ? ` (Sucesso!)` : ` (Falha!)`;
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: flavor,
        content: `<div class="dice-roll"><div class="dice-result"><h4 class="dice-total ${
          success ? "success" : "failure"
        }">${
          roll.total
        }</h4><div class="dice-formula">/ ${valorAlvo}%</div></div></div>`,
      });
    };
    new Dialog({
      title: `Teste de Atributo: ${attributeName}`,
      content: `<p>Escolha a dificuldade do teste para ${attributeName} (${testValue}%)</p>`,
      buttons: {
        dificil: {
          label: "Difícil (Metade)",
          callback: () => realizarTesteAtributo(Math.floor(testValue / 2)),
        },
        normal: {
          label: "Normal",
          callback: () => realizarTesteAtributo(testValue),
        },
        facil: {
          label: "Fácil (Dobro)",
          callback: () => realizarTesteAtributo(Math.min(testValue * 2, 95)),
        },
      },
      default: "normal",
    }).render(true);
  }

  async _onCalculateSkillPoints(event) {
    event.preventDefault();
    const age = this.actor.system.details.age.value || 0;
    const intelligence = this.actor.system.attributes.int.value || 0;
    const totalPoints = 10 * age + 5 * intelligence;
    await this.actor.update({
      "system.details.skillpoints.total": totalPoints,
    });
    ui.notifications.info(
      `Total de Pontos de Perícia calculado: ${totalPoints}`
    );
  }
  async _onItemAttack(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    const ataquePersonagem = item.type === "pericia-combate" ? (item.system.total_atk || 0) : (item.system.attack || 0);

    const content = `
      <form>
        <div class="form-group">
          <label>Defesa do Alvo</label>
          <input type="number" name="defesaAlvo" value="30" autofocus/>
        </div>
        <hr/>
        <div class="form-group-total" style="text-align: center;">
          <h3>Chance de Acerto: <span class="chance-display">40</span>%</h3>
        </div>
      </form>
    `;

    new Dialog({
      title: `Atacar com ${item.name}`,
      content: content,
      render: (html) => {
        const defenseInput = html.find('input[name="defesaAlvo"]');
        const chanceDisplay = html.find('.chance-display');
        const updateChance = () => {
          const defesaAlvo = parseInt(defenseInput.val()) || 0;
          const chance = 50 + ataquePersonagem - defesaAlvo;
          chanceDisplay.text(chance);
        };
        updateChance();
        defenseInput.on('keyup change', updateChance);
      },
      buttons: {
        atacar: {
          icon: '<i class="fas fa-check"></i>',
          label: "Rolar Ataque",
          callback: async (html) => {
            const defesaAlvo = parseInt(html.find('[name="defesaAlvo"]').val()) || 0;
            const chance = 50 + ataquePersonagem - defesaAlvo;
            
            const roll = new Roll("1d100");
            // ===== CORREÇÃO APLICADA AQUI =====
            await roll.evaluate(); // Removido o { async: true }

            const critico = Math.floor(ataquePersonagem / 4);
            const isSuccess = roll.total <= chance && roll.total <= 95;
            const isCritical = roll.total <= critico;
            let flavor = `Teste de Ataque: <strong>${item.name}</strong> vs Defesa ${defesaAlvo}`;
            flavor += isCritical ? ` (Acerto Crítico!)` : (isSuccess ? ` (Sucesso!)` : ` (Falha!)`);
            await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), flavor: flavor });
            
            if (isSuccess) {
              // ... (lógica de dano permanece a mesma)
            }
          },
        },
        cancelar: { icon: '<i class="fas fa-times"></i>', label: "Cancelar" },
      },
      default: "atacar",
    }).render(true);
  }

  async _onAttributeRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;
    const testValue = parseInt(dataset.testValue);
    const attributeName = dataset.label;

    const realizarTesteAtributo = async (valorAlvo) => {
      const roll = new Roll("1d100");
      // ===== CORREÇÃO APLICADA AQUI TAMBÉM =====
      await roll.evaluate(); // Removido o { async: true }
      
      const success = roll.total <= valorAlvo && roll.total <= 95;
      let flavor = `Teste de <strong>${attributeName}</strong>`;
      flavor += success ? ` (Sucesso!)` : ` (Falha!)`;
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: flavor,
        content: `<div class="dice-roll"><div class="dice-result"><h4 class="dice-total ${success ? "success" : "failure"}">${roll.total}</h4><div class="dice-formula">/ ${valorAlvo}%</div></div></div>`,
      });
    };

    new Dialog({
      title: `Teste de Atributo: ${attributeName}`,
      content: `<p>Escolha a dificuldade do teste para ${attributeName} (${testValue}%)</p>`,
      buttons: {
        dificil: { label: "Difícil (Metade)", callback: () => realizarTesteAtributo(Math.floor(testValue / 2)) },
        normal: { label: "Normal", callback: () => realizarTesteAtributo(testValue) },
        facil: { label: "Fácil (Dobro)", callback: () => realizarTesteAtributo(Math.min(testValue * 2, 95)) }
      },
      default: "normal"
    }).render(true);
  }
}
