export type ProblemComplexity = "low" | "medium" | "high";

export type ProblemCompany = {
  id: string;
  relation: "reported" | "similar" | "relevant";
  source?: string;
};

export interface ProblemMetadata {
  id: string;
  title: string;
  interview: string;
  complexity: ProblemComplexity;
  type?: string;
  difficulty?: "easy" | "medium" | "hard";
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
