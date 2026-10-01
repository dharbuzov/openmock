import type { Interview } from "./types";

export type SessionState = {
  interview: Interview;
  operation: "send" | "finish" | null;
};
export type SessionRequest = {
  controller: AbortController;
  interview: Interview;
};

// One owner for the current interview and all asynchronous session mutations.
export class SessionOperations {
  private request: SessionRequest | null = null;
  private state: SessionState;

  constructor(
    interview: Interview,
    private readonly onChange: (state: SessionState) => void,
  ) {
    this.state = { interview, operation: null };
  }

  begin = (operation: "send" | "finish"): SessionRequest | null => {
    if (this.request || this.state.interview.status !== "in-progress")
      return null;
    this.request = {
      controller: new AbortController(),
      interview: this.state.interview,
    };
    this.state = { ...this.state, operation };
    this.onChange(this.state);
    return this.request;
  };

  isCurrent = (request: SessionRequest): boolean =>
    this.request === request && !request.controller.signal.aborted;

  commit = (request: SessionRequest, interview: Interview): boolean => {
    if (!this.isCurrent(request)) return false;
    this.state = { ...this.state, interview };
    this.onChange(this.state);
    return true;
  };

  end = (request: SessionRequest): void => {
    if (this.request !== request) return;
    this.request = null;
    this.state = { ...this.state, operation: null };
    this.onChange(this.state);
  };

  cancel = (): void => {
    const request = this.request;
    request?.controller.abort();
    if (request) this.end(request);
  };
}
