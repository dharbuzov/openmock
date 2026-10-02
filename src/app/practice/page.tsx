import { PracticeProblems } from "@/components/practice-problems";
import { getProblems } from "@/lib/problems/loader";
import { getInterviewDefinitions } from "@/lib/interview/definitions";

export default async function PracticePage() {
  const [problems, definitions] = await Promise.all([
    getProblems(),
    getInterviewDefinitions(),
  ]);
  const interviewTypes = definitions.map(
    ({ id, name, description, icon, order }) => ({
      id,
      name,
      description,
      icon,
      order,
    }),
  );
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Practice</h1>
        <p className="text-sm text-muted-foreground">
          Choose a problem to practice.
        </p>
      </div>
      <PracticeProblems problems={problems} interviewTypes={interviewTypes} />
    </main>
  );
}
