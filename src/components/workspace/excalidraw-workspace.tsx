"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((module) => module.Excalidraw),
  {
    ssr: false,
    loading: () => <p role="status" className="p-6 text-sm text-muted-foreground">Loading workspace…</p>,
  },
);

export function ExcalidrawWorkspace() {
  const { resolvedTheme } = useTheme();
  return (
    <section aria-label="Excalidraw workspace" className="system-design-canvas h-full min-h-0 w-full">
      <Excalidraw
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        autoFocus={false}
        handleKeyboardGlobally={false}
        initialData={{ appState: { viewBackgroundColor: "#ffffff" } }}
        UIOptions={{
          canvasActions: {
            export: false,
            saveAsImage: false,
            saveToActiveFile: false,
            loadScene: false,
            toggleTheme: false,
          },
        }}
      />
    </section>
  );
}
