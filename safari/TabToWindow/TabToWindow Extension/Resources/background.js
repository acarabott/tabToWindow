export const COMMAND_NORMAL = "01-tab-to-window-normal";

console.log("win");


browser.commands.onCommand.addListener((command) => {
    switch (command) {
        case COMMAND_NORMAL:
            console.log("normal!");
            break;
        default:
            console.assert(false);
            break;
    }
});
