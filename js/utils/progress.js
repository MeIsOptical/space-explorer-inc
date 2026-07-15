


import { Gear } from "../components/gear.js";
import { updateXpBarUI } from "./ui.js";





export async function loadProgress(pSetLoadingStatus, pPlayer, pPlanetMap, pGearManager) {


    const loadedData = await pPlayer.database.readData();

    // load save data if it exists
    if (loadedData && loadedData.player) {

        pSetLoadingStatus("Restoring progress...");

        const lp = loadedData.player; // shorthand

        // level & xp
        if (lp.level !== undefined) pPlayer.level = lp.level;
        if (lp.xp !== undefined) pPlayer.xp = lp.xp;
        if (lp.levelPoints !== undefined) pPlayer.levelPts = lp.levelPoints;

        // research
        if (lp.activeResearch !== undefined) pPlayer.activeResearch = lp.activeResearch;

        // currencies
        if (lp.credits !== undefined) {
            pPlayer.credits.setCents(lp.credits);
            pPlayer.credits.displayElement.innerText = pPlayer.credits.display();
        }

        // unlocked planets
        if (lp.unlockedPlanets !== undefined) {
            pPlayer.unlockedPlanets = lp.unlockedPlanets;
        }

        // set current planet
        if (lp.currentPlanetId !== undefined) {
            const savedPlanet = pPlanetMap.getPlanetById(lp.currentPlanetId);
            if (savedPlanet) pPlayer.landOn(savedPlanet);
        }

        // skill tree
        if (lp.skillTreeNodes !== undefined) {
            pPlayer.skillTree.unlockedNodes = lp.skillTreeNodes;
            pPlayer.skillTree.updateLiveUI();
            updateXpBarUI(pPlayer);
        }

        // read mail
        if (lp.pastMail !== undefined) {
            pPlayer.pastMail = lp.pastMail;
        }

        // gear inventory
        if (lp.gear !== undefined) {
            pPlayer.gear = []; // clear defaults
            lp.gear.forEach(gearId => {
                pPlayer.gear.push(new Gear(gearId, pGearManager));
            });

            // reconnect equipped gear using saved indices
            if (lp.equipped !== undefined) {
                pPlayer.equipped = {};
                Object.entries(lp.equipped).forEach(([slot, invIndex]) => {
                    if (pPlayer.gear[invIndex]) {
                        pPlayer.equipGear(pPlayer.gear[invIndex]);
                    }
                });
            }
        }

        // resources
        if (lp.resources !== undefined) {
            Object.entries(lp.resources).forEach(([key, value]) => {
                if (pPlayer.resources[key] !== undefined) {
                    pPlayer.resources[key] = value;
                }
            });
        }

    }


}







export async function saveProgress(pPlayer) {
    

    // map gear objects to simple string ids
    const gearIds = pPlayer.gear.map(g => g.id);
    
    // map equipped gear to their index in the inventory array
    const equippedIndices = {};
    Object.entries(pPlayer.equipped).forEach(([slot, gearItem]) => {
        equippedIndices[slot] = pPlayer.gear.indexOf(gearItem);
    });


    const currentData = {
        player: {
            // stats
            level: pPlayer.level,
            xp: pPlayer.xp,
            levelPoints: pPlayer.levelPts,

            // research
            activeResearch: pPlayer.activeResearch,
            
            // currencies
            credits: pPlayer.credits.currency,

            // progression
            unlockedPlanets: pPlayer.unlockedPlanets,
            currentPlanetId: pPlayer.currentPlanet.id,
            skillTreeNodes: pPlayer.skillTree.unlockedNodes,

            // gear
            gear: gearIds,
            equipped: equippedIndices,

            // resources
            resources: pPlayer.resources,

            // mailbox
            pastMail: pPlayer.pastMail
        }
    };

    await pPlayer.database.saveData(currentData);


}