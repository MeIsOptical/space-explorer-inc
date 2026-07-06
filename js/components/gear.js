


export class Gear {
    constructor(pId, pGearManager) {
        this.id = pId;

        Object.assign(this, pGearManager.gearTypes[pId]);
    }
}