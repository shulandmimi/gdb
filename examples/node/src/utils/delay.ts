export default function delay(time: number = 1000) {
    return new Promise((r) => {
        setTimeout(r, time);
    });
}
