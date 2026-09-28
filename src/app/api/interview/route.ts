import { createInterview } from "@/lib/interview/engine";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("problemId" in body) || typeof body.problemId !== "string" || !body.problemId.trim()) {
    return Response.json({ error: "problemId must be a non-empty string." }, { status: 400 });
  }
  const interview = await createInterview(body.problemId);
  if (!interview) return Response.json({ error: "Problem not found." }, { status: 404 });
  return Response.json(interview, { status: 201 });
}
