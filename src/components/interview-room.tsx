import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ProblemPanel } from "@/components/problem-panel";
import { Whiteboard } from "@/components/whiteboard";
import { AIInterviewer } from "@/components/ai-interviewer";
import type { Interview } from "@/lib/interview/types";

export function InterviewRoom({ interview }: { interview: Interview }) {
  const minutes = String(Math.floor(interview.elapsedSeconds / 60)).padStart(2, "0");
  const seconds = String(interview.elapsedSeconds % 60).padStart(2, "0");
  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium tracking-tight">{interview.problem.title}</h1>
          <p className="font-mono text-xs text-muted-foreground">{interview.id} · {interview.status} · {interview.currentStage} · {minutes}:{seconds} (demo)</p>
        </div>
        <Link href={`/results/${interview.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Finish demo interview</Link>
      </div>
      <div className="grid flex-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,5fr)_minmax(0,3fr)]">
        <ProblemPanel problem={interview.problem} />
        <Whiteboard />
        <AIInterviewer messages={interview.messages} />
      </div>
    </main>
  );
}
