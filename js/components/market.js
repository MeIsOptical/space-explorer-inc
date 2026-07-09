

import { Gear } from "./gear.js";
import { showFloatingMessage } from "../utils/ui.js";
import { RUN_CONFIG } from "../main.js";
import { playSound, SOUND_IDS } from "../systems/audio.js";



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
        const listingData = this.offers[pItemId];
        const price = listingData.price || listingData;
        const priceCents = pPlayer.credits.parseToCents(price);

        const priceDue = RUN_CONFIG.dev ? 0 : priceCents;

        // check if player has enough credits
        if (pPlayer.credits.currency >= priceDue) {


            if (this.type === "research") {
                // start research
                if (pPlayer.startResearch(pItemId, this.id, listingData.duration * 60)) {
                    // show success message
                    showFloatingMessage("RESEARCH STARTED!", "#52b752");
                }
                else {
                    showFloatingMessage("LAB FULL!", "#ff4848");
                    return false;
                }
            }



            else {
                // check if inventory has space
                if (pPlayer.totalGearCount >= pPlayer.maxGearCapacity) {
                    showFloatingMessage("INVENTORY FULL!", "#ff4848");
                    return false;
                }

                // create and give new gear
                const newGear = new Gear(pItemId, pPlayer.gearManager);
                pPlayer.giveGear(newGear);

                // show success message
                showFloatingMessage("PURCHASED!", "#52b752");
            }



            if (priceDue > 0) pPlayer.credits.addCents(-priceCents);
            playSound(SOUND_IDS.buyGear);
            return true;
            


        }
        else {
            // show error message
            showFloatingMessage("NOT ENOUGH CREDITS!", "#ff4848");
            return false;
        }
    }


}