"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
  FieldDescription,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { readProviderSettings, saveSettings } from "@/lib/settings/storage";
import {
  aiProviders,
  anthropicModels,
  isCloudSettings,
  openAIModels,
  type AIProviderId,
  type AISettings,
} from "@/lib/settings/types";

const themes = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const providerDescriptions: Record<AIProviderId, string> = {
  openai: "Interview content is sent to OpenAI using your API key.",
  anthropic: "Interview content is sent to Anthropic using your API key.",
  ollama:
    "Local mode — interview content is sent to your configured Ollama server.",
};

export function SettingsDialog({
  initialSettings,
  onClose,
}: {
  initialSettings: AISettings;
  onClose: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState(initialSettings);
  const [keyInput, setKeyInput] = useState("");
  const [removeKey, setRemoveKey] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>(
    initialSettings.provider === "ollama" && initialSettings.model
      ? [initialSettings.model]
      : [],
  );
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const resolvedSettings: AISettings = isCloudSettings(settings)
    ? {
        ...settings,
        apiKey: keyInput.trim() || (removeKey ? "" : settings.apiKey),
      }
    : settings;

  function selectProvider(provider: AIProviderId) {
    if (provider === settings.provider) return;
    controller.current?.abort();
    controller.current = null;
    setSettings(readProviderSettings(provider));
    setKeyInput("");
    setRemoveKey(false);
    setFeedback("");
    if (provider === "ollama") {
      const saved = readProviderSettings("ollama");
      setOllamaModels(saved.model ? [saved.model] : []);
    }
  }

  async function testConnection() {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setTesting(true);
    setFeedback("");
    try {
      if (resolvedSettings.provider === "ollama") {
        const { listOllamaModels } = await import("@/lib/ai/ollama");
        const models = await listOllamaModels(resolvedSettings, request.signal);
        if (models.length === 0) {
          setOllamaModels([]);
          setSettings({ ...resolvedSettings, model: "" });
          setFeedback("No local models found");
          return;
        }
        setOllamaModels(models);
        setSettings({
          ...resolvedSettings,
          model: models.includes(resolvedSettings.model)
            ? resolvedSettings.model
            : models[0],
        });
      } else {
        const { testAIConnection } = await import("@/lib/ai/provider");
        await testAIConnection(resolvedSettings, request.signal);
      }
      if (!request.signal.aborted) setFeedback("Connected");
    } catch {
      if (!request.signal.aborted) {
        setFeedback(
          resolvedSettings.provider === "ollama"
            ? `Cannot connect to Ollama at ${resolvedSettings.baseUrl.trim() || "the configured URL"}`
            : "Invalid API key or the selected model is unavailable",
        );
      }
    } finally {
      controller.current = null;
      if (!request.signal.aborted) setTesting(false);
    }
  }

  function save() {
    try {
      saveSettings(resolvedSettings);
      onClose();
    } catch {
      setFeedback(
        "Could not save browser settings. Check browser storage permissions and try again.",
      );
    }
  }

  const canTest =
    resolvedSettings.provider === "ollama"
      ? Boolean(resolvedSettings.baseUrl.trim())
      : Boolean(resolvedSettings.apiKey.trim() && resolvedSettings.model);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto overscroll-contain sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Appearance and your AI provider, on this browser.
          </DialogDescription>
        </DialogHeader>

        <FieldSet>
          <FieldLegend variant="label">Appearance</FieldLegend>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="settings-theme">Theme</FieldLabel>
            <Select
              items={themes}
              value={theme ?? "system"}
              onValueChange={(value) => {
                if (value) setTheme(value);
              }}
            >
              <SelectTrigger id="settings-theme" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {themes.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldSet>

        <Separator />

        <FieldSet disabled={testing}>
          <FieldLegend variant="label">AI Provider</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="settings-provider">Provider</FieldLabel>
              <Select
                items={aiProviders}
                value={settings.provider}
                onValueChange={(value) => {
                  if (value) selectProvider(value as AIProviderId);
                }}
              >
                <SelectTrigger id="settings-provider" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {aiProviders.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                {providerDescriptions[settings.provider]}
              </FieldDescription>
            </Field>

            {isCloudSettings(settings) ? (
              <>
                <Field>
                  <FieldLabel htmlFor="settings-api-key">API Key</FieldLabel>
                  <Input
                    id="settings-api-key"
                    name="api-key"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={keyInput}
                    placeholder={
                      settings.apiKey && !removeKey
                        ? "Key saved · enter a replacement"
                        : `Enter your ${settings.provider === "openai" ? "OpenAI" : "Anthropic"} API key`
                    }
                    onChange={(event) => {
                      setKeyInput(event.target.value);
                      setFeedback("");
                    }}
                  />
                  <FieldDescription>
                    Stored only in this browser. OpenMock does not persist API
                    keys on its server.
                  </FieldDescription>
                  {settings.apiKey && !removeKey ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRemoveKey(true);
                        setKeyInput("");
                        setFeedback("");
                      }}
                    >
                      Remove saved key
                    </Button>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="settings-model">Model</FieldLabel>
                  <Select
                    items={
                      settings.provider === "openai"
                        ? openAIModels
                        : anthropicModels
                    }
                    value={settings.model}
                    onValueChange={(value) => {
                      if (value) {
                        setSettings({ ...settings, model: value });
                        setFeedback("");
                      }
                    }}
                  >
                    <SelectTrigger id="settings-model" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {(settings.provider === "openai"
                          ? openAIModels
                          : anthropicModels
                        ).map(({ value, label }) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="settings-remember">
                    Remember API key
                  </FieldLabel>
                  <Switch
                    id="settings-remember"
                    checked={settings.rememberApiKey}
                    onCheckedChange={(rememberApiKey) =>
                      setSettings({ ...settings, rememberApiKey })
                    }
                    size="sm"
                  />
                </Field>
                <p className="text-xs leading-5 text-muted-foreground">
                  {settings.rememberApiKey
                    ? "Saved on this browser until you remove it. Use only on a trusted device."
                    : "Kept for this tab’s browser session, including refreshes."}
                </p>
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="settings-ollama-url">
                    Server URL
                  </FieldLabel>
                  <Input
                    id="settings-ollama-url"
                    inputMode="url"
                    spellCheck={false}
                    value={settings.baseUrl}
                    onChange={(event) => {
                      setSettings({
                        ...settings,
                        baseUrl: event.target.value,
                        model: "",
                      });
                      setOllamaModels([]);
                      setFeedback("");
                    }}
                  />
                  <FieldDescription>
                    Requests go from this browser to your Ollama server. Ollama
                    must allow this site through CORS.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="settings-model">Model</FieldLabel>
                  <Select
                    items={ollamaModels.map((model) => ({
                      value: model,
                      label: model,
                    }))}
                    value={settings.model}
                    disabled={ollamaModels.length === 0}
                    onValueChange={(value) => {
                      if (value) setSettings({ ...settings, model: value });
                    }}
                  >
                    <SelectTrigger id="settings-model" size="sm">
                      <SelectValue placeholder="Test connection to load models" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ollamaModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}
          </FieldGroup>
        </FieldSet>

        <p role="status" className="text-xs leading-5 text-muted-foreground">
          {testing ? "Testing connection…" : feedback}
        </p>
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <Button
            size="sm"
            variant="outline"
            disabled={testing || !canTest}
            onClick={testConnection}
          >
            Test connection
          </Button>
          <Button
            size="sm"
            disabled={testing || !resolvedSettings.model}
            onClick={save}
          >
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {settings.provider === "ollama"
            ? "Connection testing reads the models installed on your configured Ollama instance."
            : `Connection testing makes a small ${settings.provider === "openai" ? "OpenAI" : "Anthropic"} request. Provider usage charges may apply.`}
        </p>
      </DialogContent>
    </Dialog>
  );
}
