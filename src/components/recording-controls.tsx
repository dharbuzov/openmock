"use client";

import { useEffect, useRef } from "react";
import { ArrowUp, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function MicrophoneWaveform({ stream }: { stream: MediaStream | null }) {
  const bars = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!stream) return;
    let context: AudioContext | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let analyser: AnalyserNode | undefined;
    let frame = 0;
    try {
      context = new AudioContext();
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      void context.resume().catch(() => {});
      const samples = new Uint8Array(analyser.fftSize);
      const levels = Array<number>(32).fill(0);
      let previous = 0;
      const draw = (time: number) => {
        if (time - previous >= 33) {
          previous = time;
          analyser!.getByteTimeDomainData(samples);
          let energy = 0;
          for (const sample of samples) energy += ((sample - 128) / 128) ** 2;
          levels.shift();
          levels.push(Math.min(1, Math.sqrt(energy / samples.length) * 5));
          Array.from(bars.current?.children ?? []).forEach((bar, index) => {
            (bar as HTMLElement).style.transform =
              `scaleY(${0.08 + levels[index] * 0.92})`;
          });
        }
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    } catch {
      // Visualization failure must not prevent recording or transcription.
    }
    return () => {
      cancelAnimationFrame(frame);
      source?.disconnect();
      analyser?.disconnect();
      void context?.close().catch(() => {});
    };
  }, [stream]);
  return (
    <div
      ref={bars}
      aria-hidden="true"
      className="flex h-7 min-w-0 flex-1 items-center gap-0.5 overflow-hidden"
    >
      {Array.from({ length: 32 }, (_, index) => (
        <span
          key={index}
          className="h-full min-w-px flex-1 rounded-sm bg-foreground/50"
          style={{ transform: "scaleY(0.08)" }}
        />
      ))}
    </div>
  );
}

export function RecordingControls({
  stream,
  seconds,
  onCancel,
  onStop,
  onSend,
  microphoneShortcut,
}: {
  stream: MediaStream | null;
  seconds: number;
  onCancel: () => void;
  onStop: () => void;
  onSend: () => void;
  microphoneShortcut: string;
}) {
  return (
    <div
      aria-label="Microphone recording"
      className="flex w-full min-w-0 items-center gap-2"
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cancel recording"
              onClick={onCancel}
              autoFocus
            />
          }
        >
          <X aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Cancel — Esc</TooltipContent>
      </Tooltip>
      <MicrophoneWaveform stream={stream} />
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-mono tabular-nums text-muted-foreground">
        <span
          aria-hidden="true"
          className="size-1 rounded-full bg-foreground/60"
        />
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:
        {String(seconds % 60).padStart(2, "0")}
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Stop and review"
              onClick={onStop}
            />
          }
        >
          <Square aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Stop and review — {microphoneShortcut}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon-sm"
              aria-label="Stop and send"
              onClick={onSend}
            />
          }
        >
          <ArrowUp aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Send recording — Enter</TooltipContent>
      </Tooltip>
    </div>
  );
}
