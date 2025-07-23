/**
 * Extend the base Actor document by defining a custom roll data structure for the Daemon system.
 * @extends {Actor}
 */
export class DaemonActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
  }

  /**
   * @override
   */
  prepareDerivedData() {
    console.log(
      "Daemon | Preparando dados para o ator:",
      this.name,
      this.system
    );
    const systemData = this.system;
    // --- Garante que este código só rode para atores do tipo "personagem" ---
    if (this.type !== "personagem") return;

    // --- Cálculos dos Atributos ---
    for (let [key, attribute] of Object.entries(systemData.attributes)) {
      // Regra do Daemon (pág. 5): Valor de Teste = Valor do Atributo x 4.
      attribute.test = attribute.value * 4;
    }

    // Regra do Bônus de Dano (pág. 9): (Força - 13.5) / 2
    systemData.attributes.fr.dmg = Math.floor(
      (systemData.attributes.fr.value - 13.5) / 2
    );

    // --- Cálculos dos Recursos ---
    const attributes = systemData.attributes;
    const details = systemData.details;

    // Regra dos Pontos de Vida (pág. 6): (Força + Constituição) / 2 + Nível.
    systemData.resources.pv.max =
      Math.ceil((attributes.fr.value + attributes.con.value) / 2) +
      details.level.value;
  }
}
