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
  /** Candidate-facing Markdown only. */
  content: string;
}
