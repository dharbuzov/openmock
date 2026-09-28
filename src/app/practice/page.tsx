import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getProblems } from "@/lib/problems/loader";

export default async function PracticePage() {
  const problems = await getProblems();
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Practice</h1>
        <p className="text-sm text-muted-foreground">Choose a problem to start an interview.</p>
      </div>
      <ul className="divide-y border-y">
        {problems.map((problem) => (
          <li key={problem.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">{problem.title}</h2>
              <p className="font-mono text-xs text-muted-foreground">{problem.type} / {problem.level}</p>
              <p className="text-xs text-muted-foreground">{problem.tags.join(" · ")}</p>
            </div>
            <Link href={`/interview/${problem.id}`} aria-label={`Start ${problem.title}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Start interview</Link>
          </li>
        ))}
      </ul>
      {problems.length === 0 ? <p className="text-sm text-muted-foreground">No practice problems are available yet.</p> : null}
    </main>
  );
}
