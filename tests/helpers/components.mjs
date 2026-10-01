import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { load } from "../register-typescript.mjs";

export function loadComponent(filename, overrides = {}) {
  const absolute = path.resolve(filename);
  const code = ts.transpileModule(readFileSync(absolute, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => {
      if (name in overrides) return overrides[name];
      const file = name.startsWith("@/")
        ? path.resolve("src", name.slice(2))
        : name.startsWith(".")
          ? path.resolve(path.dirname(absolute), name)
          : null;
      if (file) {
        if (existsSync(`${file}.tsx`))
          return loadComponent(`${file}.tsx`, overrides);
        return load(file);
      }
      return load(name);
    },
    compiled,
    compiled.exports,
  );
  return compiled.exports;
}

export function hookHarness() {
  const slots = [],
    effects = [];
  let index = 0;
  const react = {
    useState(initial) {
      const slot = index++;
      if (!(slot in slots))
        slots[slot] = typeof initial === "function" ? initial() : initial;
      return [
        slots[slot],
        (value) => {
          slots[slot] =
            typeof value === "function" ? value(slots[slot]) : value;
        },
      ];
    },
    useRef(initial) {
      const slot = index++;
      return (slots[slot] ??= { current: initial });
    },
    useEffect(callback, deps) {
      const slot = index++;
      if (
        !slots[slot] ||
        deps.some((dep, i) => !Object.is(dep, slots[slot].deps[i]))
      )
        effects.push(() => {
          slots[slot]?.cleanup?.();
          slots[slot] = { deps, cleanup: callback() };
        });
    },
    useSyncExternalStore(subscribe, snapshot) {
      return snapshot();
    },
    useMemo(callback) {
      return callback();
    },
    createContext() {
      return { Provider: "provider" };
    },
  };
  return {
    react,
    render(component, props) {
      index = 0;
      const result = component(props);
      while (effects.length) effects.shift()();
      return result;
    },
  };
}

export function findElement(tree, predicate) {
  if (!tree || typeof tree !== "object") return null;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}
