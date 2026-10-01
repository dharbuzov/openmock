import { localStorage, sessionStorage } from "../storage/local-storage";
import type { Storage } from "../storage/storage";
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

export class SettingsStorage {
  constructor(
    private readonly preferencesStorage: Storage,
    private readonly persistentKeys: Storage,
    private readonly temporaryKeys: Storage,
  ) {}

  private readPreferences(): StoredPreferences {
    const stored =
      this.preferencesStorage.get<StoredPreferences>(preferencesKey);
    if (stored) return stored;

    const legacy = this.preferencesStorage.get<{
      model?: string;
      rememberApiKey?: boolean;
    }>(legacyPreferencesKey);
    if (!legacy) return {};
    return {
      provider: "openai",
      openai: {
        model: legacy.model,
        rememberApiKey: legacy.rememberApiKey,
      },
    };
  }

  private readApiKey(
    provider: CloudProviderId,
    rememberApiKey: boolean,
  ): string {
    const storage = rememberApiKey ? this.persistentKeys : this.temporaryKeys;
    return (
      storage.getText(apiKeyStorageKey(provider)) ??
      (provider === "openai"
        ? storage.getText(legacyApiKeyStorageKey)
        : null) ??
      ""
    );
  }

  readProviderSettings(provider: AIProviderId): AISettings {
    try {
      const preferences = this.readPreferences();
      if (provider === "ollama") {
        return {
          provider,
          baseUrl:
            preferences.ollama?.baseUrl?.trim() ||
            defaultOllamaSettings.baseUrl,
          model:
            preferences.ollama?.model?.trim() ?? defaultOllamaSettings.model,
        };
      }

      const saved = preferences[provider];
      const models = provider === "openai" ? openAIModels : anthropicModels;
      const fallback = defaultSettingsByProvider[provider];
      const model =
        (saved?.model === fallback.model
          ? saved.model
          : models.find(({ value }) => value === saved?.model)?.value) ??
        fallback.model;
      const rememberApiKey = saved?.rememberApiKey === true;
      return {
        provider,
        model,
        rememberApiKey,
        apiKey: this.readApiKey(provider, rememberApiKey),
      };
    } catch {
      return { ...defaultSettingsByProvider[provider] };
    }
  }

  readSettings(): AISettings {
    try {
      const provider = this.readPreferences().provider;
      return this.readProviderSettings(
        isProvider(provider) ? provider : defaultSettings.provider,
      );
    } catch {
      return { ...defaultSettings };
    }
  }

  saveSettings(settings: AISettings): void {
    const preferences = this.readPreferences();
    preferences.provider = settings.provider;

    if (settings.provider !== "openai") {
      const rememberOpenAIKey = preferences.openai?.rememberApiKey === true;
      const legacyStorage = rememberOpenAIKey
        ? this.persistentKeys
        : this.temporaryKeys;
      const legacyKey = legacyStorage.getText(legacyApiKeyStorageKey);
      const migratedKey = apiKeyStorageKey("openai");
      if (legacyKey && !legacyStorage.getText(migratedKey))
        legacyStorage.setText(migratedKey, legacyKey);
    }

    if (settings.provider === "ollama") {
      preferences.ollama = {
        baseUrl: settings.baseUrl.trim(),
        model: settings.model,
      };
    } else {
      const key = apiKeyStorageKey(settings.provider);
      this.persistentKeys.remove(key);
      this.temporaryKeys.remove(key);
      if (settings.apiKey) {
        (settings.rememberApiKey
          ? this.persistentKeys
          : this.temporaryKeys
        ).setText(key, settings.apiKey);
      }
      preferences[settings.provider] = {
        model: settings.model,
        rememberApiKey: settings.rememberApiKey,
      };
    }

    this.preferencesStorage.set(preferencesKey, preferences);
    this.persistentKeys.remove(legacyApiKeyStorageKey);
    this.temporaryKeys.remove(legacyApiKeyStorageKey);
  }
}

const settingsStorage = new SettingsStorage(
  localStorage,
  localStorage,
  sessionStorage,
);
export const readSettings = () => settingsStorage.readSettings();
export const readProviderSettings = (provider: AIProviderId) =>
  settingsStorage.readProviderSettings(provider);
export const saveSettings = (settings: AISettings) =>
  settingsStorage.saveSettings(settings);
