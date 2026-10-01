import type { InteractionMode } from "./interaction-mode-control";
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
import { InterviewControlsProvider } from "@/components/interview-controls-context";
import { InterviewControls } from "@/components/interview-controls";

export function InterviewRoom({
  interview,
  problem,
  definition,
  initialMode = "chat",
}: {
  interview: Interview;
  problem: Problem;
  definition: InterviewDefinition;
  initialMode?: InteractionMode;
}) {
  return (
    <InterviewCodeProvider key={interview.id}>
      <InterviewSessionProvider
        initialInterview={interview}
        problem={problem}
        definition={definition}
      >
        <InterviewControlsProvider initialMode={initialMode}>
          <InterviewDiagramProvider>
            <main
              data-interview-room
              className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background"
            >
              <header className="grid h-[50px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 border-b px-1 sm:gap-3 sm:px-4">
                <div className="flex min-w-0 items-center gap-4 overflow-hidden">
                  <Link
                    href="/"
                    className="hidden shrink-0 text-sm font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 sm:block"
                  >
                    OpenMock
                  </Link>
                  <h1
                    className="hidden truncate border-l pl-4 text-sm font-medium lg:block"
                    title={problem.title}
                  >
                    {problem.title}
                  </h1>
                </div>
                <InterviewControls />
                <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-3">
                  <SettingsButton />
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
        </InterviewControlsProvider>
      </InterviewSessionProvider>
    </InterviewCodeProvider>
  );
}
