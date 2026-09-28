import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-start justify-center gap-6 px-6 py-24">
      <p className="font-mono text-xs text-muted-foreground">FREE & OPEN SOURCE</p>
      <h1 className="max-w-2xl text-5xl font-semibold tracking-tight">Practice your next technical interview.</h1>
      <p className="max-w-xl text-sm leading-7 text-muted-foreground">
        OpenMock is an AI mock interview platform for software engineers.
        Choose a community problem in algorithms or system design and explore the interview workspace.
      </p>
      <Link href="/practice" className={buttonVariants()}>Choose a problem</Link>
      <p className="text-xs text-muted-foreground">Early skeleton · Demo interviews only. AI and voice are not connected.</p>
    </main>
  );
}
