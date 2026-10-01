import { notFound } from "next/navigation";
import { InterviewSetup } from "@/components/interview-setup";
import { getProblem } from "@/lib/problems/loader";
import { requireInterviewDefinition } from "@/lib/interview/definitions";

export default async function InterviewSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = await getProblem(id);
  if (!problem) notFound();
  const definition = await requireInterviewDefinition(problem.interview);
  return (
    <InterviewSetup
      key={problem.id}
      problem={problem}
      definition={definition}
    />
  );
}
