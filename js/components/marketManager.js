

import { populateItemPopup, setupPopupClose } from "../utils/ui.js";
import { formatBigNumber } from "../utils/formatting.js";
import { Market } from "./market.js";




export class MarketManager {
    constructor() {
        this.markets = [];
    }

    async build(pLoadingStatus) {

        pLoadingStatus("Loading markets...");

        const response = await fetch("assets/markets/manifest.json");
        const marketIds = await response.json();

        const marketLength = marketIds.length;
        let currentMarketLength = 1;

        for (const id of marketIds) {

            pLoadingStatus(`Loading markets... ${currentMarketLength}/${marketLength}`);
            currentMarketLength++;

            const newMarket = new Market(id);
            await newMarket.build();
            this.markets.push(newMarket);
        }
    }





    showPopup(pMarket, pPlayer) {
        const overlay = document.getElementById("marketPopupOverlay");
        const name = document.getElementById("marketPopupName");
        const offersContainer = document.getElementById("marketPopupOffers");
        const closeBtn = document.getElementById("marketPopupClose");

        name.innerText = pMarket.name;
        offersContainer.innerHTML = ""; // clear previous offers

        // loop through store offers
        Object.entries(pMarket.offers).forEach(([itemId, price]) => {
            const itemData = pPlayer.gearManager.gearTypes[itemId];
            if (!itemData) return;

            const itemDiv = document.createElement("div");
            itemDiv.className = "gearSlot";
            
            itemDiv.innerHTML = `
                <div class="gearSlotBg" style="background-color: ${itemData.tier.color}"></div>
                <div class="gearSlotFrame"></div>
                <img class="gearSlotImg" src="assets/gear/${itemId}/default.png">
                <div class="priceTag">${formatBigNumber(price)}<img src="assets/ui/icons/credits.png">
                </div>
            `;

            // open item popup when clicked
            itemDiv.onclick = () => {
                this.showItemPopup(itemId, itemData, price, pMarket, pPlayer);
            };

            offersContainer.appendChild(itemDiv);
        });

        // close logic
        setupPopupClose(overlay, closeBtn);

        // show popup
        overlay.style.display = "flex";
    }





    showItemPopup(pItemId, pItemData, pPrice, pMarket, pPlayer) {
        const overlay = document.getElementById("marketItemPopupOverlay");
        const actionBtn = document.getElementById("marketItemPopupActionBtn");
        const closeBtn = document.getElementById("marketItemPopupClose");

        // build generic display
        populateItemPopup("marketItemPopup", pItemId, pItemData);

        // set price
        actionBtn.innerHTML = `Buy: ${formatBigNumber(pPrice)} <img src="assets/ui/icons/credits.png">`;

        const priceCents = pPlayer.credits.parseToCents(pPrice);
        if (pPlayer.credits.currency >= priceCents) {
            actionBtn.style.opacity = 1;
        } else {
            actionBtn.style.opacity = 0.4;
        }

        // buy button logic
        actionBtn.onclick = () => {
            if (pMarket.buyItem(pItemId, pPlayer)) overlay.style.display = "none";
        };

        // close logic
        setupPopupClose(overlay, closeBtn);

        // show popup
        overlay.style.display = "flex";
    }
}