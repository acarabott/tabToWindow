export const getFromId = <T extends HTMLElement>(id: string, root = document) =>
  root.getElementById(id) as T;

export const getFromIdOrThrow = <T extends HTMLElement>(id: string) => {
  const el = getFromId<T>(id);
  if (el === null) {
    throw new Error(`Could not find element with id ${id}`);
  }
  return el;
};

export const getFromClass = <T extends HTMLElement>(className: string, root = document) =>
  Array.from(root.getElementsByClassName(className)) as T[];

export const getFromTag = <T extends HTMLElement>(tagName: string, root = document) =>
  Array.from(root.getElementsByTagName(tagName)) as T[];
