import type { InterviewMessage } from "@/lib/interview/types";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const sampleConversation: InterviewMessage[] = [
  { id: "requirements", role: "interviewer", content: "Let’s start with the requirements. What would you clarify before designing the system?" },
  { id: "answer", role: "candidate", content: "I’d first clarify the core operations and latency expectations. For a URL shortener, we need to create short URLs and redirect users with very low latency." },
  { id: "scale", role: "interviewer", content: "Good. What scale are you designing for, and what does that imply for your read/write ratio?" },
];

const dsaConversation: InterviewMessage[] = [
  { id: "approach", role: "interviewer", content: "Before coding, walk me through the simplest solution you can think of." },
  { id: "reasoning", role: "candidate", content: "I’d start with a straightforward approach, then look for repeated work we can avoid with a better data structure." },
  { id: "complexity", role: "interviewer", content: "Good. What information would you store to make each lookup efficient, and how does that affect space complexity?" },
];

export function AIInterviewer({ problemType }: { problemType: "dsa" | "system-design" }) {
  const messages = problemType === "dsa" ? dsaConversation : sampleConversation;
  return (
    <section aria-labelledby="interviewer-heading" className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <h2 id="interviewer-heading" className="text-xs font-medium">AI Interviewer</h2>
        <span className="text-xs text-muted-foreground">Sample conversation</span>
      </div>
      <ol aria-label="Interview conversation" className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto overscroll-contain p-4">
        {messages.map((message) => (
          <li key={message.id} className={message.role === "candidate" ? "border-l-2 pl-3" : undefined}>
            <p className="mb-2 text-xs font-medium">{message.role === "candidate" ? "You" : "AI Interviewer"}</p>
            <p className="text-sm leading-6 text-muted-foreground">{message.content}</p>
          </li>
        ))}
      </ol>
      <div className="flex shrink-0 flex-col gap-3 border-t p-4">
        <label htmlFor="interview-answer" className="sr-only">Your answer</label>
        <Textarea id="interview-answer" name="answer" placeholder="Type your answer…" aria-describedby="answer-note" className="max-h-36 min-h-24 resize-none" />
        <div className="flex items-center justify-between gap-3">
          <p id="answer-note" className="text-xs leading-5 text-muted-foreground">Draft only. Answers are not sent or saved.</p>
          <Button variant="ghost" size="icon-sm" disabled aria-label="Microphone unavailable" title="Voice input is not connected"><Mic aria-hidden="true" /></Button>
        </div>
      </div>
    </section>
  );
}
