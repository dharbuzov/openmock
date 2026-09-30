import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { InterviewResults } from "@/components/interview-results";

export default async function ResultsPage({ params }: PageProps<"/results/[id]">) {
  const { id } = await params;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Interview results</h1>
      <p className="text-sm text-muted-foreground">Evidence-based feedback generated with your selected AI provider.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-4 border-y py-6 text-sm">
        <dt className="text-muted-foreground">Interview</dt><dd className="break-all font-mono">{id}</dd>
        <dt className="text-muted-foreground">Status</dt><dd>completed</dd>
      </dl>
      <InterviewResults interviewId={id} />
      <div className="flex flex-wrap gap-3">
        <Link href="/practice" className={buttonVariants()}>Choose another problem</Link>
      </div>
    </main>
  );
}
