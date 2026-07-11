


import { playSound, SOUND_IDS } from "./audio.js";
import { formatBigNumber } from "../utils/formatting.js";
import { SkillTree } from "../components/skillTree.js";
import { updateXpBarUI } from "../utils/ui.js";



export class Player {
    constructor(pResourceManager, pGearManager) {
        // set resources
        this.resources = {};
        Object.entries(pResourceManager.resources).forEach(([key, value]) => {
            this.resources[key] = 0n;
        });

        // set gear inventory
        this.gearManager = pGearManager;
        this.gear = [];

        // set equipped gear
        this.equipped = {};

        // set unlocked planets
        this.unlockedPlanets = ["calypso"];

        // level
        this.level = 1;
        this.xp = 0n;
        this.levelPts = 0n;
        updateXpBarUI(this);

        // skills
        this.skillTree = new SkillTree(this);

        // auto-damage tracking
        this.lastDamagedResId = null;
        this.autoDamageTimer = 1.0;
        this.initAutoDamage();
        
        // research
        this.researchCapacity = 1;
        this.activeResearch = [];

        // mailbox
        this.pastMail = [];
    }


    
    get maxGearCapacity() {
        const stats = this.skillTree.getStatBonuses();
        const bonus = stats.inventoryBonus || 0;
        return 8 + bonus;
    }



    get maxXp() {
        return BigInt(Math.round(((2.6 * this.level) ** 1.65) + 50));
    }



    addXp(pAmount) {
        let amount;
        if (typeof pAmount === "bigint") {
            amount = pAmount
        }
        else {
            amount = BigInt(pAmount);
        }

        this.xp += amount;
        let leveledUp = false; // track if a level was gained

        while (this.xp >= this.maxXp) {
            // level up
            this.xp -= this.maxXp;
            this.level++;
            this.levelPts++;
            leveledUp = true;
        }

        // update ui
        updateXpBarUI(this);

        // broadcast level up
        if (leveledUp) {
            playSound(SOUND_IDS.playerLevelup);
            if (typeof this.onLevelUp === "function") this.onLevelUp();
        }
    }




    addResource(pId, pAmount) {
        if (!this.resources[pId]) {
            this.resources[pId] = 0n;
        }
        this.resources[pId] += BigInt(pAmount);

        if (typeof this.onResourceUpdate === "function") {
            this.onResourceUpdate();
        }
    }



    formatResource(pId) {
        if (!this.resources[pId]) return "0";
        return formatBigNumber(this.resources[pId]);
    }




    landOn(pPlanet) {
        this.currentPlanet = pPlanet;
        this.lastDamagedResId = null;
    }




    get totalGearCount() {
        return this.gear.length;
    }


    giveGear(pGear) {
        if (this.totalGearCount >= this.maxGearCapacity) {
            return false;
        }
        this.gear.push(pGear);
        return true;
    }





    equipGear(pGear) {
        const slot = pGear.slot;
        this.equipped[slot] = pGear;
    }

    unequipGear(pSlot) {
        if (this.equipped[pSlot]) {
            delete this.equipped[pSlot];
        }
    }

    discardGear(pGear) {
        // unequip if currently equipped
        if (this.equipped[pGear.slot] === pGear) {
            this.unequipGear(pGear.slot);
        }

        // remove from inventory
        const index = this.gear.indexOf(pGear);
        if (index > -1) {
            this.gear.splice(index, 1);
        }
    }




    getStatsForCategory(pCategory) {
        // base bonuses from skill tree
        const skillBonuses = this.skillTree.getStatBonuses();

        // start totals with base value + skill tree bonuses
        let totalDamage = 1 + (skillBonuses.damageBonus || 0);
        let resourceMultiplier = 1 + (skillBonuses.resourceBonus || 0);
        let xpMultiplier = 1 + (skillBonuses.xpBonus || 0);
        let cooldownReduction = Math.min(Math.max(skillBonuses.cooldownReduction || 0, 0), 1);
        let ricochetChance = skillBonuses.ricochetChance || 0;

        const gearMultiplier = 1 + (skillBonuses.gearStatMultiplier || 0);

        // loop equipped gear
        const slots = this.gearManager.slots;
        slots.forEach(slotType => {
            const equippedItem = this.equipped[slotType];
            if (equippedItem) {
                if (equippedItem.resourceCategory.id === pCategory || equippedItem.resourceCategory.id == "any") {
                    totalDamage += Math.round(equippedItem.damageBonus * gearMultiplier);
                    resourceMultiplier += Math.round(equippedItem.resourceBonus * gearMultiplier);
                    xpMultiplier += Math.round(equippedItem.xpBonus * gearMultiplier);
                    ricochetChance += (equippedItem.ricochetChance * gearMultiplier);
                }
            }
        });

        //console.log({ totalDamage, resourceMultiplier, xpMultiplier, cooldownReduction, ricochetChance });

        return { totalDamage, resourceMultiplier, xpMultiplier, cooldownReduction, ricochetChance };
    }










    hasUnlockedPlanet(pPlanetId) {
        return this.unlockedPlanets.includes(pPlanetId);
    }

    unlockPlanet(pPlanetId) {
        if (!this.hasUnlockedPlanet(pPlanetId)) {
            this.unlockedPlanets.push(pPlanetId);
        }
    }







    //#region AUTO DAMAGE

    getEffectiveCooldown(pBaseCooldown, pSkillLevel) {
        if (!pSkillLevel) return pBaseCooldown;
        const speedMultiplier = 2 ** (Number(pSkillLevel) - 1);
        return pBaseCooldown / speedMultiplier;
    }

    setLastDamagedResource(pId) {
        if (this.lastDamagedResId !== pId) {
            this.lastDamagedResId = pId;
            
            const stats = this.skillTree.getStatBonuses();
            this.autoDamageTimer = this.getEffectiveCooldown(1.0, stats.autoDamage);
        }
    }

    initAutoDamage() {
        setInterval(() => {
            const stats = this.skillTree.getStatBonuses();
            if (!stats.autoDamage || !this.lastDamagedResId || !this.currentPlanet) return;

            const dt = 0.1; 
            const effectiveCooldown = this.getEffectiveCooldown(1.0, stats.autoDamage);

            this.autoDamageTimer -= dt;

            if (this.autoDamageTimer <= 0) {
                let missedTriggers = 0;
                
                if (this.autoDamageTimer < 0 && effectiveCooldown < dt) {
                    missedTriggers = Math.floor(Math.abs(this.autoDamageTimer) / effectiveCooldown);
                }
                
                let damageTriggers = 1 + missedTriggers;
                
                this.autoDamageTimer += effectiveCooldown * damageTriggers;

                if (typeof this.currentPlanet.applyAutoDamage === "function") {
                    this.currentPlanet.applyAutoDamage(this.lastDamagedResId, damageTriggers);
                }
            }
        }, 100);
    }

    //#endregion












    //#region RESEARCH


    startResearch(pItemId, pMarketId, pDurationSeconds) {
        if (this.activeResearch.length >= this.researchCapacity) return false;
        
        this.activeResearch.push({
            itemId: pItemId,
            marketId: pMarketId,
            finishTime: Date.now() + (pDurationSeconds * 1000)
        });
        return true;
    }

    //#endregion
}