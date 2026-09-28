import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { completeInterview } from "@/lib/interview/engine";
import { InterviewResults } from "@/components/interview-results";

export default async function ResultsPage({ params }: PageProps<"/results/[id]">) {
  const { id } = await params;
  const interview = await completeInterview(id);
  if (!interview) notFound();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Interview results</h1>
      <p className="text-sm text-muted-foreground">Evidence-based feedback for {interview.problem.title}, generated with your selected AI provider.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-4 border-y py-6 text-sm">
        <dt className="text-muted-foreground">Interview</dt><dd className="break-all font-mono">{interview.id}</dd>
        <dt className="text-muted-foreground">Status</dt><dd>{interview.status}</dd>
        <dt className="text-muted-foreground">Stage</dt><dd>{interview.currentStage}</dd>
        <dt className="text-muted-foreground">Elapsed time</dt><dd className="font-mono">{interview.elapsedSeconds}s (demo)</dd>
      </dl>
      <InterviewResults interviewId={interview.id} />
      <div className="flex flex-wrap gap-3">
        <Link href="/practice" className={buttonVariants()}>Choose another problem</Link>
        <Link href={`/interview/${interview.id}`} className={buttonVariants({ variant: "outline" })}>Reopen demo</Link>
      </div>
    </main>
  );
}
