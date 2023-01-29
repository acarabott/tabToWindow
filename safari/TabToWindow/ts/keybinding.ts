import { CommandName, IKeybinding, IOptions, PopupState } from "./api";
import { Atom } from "./defAtom";
import { getOptions } from "./options-storage";
import { ScanCode } from "./ScanCode";

const defKeybinding = (): IKeybinding => ({
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  altGraphKey: false,
  code: "None",
  display: "",
});

export const setupKeybinding = (
  db: Atom<PopupState>,
  onUpdate: (keybindings: IOptions["keybindings"]) => void,
  onCancel: () => void,
) => {
  let keybinding = defKeybinding();

  const resetKeybinding = () => (keybinding = defKeybinding());

  const assign = async (commandName: CommandName, keybinding: Readonly<IKeybinding>) => {
    const options = await getOptions();
    const keybindings = options.get("keybindings");

    const newKeybindings = structuredClone(keybindings);
    newKeybindings[commandName] = structuredClone(keybinding);
    options.update({ keybindings: newKeybindings });
    onUpdate(newKeybindings);
  };

  const MODIFIERS: ScanCode[] = [
    "ControlLeft",
    "ControlRight",
    "AltLeft",
    "AltRight",
    "MetaLeft",
    "MetaRight",
    "ShiftLeft",
    "ShiftRight",
  ];

  const getAltGraphState = (event: KeyboardEvent) => event.getModifierState("AltGraph");

  const isModifier = (event: KeyboardEvent) =>
    MODIFIERS.includes(event.code as unknown as ScanCode) || getAltGraphState(event);

  const onKeyDown = (event: KeyboardEvent) => {
    const state = db.get();
    if (state.commandBeingAssignedTo !== undefined) {
      event.preventDefault();

      const code = event.code as unknown as ScanCode;

      if (isModifier(event)) {
        keybinding.ctrlKey = event.ctrlKey;
        keybinding.shiftKey = event.shiftKey;
        keybinding.altKey = event.altKey;
        keybinding.metaKey = event.metaKey;
        keybinding.altGraphKey = getAltGraphState(event);
      } else if (code === "Escape") {
        resetKeybinding();
        db.set({ commandBeingAssignedTo: undefined });
        onCancel();
      } else {
        keybinding.code = code;
        keybinding.display = event.code; // TODO need lookup
      }

      if (
        keybinding.code !== "None" &&
        (keybinding.ctrlKey ||
          keybinding.shiftKey ||
          keybinding.altKey ||
          keybinding.metaKey ||
          keybinding.altGraphKey)
      ) {
        assign(state.commandBeingAssignedTo, keybinding);
        resetKeybinding();
      }
    }
  };

  document.body.addEventListener("keydown", onKeyDown);
};
