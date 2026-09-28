import {
  aiProviders,
  anthropicModels,
  defaultOllamaSettings,
  defaultSettings,
  defaultSettingsByProvider,
  openAIModels,
  type AIProviderId,
  type AISettings,
  type CloudProviderId,
} from "./types";

export const themeStorageKey = "openmock:theme";
const preferencesKey = "openmock:ai-preferences:v2";
const legacyPreferencesKey = "openmock:ai-preferences:v1";
const legacyApiKeyStorageKey = "openmock:api-key:v1";

type StoredPreferences = {
  provider?: AIProviderId;
  openai?: { model?: string; rememberApiKey?: boolean };
  anthropic?: { model?: string; rememberApiKey?: boolean };
  ollama?: { baseUrl?: string; model?: string };
};

function isProvider(value: unknown): value is AIProviderId {
  return aiProviders.some((provider) => provider.value === value);
}

function apiKeyStorageKey(provider: CloudProviderId): string {
  return `openmock:api-key:v2:${provider}`;
}

function readPreferences(): StoredPreferences {
  const stored = window.localStorage.getItem(preferencesKey);
  if (stored) return JSON.parse(stored) as StoredPreferences;

  const legacy = JSON.parse(window.localStorage.getItem(legacyPreferencesKey) ?? "{}") as {
    model?: string;
    rememberApiKey?: boolean;
  };
  return {
    provider: "openai",
    openai: {
      model: legacy.model,
      rememberApiKey: legacy.rememberApiKey,
    },
  };
}

function readApiKey(provider: CloudProviderId, rememberApiKey: boolean): string {
  const storage = rememberApiKey ? window.localStorage : window.sessionStorage;
  return storage.getItem(apiKeyStorageKey(provider))
    ?? (provider === "openai" ? storage.getItem(legacyApiKeyStorageKey) : null)
    ?? "";
}

export function readProviderSettings(provider: AIProviderId): AISettings {
  if (typeof window === "undefined") return { ...defaultSettingsByProvider[provider] };
  try {
    const preferences = readPreferences();
    if (provider === "ollama") {
      return {
        provider,
        baseUrl: preferences.ollama?.baseUrl?.trim() || defaultOllamaSettings.baseUrl,
        model: preferences.ollama?.model?.trim() ?? "",
      };
    }

    const saved = preferences[provider];
    const models = provider === "openai" ? openAIModels : anthropicModels;
    const fallback = defaultSettingsByProvider[provider];
    const model = models.some(({ value }) => value === saved?.model)
      ? saved?.model ?? fallback.model
      : fallback.model;
    const rememberApiKey = saved?.rememberApiKey === true;
    return {
      provider,
      model,
      rememberApiKey,
      apiKey: readApiKey(provider, rememberApiKey),
    };
  } catch {
    return { ...defaultSettingsByProvider[provider] };
  }
}

export function readSettings(): AISettings {
  if (typeof window === "undefined") return { ...defaultSettings };
  try {
    const provider = readPreferences().provider;
    return readProviderSettings(isProvider(provider) ? provider : "openai");
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: AISettings): void {
  const preferences = readPreferences();
  preferences.provider = settings.provider;

  if (settings.provider === "ollama") {
    preferences.ollama = { baseUrl: settings.baseUrl.trim(), model: settings.model };
  } else {
    const key = apiKeyStorageKey(settings.provider);
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
    if (settings.apiKey) {
      (settings.rememberApiKey ? window.localStorage : window.sessionStorage).setItem(key, settings.apiKey);
    }
    preferences[settings.provider] = {
      model: settings.model,
      rememberApiKey: settings.rememberApiKey,
    };
  }

  window.localStorage.setItem(preferencesKey, JSON.stringify(preferences));
  window.localStorage.removeItem(legacyApiKeyStorageKey);
  window.sessionStorage.removeItem(legacyApiKeyStorageKey);
}
