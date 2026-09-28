"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { captureArchitectureDiagram } from "@/lib/diagram/normalize-excalidraw";
import type { ArchitectureDiagram } from "@/lib/diagram/types";

interface InterviewDiagramContextValue {
  registerSceneReader: (reader: (() => readonly ExcalidrawElement[]) | null) => void;
  captureCurrentArchitecture: () => ArchitectureDiagram;
}

const InterviewDiagramContext = createContext<InterviewDiagramContextValue | null>(null);

export function InterviewDiagramProvider({ children }: { children: ReactNode }) {
  const sceneReader = useRef<(() => readonly ExcalidrawElement[]) | null>(null);
  const registerSceneReader = useCallback((reader: (() => readonly ExcalidrawElement[]) | null) => {
    sceneReader.current = reader;
  }, []);
  const captureCurrentArchitecture = useCallback(() => (
    captureArchitectureDiagram(sceneReader.current ?? (() => []))
  ), []);

  const value = useMemo(() => ({
    registerSceneReader,
    captureCurrentArchitecture,
  }), [captureCurrentArchitecture, registerSceneReader]);

  return <InterviewDiagramContext value={value}>{children}</InterviewDiagramContext>;
}

export function useInterviewDiagram(): InterviewDiagramContextValue {
  const context = useContext(InterviewDiagramContext);
  if (!context) throw new Error("Interview diagram provider is unavailable");
  return context;
}
