/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class DaemonItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["daemonrpg", "sheet", "item"],
      width: 520,
      height: 480,
    });
  }

  /**
   * @override
   * Carrega o template HTML baseado no tipo do item.
   */
  get template() {
    const path = "systems/daemonrpg/templates/item";
    return `${path}/item-${this.item.type}-sheet.hbs`;
  }

  /** @override */
  async getData() {
    const context = await super.getData();
    context.system = context.item.system;
    return context;
  }
}
