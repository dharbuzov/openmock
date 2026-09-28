import type { Problem } from "@/lib/problems/types";

export function ProblemPanel({ problem }: { problem: Problem }) {
  return (
    <section aria-labelledby="problem-heading" className="min-w-0 border-b p-5 lg:border-r lg:border-b-0">
      <h2 id="problem-heading" className="text-sm font-medium">Problem</h2>
      <p className="mt-2 font-mono text-xs text-muted-foreground">{problem.type} / {problem.level}</p>
      <pre className="mt-6 whitespace-pre-wrap break-words font-sans text-sm leading-6">{problem.content}</pre>
    </section>
  );
}
