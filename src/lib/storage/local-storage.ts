import type { Storage } from "./storage";

export function deserialize<T>(value: string): T {
  return JSON.parse(value) as T;
}

// Explicit text methods preserve unquoted API keys and stable string snapshots.
export class LocalStorage implements Storage {
  constructor(
    private readonly scope: "localStorage" | "sessionStorage" = "localStorage",
  ) {}

  private get browserStorage() {
    if (typeof window !== "undefined") return window[this.scope];
    // Also supports non-window browser storage environments.
    return globalThis[this.scope];
  }

  get<T>(key: string): T | null {
    const value = this.browserStorage?.getItem(key);
    if (value == null) return null;
    return deserialize<T>(value);
  }

  set<T>(key: string, value: T): void {
    this.browserStorage?.setItem(key, JSON.stringify(value));
  }

  getText(key: string): string | null {
    return this.browserStorage?.getItem(key) ?? null;
  }

  setText(key: string, value: string): void {
    this.browserStorage?.setItem(key, value);
  }

  remove(key: string): void {
    this.browserStorage?.removeItem(key);
  }
}

export const localStorage = new LocalStorage();
export const sessionStorage = new LocalStorage("sessionStorage");
