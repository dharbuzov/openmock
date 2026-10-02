import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { InterviewResults } from "@/components/interview-results";

export default async function ResultsPage({
  params,
}: PageProps<"/results/[id]">) {
  const { id } = await params;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        Interview results
      </h1>
      <InterviewResults interviewId={id} />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/practice"
          className={buttonVariants({ variant: "outline" })}
        >
          Choose another problem
        </Link>
      </div>
    </main>
  );
}
