export function timeNowMs(): number {
    return Date.now();
}

export function timeNowSec(): number {
    return Math.round(Date.now() / 1000);
}

export async function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};
