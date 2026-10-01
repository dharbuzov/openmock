import type { ArchitectureDiagram } from "../diagram/types";
import type { Problem } from "../problems/types";

export type WorkspaceType = "diagram" | "code" | "project" | "none";
export type InterviewStage = { id: string; name?: string };
export type InterviewLevelId =
  "junior" | "middle" | "senior" | "staff" | "principal";
export type InterviewLevel = { id: InterviewLevelId; name: string };
export type InterviewMode = "practice" | "mock";
export type HiringRecommendation =
  "strong-hire" | "hire" | "mixed" | "no-hire" | "strong-no-hire";
export type CompetencyDefinition = { id: string; name: string };
export type EvaluationDefinition = {
  competencies: CompetencyDefinition[];
  recommendations: HiringRecommendation[];
};

export type InterviewDefinition = {
  id: string;
  name: string;
  version: number;
  revision: string;
  workspace: WorkspaceType;
  stages: InterviewStage[];
  levels: InterviewLevel[];
  modes: InterviewMode[];
  duration: { defaultMinutes: number };
  evaluation: EvaluationDefinition;
  instructions: string;
};

export type InterviewStatus = "in-progress" | "completed";
export type InterviewEndReason =
  "completed" | "candidate-finished" | "time-limit" | "abandoned" | "error";
export type InterviewDefinitionReference = Pick<
  InterviewDefinition,
  "id" | "version" | "revision"
>;
export type InterviewStageState = {
  current: string;
  completed: string[];
  startedAt: string;
};
export type InterviewMessageRole = "candidate" | "interviewer";
export type InterviewMessage = {
  id: string;
  role: InterviewMessageRole;
  content: string;
  stage: string;
  createdAt: string;
};
export type InterviewObservation = {
  id: string;
  competencyId?: string;
  observation: string;
  messageId?: string;
  stage: string;
};
export type Interview = {
  id: string;
  problemId: string;
  definition: InterviewDefinitionReference;
  targetLevel: InterviewLevelId;
  mode: InterviewMode;
  status: InterviewStatus;
  stage: InterviewStageState;
  messages: InterviewMessage[];
  observations: InterviewObservation[];
  startedAt: string;
  completedAt?: string;
  endReason?: InterviewEndReason;
};

export type DiagramWorkspaceSnapshot = {
  type: "diagram";
  diagram: ArchitectureDiagram;
};
export type CodeWorkspaceSnapshot = {
  type: "code";
  language: string;
  filename: string;
  code: string;
};
export type ProjectFile = { path: string; content: string };
export type ProjectWorkspaceSnapshot = {
  type: "project";
  files: ProjectFile[];
  activeFile?: string;
};
export type NoWorkspaceSnapshot = { type: "none" };
export type WorkspaceSnapshot =
  | DiagramWorkspaceSnapshot
  | CodeWorkspaceSnapshot
  | ProjectWorkspaceSnapshot
  | NoWorkspaceSnapshot;

export type InterviewContext = {
  interview: Interview;
  problem: Problem;
  definition: InterviewDefinition;
  workspace: WorkspaceSnapshot;
};
export type InterviewTurnObservation = Omit<InterviewObservation, "stage">;
export type InterviewTurn = {
  message: string;
  stageComplete: boolean;
  observations: InterviewTurnObservation[];
};
export type CompetencyRating =
  | "strong-positive"
  | "positive"
  | "mixed"
  | "negative"
  | "strong-negative"
  | "not-assessed";
export type EvaluationEvidence = {
  observation: string;
  messageId?: string;
  stage?: string;
};
export type CompetencyResult = {
  competencyId: string;
  rating: CompetencyRating;
  summary: string;
  evidence: EvaluationEvidence[];
};
export type InterviewResult = {
  interviewId: string;
  problemId: string;
  definition: InterviewDefinitionReference;
  targetLevel: InterviewLevelId;
  recommendation: HiringRecommendation;
  competencies: CompetencyResult[];
  strengths: EvaluationEvidence[];
  concerns: EvaluationEvidence[];
  keyMoments: EvaluationEvidence[];
  summary: string;
  finalAssessment: string;
  createdAt: string;
};
