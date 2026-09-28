import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";
import type { LanguageModel } from "ai";
import type { AISettings } from "../settings/types";
import { normalizeOllamaBaseUrl } from "./ollama";

export class AIConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

export function getLanguageModel(settings: AISettings): LanguageModel {
  if (!settings.model.trim()) throw new AIConfigurationError("Select an AI model before continuing.");

  switch (settings.provider) {
    case "openai": {
      if (!settings.apiKey.trim()) throw new AIConfigurationError("Enter an OpenAI API key before continuing.");
      return createOpenAI({ apiKey: settings.apiKey.trim() })(settings.model);
    }
    case "anthropic": {
      if (!settings.apiKey.trim()) throw new AIConfigurationError("Enter an Anthropic API key before continuing.");
      return createAnthropic({
        apiKey: settings.apiKey.trim(),
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      })(settings.model);
    }
    case "ollama": {
      const baseURL = `${normalizeOllamaBaseUrl(settings.baseUrl)}/api`;
      return createOllama({ baseURL, compatibility: "strict" })(settings.model);
    }
  }
}
