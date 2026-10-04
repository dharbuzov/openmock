import { Clock } from "lucide-react";
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
  showLabels = false,
  typeLabel,
  durationMinutes,
  showCompanies = false,
}: {
  problem: Problem;
  topicLimit?: number;
  showLabels?: boolean;
  typeLabel?: string;
  durationMinutes?: number;
  showCompanies?: boolean;
}) {
  const topics = [...new Set(problem.topics)];
  const difficultyClass = {
    easy: "border-success/15 bg-success/5 text-success",
    medium: "border-warning/15 bg-warning/5 text-warning",
    hard: "border-destructive/15 bg-destructive/5 text-destructive",
  };
  const typeBadge = typeLabel ? (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full",
        !showLabels &&
          "border-blue-200/70 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
      )}
    >
      <span className="truncate">{typeLabel}</span>
    </Badge>
  ) : null;
  const durationBadge = durationMinutes ? (
    <Badge variant="outline" className="text-muted-foreground">
      <Clock aria-hidden="true" className="size-3" />
      {durationMinutes} min
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
      {showLabels && typeLabel && (
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
        {!showLabels && durationBadge}
      </div>
      {showLabels && durationBadge && (
        <>
          <span className="text-xs leading-5 text-muted-foreground">
            Duration
          </span>
          <div className="flex min-w-0 flex-wrap gap-1.5">{durationBadge}</div>
        </>
      )}
      {topics.length > 0 && (
        <>
          {showLabels && (
            <span className="text-xs leading-5 text-muted-foreground">
              Topics
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
