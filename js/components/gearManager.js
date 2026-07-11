
import { playSound, SOUND_IDS } from "../systems/audio.js";
import { populateItemPopup, setupPopupClose } from "../utils/ui.js";



export class GearManager {
    constructor() {
        this.slots = ["head", "chest", "legs", "feet", "tool"];
    }

    async build(pLoadingStatus) {

        pLoadingStatus("Loading gear...");

        let tierData;
        let categoriesData;
        let gearData;
        try {
            // load gear teirs
            const tierResponse = await fetch("assets/gear/tiers.json");
            tierData = await tierResponse.json();

            // load categories
            const catResponse = await fetch("assets/resources/categories.json");
            categoriesData = await catResponse.json();

            // load gear items
            const gearResponse = await fetch("assets/gear/manifest.json");
            gearData = await gearResponse.json();
        }
        catch {
            return { success: false, error: "Failed to fetch gear manifest files." };
        }
        

        // error handling
        const missingIds = [];

        this.gearTypes = {};

        const gearLength = gearData.length;
        let currentGearLength = 1;
        for (const gearId of gearData) {

            pLoadingStatus(`Loading gear... (${currentGearLength}/${gearLength})`);
            currentGearLength++;

            try {

                const loopGearResponse = await fetch(`assets/gear/${gearId}/manifest.json`);
                const loopGearData = await loopGearResponse.json();
                
                // tier
                const tierId = loopGearData.tier;
                loopGearData.tier = tierData[loopGearData.tier - 1];
                loopGearData.tier.id = tierId;

                // category
                const categoryId = loopGearData.resourceCategory;
                loopGearData.resourceCategory = categoriesData[categoryId];
                loopGearData.resourceCategory.id = categoryId;
                

                this.gearTypes[gearId] = loopGearData;
            }
            catch {
                missingIds.push(gearId);
            }            
        }

        if (missingIds.length === 0) return { success: true };
        else {
            const formattedIds = missingIds.map(id => `"${id}"`).join(", ");
            return { success: false, error: `Error loading gear${missingIds.length === 1 ? "" : "s"} with ID${missingIds.length === 1 ? "" : "s"} ${formattedIds}`};
        }
    }




    display(pPlayer) {
        const equippedContainer = document.getElementById("equippedGearContainer");
        const inventoryContainer = document.getElementById("inventoryGearContainer");

        equippedContainer.innerHTML = "";
        inventoryContainer.innerHTML = "";

        // equipped gear
        this.slots.forEach(slotType => {
            const slotDiv = document.createElement("div");
            const equippedItem = pPlayer.equipped[slotType];

            slotDiv.className = equippedItem ? "gearSlot" : "gearSlot empty";

            if (equippedItem) {
                slotDiv.innerHTML = `
                    <div class="gearSlotBg" style="background-color: ${equippedItem.tier.color}"></div>
                    <div class="gearSlotFrame"></div>
                    <img class="gearSlotImg" src="assets/gear/${equippedItem.id}/default.png">
                `;
                
                // open popup when clicked
                slotDiv.onclick = () => {
                    this.showPopup(equippedItem, pPlayer, true);
                };
            }
            else {
                slotDiv.innerHTML = `<div class="gearSlotFrame"></div>`;
            }

            // label
            const label = document.createElement("div");
            label.className = "gearSlotLabel";
            label.innerText = slotType.toUpperCase();
            slotDiv.appendChild(label);

            equippedContainer.appendChild(slotDiv);
        });

        // inventory grid
        pPlayer.gear.forEach(item => {
            const itemDiv = document.createElement("div");
            itemDiv.className = "gearSlot";
            
            itemDiv.innerHTML = `
                <div class="gearSlotBg" style="background-color: ${item.tier.color}"></div>
                <div class="gearSlotFrame"></div>
                <img class="gearSlotImg" src="assets/gear/${item.id}/default.png">
            `;

            // check if is equipped
            const isEquipped = pPlayer.equipped[item.slot] === item;

            if (isEquipped) {
                itemDiv.classList.add("equipped");

                const badge = document.createElement("div");
                badge.className = "equippedBadge";
                badge.innerText = "Equipped";
                itemDiv.appendChild(badge);
            }

            // open popup when clicked
            itemDiv.onclick = () => {
                this.showPopup(item, pPlayer, isEquipped);
            };

            inventoryContainer.appendChild(itemDiv);
        });

        // fill empty slots
        const emptySlotsNeeded = pPlayer.maxGearCapacity - pPlayer.gear.length;
        for (let i = 0; i < emptySlotsNeeded; i++) {
            const emptyDiv = document.createElement("div");
            emptyDiv.className = "gearSlot empty";
            emptyDiv.innerHTML = `<div class="gearSlotFrame"></div>`;
            inventoryContainer.appendChild(emptyDiv);
        }
    }









    showPopup(pItem, pPlayer, pIsEquipped) {

        playSound(SOUND_IDS.popupOpen);

        const overlay = document.getElementById("gearPopupOverlay");
        const actionBtn = document.getElementById("gearPopupActionBtn");
        const closeBtn = document.getElementById("gearPopupClose");
        const deleteBtn = document.getElementById("gearPopupDelete");
        
        const confirmOverlay = document.getElementById("gearDeleteConfirmOverlay");
        const confirmBtn = document.getElementById("gearDeleteConfirmBtn");
        const cancelBtn = document.getElementById("gearDeleteCancelBtn");

        // build generic display
        populateItemPopup("gearPopup", pItem.id, pItem, pPlayer);

        // delete logic
        deleteBtn.style.display = "block";
        deleteBtn.onclick = () => {
            confirmOverlay.style.display = "flex";
            playSound(SOUND_IDS.defaultClick);
        };

        // confirmation logic
        confirmBtn.onclick = () => {
            pPlayer.discardGear(pItem);
            confirmOverlay.style.display = "none";
            overlay.style.display = "none";
            this.display(pPlayer);

            playSound(SOUND_IDS.gearDelete);
        };

        setupPopupClose(confirmOverlay, cancelBtn);

        // button logic
        if (pIsEquipped) {
            actionBtn.innerText = "UNEQUIP";
            actionBtn.onclick = () => {
                pPlayer.unequipGear(pItem.slot);
                overlay.style.display = "none";
                this.display(pPlayer);
                playSound(SOUND_IDS.gearUnequip);
            };
        } else {
            actionBtn.innerText = "EQUIP";
            actionBtn.onclick = () => {
                pPlayer.equipGear(pItem);
                overlay.style.display = "none";
                this.display(pPlayer);
                playSound(SOUND_IDS.gearEquip);
            };
        }

        // close logic
        setupPopupClose(overlay, closeBtn);

        // show popup
        overlay.style.display = "flex";
    }
}