import type { InterviewMessage } from "@/lib/interview/types";

export function AIInterviewer({ messages }: { messages: InterviewMessage[] }) {
  return (
    <section aria-labelledby="interviewer-heading" className="flex min-w-0 flex-col gap-6 p-5">
      <h2 id="interviewer-heading" className="text-sm font-medium">AI Interviewer</h2>
      <p className="text-xs text-muted-foreground">Static demo transcript</p>
      <ol className="flex flex-col gap-4">
        {messages.map((message) => (
          <li key={message.id} className="flex flex-col gap-2 text-sm leading-6">
            <p className="font-medium capitalize">{message.role}</p>
            <p>{message.content}</p>
          </li>
        ))}
      </ol>
      <p className="text-xs leading-5 text-muted-foreground">AI responses and voice are not connected.</p>
    </section>
  );
}
