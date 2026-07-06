


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




export const SOUND_IDS = {
    sectionChange: "ui/defaultClick",
    resourceHit: "ui/hit",
    resourceBreak: "ui/break",
    collectorSell: "ui/sell",
    playerLevelup: "ui/levelup",
    skillNodeOpen: "ui/defaultClick"
}




export function playSound(pName, pVolume = 1) {
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }

    const buffer = soundBuffers[pName];
    if (!buffer) return;

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    // gain node to control volume
    const gainNode = audioCtx.createGain();
    
    // set the volume (0 is mute, 1 is full volume)
    gainNode.gain.value = pVolume; 

    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    source.start(0);
}