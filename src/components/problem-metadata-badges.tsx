import type { Problem } from "@/lib/problems/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

function metadataLabel(value: string): string {
  if (["dsa", "sql"].includes(value)) return value.toUpperCase();
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ProblemMetadataBadges({
  problem,
  topicLimit = 2,
  showLevel = true,
}: {
  problem: Problem;
  topicLimit?: number;
  showLevel?: boolean;
}) {
  const topics = [...new Set([...problem.tags, ...problem.topics])];
  const difficultyClass = {
    easy: "border-green-200/70 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
    medium:
      "border-amber-200/70 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    hard: "border-red-200/70 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <Badge
          variant="outline"
          className="max-w-full border-blue-200/70 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
        >
          <span className="truncate">
            {metadataLabel(problem.type ?? problem.interview)}
          </span>
        </Badge>
        {problem.difficulty && (
          <Badge
            variant="outline"
            className={cn(difficultyClass[problem.difficulty])}
          >
            <span
              aria-hidden="true"
              className="size-1 rounded-full bg-current"
            />
            {metadataLabel(problem.difficulty)}
          </Badge>
        )}
        {showLevel && problem.level && (
          <Badge
            variant="outline"
            className="border-violet-200/70 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300"
          >
            {metadataLabel(problem.level)}
          </Badge>
        )}
      </div>
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topics.slice(0, topicLimit).map((value) => (
            <Badge
              key={value}
              variant="outline"
              className="max-w-full text-muted-foreground"
            >
              <span className="truncate">{metadataLabel(value)}</span>
            </Badge>
          ))}
          {topics.length > topicLimit && (
            <Badge
              variant="outline"
              className="text-muted-foreground"
              title={topics.slice(topicLimit).map(metadataLabel).join(", ")}
            >
              +{topics.length - topicLimit}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
