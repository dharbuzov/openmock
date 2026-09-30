import { notFound } from "next/navigation";
import { InterviewRoom } from "@/components/interview-room";
import { startInterview } from "@/lib/interview/engine";
import { getProblem } from "@/lib/problems/loader";
import { requireInterviewDefinition } from "@/lib/interview/definitions";

export default async function InterviewPage({ params }: PageProps<"/interview/[id]">) {
  const { id } = await params;
  const problem = await getProblem(id);
  if (!problem) notFound();
  const definition = await requireInterviewDefinition(problem.interview);
  return <InterviewRoom
    interview={startInterview(problem, { definition, targetLevel: "senior", mode: "practice" })}
    problem={problem}
    definition={definition}
  />;
}
