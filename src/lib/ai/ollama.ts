import { logger } from "../logging/logger";
import { loggedProviderFetch } from "./logging";
import type { OllamaSettings } from "../settings/types";

export class OllamaConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaConnectionError";
  }
}

export function normalizeOllamaBaseUrl(value: string): string {
  const raw = value.trim();
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error("Unsupported protocol");
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/(?:api)?\/?$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new OllamaConnectionError("Enter a valid Ollama server URL.");
  }
}

export async function listOllamaModels(
  settings: Pick<OllamaSettings, "baseUrl">,
  signal?: AbortSignal,
): Promise<string[]> {
  const baseUrl = normalizeOllamaBaseUrl(settings.baseUrl);
  const metadata = {
    component: "ollama",
    provider: "ollama",
    operation: "connection-test",
    requestId: crypto.randomUUID(),
  };
  try {
    const response = await loggedProviderFetch(metadata, [])(
      `${baseUrl}/api/tags`,
      {
        signal,
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error("Ollama request failed");
    const body = (await response.json()) as {
      models?: Array<{ name?: unknown }>;
    };
    logger.info(
      {
        ...metadata,
        status: response.status,
        modelCount: body.models?.length ?? 0,
      },
      "Ollama connection tested",
    );
    return (body.models ?? [])
      .map((model) => (typeof model.name === "string" ? model.name.trim() : ""))
      .filter((name): name is string => Boolean(name));
  } catch (error) {
    logger.warn(
      { ...metadata, endpoint: `${baseUrl}/api/tags`, err: error },
      "Model discovery failed",
    );
    if (
      error instanceof OllamaConnectionError ||
      (error instanceof DOMException && error.name === "AbortError")
    )
      throw error;
    throw new OllamaConnectionError(`Cannot connect to Ollama at ${baseUrl}`);
  }
}
