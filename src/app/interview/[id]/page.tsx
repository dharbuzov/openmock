import { notFound } from "next/navigation";
import { InterviewRoom } from "@/components/interview-room";
import { createInterview, getDummyInterview } from "@/lib/interview/engine";

export default async function InterviewPage({ params }: PageProps<"/interview/[id]">) {
  const { id } = await params;
  // Problems also have a direct, shareable problem-slug URL.
  const interview = id.startsWith("demo-")
    ? await getDummyInterview(id)
    : await createInterview(id);
  if (!interview) notFound();
  return <InterviewRoom interview={interview} />;
}
