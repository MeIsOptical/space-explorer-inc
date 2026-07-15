

import { populateItemPopup, setupPopupClose, showFloatingMessage } from "../utils/ui.js";
import { formatBigNumber, formatSeconds } from "../utils/formatting.js";
import { Market } from "./market.js";
import { Gear } from "./gear.js";
import { playSound, SOUND_IDS } from "../systems/audio.js";
import { RUN_CONFIG } from "../main.js";
import { saveProgress } from "../utils/progress.js";




export class MarketManager {
    constructor() {
        this.markets = [];
    }

    async build(pLoadingStatus) {

        pLoadingStatus("Loading markets...");

        let marketIds;
        try {
            const response = await fetch("assets/markets/manifest.json");
            marketIds = await response.json();
        }
        catch {
            return { success: false, error: "Failed to fetch markets manifest." };
        }
        

        const marketLength = marketIds.length;
        let currentMarketLength = 1;

        // error handling
        const missingIds = [];

        for (const id of marketIds) {

            pLoadingStatus(`Loading markets... ${currentMarketLength}/${marketLength}`);
            currentMarketLength++;

            try {
                const newMarket = new Market(id);
                await newMarket.build();
                this.markets.push(newMarket);
            }
            catch {
                missingIds.push(id);
            }
        }

        if (missingIds.length === 0) return { success: true };
        else {
            const formattedIds = missingIds.map(id => `"${id}"`).join(", ");
            return { success: false, error: `Error loading market${missingIds.length === 1 ? "" : "s"} with ID${missingIds.length === 1 ? "" : "s"} ${formattedIds}`};
        }
    }









    showPopup(pMarket, pPlayer) {

        // kill past loops
        if (this.marketFrameId) cancelAnimationFrame(this.marketFrameId);


        playSound(SOUND_IDS.popupOpen);

        const overlay = document.getElementById("marketPopupOverlay");
        const name = document.getElementById("marketPopupName");
        const offersContainer = document.getElementById("marketPopupOffers");
        const closeBtn = document.getElementById("marketPopupClose");

        
        name.innerHTML = pMarket.name;
        if (pMarket.type === "research") {
            name.innerHTML += ` <span style="font-weight: normal; font-size: 75%;">(${pPlayer.activeResearch.length}/${pPlayer.researchCapacity})</span>`;
        }


        offersContainer.innerHTML = ""; // clear previous offers

        const activeTimers = [];

        // loop through store offers
        Object.entries(pMarket.offers).forEach(([itemId, data]) => {
            const price = data.price || data;
            const itemData = pPlayer.gearManager.gearTypes[itemId];
            if (!itemData) return;

            const itemDiv = document.createElement("div");
            itemDiv.className = "gearSlot";

            const priceTag = document.createElement("div");
            priceTag.className = "priceTag";

            let gearOverlay = "";

            // prepare display
            if (pMarket.type === "research") {
                const activeResearch = pPlayer.activeResearch.find(r => r.itemId === itemId && r.marketId === pMarket.id);

                if (activeResearch){
                    priceTag.innerHTML = ``;

                    // add timer icon overlay
                    gearOverlay = `<img class="gearOverlay" src="assets/ui/icons/timer.png">`;
                    const completionOverlaySrc = "assets/ui/icons/checkmark.png";

                    activeTimers.push(() => {
                        const timeLeftMs = activeResearch.finishTime - Date.now();

                        const overlayElement = itemDiv.querySelector(".gearOverlay");

                        if (timeLeftMs <= 0) {

                            // switch overlay
                            if (overlayElement && !overlayElement.src.endsWith(completionOverlaySrc)) {
                                overlayElement.src = completionOverlaySrc;
                            }

                        }
                        
                        priceTag.innerText = formatSeconds(timeLeftMs / 1000);
                        
                    });
                }  
                else {
                    priceTag.innerHTML = `${formatBigNumber(price)}<img src="assets/ui/icons/credits.png">`;
                }
            }
            else {
                priceTag.innerHTML = `${formatBigNumber(price)}<img src="assets/ui/icons/credits.png">`;
            }
            
            // update display
            itemDiv.innerHTML = `
                <div class="gearSlotBg" style="background-color: ${itemData.tier.color}"></div>
                <div class="gearSlotFrame"></div>
                <img class="gearSlotImg" src="assets/gear/${itemId}/default.png">
                ${gearOverlay}
            `;
            itemDiv.appendChild(priceTag);

            itemDiv.onclick = () => {
                this.showItemPopup(itemId, itemData, data, price, pMarket, pPlayer);
            };

            offersContainer.appendChild(itemDiv);
        });


        // show popup before loop starts
        setupPopupClose(overlay, closeBtn);
        overlay.style.display = "flex";


        // handle live updates
        const updateLoop = () => {
            if (overlay.style.display === "none") {
                this.marketFrameId = null;
                return;
            }
            
            activeTimers.forEach(updateFn => updateFn());
            this.marketFrameId = requestAnimationFrame(updateLoop);
        };

        if (activeTimers.length > 0) updateLoop();
    }











    showItemPopup(pItemId, pItemData, pListingData, pPrice, pMarket, pPlayer) {
        playSound(SOUND_IDS.popupOpen);
        
        const overlay = document.getElementById("marketItemPopupOverlay");
        const actionBtn = document.getElementById("marketItemPopupActionBtn");
        const closeBtn = document.getElementById("marketItemPopupClose");
        const extraInfoElement = document.getElementById("marketItemPopupExtraInfo");

        if (this.itemFrameId) cancelAnimationFrame(this.itemFrameId);

        populateItemPopup("marketItemPopup", pItemId, pItemData, pPlayer);
        actionBtn.style.backgroundColor = ""; 

        // show popup first so the loops don't cancel immediately
        setupPopupClose(overlay, closeBtn);
        overlay.style.display = "flex";

        const priceCents = pPlayer.credits.parseToCents(pPrice);

        if (pMarket.type === "research") {
            const activeResIndex = pPlayer.activeResearch.findIndex(r => r.itemId === pItemId && r.marketId === pMarket.id);

            // active research
            if (activeResIndex !== -1) {
                const activeRes = pPlayer.activeResearch[activeResIndex];

                actionBtn.innerHTML = "CANCEL";
                actionBtn.style.opacity = 1;
                actionBtn.style.backgroundColor = "#ff4a4a"; 
                actionBtn.onclick = () => {
                    pPlayer.activeResearch.splice(activeResIndex, 1);

                    // cancel android notification
                    if (window.AndroidBridge) {
                        window.AndroidBridge.cancelNotification(1);
                    }
                    
                    const refundAmount = RUN_CONFIG.dev ? 0 : priceCents;
                    if (refundAmount > 0) pPlayer.credits.addCents(refundAmount);
                    
                    showFloatingMessage("CANCELED", "#ff4848");
                    playSound(SOUND_IDS.defaultClick);
                    
                    overlay.style.display = "none";
                    saveProgress(pPlayer);
                    this.showPopup(pMarket, pPlayer); 
                };

                const updatePopupLoop = () => {
                    if (overlay.style.display === "none") {
                        this.itemFrameId = null;
                        return;
                    }

                    const timeLeftMs = activeRes.finishTime - Date.now();

                    if (timeLeftMs > 0) {
                        extraInfoElement.innerHTML = `Time Left: <span style="color: var(--c-research-main)">${formatSeconds(timeLeftMs / 1000)}</span>`;
                        this.itemFrameId = requestAnimationFrame(updatePopupLoop);
                    } 
                    else {
                        extraInfoElement.style.display = "none";
                        
                        actionBtn.innerHTML = "CLAIM";
                        actionBtn.style.opacity = 1;
                        actionBtn.style.backgroundColor = "var(--c-research-back)";
                        
                        actionBtn.onclick = () => {
                            if (pPlayer.totalGearCount >= pPlayer.maxGearCapacity) {
                                showFloatingMessage("INVENTORY FULL!", "#ff4848");
                                playSound(SOUND_IDS.fail);
                                return;
                            }
                            
                            const newGear = new Gear(pItemId, pPlayer.gearManager);
                            pPlayer.giveGear(newGear);
                            pPlayer.activeResearch.splice(activeResIndex, 1);
                            
                            showFloatingMessage("CLAIMED!", "#52b752");
                            playSound(SOUND_IDS.questComplete); 
                            
                            overlay.style.display = "none";
                            this.showPopup(pMarket, pPlayer); 
                        };

                        this.itemFrameId = null; 
                    }
                };

                extraInfoElement.style.display = "initial";
                updatePopupLoop();
            }


            // research, not not started
            else {
                extraInfoElement.innerHTML = `Research Time: <span style="color: var(--c-research-main)">${formatSeconds(pListingData.duration * 60)}</span>`;
                extraInfoElement.style.display = "initial";
                
                actionBtn.innerHTML = `Order: ${formatBigNumber(pPrice)} <img src="assets/ui/icons/credits.png">`;

                if (pPlayer.credits.currency >= priceCents && pPlayer.activeResearch.length < pPlayer.researchCapacity) actionBtn.style.opacity = 1;
                else actionBtn.style.opacity = 0.4;

                actionBtn.onclick = () => {
                    if (pMarket.buyItem(pItemId, pPlayer)) {
                        overlay.style.display = "none";
                        this.showPopup(pMarket, pPlayer);
                    }
                    else playSound(SOUND_IDS.fail);
                };
            }
        } 


        // regular market
        else {
            extraInfoElement.style.display = "none";
            actionBtn.innerHTML = `Buy: ${formatBigNumber(pPrice)} <img src="assets/ui/icons/credits.png">`;

            if (pPlayer.credits.currency >= priceCents) actionBtn.style.opacity = 1;
            else actionBtn.style.opacity = 0.4;

            actionBtn.onclick = () => {
                if (pMarket.buyItem(pItemId, pPlayer)) {
                    overlay.style.display = "none";
                    this.showPopup(pMarket, pPlayer);
                }
                else playSound(SOUND_IDS.fail);
            };
        }
    }
}