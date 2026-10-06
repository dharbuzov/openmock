export type TurnContext = {
  interviewId: string;
  turnId: string;
  startedAt: number;
};

export function createTurnContext(interviewId: string): TurnContext {
  return {
    interviewId,
    turnId: crypto.randomUUID(),
    startedAt: performance.now(),
  };
}
