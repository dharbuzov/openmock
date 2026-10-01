export class InterviewTimer {
  private accumulated: number;
  private runningSince: number | null;
  constructor(
    startedAt: string,
    private readonly now = Date.now,
  ) {
    const current = now();
    this.accumulated = Math.max(0, current - Date.parse(startedAt));
    this.runningSince = current;
  }
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
