



import { isGameFocused } from "../main.js";



export const SOUND_IDS = {
    defaultClick: "ui/defaultClick",
    fail: "ui/fail",
    sectionChange: "ui/defaultClick",
    popupOpen: "ui/popupOpen",
    popupClose: "ui/defaultClick",
    gearEquip: "ui/defaultClick",
    gearUnequip: "ui/defaultClick",
    gearDelete: "ui/gearDelete",
    resourceHit: "ui/hit",
    resourceBreak: "ui/break",
    buyGear: "ui/credits",
    sell: "ui/credits",
    playerLevelup: "ui/levelup",
    skillUnlock: "ui/defaultClick",
    skillNodeOpen: "ui/defaultClick",

    selectPlanet: "ui/defaultClick",
    landPlanet: "ui/defaultClick",
    unlockPlanet: "ui/credits"
}




const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const soundBuffers = {};





export async function loadSounds(pLoadingStatus) {

    pLoadingStatus("Loading sound effects...");

    const response = await fetch("assets/sounds/manifest.json");
    const data = await response.json();

    const loadPromises = [];

    // loop through sound categories
    for (const [key, value] of Object.entries(data)) {
        const category = key;
        const categoryData = value;

        // loop through sounds in categroy
        for (const [soundName, soundInfo] of Object.entries(categoryData)) {
            const soundPath = `assets/sounds/${category}/${soundName}.${soundInfo.format}`;

            // fetch sound
            const loadPromise = fetch(soundPath)
                .then(res => res.arrayBuffer())
                .then(buffer => audioCtx.decodeAudioData(buffer))
                .then(decoded => {
                    soundBuffers[`${category}/${soundName}`] = decoded;
                })
                .catch(err => console.error(`Failed to load ${soundName}:`, err));

            loadPromises.push(loadPromise);
        }
    }


    // wait for all sounds to load
    await Promise.all(loadPromises);

}







export function playSound(pName, pVolume = 2) {

    if (!isGameFocused) return;

    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    const buffer = soundBuffers[pName];
    if (!buffer) return;

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    // gain node to control volume
    const gainNode = audioCtx.createGain();
    
    // set the volume
    gainNode.gain.value = pVolume; 

    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    source.start(0);
}