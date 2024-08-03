/* eslint-disable no-use-before-define */
/* eslint-disable @typescript-eslint/array-type */

import { clone } from "./clone";

/* eslint-disable @typescript-eslint/ban-types */
export type ImmutablePrimitive = undefined | null | boolean | string | number | Function;

export type ImmutableArray<T> = ReadonlyArray<Immutable<T>>;
export type ImmutableMap<K, V> = ReadonlyMap<Immutable<K>, Immutable<V>>;
export type ImmutableSet<T> = ReadonlySet<Immutable<T>>;
export type ImmutableObject<T> = { readonly [K in keyof T]: Immutable<T[K]> };
export type Immutable<T> = T extends ImmutablePrimitive
  ? T
  : T extends Map<infer K, infer V>
  ? ImmutableMap<K, V>
  : T extends Set<infer M>
  ? ImmutableSet<M>
  : ImmutableObject<T>;

export type AtomListener<T> = (state: Immutable<T>) => void;

const cloneAsMutable = <T>(src: Immutable<T>): T => clone(src) as T;

export interface Atom<T> {
  get: () => Immutable<T>;
  set: (state: Immutable<T>) => void;
  swap: (swapFn: (copy: T) => Immutable<T>) => void;
  addListener: (listener: AtomListener<T>) => void;
  removeListener: (listener: AtomListener<T>) => void;
  notifyListeners: () => void;
}

export const defAtom = <T>(initialState: Immutable<T>): Atom<T> => {
  let state = cloneAsMutable(initialState);
  let listeners: AtomListener<T>[] = [];

  const notifyListeners = (newState: Immutable<T>) => {
    for (const listener of listeners) {
      listener(newState);
    }
  };

  const atom: Atom<T> = {
    get() {
      return state as Immutable<T>;
    },
    set(newState) {
      const copy = cloneAsMutable(newState);
      state = copy;
      notifyListeners(copy as Immutable<T>);
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
    notifyListeners() {
      notifyListeners(state as Immutable<T>);
    },
  };

  return atom;
};
