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
      }
      if (keybinding.altKey) {
        modifiers.push("Alt");
      }
      if (keybinding.ctrlKey) {
        modifiers.push("Ctrl");
      }
      if (keybinding.metaKey) {
        modifiers.push("Cmd"); // TODO mac/win
      }
      if (keybinding.shiftKey) {
        modifiers.push("Shift");
      }

      modifiersLabel = modifiers.join(" + ");
    }

    {
      // code
      keyLabel = keybinding.display;
    }
  }

  return `${modifiersLabel} + ${keyLabel}`;
};
