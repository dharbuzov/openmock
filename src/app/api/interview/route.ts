import { startInterview, InterviewOptionsError } from "@/lib/interview/engine";
import { getProblem } from "@/lib/problems/loader";
import { requireInterviewDefinition } from "@/lib/interview/definitions";
import {
  interviewLevelIds,
  interviewModes,
  type InterviewLevelId,
  type InterviewMode,
} from "@/lib/interview/types";

const levels = new Set<InterviewLevelId>(interviewLevelIds);
const modes = new Set<InterviewMode>(interviewModes);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("problemId" in body) ||
    typeof body.problemId !== "string" ||
    !body.problemId.trim()
  ) {
    return Response.json(
      { error: "problemId must be a non-empty string." },
      { status: 400 },
    );
  }
  const input = body as {
    problemId: string;
    targetLevel?: unknown;
    mode?: unknown;
  };
  if (
    input.targetLevel !== undefined &&
    (typeof input.targetLevel !== "string" ||
      !levels.has(input.targetLevel as InterviewLevelId))
  ) {
    return Response.json(
      { error: "targetLevel is not supported." },
      { status: 400 },
    );
  }
  if (
    input.mode !== undefined &&
    (typeof input.mode !== "string" || !modes.has(input.mode as InterviewMode))
  ) {
    return Response.json({ error: "mode is not supported." }, { status: 400 });
  }
  const problem = await getProblem(input.problemId);
  if (!problem)
    return Response.json({ error: "Problem not found." }, { status: 404 });
  const definition = await requireInterviewDefinition(problem.interview);
  try {
    return Response.json(
      startInterview(problem, {
        definition,
        targetLevel: input.targetLevel as InterviewLevelId | undefined,
        mode: input.mode as InterviewMode | undefined,
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof InterviewOptionsError)
      return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
