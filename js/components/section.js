
import { playSound, SOUND_IDS } from "../systems/audio.js";



const SECTION_BTNS = document.querySelectorAll('.btn.section');
const SECTION_CONTAINERS = [];



export class Section {
    constructor(pId, pAction) {
        this.id = pId;


        //#region CONTAINER

        this.container = document.getElementById("dynContainer-" + pId);
        SECTION_CONTAINERS.push(this.container);

        //#endregion



        //#region BUTTON
        this.btnElement = document.getElementById("sectionBtn-" + pId);

        this.btnElement.addEventListener('click', () => {

            if (this.btnElement.classList.contains('selected')) { return };
            
            // remove 'selected' class from all section buttons
            SECTION_BTNS.forEach(b => b.classList.remove('selected'));
            
            // add 'selected' class to the clicked button
            this.btnElement.classList.add('selected');

            // right before showing page, execute custom code
            if (pAction && typeof pAction == "function") {
                pAction();
            }

            // display page
            SECTION_CONTAINERS.forEach(c => c.style.display = "none");
            this.container.style.display = "flex";

            // play sound if triggered by a real user interaction
            if (event.isTrusted) {
                playSound(SOUND_IDS.sectionChange);
            }
        });

        //#endregion
    }
}