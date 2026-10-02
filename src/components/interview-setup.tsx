"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useOpenSettings } from "./settings-provider";
import {
  InteractionModeControl,
  type InteractionMode,
} from "./interaction-mode-control";
import { ProblemMetadataBadges } from "./problem-metadata-badges";
import { problemDescription } from "./problem-panel";
import { readSettings, subscribeSettings } from "@/lib/settings/storage";
import {
  aiSettingsIssue,
  aiProviders,
  type AIProviderId,
} from "@/lib/settings/types";
import { startInterview } from "@/lib/interview/engine";
import { saveInterviewSession } from "@/lib/interview/session-storage";
import { recognitionConstructor } from "@/lib/voice/browser";
import type {
  InterviewDefinition,
  InterviewLevelId,
  InterviewMode,
} from "@/lib/interview/types";
import type { Problem } from "@/lib/problems/types";

const subscribeCapabilities = () => () => {};
const noCapability = () => false;
function aiSummarySnapshot(): string {
  const settings = readSettings();
  return JSON.stringify([
    settings.provider,
    settings.model,
    aiSettingsIssue(settings),
  ]);
}

function SetupForm({
  problem,
  definition,
}: {
  problem: Problem;
  definition: InterviewDefinition;
}) {
  const router = useRouter();
  const levels = definition.levels;
  const [level, setLevel] = useState<InterviewLevelId>(definition.defaultLevel);
  const [interviewMode, setInterviewMode] = useState<InterviewMode>(
    definition.defaultMode,
  );
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>("chat");
  const openSettings = useOpenSettings();
  const snapshot = useSyncExternalStore(
    subscribeSettings,
    aiSummarySnapshot,
    () => "",
  );
  const [provider, model, issue] = JSON.parse(snapshot) as [
    AIProviderId,
    string,
    string,
  ];
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const speechAvailable = useSyncExternalStore(
    subscribeCapabilities,
    () => Boolean(recognitionConstructor()),
    noCapability,
  );
  const summary =
    problemDescription(problem.content)
      .split(/\n\s*\n/)
      .find((paragraph) => paragraph.trim() && !paragraph.startsWith("#")) ??
    "";
  function start() {
    if (startingRef.current) return;
    const currentSettings = readSettings();
    const validation = aiSettingsIssue(currentSettings);
    if (validation) {
      setError(validation);
      return;
    }
    startingRef.current = true;
    setStarting(true);
    try {
      const interview = startInterview(problem, {
        definition,
        targetLevel: level,
        mode: interviewMode,
      });
      saveInterviewSession({ interview, interactionMode });
      router.push(`/interview/${problem.id}?session=${interview.id}`);
    } catch {
      startingRef.current = false;
      setStarting(false);
      setError(
        "Could not start the interview. Check browser storage permissions and try again.",
      );
    }
  }
  return (
    <main className="mx-auto grid w-full max-w-6xl grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-7 px-6 py-12">
      <div className="self-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Back to Practice"
                  onClick={() => router.push("/practice")}
                />
              }
            >
              <ArrowLeft />
            </TooltipTrigger>
            <TooltipContent>Back to Practice</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Interview Setup</h1>
      <div className="col-span-2 grid min-w-0 items-start gap-8 md:col-span-1 md:col-start-2 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-10">
        <section
          aria-label="Problem context"
          className="flex min-w-0 flex-col gap-3"
        >
          <h2 className="text-lg font-medium tracking-tight">
            {problem.title}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">{summary}</p>
          <ProblemMetadataBadges
            problem={problem}
            topicLimit={3}
            showLevel={false}
          />
          {problem.companies.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs text-muted-foreground">
                {problem.companies.every(
                  ({ relation }) => relation === "reported",
                )
                  ? "Asked at"
                  : "Common at"}
              </span>
              {problem.companies.map((company) => (
                <Badge key={company.id} variant="outline">
                  {company.id
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                </Badge>
              ))}
            </div>
          )}
        </section>
        <section
          aria-label="Interview configuration"
          className="flex min-w-0 flex-col gap-6 border-t pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-10"
        >
          <Field>
            <FieldLabel id="target-level-label">Target level</FieldLabel>
            <FieldDescription>
              Choose the level you want to be evaluated against.
            </FieldDescription>
            <ToggleGroup
              aria-labelledby="target-level-label"
              value={[level]}
              onValueChange={(values) => {
                const next = levels.find(({ id }) => id === values[0]);
                if (next) setLevel(next.id);
              }}
              variant="outline"
              size="sm"
              spacing={0}
              className="flex-wrap"
            >
              {(levels.length ? levels : definition.levels).map(
                ({ id, name }) => (
                  <ToggleGroupItem key={id} value={id}>
                    {id === "middle" ? "Mid" : name}
                  </ToggleGroupItem>
                ),
              )}
            </ToggleGroup>
          </Field>

          <Field>
            <FieldLabel id="interview-mode-label">Interview mode</FieldLabel>
            <ToggleGroup
              aria-labelledby="interview-mode-label"
              value={[interviewMode]}
              onValueChange={(values) => {
                const next = definition.modes.find(
                  (value) => value === values[0],
                );
                if (next) setInterviewMode(next);
              }}
              variant="outline"
              size="sm"
              spacing={0}
              className="flex-wrap"
            >
              {definition.modes.map((value) => (
                <ToggleGroupItem key={value} value={value}>
                  {value === "practice" ? "Practice" : "Mock"}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>
              {interviewMode === "practice"
                ? "Practice with guidance and hints."
                : "Simulate a real interview with limited guidance."}
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Interaction</FieldLabel>
            <InteractionModeControl
              mode={interactionMode}
              setMode={setInteractionMode}
              speechAvailable={speechAvailable}
            />
            <FieldDescription>
              {interactionMode === "chat"
                ? "Turn-based conversation using text or microphone."
                : "Continuous voice interaction with the AI interviewer."}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>AI Interviewer</FieldLabel>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                role="status"
                className="min-w-0 break-words text-sm text-muted-foreground"
              >
                {issue ? (
                  "AI provider required"
                ) : (
                  <>
                    {aiProviders.find(({ value }) => value === provider)?.label}{" "}
                    · {model}{" "}
                    <span className="ml-2 whitespace-nowrap text-xs">
                      ✓ Ready
                    </span>
                  </>
                )}
              </p>
              <Button variant="outline" size="sm" onClick={openSettings}>
                {issue ? "Configure AI" : "Change"}
              </Button>
            </div>
            {issue && <FieldDescription>{issue}</FieldDescription>}
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5">
            <p className="text-xs text-muted-foreground">
              {definition.duration.defaultMinutes} min ·{" "}
              {definition.stages.length} stages · {definition.name}
            </p>
            <Button
              size="sm"
              disabled={Boolean(issue) || starting}
              onClick={start}
            >
              {starting ? "Opening interview…" : "Start interview"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

export function InterviewSetup(props: {
  problem: Problem;
  definition: InterviewDefinition;
}) {
  const hydrated = useSyncExternalStore(
    subscribeCapabilities,
    () => true,
    noCapability,
  );
  if (!hydrated)
    return (
      <p
        role="status"
        className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground"
      >
        Loading interview setup…
      </p>
    );
  return <SetupForm {...props} />;
}
