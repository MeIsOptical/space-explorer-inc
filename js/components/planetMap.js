import { Planet } from "./planet.js";
import { formatBigNumber } from "../utils/formatting.js";
import { Camera } from "./camera.js";
import { RUN_CONFIG } from "../main.js";
import { playSound, SOUND_IDS } from "../systems/audio.js";


const GRID_SIZE = 60;


export class PlanetMap {
    constructor(pResourceManager, pPlayer, pMarketManager) {
        this.planets = [];
        this.resourceManager = pResourceManager;
        this.player = pPlayer;
        this.marketManager = pMarketManager;

        //#region MAP STATE

        this.mapElement = null;
        this.selectedPlanet = null;
        this.camera = null;

        //#endregion
    }



    async loadPlanets(pLoadingStatus) {

        pLoadingStatus("Loading planets...");

        let planetIds;
        try {
            const planetManifestResponse = await fetch("assets/planets/manifest.json");
            planetIds = await planetManifestResponse.json();
        }
        catch {
            return { success: false, error: "Failed to fetch planets manifest." };
        }

        const planetLength = planetIds.length;
        let currentPlanetLength = 1;

        // error handling
        const missingIds = [];

        for (const id of planetIds) {

            pLoadingStatus(`Loading planets... ${currentPlanetLength}/${planetLength}`);
            currentPlanetLength++;

            try {
                const newPlanet = new Planet(id);
                await newPlanet.build(this.resourceManager, this.player);
                
                // map markets
                if (newPlanet.markets) {
                    newPlanet.markets = newPlanet.markets.map(marketId => 
                        this.marketManager.markets.find(m => m.id === marketId)
                    ).filter(Boolean);
                } else {
                    newPlanet.markets = [];
                }

                newPlanet.marketManager = this.marketManager; 
                this.planets.push(newPlanet);
            }
            catch {
                missingIds.push(id);
            }
        }

        if (missingIds.length === 0) return { success: true };
        else {
            const formattedIds = missingIds.map(id => `"${id}"`).join(", ");
            return { success: false, error: `Error loading planet${missingIds.length === 1 ? "" : "s"} with ID${missingIds.length === 1 ? "" : "s"} ${formattedIds}`};
        }
    }



    getPlanetById(pId) {
        return this.planets.find(planet => planet.id === pId);
    }


    targetPlanet(pPlanet, pZoom) {

        // remove selection from other planets
        this.deselectPlanet();

        this.selectedPlanet = pPlanet;

        // add outline to this planet
        pPlanet.element.classList.add("selected");


        // move camera
        const centerX = this.container.clientWidth / 2;
        const centerY = this.container.clientHeight / 2;

        const planetCenterX = (pPlanet.x * GRID_SIZE) + (pPlanet.element.offsetWidth / 2);
        const planetCenterY = (pPlanet.y * GRID_SIZE) + (pPlanet.element.offsetHeight / 2);

        const targetScale = pZoom || this.camera.targetScale;
        const targetTranslateX = centerX - (planetCenterX * targetScale);
        const targetTranslateY = centerY - (planetCenterY * targetScale) - 140;

        this.camera.moveTo(targetTranslateX, targetTranslateY, targetScale);


        // update and show popup
        if (this.popupElement) {
            const titleElement = this.popupElement.querySelector("#popupTravelTitle");
            const resourcesElement = this.popupElement.querySelector("#popupTravelResources");
            const travelBtn = document.getElementById("popupTravelBtn");
            const inDevBadge = document.getElementById("popupTravelInDev");

            // check if planet can be unlocked
            const canUnlock = pPlanet.canUnlock;

            titleElement.innerText = pPlanet.name.toUpperCase();
            

            // inDev badge
            if (pPlanet.inDev) {
                if (canUnlock) {
                    inDevBadge.innerText = "⚠ In Development ⚠";
                }
                else {
                    inDevBadge.innerText = "⚠ Coming soon! ⚠";
                }
                inDevBadge.style.display = "initial";
            }
            else {
                inDevBadge.style.display = "none";
            }

            let displayCount = 0;
            resourcesElement.innerHTML = "";

            // display resources
            const resourceNames = pPlanet.resourceNodes.map(node => `<span style="color: ${node.manifest.color}; text-decoration: underline;">${node.manifest.name}</span>`);
            if (resourceNames.length > 0) {
                   resourcesElement.innerHTML += `⏵ Resources: ${resourceNames.join(", ")}<br>`;
                   displayCount++;
               }

            // display markets
            const marketNames = pPlanet.markets.map(market => `<span style="color: ${market.color || 'var(--c-credits)'}; text-decoration: underline;">${market.name}</span>`);
            if (marketNames.length > 0) {
                resourcesElement.innerHTML += `⏵ Markets: ${marketNames.join(", ")}<br>`;
                displayCount++;
            }


            if (displayCount === 0) {
                resourcesElement.innerHTML = "Nothing to do here...";
                if (pPlanet.inDev) resourcesElement.innerHTML += " for now.";
            }
            

            // travel button state
            const isUnlocked = this.player.hasUnlockedPlanet(pPlanet.id);

            if (pPlanet === this.player.currentPlanet) {
                // already here
                travelBtn.style.display = "flex";
                travelBtn.innerText = "Landed";
                travelBtn.style.opacity = 0.4;
            } else if (isUnlocked) {
                // unlocked and can travel
                travelBtn.style.display = "flex";
                travelBtn.innerText = "Travel";
                travelBtn.style.opacity = 1;
            } else if (canUnlock) {
                // locked
                travelBtn.style.display = "flex";
                travelBtn.innerHTML = `Buy Access: ${formatBigNumber(pPlanet.price) || '???'} <img class="numImg" src="assets/ui/icons/credits.png">`; 

                if (this.player.credits.currency >= BigInt(pPlanet.price * 100)) travelBtn.style.opacity = 1;
                else travelBtn.style.opacity = 0.4;
            } else {
                // locked and cannot unlock
                travelBtn.style.display = "none";
            }

            this.popupElement.classList.add("show");
        }
    }




    create() {
        this.container.innerHTML = "";

        // create the map wrapper
        const mapElement = document.createElement("div");
        mapElement.id = "spaceMap";
        mapElement.style.transformOrigin = "0 0";
        this.mapElement = mapElement;

        // loop through planets
        this.planets.forEach(pPlanet => {
            // create planet container
            const planetElement = document.createElement("div");
            planetElement.classList.add("planetContainer");
            planetElement.id = "planet-" + pPlanet.id;

            // position planet
            planetElement.style.left = (pPlanet.x * GRID_SIZE) + "px"; 
            planetElement.style.top = (pPlanet.y * GRID_SIZE) + "px";

            pPlanet.element = planetElement;


            // click event
            planetElement.addEventListener("click", () => {
                if (this.camera.hasDragged) return; 

                // target planet
                this.targetPlanet(pPlanet);
                playSound(SOUND_IDS.selectPlanet);
            });


            // image shadow
            const shadowElement = document.createElement("img");
            shadowElement.src = `assets/planets/${pPlanet.id}/default.png`;
            shadowElement.alt = pPlanet.name;
            shadowElement.className = "planetShadow";
            shadowElement.style.filter = `blur(${pPlanet.glow ? pPlanet.glow : 2}px)`;
            planetElement.appendChild(shadowElement);


            // planet wrapper
            const imgWrapper = document.createElement("div");
            imgWrapper.className = "planetImgWrapper";

            // planet image
            const imgElement = document.createElement("img");
            imgElement.src = `assets/planets/${pPlanet.id}/default.png`;
            imgElement.alt = pPlanet.name;
            imgElement.className = "planetImg";

            imgWrapper.appendChild(imgElement);
            planetElement.appendChild(imgWrapper);

            // add marker
            const markerElement = document.createElement("img");
            markerElement.className = "planetMarker";
            planetElement.appendChild(markerElement);


            // append planet to map
            mapElement.appendChild(planetElement);

        });

        // append the map to div
        this.container.appendChild(mapElement);


        //#region selected planet popup

        const popupElement = document.createElement("div");
        popupElement.id = "planetPopup";
        popupElement.innerHTML =
            `<p id="popupTravelTitle">PLANET</p>
            <p id="popupTravelResources"></p>
            <p id=popupTravelInDev></p>
            <button class="btn purple" id="popupTravelBtn">Travel</button>`;
        
        this.container.appendChild(popupElement);
        this.popupElement = popupElement;

        // block events from reaching the map container
        popupElement.addEventListener("mousedown", (e) => e.stopPropagation());
        popupElement.addEventListener("touchstart", (e) => e.stopPropagation());
        popupElement.addEventListener("wheel", (e) => e.stopPropagation());
        popupElement.addEventListener("click", (e) => e.stopPropagation());

        // travel button
        const travelBtn = popupElement.querySelector("#popupTravelBtn");
        travelBtn.addEventListener("click", () => {
            if (this.selectedPlanet) {

                const isUnlocked = this.player.hasUnlockedPlanet(this.selectedPlanet.id);
                const canUnlock = this.selectedPlanet.canUnlock;


                if (this.selectedPlanet === this.player.currentPlanet) { // already here
                    document.getElementById("sectionBtn-planet").click();
                    playSound(SOUND_IDS.sectionChange);
                }

                else if (isUnlocked || RUN_CONFIG.dev) { // unlocked and can travel
                    
                    // land
                    this.player.landOn(this.selectedPlanet);
                    document.getElementById("sectionBtn-planet").click();
                    playSound(SOUND_IDS.landPlanet);

                }

                else if (canUnlock) { // locked

                    if (this.player.credits.currency >= BigInt(this.selectedPlanet.price * 100)) {
                        this.player.credits.add(-this.selectedPlanet.price);
                        this.player.unlockPlanet(this.selectedPlanet.id);
                        this.targetPlanet(this.selectedPlanet);
                        playSound(SOUND_IDS.unlockPlanet);
                    }
                    else {
                        // not enough credits
                        playSound(SOUND_IDS.fail);
                    }

                }

                
            }
        });


        // initialize the camera
        this.camera = new Camera(this.container, this.mapElement, {
            onInteract: () => this.deselectPlanet()
        });
        this.camera.startLoop();
    }



    deselectPlanet() {
        const allPlanets = this.mapElement.querySelectorAll('.planetContainer');
        allPlanets.forEach(el => el.classList.remove('selected'));
        
        this.selectedPlanet = null;

        // hide popup
        if (this.popupElement) {
            this.popupElement.classList.remove("show");
        }
    }




    updatePlanetMarkers() {
        const allPlanets = this.mapElement.querySelectorAll('.planetContainer');
        allPlanets.forEach(el => el.classList.remove('visible'));

        if (this.player.currentPlanet) {
            const currentEl = document.getElementById("planet-" + this.player.currentPlanet.id);
            if (currentEl) {
                const markerEl = currentEl.querySelector('.planetMarker');
                if (markerEl) markerEl.src = "assets/ui/space map/red-marker.png";
                currentEl.classList.add('visible');

            }
        }
    }
}





