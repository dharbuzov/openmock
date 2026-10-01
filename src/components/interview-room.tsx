import Link from "next/link";
import { ProblemPanel } from "@/components/problem-panel";
import { Workspace } from "@/components/workspace/workspace";
import { AIInterviewer } from "@/components/ai-interviewer";
import { InterviewPanes } from "@/components/interview-panes";
import type { Interview, InterviewDefinition } from "@/lib/interview/types";
import type { Problem } from "@/lib/problems/types";
import { SettingsButton } from "@/components/settings-provider";
import { InterviewCodeProvider } from "@/components/interview-code-context";
import { InterviewSessionProvider } from "@/components/interview-session-context";
import { FinishInterviewButton } from "@/components/finish-interview-button";
import { InterviewDiagramProvider } from "@/components/interview-diagram-context";

export function InterviewRoom({
  interview,
  problem,
  definition,
}: {
  interview: Interview;
  problem: Problem;
  definition: InterviewDefinition;
}) {
  return (
    <InterviewCodeProvider key={interview.id}>
      <InterviewSessionProvider
        initialInterview={interview}
        problem={problem}
        definition={definition}
      >
        <InterviewDiagramProvider>
          <main
            data-interview-room
            className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background"
          >
            <header className="flex h-[50px] shrink-0 items-center justify-between gap-4 border-b px-4">
              <div className="flex min-w-0 items-center gap-4">
                <Link
                  href="/"
                  className="shrink-0 text-sm font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  OpenMock
                </Link>
                <h1
                  className="truncate border-l pl-4 text-sm font-medium"
                  title={problem.title}
                >
                  {problem.title}
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <SettingsButton />
                <span
                  aria-label="Elapsed time: 24 minutes, 31 seconds, sample value"
                  className="hidden font-mono text-xs tabular-nums sm:inline"
                >
                  24:31
                </span>
                <FinishInterviewButton />
              </div>
            </header>
            <InterviewPanes
              problem={<ProblemPanel problem={problem} />}
              workspace={
                <Workspace
                  key={interview.id}
                  problem={problem}
                  type={definition.workspace}
                />
              }
              interviewer={<AIInterviewer />}
            />
          </main>
        </InterviewDiagramProvider>
      </InterviewSessionProvider>
    </InterviewCodeProvider>
  );
}
