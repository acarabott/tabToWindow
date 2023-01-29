export type AtomListener<T> = (state: Readonly<T>) => void;

export interface Atom<T> {
  get: () => T;
  set: (state: Readonly<T>) => void;
  swap: (swapFn: (oldState: Readonly<T>) => Readonly<T>) => void;
  addListener: (listener: AtomListener<T>) => void;
  removeListener: (listener: AtomListener<T>) => void;
}

export const defAtom = <T>(initialState: Readonly<T>): Atom<T> => {
  let state = structuredClone(initialState);
  let listeners: AtomListener<T>[] = [];

  const atom: Atom<T> = {
    get() {
      return state;
    },
    set(newState) {
      const clone = structuredClone(newState);
      state = clone;

      for (const listener of listeners) {
        listener(clone);
      }
    },
    swap(swapFn) {
      this.set(swapFn(state));
    },
    addListener(listener) {
      listeners.push(listener);
    },
    removeListener(listener) {
      listeners = listeners.filter((flistener) => flistener !== listener);
    },
  };

  return atom;
};
