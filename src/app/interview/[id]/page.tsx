import { notFound } from "next/navigation";
import { InterviewRoom } from "@/components/interview-room";
import { startInterview } from "@/lib/interview/engine";
import { getProblem } from "@/lib/problems/loader";

export default async function InterviewPage({ params }: PageProps<"/interview/[id]">) {
  const { id } = await params;
  const problem = await getProblem(id);
  if (!problem) notFound();
  return <InterviewRoom interview={startInterview(problem)} />;
}
