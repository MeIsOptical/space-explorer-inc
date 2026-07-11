

import { formatBigNumber } from "../utils/formatting.js";
import { isVisible } from "../utils/ui.js";
import { playSound, SOUND_IDS } from "../systems/audio.js";




export class Collector {
    constructor(pResourceManager, pPlayer) {
        this.resourceManager = pResourceManager;
        this.player = pPlayer;

        this.resourcesListElement = document.getElementById("resourcesList");

        // init auto-sell loop
        this.autoSellTimers = {};
        this.initAutoSell();
    }


    buildUI() {
        this.resourcesListElement.innerHTML = "";

        const sortedResources = Object.entries(this.resourceManager.resources).sort((a, b) => a[1].worth - b[1].worth);

        sortedResources.forEach(([key, resource]) => {
            // create container
            const listing = document.createElement("div");
            listing.className = "resourceListing";

            listing.innerHTML = `
                <div class="resourceListingText">
                    <p class="resourceListingTitle" style="color: ${resource.color}">${resource.name}<span class="resourceListingWorth" id="resource-worth-${key}">(${resource.worth}<img src="assets/ui/icons/credits.png" class="numImg small">)</span></p>
                    <p>Stored: <span id="resource-stored-${key}">0</span> (<span id="resource-total-${key}">0</span><img src="assets/ui/icons/credits.png" class="numImg small">)</p>
                </div>
                
                <button class="btn square sellBtn" id="sellBtn-${key}" style="background-color: ${resource.color}">
                    <img class="btnIcon" src="assets/ui/icons/credits.png" alt="Sell">
                </button>
            `;

            this.resourcesListElement.appendChild(listing);

            // sell logic
            const sellBtn = listing.querySelector(`#sellBtn-${key}`);
            sellBtn.addEventListener("click", () => {
                this.sellResource(key);
            });
        });
    }






    updateUI() {

        // get multiplier
        const playerStats = this.player.skillTree.getStatBonuses();
        const multiplier = 1 + (playerStats.creditMultiplier || 0);

        Object.keys(this.resourceManager.resources).forEach(key => {
            const sellBtn = document.getElementById(`sellBtn-${key}`);
            const storedSpan = document.getElementById(`resource-stored-${key}`);
            const totalSpan = document.getElementById(`resource-total-${key}`);
            const worthSpan = document.getElementById(`resource-worth-${key}`);
            
            if (sellBtn && storedSpan && totalSpan) {
                let quantity = this.player.resources[key] || 0n;
                let baseWorthFloat = this.resourceManager.getResourceById(key).worth;
                
                // apply multiplier
                let effectiveWorth = baseWorthFloat * multiplier;
                let worthInCents = BigInt(Math.round(effectiveWorth * 100));
                
                // update worth text
                if (worthSpan) {
                    worthSpan.innerHTML = `(${Number(effectiveWorth.toFixed(2))}<img src="assets/ui/icons/credits.png" class="numImg small">)`;
                }

                storedSpan.innerText = this.player.formatResource(key);
                
                let totalCents = quantity * worthInCents;
                let totalWorthWhole = totalCents / 100n;

                if (totalWorthWhole >= 1000n) {
                    totalSpan.innerText = formatBigNumber(totalWorthWhole);
                }
                else {
                    let displayDec = totalCents % 100n;
                    totalSpan.innerText = totalWorthWhole.toString() + "." + displayDec.toString().padStart(2, '0');
                }

                // button opacity
                if (quantity <= 0n) sellBtn.style.opacity = 0.4;
                else sellBtn.style.opacity = 1;
            }
        });
    }






    sellResource(pId) {
        const stats = this.player.skillTree.getStatBonuses();
        const bulkBonus = BigInt(stats.sellAmountBonus || 0);
        
        const amountToSell = 1n + bulkBonus; 
        
        this.executeSell(pId, amountToSell);
        this.updateUI();
    }



    // handles actual the math for selling
    executeSell(pId, pAmount) {
        let playerHas = this.player.resources[pId] || 0n;
        
        if (playerHas > 0n) {
            // cap the amount to sell at the amount the player owns
            let actualAmount = pAmount > playerHas ? playerHas : pAmount;
            
            let worthFloat = this.resourceManager.getResourceById(pId).worth;

            const playerStats = this.player.skillTree.getStatBonuses();
            const multiplier = 1 + (playerStats.creditMultiplier || 0);
            let worthInCents = BigInt(Math.round(worthFloat * 100 * multiplier));

            let totalProfitCents = actualAmount * worthInCents;
            
            this.player.credits.addCents(totalProfitCents);
            this.player.resources[pId] -= actualAmount;

            // play sound
            playSound(SOUND_IDS.sell);
        }
        else {
            playSound(SOUND_IDS.fail);
        }
    }








    // background loop that processes auto-selling (genius)
    initAutoSell() {
        setInterval(() => {
            const skillStats = this.player.skillTree.getStatBonuses();
            if (!skillStats.autoSell) return;

            const dt = 0.1; 
            let didSellAnything = false;
            let totalProfitCentsThisTick = 0n;

            Object.keys(this.player.resources).forEach(resId => {
                if (this.player.resources[resId] > 0n) {
                    
                    const resInfo = this.resourceManager.getResourceById(resId);
                    const baseCooldown = resInfo.cooldown || 3;

                    const categoryId = resInfo.category.id;
                    const playerStats = this.player.getStatsForCategory(categoryId);
                    const cooldownMultiplier = 1 - playerStats.cooldownReduction;
                    const realCooldown = Math.max(baseCooldown * cooldownMultiplier, 0.001); // to prevent infinity bug

                    const effectiveCooldown = this.player.getEffectiveCooldown(realCooldown, skillStats.autoSell);

                    if (this.autoSellTimers[resId] === undefined) {
                        this.autoSellTimers[resId] = effectiveCooldown; 
                    }

                    this.autoSellTimers[resId] -= dt;

                    if (this.autoSellTimers[resId] <= 0) {
                        let missedTriggers = 0;
                        
                        if (this.autoSellTimers[resId] < 0 && effectiveCooldown < dt) {
                            missedTriggers = Math.floor(Math.abs(this.autoSellTimers[resId]) / effectiveCooldown);
                        }
                        
                        let sellAmount = 1n + BigInt(missedTriggers);
                        
                        this.autoSellTimers[resId] += effectiveCooldown * (missedTriggers + 1);
                        
                        if (sellAmount > this.player.resources[resId]) {
                            sellAmount = this.player.resources[resId];
                        }

                        let worthFloat = resInfo.worth;
                        let worthInCents = BigInt(Math.round(worthFloat * 100));
                        totalProfitCentsThisTick += (sellAmount * worthInCents);
                        
                        this.player.resources[resId] -= sellAmount;
                        didSellAnything = true;
                    }
                }
            });

            if (didSellAnything) {

                // sound
                const isFocused = isVisible(this.resourcesListElement);
                if (isFocused) playSound(SOUND_IDS.sell);

                this.player.credits.addCents(totalProfitCentsThisTick);
                
                // update ui
                if (typeof this.player.onResourceUpdate === "function") {
                    this.player.onResourceUpdate(); 
                }
            }
        }, 100);
    }
}