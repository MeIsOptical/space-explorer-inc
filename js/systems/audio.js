



import { isGameFocused } from "../main.js";



export const SOUND_IDS = {
    defaultClick: "ui/defaultClick",
    fail: "ui/fail",
    sectionChange: "ui/defaultClick",
    popupOpen: "ui/popupOpen",
    popupClose: "ui/defaultClick",
    gearEquip: "ui/defaultClick",
    gearUnequip: "ui/defaultClick",
    gearDelete: "ui/break",
    resourceHit: "ui/hit",
    resourceBreak: "ui/break",
    buyGear: "ui/credits",
    sell: "ui/credits",
    playerLevelup: "ui/levelup",
    skillUnlock: "ui/defaultClick",
    skillNodeOpen: "ui/defaultClick",

    selectPlanet: "ui/defaultClick",
    landPlanet: "ui/defaultClick",
    unlockPlanet: "ui/credits",

    startResearch: "ui/bubbles"
}




const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const soundBuffers = {};

const validMusic = [];


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

            if (category === "music") {
                validMusic.push(`${category}/${soundName}`);
            }

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










// music

let musicSource = null;
let musicGainNode = null;
let currentMusicVolume = 0.3;

export function startMusic(pVolume) {

    // pick random music
    const rndMusic = validMusic[Math.floor(Math.random() * validMusic.length)];


    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    const buffer = soundBuffers[rndMusic];
    if (!buffer) return;

    // stop current music
    if (musicSource) {
        musicSource.stop();
    }

    musicSource = audioCtx.createBufferSource();
    musicSource.buffer = buffer;
    musicSource.loop = true;

    if (!musicGainNode) {
        musicGainNode = audioCtx.createGain();
        musicGainNode.connect(audioCtx.destination);
    }

    if (pVolume !== undefined) currentMusicVolume = pVolume;
    musicGainNode.gain.value = currentMusicVolume;

    musicSource.connect(musicGainNode);
    musicSource.start(0);
}


export function muteMusic(pIsMuted) {
    if (musicGainNode) {
        musicGainNode.gain.value = pIsMuted ? 0 : currentMusicVolume;
    }
}