import { notFound, redirect } from "next/navigation";
import { ConfiguredInterviewRoom } from "@/components/configured-interview-room";
import { getProblem } from "@/lib/problems/loader";
import { requireInterviewDefinition } from "@/lib/interview/definitions";

export default async function InterviewPage({
  params,
  searchParams,
}: PageProps<"/interview/[id]">) {
  const { id } = await params;
  const problem = await getProblem(id);
  if (!problem) notFound();
  const { session } = await searchParams;
  if (typeof session !== "string" || !session)
    redirect(`/practice/${id}/setup`);
  const definition = await requireInterviewDefinition(problem.interview);
  return (
    <ConfiguredInterviewRoom
      key={session}
      problem={problem}
      definition={definition}
      sessionId={session}
    />
  );
}
