"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
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
  categories,
}: {
  problems: Problem[];
  categories: { id: string; name: string }[];
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
  return (
    <div className="flex flex-col gap-5">
      <ToggleGroup
        aria-label="Interview category"
        variant="outline"
        size="sm"
        spacing={0}
        value={[category || "__all__"]}
        onValueChange={(values) => {
          if (values.length)
            setCategory(values[0] === "__all__" ? "" : values[0]);
        }}
        className="flex-wrap"
      >
        <ToggleGroupItem value="__all__">All interviews</ToggleGroupItem>
        {categories.map(({ id, name }) => (
          <ToggleGroupItem key={id} value={id}>
            {name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-col gap-3">
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
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {visible.length} {visible.length === 1 ? "problem" : "problems"}
      </p>
      <ul className="divide-y border-y">
        {visible.map((problem) => (
          <li
            key={problem.id}
            className="flex flex-wrap items-center justify-between gap-4 py-5"
          >
            <div className="flex min-w-0 flex-col gap-2">
              <h2 className="text-sm font-medium">{problem.title}</h2>
              <ProblemMetadataBadges
                problem={{ ...problem, difficulty: problemDifficulty(problem) }}
                topicLimit={3}
                showLevel={false}
              />
            </div>
            <Link
              href={`/practice/${problem.id}/setup`}
              aria-label={`Choose ${problem.title}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Choose
            </Link>
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
  );
}
