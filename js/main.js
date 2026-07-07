

// loading screen
const loadingScreen = document.getElementById("loadingPage");
const loadingStatus = document.getElementById("loadingStatus");

const setLoadingStatus = (pText) => {
    loadingStatus.innerText = pText;
};




// track whether or not the game is on the screen
export let isGameFocused = true;
document.addEventListener("visibilitychange", () => {
    isGameFocused = document.visibilityState === "visible";
});






setLoadingStatus("Fetching components...");



//#region IMPORTS

// components
import { Section } from "./components/section.js";
import { PlanetMap } from "./components/planetMap.js";
import { Collector } from "./components/collector.js";
import { GearManager } from "./components/gearManager.js";
import { Gear } from "./components/gear.js";
import { MarketManager } from "./components/marketManager.js";

// systems
import { Currency } from "./systems/currency.js";
import { Player } from "./systems/player.js";
import { ResourcesManager } from "./systems/resources.js";
import { Database } from "./systems/database.js";
import { loadSounds, playSound, SOUND_IDS } from "./systems/audio.js";

// utils
import { updateXpBarUI } from "./utils/ui.js";

//#endregion







//#region LOAD CONFIG

const configResponse = await fetch("runConfig.json");
export let RUN_CONFIG = {};
try {
    RUN_CONFIG = await configResponse.json();

    if (RUN_CONFIG.dev) console.log("%cRunning the game in development mode.", "color: orange");
}
catch {
    console.log("No run configuration found, using defaults.");
}

//#endregion






//#region SOUND EFFECTS

await loadSounds(setLoadingStatus);

//#endregion





setLoadingStatus("Loading resources...");

//#region DEFINE RESOURCES

const resourceManager = new ResourcesManager();
await resourceManager.loadResources();

//#endregion







//#region DEFINE GEAR

const gearManager = new GearManager();
await gearManager.build(setLoadingStatus);

//#endregion





//#region DEFINE MARKETS

const marketManager = new MarketManager();
await marketManager.build(setLoadingStatus);

//#endregion





setLoadingStatus("Loading player...");

//#region DEFINE PLAYER

const player = new Player(resourceManager, gearManager);
await player.skillTree.build();

// listen for level ups and update the skill tree live
player.onLevelUp = () => {
    player.skillTree.updateLiveUI();
};

//#endregion





//#region DEFINE CURRENCIES

player.credits = new Currency("credits", 0, true);

//#endregion






//#region DEFINE COLLECTOR

const collector = new Collector(resourceManager, player);
collector.buildUI();

let isCollectorDirty = false;
player.onResourceUpdate = () => {
    isCollectorDirty = true;
};

setInterval(() => {
    if (isCollectorDirty) {
        collector.updateUI();
        isCollectorDirty = false;
    }
}, 100);

//#endregion








//#region DEFINE MAP

const planetMap = new PlanetMap(resourceManager, player, marketManager);
await planetMap.loadPlanets(setLoadingStatus);

// land player
player.landOn(planetMap.getPlanetById("calypso"));

//#endregion













setLoadingStatus("Preparing UI...");

//#region DEFINE SECTIONS

// collector
const collectorSection = new Section("collector", () => {
    isCollectorDirty = true;
});

// gear
const gearSection = new Section("gear", () => {
    gearManager.display(player);
});


// planet
const planetSection = new Section("planet", () => {
    player.currentPlanet.displayPlanetTab();
});


// travel
const travelSection = new Section("travel", () => {
    setTimeout(() => {
        planetMap.targetPlanet(player.currentPlanet);
    }, 0);
});
planetMap.container = travelSection.container; // link map container
planetMap.create(); // build visual map



// skills
const skillsSection = new Section("skills", () => {
    document.getElementById("skillPopup").classList.remove("show");
    setTimeout(() => {
        player.skillTree.displayUI();
    }, 0);
});

// route the header button to open the skills section
document.getElementById("openSkillsBtn").addEventListener("click", () => {
    playSound(SOUND_IDS.sectionChange);
    skillsSection.btnElement.click();
});

//#endregion










setLoadingStatus("Loading database...");

//#region DATABASE

if (!RUN_CONFIG.ignoreDB) {

    const database = new Database();
    await database.init();
    if (RUN_CONFIG.clearDB) await database.clear();

    // load saved content
    const loadedData = await database.readData();

    // load save data if it exists
    if (loadedData && loadedData.player) {

        setLoadingStatus("Restoring progress...");

        const lp = loadedData.player; // shorthand

        // level & xp
        if (lp.level !== undefined) player.level = lp.level;
        if (lp.xp !== undefined) player.xp = lp.xp;
        if (lp.levelPoints !== undefined) player.levelPts = lp.levelPoints;

        // currencies
        if (lp.credits !== undefined) {
            player.credits.setCents(lp.credits);
            player.credits.displayElement.innerText = player.credits.display();
        }

        // unlocked planets
        if (lp.unlockedPlanets !== undefined) {
            player.unlockedPlanets = lp.unlockedPlanets;
        }

        // set current planet
        if (lp.currentPlanetId !== undefined) {
            const savedPlanet = planetMap.getPlanetById(lp.currentPlanetId);
            if (savedPlanet) player.landOn(savedPlanet);
        }

        // skill tree
        if (lp.skillTreeNodes !== undefined) {
            player.skillTree.unlockedNodes = lp.skillTreeNodes;
            player.skillTree.updateLiveUI();
            updateXpBarUI(player);
        }

        // gear inventory
        if (lp.gear !== undefined) {
            player.gear = []; // clear defaults
            lp.gear.forEach(gearId => {
                player.gear.push(new Gear(gearId, gearManager));
            });

            // reconnect equipped gear using saved indices
            if (lp.equipped !== undefined) {
                player.equipped = {};
                Object.entries(lp.equipped).forEach(([slot, invIndex]) => {
                    if (player.gear[invIndex]) {
                        player.equipGear(player.gear[invIndex]);
                    }
                });
            }
        }

        // resources
        if (lp.resources !== undefined) {
            Object.entries(lp.resources).forEach(([key, value]) => {
                if (player.resources[key] !== undefined) {
                    player.resources[key] = value;
                }
            });
        }

    }





    // start saving
    const SAVE_FREQ = 3; // seconds

    setInterval(async () => {
        
        // map gear objects to simple string ids
        const gearIds = player.gear.map(g => g.id);
        
        // map equipped gear to their index in the inventory array
        const equippedIndices = {};
        Object.entries(player.equipped).forEach(([slot, gearItem]) => {
            equippedIndices[slot] = player.gear.indexOf(gearItem);
        });


        const currentData = {
            player: {
                // stats
                level: player.level,
                xp: player.xp,
                levelPoints: player.levelPts,
                
                // currencies
                credits: player.credits.currency,

                // progression
                unlockedPlanets: player.unlockedPlanets,
                currentPlanetId: player.currentPlanet.id,
                skillTreeNodes: player.skillTree.unlockedNodes,

                // gear
                gear: gearIds,
                equipped: equippedIndices,

                // resources
                resources: player.resources
            }
        };

        await database.saveData(currentData);

    }, SAVE_FREQ * 1000);

}


//#endregion








// open section
collectorSection.btnElement.click();




// hide loading screen
loadingScreen.style.display = "none";