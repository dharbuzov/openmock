"use client";

import { readSettings } from "../settings/storage";
import { readInterviewSession } from "./session-storage";
import { retryEvaluation } from "./runner";
import {
  parseResultsRecord,
  readResultsRecordValue,
  saveResultsRecord,
  type ResultsRecord,
} from "./evaluation-storage";

// Share in-flight work across Strict Mode mounts and result-page revisits.
const pending = new Map<string, Promise<ResultsRecord>>();

export function evaluateCompletedSession(id: string): Promise<ResultsRecord> {
  const current = pending.get(id);
  if (current) return current;
  const task = Promise.resolve()
    .then(async () => {
      const record = parseResultsRecord(readResultsRecordValue(id));
      if (record?.evaluation.status === "completed") return record;
      const session = readInterviewSession(id);
      if (
        !session ||
        session.interview.status !== "completed" ||
        !session.evaluationContext
      )
        throw new Error("Completed interview data is unavailable.");
      const { problem, definition } = session.evaluationContext;
      const finished = await retryEvaluation(
        readSettings(),
        session.interview,
        problem,
        definition,
        session.evaluationWorkspace,
      );
      saveResultsRecord(finished, problem, definition);
      const saved = parseResultsRecord(readResultsRecordValue(id));
      if (!saved) throw new Error("Could not save evaluation.");
      return saved;
    })
    .finally(() => pending.delete(id));
  pending.set(id, task);
  return task;
}
