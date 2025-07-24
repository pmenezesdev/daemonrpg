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

    // --- APLICAÇÃO DE PENALIDADES DE ARMADURA ---
    for (let attr of Object.values(systemData.attributes)) {
      attr.mod = attr.value;
    }
    const equippedArmors = this.items.filter(
      (i) => i.type === "armadura" && i.system.equipped
    );
    let penaltyDex = 0;
    let penaltyAgi = 0;
    for (const armor of equippedArmors) {
      penaltyDex += armor.system.penalties?.dex || 0;
      penaltyAgi += armor.system.penalties?.agi || 0;
    }
    systemData.attributes.dex.mod -= penaltyDex;
    systemData.attributes.agi.mod -= penaltyAgi;

    // --- CÁLCULOS DOS ATRIBUTOS ---
    for (let [key, attribute] of Object.entries(systemData.attributes)) {
      attribute.test = attribute.mod * 4;
    }
    systemData.attributes.fr.dmg = Math.floor(
      (systemData.attributes.fr.value - 13.5) / 2
    );

    // --- CÁLCULOS DOS RECURSOS ---
    systemData.resources.pv.max =
      Math.ceil(
        (systemData.attributes.fr.value + systemData.attributes.con.value) / 2
      ) + systemData.details.level.value;

    // --- CÁLCULOS DE COMBATE ---
    systemData.combat = systemData.combat || {};
    let totalIp = 0;
    for (const armor of equippedArmors) {
      totalIp += armor.system.ip?.cinetico || 0;
    }
    systemData.combat.ip = totalIp;

    // --- CÁLCULO DE PONTOS DE PERÍCIA GASTOS (CORRIGIDO) ---
    let pontosGastos = 0;
    // Soma os pontos de perícias normais
    const pericias = this.items.filter((item) => item.type === "pericia");
    for (const pericia of pericias) {
      pontosGastos += pericia.system.gasto || 0;
    }
    // Soma os pontos de perícias de combate (ataque e defesa)
    const periciasCombate = this.items.filter(
      (item) => item.type === "pericia-combate"
    );
    for (const periciaC of periciasCombate) {
      pontosGastos += periciaC.system.gasto_atk || 0;
      pontosGastos += periciaC.system.gasto_def || 0;
    }
    systemData.details.skillpoints.spent = pontosGastos;
  }
}
