


import { playSound } from "../systems/audio.js";


const notifQueue = [];
let isNotifShowing = false;




export function sendNotif(pTitle, pDesc, pSound, pDuration = 5) {
    notifQueue.push({ title: pTitle, desc: pDesc, sound: pSound, duration: pDuration });
    processNotifQueue();
}




function processNotifQueue() {
    // stop if a notification is already playing or queue is empty
    if (isNotifShowing || notifQueue.length === 0) return;

    isNotifShowing = true;
    const nextNotif = notifQueue.shift();
    const notifsDiv = document.getElementById("notifsDiv");

    // create elements
    const container = document.createElement("div");
    container.className = "notifContainer";

    const titleEl = document.createElement("p");
    titleEl.className = "notifTitle";
    titleEl.innerHTML = nextNotif.title.replace(/<c:(.*?)>(.*?)<\/c>/g, "<span style='color: var(--c-$1); text-decoration: underline;'>$2</span>");;

    const descEl = document.createElement("p");
    descEl.className = "notifDesc";
    descEl.innerHTML = nextNotif.desc.replace(/<c:(.*?)>(.*?)<\/c>/g, "<span style='color: var(--c-$1); text-decoration: underline;'>$2</span>");;;

    container.appendChild(titleEl);
    container.appendChild(descEl);
    notifsDiv.appendChild(container);

    playSound(nextNotif.sound);

    // wait, then start the hide animation
    setTimeout(() => {
        container.classList.add("hide");

        // wait, then remove and trigger next notif
        setTimeout(() => {
            container.remove();
            isNotifShowing = false;
            processNotifQueue();
        }, 400);

    }, 400 + (nextNotif.duration * 1000));
}


