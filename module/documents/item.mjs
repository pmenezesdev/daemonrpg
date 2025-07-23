/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class DaemonItem extends Item {
  /**
   * @override
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    super.prepareData();

    // Calcula o valor de acerto crítico para armas.
    if (this.type === "arma") {
      this._prepareArmaData();
    }
  }

  /**
   * Calcula dados derivados para itens do tipo 'arma'.
   */
  _prepareArmaData() {
    const itemData = this.system;
    // Regra do Acerto Crítico (pág. 3): Valor de Ataque / 4
    itemData.critical = Math.floor(itemData.attack / 4);
  }

  /**
   * Lida com a rolagem de um item.
   * @param {Event} event O evento de clique original.
   */
  // Dentro da classe DaemonItem
  async roll() {
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get("core", "rollMode");
    let flavor = ``;

    switch (this.type) {
      case "pericia":
        // Abre um diálogo para escolher a dificuldade do teste de perícia
        new Dialog({
          title: `Teste de Perícia: ${this.name}`,
          content: `<p>Escolha a dificuldade do teste para ${this.name} (${this.system.value}%)</p>`,
          buttons: {
            dificil: {
              label: "Difícil (Metade)",
              callback: () =>
                this._realizarTeste(Math.floor(this.system.value / 2)),
            },
            normal: {
              label: "Normal",
              callback: () => this._realizarTeste(this.system.value),
            },
            facil: {
              label: "Fácil (Dobro)",
              callback: () =>
                this._realizarTeste(Math.min(this.system.value * 2, 95)), // O máximo é 95
            },
          },
          default: "normal",
        }).render(true);
        break;

      // ... (o código para 'arma' e 'default' continua o mesmo de antes)
      case "arma":
        flavor = `Rolando Dano: <strong>${this.name}</strong>`;
        const danoRoll = new Roll(this.system.damage, this.actor.getRollData());
        await danoRoll.evaluate({ async: true });

        const bonusDano = this.actor.system.attributes.fr.dmg || 0;
        const totalDano = danoRoll.total + bonusDano;

        danoRoll.toMessage({
          speaker: speaker,
          rollMode: rollMode,
          flavor: flavor,
          content: `<div class="dice-roll"><div class="dice-result"><h4 class="dice-total">${totalDano}</h4><div class="dice-formula">${danoRoll.formula} + ${bonusDano} (FR)</div></div></div>`,
        });
        break;

      default:
        flavor = `Usando: <strong>${this.name}</strong>`;
        ChatMessage.create({
          speaker: speaker,
          rollMode: rollMode,
          flavor: flavor,
          content: this.system.description.value,
        });
        break;
    }
  }

  /**
   * NOVO MÉTODO HELPER para realizar o teste de 1d100 e enviar ao chat.
   * @param {number} valorAlvo O valor final a ser testado (já com modificadores).
   * @private
   */
  async _realizarTeste(valorAlvo) {
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get("core", "rollMode");
    const roll = new Roll("1d100");
    await roll.evaluate({ async: true });

    const success = roll.total <= valorAlvo && roll.total <= 95;
    let flavor = `Teste de Perícia: <strong>${this.name}</strong>`;
    flavor += success ? ` (Sucesso!)` : ` (Falha!)`;

    roll.toMessage({
      speaker: speaker,
      rollMode: rollMode,
      flavor: flavor,
      content: `<div class="dice-roll"><div class="dice-result"><h4 class="dice-total ${
        success ? "success" : "failure"
      }">${
        roll.total
      }</h4><div class="dice-formula">/ ${valorAlvo}%</div></div></div>`,
    });
  }
}
