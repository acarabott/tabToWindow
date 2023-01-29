import { IKeybinding } from "./api";

export const keybindingToString = (keybinding: IKeybinding | undefined): string => {
  let modifiersLabel = "_";
  let keyLabel = "_";

  if (keybinding !== undefined) {
    {
      // modifiers
      const modifiers: string[] = [];

      if (keybinding.altGraphKey) {
        modifiers.push("AltGr");
      } else if (keybinding.altKey) {
        modifiers.push("Alt");
      } else if (keybinding.ctrlKey) {
        modifiers.push("Ctrl");
      } else if (keybinding.metaKey) {
        modifiers.push("Cmd"); // TODO mac/win
      } else if (keybinding.shiftKey) {
        modifiers.push("Shift");
      }

      modifiersLabel = modifiers.join(" ");
    }

    {
      // code
      keyLabel = keybinding.display;
    }
  }

  return `${modifiersLabel} + ${keyLabel}`;
};
