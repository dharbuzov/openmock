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
  type?: string;
  difficulty: ProblemDifficulty;
  level?: "junior" | "mid" | "senior" | "staff" | "principal";
  categories: string[];
  topics: string[];
  companies: ProblemCompany[];
  tags: string[];
  interviewerContext?: string;

  /** Compatibility metadata used by the current single-file code workspace. */
  language?: string;
  starterCode?: string;
}

export interface Problem extends ProblemMetadata {
  /** Full problem Markdown; the candidate panel selects its Description section. */
  content: string;
}
