import type { Storage } from "./storage";

export function deserialize<T>(value: string): T {
  return JSON.parse(value) as T;
}

// Text mode preserves existing unquoted API keys and stable string snapshots.
export class LocalStorage implements Storage {
  constructor(
    private readonly scope: "localStorage" | "sessionStorage" = "localStorage",
    private readonly format: "json" | "text" = "json",
  ) {}

  private get browserStorage() {
    if (typeof window !== "undefined") return window[this.scope];
    // Also supports non-window browser storage environments.
    return globalThis[this.scope];
  }

  get<T>(key: string): T | null {
    const value = this.browserStorage?.getItem(key);
    if (value == null) return null;
    return this.format === "text" ? value as T : deserialize<T>(value);
  }

  set<T>(key: string, value: T): void {
    this.browserStorage?.setItem(key, this.format === "text" ? String(value) : JSON.stringify(value));
  }

  remove(key: string): void {
    this.browserStorage?.removeItem(key);
  }
}

export const localStorage = new LocalStorage();
export const sessionStorage = new LocalStorage("sessionStorage");
export const localTextStorage = new LocalStorage("localStorage", "text");
export const sessionTextStorage = new LocalStorage("sessionStorage", "text");
