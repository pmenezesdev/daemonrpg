/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class DaemonItem extends Item {
  /** @override */
  prepareData() {
    super.prepareData();
    if (this.type === "arma") this._prepareArmaData();
    if (this.type === "pericia") this._preparePericiaData();
    if (this.type === "pericia-combate") this._preparePericiaCombateData();
  }

  _prepareArmaData() {
    const itemData = this.system;
    itemData.critical = Math.floor(itemData.attack / 4);
  }

  _preparePericiaData() {
    const itemData = this.system;
    if (!this.actor) {
      itemData.total = itemData.gasto || 0;
      return;
    }
    const baseAttributeKey = itemData.attribute || "none";
    const baseAttributeValue =
      baseAttributeKey !== "none"
        ? this.actor.system.attributes[baseAttributeKey]?.value || 0
        : 0;
    itemData.total = (itemData.gasto || 0) + baseAttributeValue;
  }

  _preparePericiaCombateData() {
    const itemData = this.system;
    if (!this.actor) {
      itemData.total_atk = itemData.gasto_atk || 0;
      itemData.total_def = itemData.gasto_def || 0;
      return;
    }

    // LÓGICA DO CUSTO DOBRADO (aplica-se apenas ao ataque)
    const pontosGastosAtk = itemData.gasto_atk || 0;
    const pontosEfetivosAtk = itemData.custoDobrado ? Math.floor(pontosGastosAtk / 2) : pontosGastosAtk;
    const pontosGastosDef = itemData.gasto_def || 0; // A defesa nunca tem custo dobrado

    const baseAttributeKey = itemData.attribute || "none";
    const baseAttributeValue = baseAttributeKey !== "none" ? this.actor.system.attributes[baseAttributeKey]?.value || 0 : 0;

    itemData.total_atk = pontosEfetivosAtk + baseAttributeValue;
    itemData.total_def = pontosGastosDef + baseAttributeValue;
  }

  async roll() {
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get("core", "rollMode");
    let flavor = ``;

    switch (this.type) {
      case "pericia":
        new Dialog({
          title: `Teste de Perícia: ${this.name}`,
          content: `<p>Escolha a dificuldade do teste para ${this.name} (${this.system.total}%)</p>`,
          buttons: {
            dificil: {
              label: "Difícil (Metade)",
              callback: () =>
                this._realizarTeste(Math.floor(this.system.total / 2)),
            },
            normal: {
              label: "Normal",
              callback: () => this._realizarTeste(this.system.total),
            },
            facil: {
              label: "Fácil (Dobro)",
              callback: () =>
                this._realizarTeste(Math.min(this.system.total * 2, 95)),
            },
          },
          default: "normal",
        }).render(true);
        break;
      case "arma":
        flavor = `Rolando Dano: <strong>${this.name}</strong>`;
        const danoRoll = new Roll(this.system.damage, this.actor.getRollData());
        await danoRoll.evaluate({ async: true });

        // LÓGICA CONDICIONAL DO BÔNUS DE FORÇA
        let bonusDano = 0;
        let formulaDano = danoRoll.formula;
        if (this.system.weaponType === "corporal") {
          bonusDano = this.actor.system.attributes.fr.dmg || 0;
          formulaDano += ` + ${bonusDano} (FR)`;
        }

        const totalDano = danoRoll.total + bonusDano;
        danoRoll.toMessage({
          speaker: speaker,
          rollMode: rollMode,
          flavor: flavor,
          content: `<div class="dice-roll"><div class="dice-result"><h4 class="dice-total">${totalDano}</h4><div class="dice-formula">${formulaDano}</div></div></div>`,
        });
        break;
      default:
        flavor = `Usando: <strong>${this.name}</strong>`;
        ChatMessage.create({
          speaker: speaker,
          rollMode: rollMode,
          flavor: flavor,
          content: this.system.description?.value || "",
        });
        break;
    }
  }

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
