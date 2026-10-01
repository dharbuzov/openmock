export interface Storage {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  getText(key: string): string | null;
  setText(key: string, value: string): void;
  remove(key: string): void;
}
