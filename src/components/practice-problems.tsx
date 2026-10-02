"use client";

import Link from "next/link";
import { useState } from "react";
import { LayoutGrid } from "lucide-react";
import { resolveIcon } from "./lucide-icon-registry";
import type { InterviewTypeSummary } from "@/lib/interview/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { ProblemMetadataBadges } from "./problem-metadata-badges";
import { problemDescription } from "./problem-panel";
import type { Problem } from "@/lib/problems/types";

type Difficulty = "" | "easy" | "medium" | "hard";
type Filters = {
  category: string;
  difficulty: Difficulty;
  company: string;
  search: string;
};
export function problemDifficulty(problem: Problem): Exclude<Difficulty, ""> {
  return (
    problem.difficulty ??
    ({ low: "easy", medium: "medium", high: "hard" } as const)[
      problem.complexity
    ]
  );
}
export function filterProblems(
  problems: Problem[],
  filters: Filters,
): Problem[] {
  const query = filters.search.trim().toLowerCase().replace(/\s+/g, " ");
  return problems.filter(
    (problem) =>
      (!filters.category || problem.interview === filters.category) &&
      (!filters.difficulty ||
        problemDifficulty(problem) === filters.difficulty) &&
      (!filters.company ||
        problem.companies.some(({ id }) => id === filters.company)) &&
      (!query ||
        [
          problem.title,
          problemDescription(problem.content),
          problem.type ?? problem.interview,
          (problem.type ?? problem.interview).replace(/-/g, " "),
          ...problem.tags,
          ...problem.companies.map(({ id }) => id),
        ]
          .join(" ")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .includes(query)),
  );
}
export function availableCompanies(
  problems: Problem[],
): { value: string; label: string }[] {
  return [
    ...new Set(
      problems.flatMap((problem) => problem.companies.map(({ id }) => id)),
    ),
  ]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      value,
      label: value
        .replace(/-/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    }));
}

export function PracticeProblems({
  problems,
  interviewTypes,
}: {
  problems: Problem[];
  interviewTypes: InterviewTypeSummary[];
}) {
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("");
  const [company, setCompany] = useState("");
  const companies = [
    { value: "", label: "All companies" },
    ...availableCompanies(problems),
  ];
  const visible = filterProblems(problems, {
    category,
    search,
    difficulty,
    company,
  });
  const navigationItems = [
    {
      id: "",
      name: "All Interviews",
      icon: LayoutGrid,
      count: problems.length,
    },
    ...interviewTypes.map(({ id, name, icon }) => ({
      id,
      name,
      icon: resolveIcon(icon),
      count: problems.filter((problem) => problem.interview === id).length,
    })),
  ];
  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-7">
      <nav
        aria-labelledby="practice-interview-types"
        className="hidden w-60 shrink-0 flex-col gap-3 md:flex"
      >
        <h2 id="practice-interview-types" className="text-sm font-medium">
          Interview Types
        </h2>
        <div className="flex flex-col gap-1">
          {navigationItems.map(({ id, name, icon: Icon, count }) => (
            <Button
              key={id}
              variant={category === id ? "secondary" : "ghost"}
              aria-pressed={category === id}
              onClick={() => setCategory(id)}
              className="h-auto w-full justify-start gap-2 py-2"
            >
              <Icon data-icon="inline-start" />
              <span className="min-w-0 flex-1 text-left whitespace-normal">
                {name}
              </span>
              <span className="font-mono tabular-nums">{count}</span>
            </Button>
          ))}
        </div>
      </nav>
      <Separator orientation="vertical" className="hidden md:block" />
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <Field className="md:hidden">
          <FieldLabel htmlFor="practice-interview-select">
            Interview Types
          </FieldLabel>
          <Select
            items={navigationItems.map(({ id, name, count }) => ({
              value: id || "__all__",
              label: `${name} (${count})`,
            }))}
            value={category || "__all__"}
            onValueChange={(value) => {
              if (value !== null) setCategory(value === "__all__" ? "" : value);
            }}
          >
            <SelectTrigger id="practice-interview-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {navigationItems.map(({ id, name, count }) => (
                  <SelectItem key={id} value={id || "__all__"}>
                    {name} ({count})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="practice-search" className="sr-only">
              Search problems
            </FieldLabel>
            <Input
              id="practice-search"
              type="search"
              placeholder="Search problems..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap items-end gap-4">
            <Field className="w-auto">
              <FieldLabel
                id="practice-difficulty"
                className="text-xs text-muted-foreground"
              >
                Difficulty
              </FieldLabel>
              <ToggleGroup
                aria-labelledby="practice-difficulty"
                variant="outline"
                size="sm"
                spacing={0}
                value={[difficulty || "__all__"]}
                onValueChange={(values) => {
                  if (["__all__", "easy", "medium", "hard"].includes(values[0]))
                    setDifficulty(
                      values[0] === "__all__" ? "" : (values[0] as Difficulty),
                    );
                }}
              >
                <ToggleGroupItem value="__all__">All</ToggleGroupItem>
                <ToggleGroupItem value="easy">Easy</ToggleGroupItem>
                <ToggleGroupItem value="medium">Medium</ToggleGroupItem>
                <ToggleGroupItem value="hard">Hard</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field className="w-full sm:w-56">
              <FieldLabel
                htmlFor="practice-company"
                className="text-xs text-muted-foreground"
              >
                Company
              </FieldLabel>
              <Combobox
                items={companies}
                value={companies.find(({ value }) => value === company)}
                onValueChange={(item) => setCompany(item?.value ?? "")}
                itemToStringLabel={(item) => item.label}
                itemToStringValue={(item) => item.value}
              >
                <ComboboxInput
                  id="practice-company"
                  placeholder="All companies"
                  showClear={Boolean(company)}
                />
                <ComboboxContent>
                  <ComboboxEmpty>No companies found.</ComboboxEmpty>
                  <ComboboxList>
                    {(item) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>
          </div>
        </FieldGroup>
        <p role="status" className="text-xs text-muted-foreground">
          {visible.length} {visible.length === 1 ? "problem" : "problems"}
        </p>
        <ul>
          {visible.map((problem, index) => (
            <li key={problem.id} className="group relative">
              {index > 0 && <Separator />}
              <div className="flex items-center justify-between gap-4 py-5 group-hover:bg-muted/50 group-focus-within:bg-muted/50">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <h2 className="text-sm font-medium">{problem.title}</h2>
                  <ProblemMetadataBadges
                    problem={{
                      ...problem,
                      difficulty: problemDifficulty(problem),
                    }}
                    topicLimit={3}
                    showLevel={false}
                  />
                </div>
                <Link
                  href={`/practice/${problem.id}/setup`}
                  aria-label={`Choose ${problem.title}`}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "after:absolute after:inset-0",
                  })}
                >
                  Choose
                </Link>
              </div>
            </li>
          ))}
        </ul>
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {problems.length
              ? "No problems match these filters."
              : "No practice problems are available yet."}
          </p>
        )}
      </div>
    </div>
  );
}
