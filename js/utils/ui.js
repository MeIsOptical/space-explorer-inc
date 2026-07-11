
import { playSound, SOUND_IDS } from "../systems/audio.js";
import { formatBigNumber } from "./formatting.js";







export function isVisible(pElement) {
    if (!pElement) return false;
    if (pElement.checkVisibility) {
        return pElement.checkVisibility();
    }
    // fallback
    return !!(pElement.offsetWidth || pElement.offsetHeight || pElement.getClientRects().length);
}




export function populateItemPopup(pPrefix, pItemId, pItemData, pPlayer) {
    const img = document.getElementById(`${pPrefix}Img`);
    const name = document.getElementById(`${pPrefix}Name`);
    const tier = document.getElementById(`${pPrefix}Tier`);
    const description = document.getElementById(`${pPrefix}Description`);
    const statsContainer = document.getElementById(`${pPrefix}Stats`);

    // set header info
    img.src = `assets/gear/${pItemId}/default.png`;
    name.innerText = pItemData.name;
    tier.innerText = pItemData.tier.name;
    tier.style.color = pItemData.tier.color;
    description.innerText = pItemData.description;

    // get stat multiplier
    const playerStats = pPlayer.skillTree.getStatBonuses();
    const gearMultiplier = 1 + (playerStats.gearStatMultiplier || 0);

    // set dynamic stats
    statsContainer.innerHTML = "";

    if (pItemData.resourceCategory.id !== "any") {
        statsContainer.innerHTML += `<div style="text-decoration: underline">Only applies to <span style="color: #ffffff; font-weight: bold">${pItemData.resourceCategory.name}</span>:</div>`;
    }
    else {
        statsContainer.innerHTML += `<div style="text-decoration: underline">Applies to <span style="color: #ffffff; font-weight: bold">${pItemData.resourceCategory.name}</span>:</div>`;
    }

    if (pItemData.damageBonus > 0) statsContainer.innerHTML += `<div>⏵ Damage: <span style="color: var(--c-gear-damage)">+${Math.round(pItemData.damageBonus * gearMultiplier)}</span></div>`;
    if (pItemData.resourceBonus > 0) statsContainer.innerHTML += `<div>⏵ Resources: <span style="color: var(--c-gear-resources)">+${Math.round(pItemData.resourceBonus * gearMultiplier)}x</span></div>`;
    if (pItemData.xpBonus > 0) statsContainer.innerHTML += `<div>⏵ XP: <span style="color: var(--c-gear-xp)">+${Math.round(pItemData.xpBonus * gearMultiplier)}x</span></div>`;
    if (pItemData.ricochetChance > 0) statsContainer.innerHTML += `<div>⏵ Ricochet Chance: <span style="color: var(--c-gear-ricochet)">+${Math.round(pItemData.ricochetChance * gearMultiplier * 100)}%</span></div>`;
}





export function setupPopupClose(pOverlay, pCloseBtn, pOnClose) {

    if (Array.isArray(pCloseBtn)) {
        pCloseBtn.forEach(btn => {
            btn.onclick = () => {
                pOverlay.style.display = "none";
                playSound(SOUND_IDS.popupClose);
                if (pOnClose) pOnClose();
            };
        });

    }
    else {
        pCloseBtn.onclick = () => {
            pOverlay.style.display = "none";
            playSound(SOUND_IDS.popupClose);
            if (pOnClose) pOnClose();
        };
    }

    pOverlay.onclick = (event) => {
        if (event.target === pOverlay) {
            pOverlay.style.display = "none";
            playSound(SOUND_IDS.popupClose);
            if (pOnClose) pOnClose();
        }
    };
}












export function showFloatingMessage(pText, pColor, pDurationMs = 4000, pZIndex = 99999) {
    const msg = document.createElement("div");
    msg.className = "floatingMessage";
    
    msg.style.color = pColor;
    msg.style.zIndex = pZIndex;
    msg.innerText = pText;

    document.body.appendChild(msg);

    msg.style.setProperty('--animDuration', `${pDurationMs}ms`);

    // remove after animation finishes
    setTimeout(() => {
        msg.remove();
    }, pDurationMs);
}








export function showFloatingMessageAt(pText, pColor, pX, pY, pDurationMs = 4000, pZIndex = 99999) {
    const msg = document.createElement("div");
    msg.className = "floatingMessage";
    
    msg.style.color = pColor;
    msg.style.zIndex = pZIndex;
    msg.innerText = pText;

    msg.style.width = "auto";
    msg.style.height = "auto";
    msg.style.left = `${pX}px`;
    msg.style.top = `${pY}px`; 

    document.body.appendChild(msg);

    msg.style.setProperty('--animDuration', `${pDurationMs}ms`);

    // remove after animation finishes
    setTimeout(() => {
        msg.remove();
    }, pDurationMs);
}











export function updateXpBarUI(pPlayer) {

    const bar = document.getElementById("xpBar");
    const levelText = document.getElementById("playerLevelText");
    const xpText = document.getElementById("playerXpText");
    const skillTreeBtn = document.getElementById("openSkillsBtn");

    if (bar && levelText && skillTreeBtn) {

        // level display
        const currentXp = Number(pPlayer.xp);
        const maxXp = Number(pPlayer.maxXp);

        const fillPercentage = (currentXp / maxXp) * 100;
        
        bar.style.width = `${fillPercentage}%`;
        levelText.innerText = `Level ${pPlayer.level}`;
        xpText.innerText = `(${formatBigNumber(currentXp)}/${formatBigNumber(maxXp)})`;


        // check for affordable skills
        let canAffordSomething = false;
        
        if (pPlayer.levelPts > 0 && pPlayer.skillTree && pPlayer.skillTree.manifest) {
            const nodeIds = Object.keys(pPlayer.skillTree.manifest);
            
            for (let i = 0; i < nodeIds.length; i++) {
                const id = nodeIds[i];
                
                if (!pPlayer.skillTree.hasSkill(id) && 
                     pPlayer.skillTree.canUnlock(id) && 
                     pPlayer.skillTree.nodePrice(id)) {
                    
                    canAffordSomething = true;
                    break; // stop looking if one is found
                }
            }
        }

        // skill tree button
        if (canAffordSomething) {
            skillTreeBtn.style.backgroundColor = "var(--c-skill)";
            skillTreeBtn.style.opacity = 1;
        }
        else {
            skillTreeBtn.style.backgroundColor = "var(--c-gray)";
            skillTreeBtn.style.opacity = 0.4;
        }
    }

}












export async function displayMailPopup(pData) {


    return new Promise((resolve) => {
        const overlay = document.getElementById("mailboxOverlay");
        const title = document.getElementById("mailboxTitle");
        const text = document.getElementById("mailboxText");
        const actionBtn = document.getElementById("mailBoxBtn");
        const closeBtn = document.getElementById("mailBoxClose");

        title.innerHTML = pData.title.replace(/<c:(.*?)>(.*?)<\/c>/g, "<span style='color: var(--c-$1); text-decoration: underline;'>$2</span>");

        // parse custom color tags
        text.innerHTML = pData.text.replace(/<c:(.*?)>(.*?)<\/c>/g, "<span style='color: var(--c-$1); text-decoration: underline;'>$2</span>");
        
        actionBtn.innerHTML = pData.button;

        setupPopupClose(overlay, [actionBtn, closeBtn], resolve);

        overlay.style.display = "flex";
    });

}