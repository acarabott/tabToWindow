import { COMMAND_NORMAL } from "./shared.js";

browser.commands.onCommand.addListener((command) => {
    console.log("command");
    console.log(command);
    switch (command) {
        case COMMAND_NORMAL:
            console.log("normal!");
            break;
        default:
            console.log("default");
            break;
    }
});
