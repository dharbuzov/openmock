"use client";
import { MessageCircle, Mic } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
export type InteractionMode = "chat" | "live";
export function InteractionModeControl({
  mode,
  setMode,
  speechAvailable,
}: {
  mode: InteractionMode;
  setMode: (mode: InteractionMode) => void;
  speechAvailable: boolean;
}) {
  return (
    <ToggleGroup
      aria-label="Interaction mode"
      value={[mode]}
      onValueChange={(values) => {
        if (values[0] === "chat" || values[0] === "live") setMode(values[0]);
      }}
      variant="outline"
      size="sm"
      spacing={0}
    >
      <ToggleGroupItem value="chat" aria-label="Chat interaction">
        <MessageCircle data-icon="inline-start" />
        Chat
      </ToggleGroupItem>
      <ToggleGroupItem
        value="live"
        aria-label="Live interaction"
        disabled
        title={
          speechAvailable
            ? "Live conversation is not available yet. Use the microphone in Chat."
            : "Live conversation is not available yet."
        }
      >
        <Mic data-icon="inline-start" />
        Live
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
