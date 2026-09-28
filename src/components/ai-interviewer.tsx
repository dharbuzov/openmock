"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOpenSettings } from "@/components/settings-provider";
import { useInterviewCode } from "@/components/interview-code-context";
import { useInterviewSession } from "@/components/interview-session-context";
import { readSettings } from "@/lib/settings/storage";
import { isCloudSettings } from "@/lib/settings/types";
import type { Problem } from "@/lib/problems/types";
import type { AIMessage } from "@/lib/ai/provider";

export function AIInterviewer({ problem }: { problem: Problem }) {
  const { messages, setMessages } = useInterviewSession();
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const code = useInterviewCode();
  const openSettings = useOpenSettings();
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages, pending, error]);

  async function send(retry = false) {
    if (controller.current || (!retry && !answer.trim())) return;
    const settings = readSettings();
    if ((isCloudSettings(settings) && !settings.apiKey) || !settings.model) { openSettings(); return; }
    const request = new AbortController();
    controller.current = request;
    const next: AIMessage[] = retry ? messages : [...messages, { role: "user", content: answer.trim() }];
    const codeSnapshot = problem.type === "dsa" && code.current ? { ...code.current } : undefined;
    setMessages(next);
    if (!retry) setAnswer("");
    setError("");
    setPending(true);
    try {
      const { generateInterviewResponse } = await import("@/lib/ai/provider");
      const content = await generateInterviewResponse(settings, { problem, messages: next, code: codeSnapshot }, request.signal);
      if (!request.signal.aborted) setMessages([...next, { role: "assistant", content }]);
    } catch {
      if (!request.signal.aborted) setError("Could not reach the interviewer. Check your AI settings and try again.");
    } finally {
      controller.current = null;
      if (!request.signal.aborted) setPending(false);
    }
  }

  return (
    <section aria-labelledby="interviewer-heading" className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <h2 id="interviewer-heading" className="text-xs font-medium">AI Interviewer</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {messages.length === 0 && <div className="flex flex-col gap-3">
          <p className="text-sm leading-6 text-muted-foreground">{problem.type === "dsa" ? "Walk me through your initial approach, or introduce yourself to begin the interview." : "Tell me which requirements you would clarify first, or introduce yourself to begin the interview."}</p>
          <Button variant="outline" size="sm" onClick={openSettings}>Configure AI provider</Button>
        </div>}
        <ol aria-label="Interview conversation" aria-live="polite" className="flex flex-col gap-7">
          {messages.map((message, index) => (
            <li key={index} className={message.role === "user" ? "border-l-2 pl-3" : undefined}>
              <p className="mb-2 text-xs font-medium">{message.role === "user" ? "You" : "AI Interviewer"}</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{message.content}</p>
            </li>
          ))}
        </ol>
        {pending && <p role="status" className="mt-4 text-xs text-muted-foreground">Interviewer is thinking…</p>}
        {error && <div className="mt-4 flex flex-col gap-3">
          <p role="alert" className="text-xs leading-5 text-muted-foreground">{error}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => send(true)}>Retry</Button>
            <Button size="sm" variant="ghost" onClick={openSettings}>AI settings</Button>
          </div>
        </div>}
        <div ref={end} />
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex shrink-0 flex-col gap-3 border-t p-4">
        <label htmlFor="interview-answer" className="sr-only">Your answer</label>
        <Textarea id="interview-answer" name="answer" placeholder="Type your answer…" value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault(); void send();
            }
          }} aria-describedby="answer-note" className="max-h-36 min-h-24 resize-none" />
        <div className="flex items-center justify-between gap-2">
          <p id="answer-note" className="text-xs leading-5 text-muted-foreground">Shift+Enter for a new line</p>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" disabled aria-label="Microphone unavailable" title="Voice input is not available"><Mic aria-hidden="true" /></Button>
            <Button type="submit" size="sm" disabled={pending || !answer.trim()}>Send</Button>
          </div>
        </div>
      </form>
    </section>
  );
}
