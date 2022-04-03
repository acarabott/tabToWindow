// browser.runtime.sendMessage({ greeting: "hello" }).then((response) => {
//     console.log("Received response: ", response);
// });

// browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     console.log("Received request: ", request);
// });

const onReady = (action) => {
    const isReady = document.readyState === "interactive" || document.readyState === "complete";
    isReady ? action() : document.addEventListener("DOMContentLoaded", action);
};

document.addEventListener("keydown", (event) => {
    if (event.altKey && event.code === "KeyX") {
        console.log("do the thing")
    }
});

onReady(() => {});
