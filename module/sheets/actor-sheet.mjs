export class DaemonActorSheet extends ActorSheet {
  // ... (static get defaultOptions e getData continuam os mesmos de antes) ...
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["daemonrpg", "sheet", "actor"],
      template: "systems/daemonrpg/templates/actor/personagem-sheet.hbs",
      width: 720,
      height: 680,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "principal",
        },
      ],
    });
  }

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

    for (const i of context.items) {
      switch (i.type) {
        case "pericia":
          pericias.push(i);
          break;
        case "aprimoramento":
          aprimoramentos.push(i);
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
      }
    }

    context.system.pericias = pericias;
    context.system.aprimoramentos = aprimoramentos;
    context.system.armas = armas;
    context.system.armaduras = armaduras;
    context.system.itens = itens;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Listeners existentes
    html.find(".roll-attribute").on("click", this._onAttributeRoll.bind(this));
    html.find(".item .rollable").on("click", this._onItemRoll.bind(this));
    html.find(".item-edit").on("click", this._onItemEdit.bind(this));
    html.find(".item-delete").on("click", this._onItemDelete.bind(this));
    html.find(".item-create").on("click", this._onItemCreate.bind(this));

    // NOVO LISTENER PARA O BOTÃO DE ATAQUE
    html.find(".item-attack").on("click", this._onItemAttack.bind(this));
  }

  // ... (_onAttributeRoll, _onItemRoll, _onItemEdit continuam aqui) ...
  // ... (Adicione _onItemDelete e _onItemCreate se não os tiver) ...

  /**
   * NOVA FUNÇÃO PARA ROLAGEM DE ATAQUE
   * @param {Event} event O evento de clique.
   * @private
   */
  async _onItemAttack(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);

    // HTML para a janela de diálogo
    const content = `
      <form>
        <div class="form-group">
          <label>Defesa do Alvo</label>
          <input type="number" name="defesaAlvo" value="30"/>
        </div>
      </form>
    `;

    // Cria e exibe a janela de diálogo
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
            const ataquePersonagem = item.system.attack || 0;

            // Regra de Ataque do Daemon
            const chance = 50 + ataquePersonagem - defesaAlvo;
            const roll = new Roll("1d100");
            await roll.evaluate({ async: true });

            const critico =
              item.system.critical || Math.floor(ataquePersonagem / 4);
            const isSuccess = roll.total <= chance;
            const isCritical = roll.total <= critico;

            let flavor = `Teste de Ataque: <strong>${item.name}</strong> vs Defesa ${defesaAlvo}`;
            if (isCritical) {
              flavor += ` (Acerto Crítico!)`;
            } else if (isSuccess) {
              flavor += ` (Sucesso!)`;
            } else {
              flavor += ` (Falha!)`;
            }

            // Envia o resultado para o chat
            await roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: flavor,
            });

            // Se acertou, rola o dano
            if (isSuccess) {
              // Rola o dano 1x para sucesso normal, 2x para crítico
              const danoFormula = isCritical
                ? `2 * (${item.system.damage})`
                : item.system.damage;
              const danoRoll = new Roll(danoFormula, this.actor.getRollData());
              await danoRoll.evaluate({ async: true });

              const bonusDano = this.actor.system.attributes.fr.dmg || 0;
              const totalDano = danoRoll.total + bonusDano;

              await danoRoll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                flavor: `Dano com <strong>${item.name}</strong>`,
                content: `<div class="dice-roll"><div class="dice-result"><h4 class="dice-total">${totalDano}</h4></div></div>`,
              });
            }
          },
        },
        cancelar: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar",
        },
      },
      default: "atacar",
    }).render(true);
  }

  // Adicione estas funções se elas não estiverem no seu arquivo.
  // Elas permitem criar e deletar itens diretamente da ficha.
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

  // Dentro da classe DaemonActorSheet

  /**
   * Lida com a rolagem de um teste de atributo, agora com diálogo de dificuldade.
   * @param {Event} event O evento de clique original.
   * @private
   */
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

  _onItemRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const itemId = element.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    return item.roll();
  }
}
