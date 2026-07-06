


const DB_NAME = "SpaceExplorerSave";
const DB_VERSION = 1;

const SAVE_ID = "mainSave";





export class Database {
    constructor() {
        this.db = null;
    }


    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("saves")) {
                    db.createObjectStore("saves", { keyPath: "id" });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(true);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }





    async saveData(pSaveData) {
        pSaveData.id = SAVE_ID;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["saves"], "readwrite");
            const store = transaction.objectStore("saves");
            
            const request = store.put(pSaveData);
            
            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    }






    async readData() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["saves"], "readonly");
            const store = transaction.objectStore("saves");
            
            const request = store.get(SAVE_ID);
            
            request.onsuccess = (event) => {
                resolve(event.target.result); 
            };
            
            request.onerror = (event) => reject(event.target.error);
        });
    }






    async clear() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["saves"], "readwrite");
            const store = transaction.objectStore("saves");
            
            const request = store.delete(SAVE_ID);
            
            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    }
}