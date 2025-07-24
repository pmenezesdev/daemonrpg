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
    const systemData = this.system;
    if (this.type !== "personagem") return;

    // --- Cálculos dos Atributos ---
    for (let [key, attribute] of Object.entries(systemData.attributes)) {
      attribute.test = attribute.value * 4;
    }
    systemData.attributes.fr.dmg = Math.floor(
      (systemData.attributes.fr.value - 13.5) / 2
    );

    // --- Cálculos dos Recursos ---
    const attributes = systemData.attributes;
    const details = systemData.details;
    systemData.resources.pv.max =
      Math.ceil((attributes.fr.value + attributes.con.value) / 2) +
      details.level.value;

    // --- Cálculos de Combate ---
    systemData.combat = systemData.combat || {};
    const armaduras = this.items.filter((item) => item.type === "armadura");
    let totalIp = 0;
    for (const armadura of armaduras) {
      totalIp += armadura.system.ip || 0;
    }
    systemData.combat.ip = totalIp;

    // --- Cálculo de Pontos de Perícia Gastos ---
    const pericias = this.items.filter((item) => item.type === "pericia");
    let pontosGastos = 0;
    for (const pericia of pericias) {
      pontosGastos += pericia.system.gasto || 0;
    }
    systemData.details.skillpoints.spent = pontosGastos;
  }
}
