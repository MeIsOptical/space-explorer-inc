

import { formatBigNumber } from "../utils/formatting.js";
import { isVisible, showFloatingMessageAt } from "../utils/ui.js";
import { playSound, SOUND_IDS } from "../systems/audio.js";




export class Planet {
    constructor(pId, pName) {
        this.id = pId;
        this.name = pName;
    }

    async build(pResources, pPlayer) {
        this.player = pPlayer;
        
        const response = await fetch("assets/planets/" + this.id + "/manifest.json");
        const data = await response.json();

        Object.assign(this, data);

        this.resourceNodes = this.resources.map(resId => {
            return {
                id: resId,
                manifest: pResources.getResourceById(resId),
                currentHits: 0,
                cooldownUntil: 0
            };
        });
    }





    displayPlanetTab() {
        // update title
        const planetTitleElement = document.getElementById("planetPageTitle");
        planetTitleElement.innerText = `- ${this.name.toUpperCase()} -`;

        const panelsContainer = document.getElementById("planetPanelsContainer");
        panelsContainer.innerHTML = ""; // clear previous content




        // resources panel
        if (Object.entries(this.resourceNodes).length > 0) {
            // create resources panel
            const resourcesPanel = this.createPanel("RESOURCES");
            const resourcesDiv = resourcesPanel.querySelector(".planetPanelContent");

            // display resources
            for (const node of this.resourceNodes) {
                const resource = node.manifest;
                const resourceContainer = document.createElement("div");

                resourceContainer.innerHTML = `
                <div class="planetResourceContainer">
                    <div class="planetResourceHeader">
                        <p class="planetResourceTitle">${resource.name}</p>
                    </div>

                    <div class="planetResourceBody">
                        <div class="planetResourceMiddleCol">
                            <div class="planetResourceBarWrapper">
                                <div class="planetResourceBarFill" style="width: 0%; background-color: ${resource.color}"></div>
                            </div>
                            <p class="planetResourceStatusText">Ready</p>
                        </div>
                        <button class="btn square planetResourceCollectBtn" style="background-color: ${resource.color}">
                            <img class="btnIcon" src="assets/ui/icons/${resource.category.icon}.png" alt="Collect">
                        </button>
                    </div>
                </div>
                `;

                resourcesDiv.appendChild(resourceContainer);

                // grab elements for node
                const collectBtn = resourceContainer.querySelector(".planetResourceCollectBtn");
                const barFill = resourceContainer.querySelector(".planetResourceBarFill");
                const statusText = resourceContainer.querySelector(".planetResourceStatusText");

                // save ui references for the background loop to use
                node.ui = { collectBtn, barFill, statusText };

                // check initial cooldown state when loading the tab
                this.updateNodeVisuals(node, resource, barFill, statusText, collectBtn);

                // handle manual clicks
                collectBtn.addEventListener("click", () => {
                    this.processHit(node.id, 1, true);
                });
            }

            panelsContainer.appendChild(resourcesPanel);
        }







        if (this.markets.length > 0) {
            // create markets panel
            const marketsPanel = this.createPanel("MARKETS");
            const marketsDiv = marketsPanel.querySelector(".planetPanelContent");

            // display markets
            for (const market of this.markets) {
                const marketContainer = document.createElement("div");
                marketContainer.className = "planetMarketContainer";

                marketContainer.innerHTML = `
                <div class="planetMarketHeader">
                    <img class="planetMarketIcon" src="assets/ui/icons/${market.icon}.png" alt="Market">
                    <p class="planetMarketTitle">${market.name}</p>
                    <button class="btn purple planetMarketVisitBtn">Visit</button>
                </div>
                `;

                marketsDiv.appendChild(marketContainer);

                // handle clicks
                const visitBtn = marketContainer.querySelector(".planetMarketVisitBtn");
                visitBtn.addEventListener("click", () => {
                    this.marketManager.showPopup(market, this.player);
                });
            }

            panelsContainer.appendChild(marketsPanel);
        }
        
    }












    // unified hit logic for both manual clicks and auto-damage
    processHit(pResId, pTriggers, pIsManual, pIsRicochet = false) {
        const node = this.resourceNodes.find(n => n.id === pResId);
        if (!node) return;

        const now = Date.now();
        
        // reject hit if recharging
        if (now < node.cooldownUntil) return;

        // only update muscle memory skill target if this was a physical click
        if (pIsManual) {
            this.player.setLastDamagedResource(node.id);
        }

        const isFocused = isVisible(node.ui.collectBtn);
        if (isFocused) playSound(SOUND_IDS.resourceHit);

        const resource = node.manifest;
        const playerStats = this.player.getStatsForCategory(resource.category.id);

        node.currentHits += (playerStats.totalDamage * pTriggers);
        const requiredHits = resource.hits; 
        
        // check if gathered
        if (node.currentHits >= requiredHits) {
            
            // collect resource
            this.player.addResource(node.id, playerStats.resourceMultiplier);
            const xpGained = resource.xp * playerStats.xpMultiplier;
            this.player.addXp(xpGained);

            // only show floating text if visible on screen
            if (isFocused) {
                const rect = node.ui.collectBtn.getBoundingClientRect();
                const rndAmount = 20;

                // display resources collected
                let rndX = Math.random() * rndAmount*2 - rndAmount;
                let rndY = Math.random() * rndAmount*2 - rndAmount;
                let spawnX = rect.left + (rect.width / 2) - 10 + rndX;
                let spawnY = rect.top + (rect.height / 2) - 10 + rndY;
                showFloatingMessageAt(`+${formatBigNumber(playerStats.resourceMultiplier)}`, "var(--c-gear-resources)", spawnX, spawnY, 1000, 10);

                // display xp gained
                rndX = Math.random() * rndAmount*2 - rndAmount;
                rndY = Math.random() * rndAmount*2 - rndAmount;
                spawnX = rect.left + (rect.width / 2) - 10 + rndX;
                spawnY = rect.top + (rect.height / 2) - 10 + rndY;
                showFloatingMessageAt(`+${formatBigNumber(xpGained)}`, "var(--c-gear-xp)", spawnX, spawnY, 1000, 10);
            }

            // calculate cooldown reduction
            const cooldownMultiplier = 1 - playerStats.cooldownReduction;
            const realCooldown = resource.cooldown * 1000 * cooldownMultiplier

            // reset hits and start recharge
            node.currentHits = 0;
            node.cooldownUntil = now + realCooldown; 

            // play break sound
            if (isFocused) playSound(SOUND_IDS.resourceBreak);
            
        }

        // visually update the bar
        if (node.ui && node.ui.barFill.offsetParent !== null) {
            this.updateNodeVisuals(node, resource, node.ui.barFill, node.ui.statusText, node.ui.collectBtn);
        }



        // ricochet chance
        if (!pIsRicochet && playerStats.ricochetChance > 0) {
            let chance = playerStats.ricochetChance;
            let ricochetCount = Math.floor(chance);

            // check fractional chance for extra bounces
            if (Math.random() < (chance % 1)) {
                ricochetCount++;
            }

            if (ricochetCount > 0) {
                // get all valid unique targets
                let availableNodes = this.resourceNodes.filter(n => n.id !== pResId && Date.now() >= n.cooldownUntil);

                for (let i = 0; i < ricochetCount; i++) {
                    if (availableNodes.length === 0) break; // stop if out of unique nodes

                    // select random resource from the pool
                    const randomIndex = Math.floor(Math.random() * availableNodes.length);
                    const randomNode = availableNodes[randomIndex];

                    // remove the selected resource from the pool so it cannot be hit twice
                    availableNodes.splice(randomIndex, 1);

                    this.processHit(randomNode.id, pTriggers, false, true);
                }
            }
        }
    }





    createPanel(pTitle) {
        const panel = document.createElement("div");
        panel.className = "planetPanel";
        
        panel.innerHTML = `
            <div class="planetPanelHeader">
                <p class="planetPanelTitle">${pTitle}</p>
                <p class="planetPanelToggle">▼</p>
            </div>
            <div class="planetPanelContent"></div>
        `;

        // grab elements for panel
        const header = panel.querySelector(".planetPanelHeader");
        const content = panel.querySelector(".planetPanelContent");
        const toggle = panel.querySelector(".planetPanelToggle");

        // handle clicks
        header.addEventListener("click", () => {
            content.classList.toggle("hidden");
            toggle.innerText = content.classList.contains("hidden") ? "▶" : "▼";
            playSound(SOUND_IDS.defaultClick);
        });

        return panel;
    }





    updateNodeVisuals(node, resource, barFill, statusText, collectBtn) {
        // cancel existing animation loop if any
        if (node.animationFrameId) {
            cancelAnimationFrame(node.animationFrameId);
        }

        const now = Date.now();
        const requiredHits = resource.hits;

        if (now < node.cooldownUntil) {
            // cooldown
            statusText.innerText = "Recharging...";
            barFill.style.opacity = 0.4;
            collectBtn.style.opacity = 0.4;

            // calculate cooldown reduction
            const playerStats = this.player.getStatsForCategory(resource.category.id);
            const cooldownMultiplier = 1 - playerStats.cooldownReduction;
            const realCooldown = resource.cooldown * 1000 * cooldownMultiplier

            const animateCooldown = () => {

                const currentTime = Date.now();
                
                if (currentTime < node.cooldownUntil) {
                    // calculate how much of the cooldown is finished
                    const timeLeft = node.cooldownUntil - currentTime;
                    const fillPercentage = ((realCooldown - timeLeft) / realCooldown) * 100;

                    statusText.innerText = "Recharging... (" + Math.round(fillPercentage) + "%)";                    
                    barFill.style.width = `${100 - fillPercentage}%`;
                    
                    // request next frame
                    node.animationFrameId = requestAnimationFrame(animateCooldown);
                } else {
                    // cooldown is over, reset visual state
                    if (document.getElementById("planetPageTitle")?.innerText.includes(this.name.toUpperCase())) {
                        this.updateNodeVisuals(node, resource, barFill, statusText, collectBtn);
                    }
                }
            };

            // start the animation
            animateCooldown();

        } else {
            // is ready to be clicked
            const fillPercentage = (node.currentHits / requiredHits) * 100;
            barFill.style.width = `${fillPercentage}%`;
            statusText.innerText = `Ready`;
            barFill.style.opacity = 1;
            collectBtn.style.opacity = 1;
        }
    }









    //#region AUTO DAMAGE

    // routes background auto-damage triggers to the hit processor
    applyAutoDamage(pResId, pTriggers) {
        // false indicates it is an automated hit, not a manual click
        this.processHit(pResId, pTriggers, false); 
    }

    //#endregion



}