import { PracticeProblems } from "@/components/practice-problems";
import { getProblems } from "@/lib/problems/loader";
import { getInterviewDefinitions } from "@/lib/interview/definitions";

export default async function PracticePage() {
  const [problems, definitions] = await Promise.all([
    getProblems(),
    getInterviewDefinitions(),
  ]);
  const categories = definitions
    .filter(({ id }) => problems.some((problem) => problem.interview === id))
    .map(({ id, name }) => ({ id, name }));
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Practice</h1>
        <p className="text-sm text-muted-foreground">
          Choose a problem to practice.
        </p>
      </div>
      <PracticeProblems problems={problems} categories={categories} />
    </main>
  );
}
