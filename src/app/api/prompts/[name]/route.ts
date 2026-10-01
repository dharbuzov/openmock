import { isPromptName } from "@/lib/ai/prompt-loader";
import { readPromptResource } from "@/lib/ai/prompt-resources";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/prompts/[name]">,
) {
  const { name } = await context.params;
  if (!isPromptName(name))
    return new Response("Prompt not found.", { status: 404 });
  try {
    return new Response(await readPromptResource(name), {
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  } catch (error) {
    return new Response(
      error instanceof Error
        ? error.message
        : "Required prompt could not be loaded.",
      { status: 500 },
    );
  }
}
