export type TimerSnapshot = { elapsedMs: number; runningSince: number | null };

export class InterviewTimer {
  private accumulated = 0;
  private runningSince: number | null = null;
  constructor(
    private readonly now = Date.now,
    snapshot?: TimerSnapshot,
  ) {
    this.accumulated = snapshot?.elapsedMs ?? 0;
    this.runningSince = snapshot?.runningSince ?? null;
  }
  snapshot = (): TimerSnapshot => ({
    elapsedMs: this.accumulated,
    runningSince: this.runningSince,
  });
  isPaused = (): boolean => this.runningSince === null;
  elapsed = (): number =>
    this.accumulated +
    (this.runningSince === null
      ? 0
      : Math.max(0, this.now() - this.runningSince));
  pause(): void {
    this.accumulated = this.elapsed();
    this.runningSince = null;
  }
  resume(): void {
    if (this.runningSince === null) this.runningSince = this.now();
  }
}

export function formatElapsed(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function formatRemaining(milliseconds: number): string {
  return `${milliseconds < 0 ? "+" : ""}${formatElapsed(Math.abs(milliseconds))}`;
}
