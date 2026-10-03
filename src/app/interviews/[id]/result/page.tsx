import { InterviewResultPage } from "@/components/interview-result-page";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InterviewResultPage key={id} interviewId={id} />;
}
