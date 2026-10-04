import { InterviewTimer } from "./timer";
import type { Interview } from "./types";

export type SessionState = {
  interview: Interview;
  operation: "opening" | "send" | "finish" | "evaluate" | null;
};
export type SessionRequest = {
  controller: AbortController;
  interview: Interview;
};

// One owner for the current interview and all asynchronous session mutations.
export class SessionOperations {
  private request: SessionRequest | null = null;
  private state: SessionState;
  private timer: InterviewTimer;

  constructor(
    interview: Interview,
    private readonly onChange: (state: SessionState) => void,
    now = Date.now,
  ) {
    this.state = { interview, operation: null };
    this.timer = new InterviewTimer(
      now,
      interview.timer ?? {
        elapsedMs: interview.elapsedMs ?? 0,
        runningSince:
          interview.status === "in-progress" &&
          interview.elapsedMs === undefined
            ? Date.parse(interview.startedAt)
            : null,
      },
    );
  }

  elapsed = (): number => this.timer.elapsed();
  isPaused = (): boolean => this.timer.isPaused();
  private snapshotInterview = (): Interview => ({
    ...this.state.interview,
    elapsedMs: this.timer.elapsed(),
    timer: this.timer.snapshot(),
  });
  checkpoint = (): void => {
    this.state = { ...this.state, interview: this.snapshotInterview() };
    this.onChange(this.state);
  };
  toggleTimer = (): void => {
    if (this.state.interview.status !== "in-progress") return;
    if (this.timer.isPaused()) this.timer.resume();
    else this.timer.pause();
    this.checkpoint();
  };

  begin = (
    operation: "opening" | "send" | "finish" | "evaluate",
  ): SessionRequest | null => {
    if (this.request) return null;
    const requiredStatus =
      operation === "evaluate" ? "completed" : "in-progress";
    if (this.state.interview.status !== requiredStatus) return null;
    if (
      (operation === "send" || operation === "opening") &&
      this.state.interview.stage.current === null
    )
      return null;
    this.request = {
      controller: new AbortController(),
      interview: this.snapshotInterview(),
    };
    this.state = {
      ...this.state,
      interview: this.request.interview,
      operation,
    };
    this.onChange(this.state);
    return this.request;
  };

  isCurrent = (request: SessionRequest): boolean =>
    this.request === request && !request.controller.signal.aborted;

  commit = (request: SessionRequest, interview: Interview): boolean => {
    if (!this.isCurrent(request)) return false;
    if (interview.status === "completed") this.timer.pause();
    this.state = { ...this.state, interview };
    this.checkpoint();
    return true;
  };

  end = (request: SessionRequest): void => {
    if (this.request !== request) return;
    this.request = null;
    this.state = { ...this.state, operation: null };
    this.checkpoint();
  };

  cancel = (): void => {
    const request = this.request;
    request?.controller.abort();
    if (request) this.end(request);
  };
}
