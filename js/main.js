

// loading screen
const loadingScreen = document.getElementById("loadingPage");
const loadingStatus = document.getElementById("loadingStatus");
const loadingError = document.getElementById("loadingError");

const setLoadingStatus = (pText) => {
    loadingStatus.innerText = pText;
};

const setLoadingError = (pText) => {
    loadingError.innerText = pText;
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
import { MarketManager } from "./components/marketManager.js";

// systems
import { Currency } from "./systems/currency.js";
import { Player } from "./systems/player.js";
import { ResourcesManager } from "./systems/resources.js";
import { Database } from "./systems/database.js";
import { loadSounds, playSound, SOUND_IDS } from "./systems/audio.js";

// utils
import { displayMailPopup } from "./utils/ui.js";
import { initWakeLock } from "./utils/wakeLock.js";
import { loadProgress, saveProgress } from "./utils/progress.js";

//#endregion



// activate wake lock
initWakeLock();







export let RUN_CONFIG = {};
async function bootGame() {


    //#region LOAD CONFIG

    const configResponse = await fetch("runConfig.json");

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

    const gearResponse = await gearManager.build(setLoadingStatus);
    if (!gearResponse.success) {
        setLoadingError(gearResponse.error);
        throw new Error(gearResponse.error);
    }

    //#endregion





    //#region DEFINE MARKETS

    const marketManager = new MarketManager();
    const marketResponse = await marketManager.build(setLoadingStatus);
    if (!marketResponse.success) {
        setLoadingError(marketResponse.error);
        throw new Error(marketResponse.error);
    }

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
    const planetResponse = await planetMap.loadPlanets(setLoadingStatus);
    if (!planetResponse.success) {
        setLoadingError(planetResponse.error);
        throw new Error(planetResponse.error);
    }

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
        planetMap.updatePlanetMarkers();
        setTimeout(() => {
            planetMap.targetPlanet(player.currentPlanet, 1.3);
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
        player.database = database;
        if (RUN_CONFIG.clearDB) await database.clear();

        // load saved content
        await loadProgress(setLoadingStatus, player, planetMap, gearManager);


        // start saving
        const SAVE_FREQ = 2; // seconds

        setInterval(async () => {
            
            await saveProgress(player);

        }, SAVE_FREQ * 1000);

    }


    //#endregion








    // open section
    planetSection.btnElement.click();





    // load mailbox
    const mailResponse = await fetch("assets/mailbox/messages.json");
    const mailData = await mailResponse.json();


    // hide loading screen
    loadingScreen.style.display = "none";



    // display new messages

    // get all unread message ids
    player.pastMail = player.pastMail.filter(id => mailData[id]);
    const unreadIds = Object.keys(mailData).filter(id => !player.pastMail.includes(id));

    // loop through unread messages
    for (const id of unreadIds) {
        const message = mailData[id];
        
        await displayMailPopup(message);

        // mark as read
        player.pastMail.push(id);
    }

}


// boot the game
bootGame();