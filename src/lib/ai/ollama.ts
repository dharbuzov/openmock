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
  const requestSignal = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(10_000),
  ]);
  const providerFetch = loggedProviderFetch(metadata, []);
  try {
    const response = await providerFetch(`${baseUrl}/api/tags`, {
      signal: requestSignal,
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new Error("Ollama request failed");
    const body = (await response.json()) as {
      models?: Array<{ name?: unknown; capabilities?: unknown }>;
    };
    if (!Array.isArray(body.models)) throw new Error("Invalid model list");
    logger.info(
      {
        ...metadata,
        status: response.status,
        modelCount: body.models?.length ?? 0,
      },
      "Ollama connection tested",
    );
    const models = await Promise.all(
      body.models.map(async (model) => {
        if (!model || typeof model.name !== "string" || !model.name.trim())
          throw new Error("Invalid model entry");
        const name = model.name.trim();
        let capabilities = model.capabilities;
        // Older Ollama versions expose capabilities only through /api/show.
        if (capabilities === undefined) {
          const details = await providerFetch(`${baseUrl}/api/show`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: name }),
            signal: requestSignal,
            cache: "no-store",
            redirect: "error",
          });
          if (!details.ok) throw new Error("Model capability request failed");
          capabilities = (await details.json()).capabilities;
        }
        if (!Array.isArray(capabilities))
          throw new Error("Invalid capabilities");
        return capabilities.includes("completion") ? name : null;
      }),
    );
    return [...new Set(models.filter((name): name is string => name !== null))];
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
