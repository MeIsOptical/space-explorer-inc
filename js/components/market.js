

import { Gear } from "./gear.js";
import { showFloatingMessage } from "../utils/ui.js";
import { RUN_CONFIG } from "../main.js";



export class Market {
    constructor(pId) {
        this.id = pId;
    }

    async build() {
        // fetch market manifest
        const response = await fetch("assets/markets/" + this.id + "/manifest.json");
        const data = await response.json();

        // assign properties
        Object.assign(this, data);
    }

    buyItem(pItemId, pPlayer) {
        const price = this.offers[pItemId];
        const priceCents = pPlayer.credits.parseToCents(price);

        // check if player has enough credits
        if (pPlayer.credits.currency >= priceCents || RUN_CONFIG.dev) {
            
            // check if inventory has space
            if (pPlayer.totalGearCount >= pPlayer.maxGearCapacity) {
                showFloatingMessage("INVENTORY FULL!", "#ff4848");
                return false;
            }

            if (!RUN_CONFIG.dev) pPlayer.credits.addCents(-priceCents);

            // create and give new gear
            const newGear = new Gear(pItemId, pPlayer.gearManager);
            pPlayer.giveGear(newGear);

            // show success message
            showFloatingMessage("PURCHASED!", "#52b752");

            return true;

        } else {
            // show error message
            showFloatingMessage("NOT ENOUGH CREDITS!", "#ff4848");
            return false;
        }
        return false;
    }


}