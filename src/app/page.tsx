import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const principles = [
  ["System Design", "Practice architecture, scalability, failure scenarios, and trade-offs."],
  ["DSA", "Solve coding problems while explaining your reasoning."],
  ["BYOK", "Use your own AI provider key. No OpenMock AI subscription required."],
  ["Open Source", "Run it locally, inspect it, modify it, and contribute interview problems."],
];

function InterviewPreview() {
  return (
    <figure aria-labelledby="preview-caption" className="overflow-hidden rounded-sm border bg-background">
      <figcaption id="preview-caption" className="sr-only">
        Interview room preview: a URL shortener problem, an architecture workspace, and a sample interview conversation.
      </figcaption>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground" aria-hidden="true">01 /</span>
          <h2 className="text-sm font-medium">Design a URL Shortener</h2>
        </div>
        <div className="flex items-center gap-5 text-xs">
          <span className="font-mono tabular-nums">24:31</span>
          <span className="border-l pl-5 text-muted-foreground">End</span>
        </div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)_minmax(0,1.15fr)]">
        <section aria-labelledby="preview-problem" className="min-w-0 border-b lg:border-r lg:border-b-0">
          <h3 id="preview-problem" className="border-b px-5 py-3 text-xs font-medium">Problem</h3>
          <div className="flex flex-col gap-6 p-5 text-xs leading-6">
            <p className="text-muted-foreground">Design a service that turns long URLs into short, shareable links.</p>
            <div>
              <h4 className="mb-2 font-medium">Requirements</h4>
              <ul className="flex list-inside list-disc flex-col gap-1 text-muted-foreground">
                <li>Create and resolve short URLs</li>
                <li>Support custom aliases</li>
                <li>Set optional expiration</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-medium">Scale</h4>
              <p className="text-muted-foreground"><span className="font-mono text-foreground">100M</span> new URLs / month<br /><span className="font-mono text-foreground">10B</span> redirects / month</p>
            </div>
            <div>
              <h4 className="mb-2 font-medium">Constraints</h4>
              <p className="text-muted-foreground">Low latency. High availability.<br />Unique, durable short links.</p>
            </div>
          </div>
        </section>
        <section aria-labelledby="preview-workspace" className="flex min-w-0 flex-col border-b lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between border-b px-5 py-3 text-xs">
            <h3 id="preview-workspace" className="font-medium">Workspace</h3>
            <span className="font-mono text-muted-foreground">architecture.md</span>
          </div>
          <div className="flex flex-1 flex-col gap-8 bg-muted/20 px-5 py-7 sm:px-8">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-muted-foreground">01 — High-level design</p>
              <span className="font-mono text-xs text-muted-foreground">100%</span>
            </div>
            <div className="flex flex-col items-center py-2" aria-label="Architecture: client to API service, then cache backed by a URL store">
              <div className="grid w-full grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 text-center font-mono text-xs">
                <div className="border bg-background px-2 py-4">Client</div>
                <span aria-hidden="true" className="text-muted-foreground">→</span>
                <div className="border bg-background px-2 py-4">API<br />service</div>
                <span aria-hidden="true" className="text-muted-foreground">→</span>
                <div className="border bg-background px-2 py-4">Redis<br />cache</div>
                <span className="col-start-5 text-muted-foreground" aria-hidden="true">↓</span>
                <div className="col-start-5 border bg-background px-2 py-4">URL<br />store</div>
              </div>
            </div>
            <div className="flex flex-col gap-3 font-mono text-xs leading-6">
              <p className="text-muted-foreground">02 — Request flow</p>
              <p>GET /:shortCode<br /><span className="text-muted-foreground">↳ Cache lookup → 302 redirect<br />↳ Cache miss → read store → populate cache</span></p>
            </div>
            <p className="mt-auto border-l-2 pl-3 text-xs leading-5 text-muted-foreground">Read-heavy workload. Start with a cache-aside strategy and discuss invalidation.</p>
          </div>
        </section>
        <section aria-labelledby="preview-interviewer" className="min-w-0">
          <h3 id="preview-interviewer" className="border-b px-5 py-3 text-xs font-medium">AI Interviewer</h3>
          <ol className="flex flex-col gap-6 p-5 text-xs leading-6">
            <li>
              <p className="mb-2 flex items-center justify-between font-medium">Interviewer <span className="font-mono font-normal text-muted-foreground">22:08</span></p>
              <p className="text-muted-foreground">Your design uses a cache for redirects. What happens when a popular link expires?</p>
            </li>
            <li className="border-l-2 pl-3">
              <p className="mb-2 flex items-center justify-between font-medium">You <span className="font-mono font-normal text-muted-foreground">23:12</span></p>
              <p className="text-muted-foreground">I’d store the expiration with the cached value and check it before redirecting. The cache TTL should never outlive the link.</p>
            </li>
            <li>
              <p className="mb-2 flex items-center justify-between font-medium">Interviewer <span className="font-mono font-normal text-muted-foreground">24:31</span></p>
              <p>And if thousands of requests hit the same link just as the cache entry expires?</p>
            </li>
          </ol>
        </section>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-2 font-mono text-[10px] text-muted-foreground">
        <span>System Design / Scalability & caching</span>
        <span>Stage 03 — Explore trade-offs</span>
      </div>
    </figure>
  );
}

export default function Home() {
  return (
    <main id="landing-content" className="mx-auto w-full max-w-7xl px-5 sm:px-8">
      <a href="#landing-content" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:bg-background focus:p-3 focus:outline-2">Skip to content</a>
      <section aria-labelledby="hero-heading" className="grid gap-8 pb-12 pt-16 sm:pb-16 sm:pt-24 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-16">
        <div>
          <p className="mb-6 font-mono text-xs tracking-widest text-muted-foreground">FREE & OPEN SOURCE</p>
          <h1 id="hero-heading" className="text-4xl leading-[1.08] font-semibold tracking-[-0.045em] sm:text-5xl xl:text-6xl">
            Practice the interview.<br /><span className="text-muted-foreground">Not the answers.</span>
          </h1>
        </div>
        <div className="flex max-w-lg flex-col items-start gap-6">
          <p className="text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
            Free and open-source AI mock interviews for software engineers.
            Practice System Design and DSA with an AI interviewer that challenges
            your decisions and adapts to your answers.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/practice" className={buttonVariants({ size: "lg" })}>
              Start practicing <ArrowRight aria-hidden="true" data-icon="inline-end" />
            </Link>
            <a href="https://github.com/dharbuzov/openmock" className={buttonVariants({ variant: "outline", size: "lg" })}>
              View on GitHub <ArrowUpRight aria-hidden="true" data-icon="inline-end" />
            </a>
          </div>
        </div>
      </section>
      <InterviewPreview />
      <section aria-label="The OpenMock approach" className="mb-16 mt-12 grid border-y sm:grid-cols-2 lg:mb-24 lg:mt-16 lg:grid-cols-4">
        {principles.map(([title, description]) => (
          <div key={title} className="flex flex-col gap-3 border-b px-0 py-7 last:border-b-0 sm:px-6 sm:odd:border-r sm:nth-last-2:border-b-0 lg:border-r lg:border-b-0 lg:first:pl-0 lg:last:border-r-0">
            <h2 className="text-sm font-medium">{title}</h2>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
