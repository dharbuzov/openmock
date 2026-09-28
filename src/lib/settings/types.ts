export const aiProviders = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "ollama", label: "Ollama" },
] as const;

export type AIProviderId = (typeof aiProviders)[number]["value"];

export const openAIModels = [
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  { value: "gpt-4.1", label: "GPT-4.1" },
] as const;

// Keep provider model IDs centralized because provider catalogs change over time.
export const anthropicModels = [
  { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { value: "claude-opus-5", label: "Claude Opus 5" },
] as const;

interface CloudAISettings {
  model: string;
  apiKey: string;
  rememberApiKey: boolean;
}

export interface OpenAISettings extends CloudAISettings {
  provider: "openai";
}

export interface AnthropicSettings extends CloudAISettings {
  provider: "anthropic";
}

export interface OllamaSettings {
  provider: "ollama";
  baseUrl: string;
  model: string;
}

export type AISettings = OpenAISettings | AnthropicSettings | OllamaSettings;
export type CloudProviderId = OpenAISettings["provider"] | AnthropicSettings["provider"];

export const defaultOllamaSettings: OllamaSettings = {
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  model: "",
};

export const defaultSettingsByProvider: Record<AIProviderId, AISettings> = {
  openai: {
    provider: "openai",
    model: openAIModels[0].value,
    apiKey: "",
    rememberApiKey: false,
  },
  anthropic: {
    provider: "anthropic",
    model: anthropicModels[0].value,
    apiKey: "",
    rememberApiKey: false,
  },
  ollama: defaultOllamaSettings,
};

export const defaultSettings: AISettings = { ...defaultSettingsByProvider.openai };

export function isCloudSettings(settings: AISettings): settings is OpenAISettings | AnthropicSettings {
  return settings.provider === "openai" || settings.provider === "anthropic";
}
