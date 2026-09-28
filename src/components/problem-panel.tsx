import type { Problem } from "@/lib/problems/types";
import type { ReactNode } from "react";

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("`")) return <code key={index} className="rounded-sm bg-muted px-1 font-mono text-xs">{part.slice(1, -1)}</code>;
    if (part.startsWith("**")) return <strong key={index} className="font-medium text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

// Render the blocks used by community problems without interpreting raw HTML.
function MarkdownContent({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const key = index;
    if (line.startsWith("```")) {
      const code: string[] = [];
      index++;
      while (index < lines.length && !lines[index].startsWith("```")) code.push(lines[index++]);
      index++;
      blocks.push(<pre key={key} className="overflow-x-auto bg-muted p-3 font-mono text-xs leading-6"><code>{code.join("\n")}</code></pre>);
    } else if (/^#{1,6} /.test(line)) {
      const [, marks, text] = /^(#{1,6}) (.*)$/.exec(line)!;
      const Heading = `h${Math.min(marks.length + 2, 6)}` as "h3" | "h4" | "h5" | "h6";
      blocks.push(<Heading key={key} className="mt-3 font-medium text-foreground first:mt-0">{inlineMarkdown(text)}</Heading>);
      index++;
    } else if (/^\s*[-*+] /.test(line) || /^\s*\d+\. /.test(line)) {
      const ordered = /^\s*\d+\. /.test(line);
      const pattern = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/;
      const items: ReactNode[] = [];
      while (index < lines.length && pattern.test(lines[index])) {
        items.push(<li key={index}>{inlineMarkdown(lines[index++].replace(pattern, ""))}</li>);
      }
      blocks.push(ordered
        ? <ol key={key} className="flex list-decimal flex-col gap-1 pl-4">{items}</ol>
        : <ul key={key} className="flex list-disc flex-col gap-1 pl-4">{items}</ul>);
    } else {
      const paragraph: string[] = [line];
      index++;
      while (index < lines.length && lines[index].trim() && !/^(#{1,6} |```|\s*[-*+] |\s*\d+\. )/.test(lines[index])) paragraph.push(lines[index++]);
      blocks.push(<p key={key}>{inlineMarkdown(paragraph.join(" "))}</p>);
    }
  }
  return <div className="flex flex-col gap-3 text-sm leading-6 break-words text-muted-foreground">{blocks}</div>;
}

export function ProblemPanel({ problem }: { problem: Problem }) {
  return (
    <section aria-labelledby="problem-heading" className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <h2 id="problem-heading" className="text-xs font-medium">Problem</h2>
        <span className="font-mono text-xs text-muted-foreground">{problem.level}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <MarkdownContent content={problem.content} />
      </div>
    </section>
  );
}
