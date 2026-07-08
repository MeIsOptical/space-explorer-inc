

let wakeLock = null;

// request a screen wake lock
const requestWakeLock = async () => {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
    } catch (err) {
        console.error('Wake Lock error:', err);
    }
};

// init wake lock
export const initWakeLock = () => {
    document.addEventListener('visibilitychange', () => {
        if (wakeLock !== null && document.visibilityState === 'visible') {
            requestWakeLock();
        }
    });

    requestWakeLock();
};