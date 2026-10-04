export type ProblemDifficulty = "easy" | "medium" | "hard";

export type ProblemCompany = {
  id: string;
  relation: "reported" | "similar" | "relevant";
  source?: string;
};

export interface ProblemMetadata {
  id: string;
  title: string;
  interview: string;
  difficulty: ProblemDifficulty;
  duration?: { minutes: number };
  categories: string[];
  topics: string[];
  companies: ProblemCompany[];
  interviewerContext?: string;

  /** Problem-specific initial source for the single-file code workspace. */
  language?: string;
  starterCode?: string;
}

export interface Problem extends ProblemMetadata {
  /** Full problem Markdown; the candidate panel selects its Description section. */
  content: string;
}
