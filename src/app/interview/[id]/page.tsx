import { notFound } from "next/navigation";
import { InterviewRoom } from "@/components/interview-room";
import { getDummyInterview } from "@/lib/interview/engine";

export default async function InterviewPage({ params }: PageProps<"/interview/[id]">) {
  const { id } = await params;
  const interview = await getDummyInterview(id);
  if (!interview) notFound();
  return <InterviewRoom interview={interview} />;
}
