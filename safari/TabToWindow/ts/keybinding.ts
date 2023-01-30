import { CommandName, IKeybinding, Keybindings, PopupState } from "./api";
import { Atom } from "./defAtom";
import { getEntries } from "./getEntries";
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

export type OnKeybindingsUpdated = (keybindings: Keybindings) => void;
export type OnKeybindingCancelled = () => void;
export type OnKeybindingAlreadyAssigned = (failed: CommandName, existing: CommandName) => void;

export const setupKeybinding = (
  db: Atom<PopupState>,
  onUpdate: OnKeybindingsUpdated,
  onAlreadyAssigned: OnKeybindingAlreadyAssigned,
) => {
  let keybinding = defKeybinding();

  const resetKeybinding = () => (keybinding = defKeybinding());

  const assign = async (commandName: CommandName, keybinding: Readonly<IKeybinding>) => {
    const options = await getOptions();
    const keybindings = options.get("keybindings");

    const existingBinding = getEntries(keybindings).find(([otherCommandName, otherKeybinding]) => {
      return (
        otherCommandName !== commandName &&
        keybinding.ctrlKey === otherKeybinding?.ctrlKey &&
        keybinding.shiftKey === otherKeybinding?.shiftKey &&
        keybinding.altKey === otherKeybinding?.altKey &&
        keybinding.metaKey === otherKeybinding?.metaKey &&
        keybinding.altGraphKey === otherKeybinding?.altGraphKey &&
        keybinding.code === otherKeybinding?.code
      );
    });

    if (existingBinding === undefined) {
      const newKeybindings = structuredClone(keybindings);
      newKeybindings[commandName] = structuredClone(keybinding);
      options.update({ keybindings: newKeybindings });
      onUpdate(newKeybindings);
    } else {
      onAlreadyAssigned(commandName, existingBinding[0]);
    }

    db.set({ commandBeingAssignedTo: undefined });
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
