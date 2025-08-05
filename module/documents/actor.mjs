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

    // --- CÁLCULO DE PONTOS DE PERÍCIA GASTOS ---
    let pontosGastos = 0;
    const pericias = this.items.filter((item) => item.type === "pericia");
    for (const pericia of pericias) {
      pontosGastos += pericia.system.gasto || 0;
    }
    const periciasCombate = this.items.filter(
      (item) => item.type === "pericia-combate"
    );
    for (const periciaC of periciasCombate) {
      pontosGastos += periciaC.system.gasto_atk || 0;
      pontosGastos += periciaC.system.gasto_def || 0;
    }
    systemData.details.skillpoints.spent = pontosGastos;

    // --- CÁLCULO DE PONTOS DE APRIMORAMENTO ---
    systemData.details.aprimoramentos = systemData.details.aprimoramentos || {};
    const aprimoramentos = this.items.filter(
      (item) => item.type === "aprimoramento"
    );
    let pontosPositivos = 0;
    let pontosNegativos = 0;
    for (const aprimoramento of aprimoramentos) {
      const cost = aprimoramento.system.cost || 0;
      if (cost > 0) {
        pontosPositivos += cost;
      } else {
        pontosNegativos += cost;
      }
    }
    systemData.details.aprimoramentos.positivos = pontosPositivos;
    systemData.details.aprimoramentos.negativos = Math.abs(pontosNegativos);
    const pontosIniciais =
      systemData.details.creation?.aprimoramentos_pos ??
      game.settings.get(
        "daemonrpg",
        "creationPositiveAprimoramentos"
      );
    systemData.details.aprimoramentos.iniciais = pontosIniciais;
    systemData.details.aprimoramentos.disponivel =
      pontosIniciais +
      systemData.details.aprimoramentos.negativos -
      pontosPositivos;

    // --- CÁLCULO DE PONTOS DE CYBERWARE ---
    systemData.details.cyberware = systemData.details.cyberware || {
      total: 0,
      spent: 0,
    };
    let cyberwareBudget = 0;
    const aprimoramentoCibernetico = this.items.find(
      (item) =>
        item.type === "aprimoramento" &&
        item.name.toLowerCase().startsWith("cibernéticos")
    );
    if (aprimoramentoCibernetico) {
      const cost = aprimoramentoCibernetico.system.cost || 0;
      switch (cost) {
        case 1:
          cyberwareBudget = 1;
          break;
        case 2:
          cyberwareBudget = 3;
          break;
        case 3:
          cyberwareBudget = 5;
          break;
        case 4:
          cyberwareBudget = 7;
          break;
        case 5:
          cyberwareBudget = 10;
          break;
        case 6:
          cyberwareBudget = 13;
          break;
        case 7:
          cyberwareBudget = 16;
          break;
        case 8:
          cyberwareBudget = 19;
          break;
        case 9:
          cyberwareBudget = 23;
          break;
        case 10:
          cyberwareBudget = 27;
          break;
      }
    }
    systemData.details.cyberware.total = cyberwareBudget;

    const cyberwaresInstalados = this.items.filter(
      (item) => item.type === "cyberware"
    );
    let pontosGastosCyber = 0;
    for (const cyber of cyberwaresInstalados) {
      pontosGastosCyber += cyber.system.cost || 0;
    }
    systemData.details.cyberware.spent = pontosGastosCyber;
  }
}
