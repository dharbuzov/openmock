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
  showType = true,
  showLabels = !showLevel && !showType,
  typeLabel,
  showCompanies = false,
}: {
  problem: Problem;
  topicLimit?: number;
  showLevel?: boolean;
  showType?: boolean;
  showLabels?: boolean;
  typeLabel?: string;
  showCompanies?: boolean;
}) {
  const topics = [...new Set([...problem.tags, ...problem.topics])];
  const difficultyClass = {
    easy: "border-success/15 bg-success/5 text-success",
    medium: "border-warning/15 bg-warning/5 text-warning",
    hard: "border-destructive/15 bg-destructive/5 text-destructive",
  };
  const typeBadge = showType ? (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full",
        !showLabels &&
          "border-blue-200/70 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
      )}
    >
      <span className="truncate">
        {typeLabel ?? metadataLabel(problem.type ?? problem.interview)}
      </span>
    </Badge>
  ) : null;
  return (
    <div
      className={cn(
        showLabels
          ? "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2"
          : "flex flex-col gap-1.5",
      )}
    >
      {showLabels && showType && (
        <>
          <span className="text-xs leading-5 text-muted-foreground">Type</span>
          <div className="flex min-w-0 flex-wrap gap-1.5">{typeBadge}</div>
        </>
      )}
      {showLabels && problem.difficulty && (
        <span className="text-xs leading-5 text-muted-foreground">
          Difficulty
        </span>
      )}
      {((showType && !showLabels) ||
        problem.difficulty ||
        (showLevel && problem.level)) && (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {!showLabels && typeBadge}
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
      )}
      {topics.length > 0 && (
        <>
          {showLabels && (
            <span className="text-xs leading-5 text-muted-foreground">
              Tags
            </span>
          )}
          <div className="flex min-w-0 flex-wrap gap-1.5">
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
        </>
      )}
      {showCompanies && problem.companies.length > 0 && (
        <>
          <span className="text-xs leading-5 text-muted-foreground">
            Common at
          </span>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {problem.companies.map(({ id }) => (
              <Badge
                key={id}
                variant="outline"
                className="max-w-full text-muted-foreground"
              >
                <span className="truncate">{metadataLabel(id)}</span>
              </Badge>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
