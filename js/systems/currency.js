

import { MAX_CURRENCY, formatBigNumber } from "../utils/formatting.js";



export class Currency {
    constructor(pId, pInitValue = 0, pShowDecimals = true) {
        this.id = pId;
        this.showDecimals = pShowDecimals;
        this.currency = this.parseToCents(pInitValue);

        this.displayElement = document.getElementById("currency-" + pId);

        if (this.displayElement) {
            this.displayElement.innerText = this.display();
        }
        
    }


    add(pValue) {
        this.currency += this.parseToCents(pValue);
        if (this.displayElement) {
            this.displayElement.innerText = this.display();
        }
    }


    



    addCents(pCents) {
        this.currency += BigInt(pCents);
        if (this.displayElement) {
            this.displayElement.innerText = this.display();
        }
    }



    setCents(pValue) {
        this.currency = pValue;
        if (this.displayElement) {
            this.displayElement.innerText = this.display();
        }
    }



    parseToCents(pValue) {
        let centsVal;
        if (typeof pValue === 'bigint') {
            centsVal = pValue * 100n;
        } 
        else {
            centsVal = BigInt(Math.round(Number(pValue) * 100));
        }

        if (centsVal > MAX_CURRENCY) {
            return MAX_CURRENCY;
        }
        return centsVal;
    }





    display() {
        let displayInt = this.currency / 100n;

        if (displayInt >= 1000n) {
            return formatBigNumber(displayInt);
        }
        else {
            let displayDec = this.currency % 100n;
            
            if (this.showDecimals) {
                return displayInt.toString() + "." + displayDec.toString().padStart(2, '0');
            } else {
                return displayInt.toString();
            }
        }
    }
}