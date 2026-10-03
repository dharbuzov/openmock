import type { Problem } from "@/lib/problems/types";
import type { ReactNode } from "react";
import { ProblemMetadataBadges } from "./problem-metadata-badges";

// Only the explicitly authored candidate section is displayed. Fenced code
// can contain heading-like lines without ending the section.
export function problemDescription(content: string): string {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const description: string[] = [];
  let collecting = false;
  let fence: string | undefined;
  for (const line of lines) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length)
        fence = undefined;
    } else if (!fence) {
      if (/^## Description\s*$/i.test(line)) {
        collecting = true;
        continue;
      }
      if (collecting && /^#{1,2}\s/.test(line)) break;
    }
    if (collecting) description.push(line);
  }
  return description.join("\n").trim();
}

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("`"))
      return (
        <code
          key={index}
          className="rounded-sm bg-muted px-1 font-mono text-xs [overflow-wrap:anywhere]"
        >
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith("**"))
      return (
        <strong key={index} className="font-medium text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (!part.includes("→")) return part;
    return part.split("→").map((text, arrowIndex) => (
      <span key={`${index}-${arrowIndex}`}>
        {arrowIndex > 0 && (
          <span data-flow-arrow aria-label="to" className="block text-center">
            ↓
          </span>
        )}
        {text}
      </span>
    ));
  });
}

// Render the blocks used by community problems without interpreting raw HTML.
function MarkdownContent({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      index++;
      continue;
    }
    const key = index;
    if (line.startsWith("```")) {
      const code: string[] = [];
      index++;
      while (index < lines.length && !lines[index].startsWith("```"))
        code.push(lines[index++]);
      index++;
      blocks.push(
        <pre
          key={key}
          className="overflow-x-auto bg-muted p-3 font-mono text-xs leading-6"
        >
          <code>{code.join("\n")}</code>
        </pre>,
      );
    } else if (/^#{1,6} /.test(line)) {
      const [, marks, text] = /^(#{1,6}) (.*)$/.exec(line)!;
      const Heading = `h${Math.min(marks.length + 2, 6)}` as
        "h3" | "h4" | "h5" | "h6";
      blocks.push(
        <Heading
          key={key}
          className="mt-4 text-sm font-medium text-foreground first:mt-0"
        >
          {inlineMarkdown(text)}
        </Heading>,
      );
      index++;
    } else if (/^\s*[-*+] /.test(line) || /^\s*\d+\. /.test(line)) {
      const ordered = /^\s*\d+\. /.test(line);
      const pattern = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/;
      const items: ReactNode[] = [];
      while (index < lines.length && pattern.test(lines[index])) {
        items.push(
          <li key={index}>
            {inlineMarkdown(lines[index++].replace(pattern, ""))}
          </li>,
        );
      }
      blocks.push(
        ordered ? (
          <ol key={key} className="flex list-decimal flex-col gap-1 pl-4">
            {items}
          </ol>
        ) : (
          <ul key={key} className="flex list-disc flex-col gap-1 pl-4">
            {items}
          </ul>
        ),
      );
    } else {
      const paragraph: string[] = [line];
      index++;
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^(#{1,6} |```|\s*[-*+] |\s*\d+\. )/.test(lines[index])
      )
        paragraph.push(lines[index++]);
      blocks.push(
        <p
          key={key}
          className="has-[[data-flow-arrow]]:text-xs has-[[data-flow-arrow]]:[&_code]:block has-[[data-flow-arrow]]:[&_code]:bg-transparent has-[[data-flow-arrow]]:[&_code]:px-0"
        >
          {inlineMarkdown(paragraph.join(" "))}
        </p>,
      );
    }
  }
  return (
    <div className="flex flex-col gap-3 text-sm leading-6 break-words text-muted-foreground">
      {blocks}
    </div>
  );
}

export function ProblemPanel({ problem }: { problem: Problem }) {
  return (
    <section
      aria-labelledby="problem-heading"
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <h2 id="problem-heading" className="text-xs font-medium">
          Problem
        </h2>
      </div>
      <div
        className="problem-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
        tabIndex={0}
        role="region"
        aria-label="Problem description"
      >
        <div className="mb-4 flex flex-col gap-3">
          <h3 className="text-base font-medium tracking-tight">
            {problem.title}
          </h3>
          <ProblemMetadataBadges
            problem={problem}
            showLevel={false}
            showType={false}
          />
        </div>
        <h3 className="mb-2 text-sm font-medium text-foreground">
          Description
        </h3>
        <MarkdownContent content={problemDescription(problem.content)} />
      </div>
    </section>
  );
}
