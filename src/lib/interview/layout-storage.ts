import { localStorage } from "../storage/local-storage";
import type { Storage } from "../storage/storage";

type Layout = Record<string, number>;

const layoutKey = "openmock:interview-layout";
export const defaultLayout = { problem: 22, workspace: 56, interviewer: 22 };
export class InterviewLayoutStorage {
  constructor(private readonly storage: Storage) {}

  readLayout(): Layout {
    try {
      const layout = this.storage.get<Layout>(layoutKey);
      if (!layout) return defaultLayout;
      const sizes = Object.keys(defaultLayout).map((key) => layout?.[key]);
      if (
        sizes.every(
          (size) =>
            typeof size === "number" && Number.isFinite(size) && size > 0,
        ) &&
        Math.abs(sizes.reduce((sum, size) => sum + size, 0) - 100) < 0.1
      )
        return layout;
    } catch {
      /* Storage may be unavailable or contain an outdated preference. */
    }
    return defaultLayout;
  }
  saveLayout(layout: Layout) {
    try {
      this.storage.set(layoutKey, layout);
    } catch {
      /* Resizing still works when storage is unavailable. */
    }
  }
}

const interviewLayoutStorage = new InterviewLayoutStorage(localStorage);
export const readLayout = () => interviewLayoutStorage.readLayout();
export const saveLayout = (layout: Layout) =>
  interviewLayoutStorage.saveLayout(layout);
