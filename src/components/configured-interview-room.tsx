"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { InterviewRoom } from "./interview-room";
import {
  readInterviewSession,
  type InterviewRoomSession,
} from "@/lib/interview/session-storage";
import type { InterviewDefinition } from "@/lib/interview/types";
import type { Problem } from "@/lib/problems/types";

function SessionRoom({
  problem,
  definition,
  sessionId,
}: {
  problem: Problem;
  definition: InterviewDefinition;
  sessionId: string;
}) {
  const router = useRouter();
  const [session] = useState<InterviewRoomSession | null>(() =>
    readInterviewSession(sessionId),
  );
  const valid = Boolean(
    session &&
    session.interview.problemId === problem.id &&
    session.interview.definition.id === definition.id &&
    session.interview.definition.revision === definition.revision &&
    session.interview.definition.version === definition.version,
  );
  useEffect(() => {
    if (!valid) router.replace(`/practice/${problem.id}/setup`);
  }, [valid, problem.id, router]);
  if (!session || !valid)
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Opening interview…
      </p>
    );
  return (
    <InterviewRoom
      interview={session.interview}
      problem={problem}
      definition={definition}
      initialMode={session.interactionMode}
    />
  );
}

const subscribe = () => () => {};
export function ConfiguredInterviewRoom(props: {
  problem: Problem;
  definition: InterviewDefinition;
  sessionId: string;
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!hydrated)
    return (
      <p role="status" className="p-6 text-sm text-muted-foreground">
        Opening interview…
      </p>
    );
  return <SessionRoom key={props.sessionId} {...props} />;
}
