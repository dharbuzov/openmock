export type ProblemType = "dsa" | "system-design";

export interface ProblemMetadata {
  id: string;
  title: string;
  type: ProblemType;
  level: string;
  tags: string[];
  language?: "java";
  starterCode?: string;
}

export interface Problem extends ProblemMetadata {
  content: string;
}
