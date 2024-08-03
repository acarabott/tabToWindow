import { CommandName, IKeybinding, Keybindings, PopupState } from "./api";
import { clone } from "./clone";
import { Atom, Immutable } from "./defAtom";
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
  const assign = async (commandName: CommandName, keybinding: Immutable<IKeybinding>) => {
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
      const newKeybindings = clone(keybindings);
      newKeybindings[commandName] = clone(keybinding);
      await options.update({ keybindings: newKeybindings });
      onUpdate(newKeybindings);
    } else {
      onAlreadyAssigned(commandName, existingBinding[0]);
    }

    db.set({ commandBeingAssignedTo: undefined, keybinding: defKeybinding() });
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
    if (db.get().commandBeingAssignedTo !== undefined) {
      event.preventDefault();

      const code = event.code as unknown as ScanCode;

      if (isModifier(event)) {
        db.swap((oldState) => ({
          ...oldState,
          keybinding: {
            ...oldState.keybinding,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            altGraphKey: getAltGraphState(event),
          },
        }));
      } else if (code === "Escape") {
        db.set({ commandBeingAssignedTo: undefined, keybinding: defKeybinding() });
      } else {
        db.swap((oldState) => ({
          ...oldState,
          keybinding: {
            ...oldState.keybinding,
            code,
            display: event.code, // TODO need lookup
          },
        }));
      }

      {
        // do assignment
        const state = db.get();
        const keybinding = state.keybinding;

        if (
          state.commandBeingAssignedTo !== undefined &&
          keybinding.code !== "None" &&
          (keybinding.ctrlKey ||
            keybinding.shiftKey ||
            keybinding.altKey ||
            keybinding.metaKey ||
            keybinding.altGraphKey)
        ) {
          void assign(state.commandBeingAssignedTo, keybinding);
        }
      }
    }
  };

  document.body.addEventListener("keydown", onKeyDown);
};
