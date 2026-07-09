

const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
export const MAX_CURRENCY = (10n ** BigInt(SUFFIXES.length * 3 + 2)) - 1n; // calculated automatically from the suffixes array




export function formatBigNumber(pValue) {

    let bigIntValue;
    if (typeof pValue === "bigint") bigIntValue = pValue;
    else bigIntValue = BigInt(pValue);

    if (bigIntValue >= 1000n) {
        let strVal = bigIntValue.toString();
        let length = strVal.length;
        
        let exponent = Math.floor((length - 1) / 3);
        let maxExponent = SUFFIXES.length - 1;
        exponent = Math.min(exponent, maxExponent);

        let divisor = 10n ** BigInt(exponent * 3);
        
        let shortValue = Number(bigIntValue * 100n / divisor) / 100;

        return `${shortValue.toFixed(2)}${SUFFIXES[exponent]}`;
    }

    return bigIntValue.toString();
}





export function formatSeconds(pValue) {
    if (pValue === 0) return "0s";

    let remains = pValue;
    let formattedTime = "";

    // hours
    const hours = Math.floor(remains / 3600);
    remains = remains % 3600;
    if (hours > 0) formattedTime += `${String(hours).padStart(2, '0')}:`;

    // minutes
    const minutes = Math.floor(remains / 60);
    remains = remains % 60;
    formattedTime += `${String(minutes).padStart(2, '0')}:`;

    // seconds
    const seconds = Math.floor(remains);
    if (seconds > 0 || formattedTime !== "") formattedTime += String(seconds).padStart(2, '0');

    return formattedTime;
}