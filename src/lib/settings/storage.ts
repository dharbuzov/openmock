import { logger } from "../logging/logger";
import { localStorage, sessionStorage } from "../storage/local-storage";
import type { Storage } from "../storage/storage";
import {
  defaultSpeechSettings,
  type SpeechSettings,
} from "../voice/local-speech";
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
const preferencesKey = "openmock:ai-preferences";

type StoredPreferences = {
  speech?: SpeechSettings;
  interviewerVoiceEnabled?: boolean;
  provider?: AIProviderId;
  openai?: { model?: string; rememberApiKey?: boolean };
  anthropic?: { model?: string; rememberApiKey?: boolean };
  ollama?: { baseUrl?: string; model?: string };
};

function isProvider(value: unknown): value is AIProviderId {
  return aiProviders.some((provider) => provider.value === value);
}

function apiKeyStorageKey(provider: CloudProviderId): string {
  return `openmock:api-key:${provider}`;
}

export class SettingsStorage {
  constructor(
    private readonly preferencesStorage: Storage,
    private readonly persistentKeys: Storage,
    private readonly temporaryKeys: Storage,
  ) {}

  private readPreferences(): StoredPreferences {
    return this.preferencesStorage.get<StoredPreferences>(preferencesKey) ?? {};
  }

  readSpeechSettings(): SpeechSettings {
    try {
      const saved = this.readPreferences().speech;
      return {
        baseUrl:
          typeof saved?.baseUrl === "string"
            ? saved.baseUrl
            : defaultSpeechSettings.baseUrl,
        voice:
          typeof saved?.voice === "string"
            ? saved.voice
            : defaultSpeechSettings.voice,
      };
    } catch {
      return { ...defaultSpeechSettings };
    }
  }

  saveSpeechSettings(speech: SpeechSettings): void {
    this.preferencesStorage.set(preferencesKey, {
      ...this.readPreferences(),
      speech,
    });
  }

  private readApiKey(
    provider: CloudProviderId,
    rememberApiKey: boolean,
  ): string {
    const storage = rememberApiKey ? this.persistentKeys : this.temporaryKeys;
    return storage.getText(apiKeyStorageKey(provider)) ?? "";
  }

  readProviderSettings(provider: AIProviderId): AISettings {
    try {
      const preferences = this.readPreferences();
      const interviewerVoiceEnabled =
        typeof preferences.interviewerVoiceEnabled === "boolean"
          ? preferences.interviewerVoiceEnabled
          : defaultSettings.interviewerVoiceEnabled;
      if (provider === "ollama") {
        return {
          provider,
          interviewerVoiceEnabled,
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
        interviewerVoiceEnabled,
        model,
        rememberApiKey,
        apiKey: this.readApiKey(provider, rememberApiKey),
      };
    } catch {
      logger.warn(
        { operation: "storage", reason: "unavailable-or-invalid" },
        "Storage operation failed",
      );
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
      logger.warn(
        { operation: "storage", reason: "unavailable-or-invalid" },
        "Storage operation failed",
      );
      return { ...defaultSettings };
    }
  }

  saveSettings(settings: AISettings): void {
    const preferences = this.readPreferences();
    preferences.provider = settings.provider;
    preferences.interviewerVoiceEnabled = settings.interviewerVoiceEnabled;

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
  }
}

const settingsStorage = new SettingsStorage(
  localStorage,
  localStorage,
  sessionStorage,
);
export const readSettings = () => settingsStorage.readSettings();
export const readSpeechSettings = () => settingsStorage.readSpeechSettings();
export function saveSpeechSettings(speech: SpeechSettings): void {
  settingsStorage.saveSpeechSettings(speech);
  settingsListeners.forEach((listener) => listener());
}
export const readProviderSettings = (provider: AIProviderId) =>
  settingsStorage.readProviderSettings(provider);
const settingsListeners = new Set<() => void>();

export function subscribeSettings(listener: () => void): () => void {
  settingsListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    settingsListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function saveSettings(settings: AISettings): void {
  settingsStorage.saveSettings(settings);
  settingsListeners.forEach((listener) => listener());
}
