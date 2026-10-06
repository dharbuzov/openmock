"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { CircleAlert, CircleCheck, PlayIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import {
  readProviderSettings,
  saveSettings,
  readSpeechSettings,
  saveSpeechSettings,
} from "@/lib/settings/storage";
import { LocalKokoro, speechUrl } from "@/lib/voice/local-speech";
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

// American English voices supported by the configured hexgrad/Kokoro-82M model.
const voices = [
  { value: "", label: "Service default" },
  { value: "af_heart", label: "Heart — Female · American" },
  { value: "af_bella", label: "Bella — Female · American" },
  { value: "am_adam", label: "Adam — Male · American" },
  { value: "am_michael", label: "Michael — Male · American" },
];

const providerDescriptions: Record<AIProviderId, string> = {
  openai: "Interview content is sent to OpenAI using your API key.",
  anthropic: "Interview content is sent to Anthropic using your API key.",
  ollama:
    "Local mode — interview content is sent to your configured Ollama server.",
};

type ConnectionState = "idle" | "testing" | "connected" | "error";

function ConnectionTest({
  state,
  error,
  disabled,
  onTest,
  children,
}: {
  state: ConnectionState;
  error: string;
  disabled: boolean;
  onTest: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 pt-4">
      {state === "connected" ? (
        <p
          role="status"
          className="flex items-center gap-1.5 text-xs text-success"
        >
          <CircleCheck className="size-3.5" />
          Connected
        </p>
      ) : null}
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || state === "testing"}
        onClick={onTest}
      >
        {state === "testing" ? <Spinner data-icon="inline-start" /> : null}
        {state === "testing" ? "Testing…" : "Test connection"}
      </Button>
      {children}
      {state === "error" ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Connection failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function AISettingsForm({
  initialSettings,
  onSaved,
  appearance = false,
}: {
  initialSettings: AISettings;
  onSaved: () => void;
  appearance?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState(initialSettings);
  const [speech, setSpeech] = useState(readSpeechSettings);
  const [keyInput, setKeyInput] = useState("");
  const [removeKey, setRemoveKey] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>(
    initialSettings.provider === "ollama" && initialSettings.model
      ? [initialSettings.model]
      : [],
  );
  const [aiProviderConnectionState, setAIProviderConnectionState] =
    useState<ConnectionState>("idle");
  const [aiProviderConnectionError, setAIProviderConnectionError] =
    useState("");
  const [speechConnectionState, setSpeechConnectionState] =
    useState<ConnectionState>("idle");
  const [speechConnectionError, setSpeechConnectionError] = useState("");
  const [saveError, setSaveError] = useState("");
  const testing = aiProviderConnectionState === "testing";
  const controller = useRef<AbortController | null>(null);
  const speechController = useRef<AbortController | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewFeedback, setPreviewFeedback] = useState("");
  const previewController = useRef<AbortController | null>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const previewUrl = useRef<string | null>(null);

  function stopPreview() {
    previewController.current?.abort();
    previewController.current = null;
    previewAudio.current?.pause();
    previewAudio.current = null;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
  }

  useEffect(
    () => () => {
      controller.current?.abort();
      speechController.current?.abort();
      stopPreview();
    },
    [],
  );

  async function previewVoice() {
    if (previewController.current) return;
    const request = new AbortController();
    previewController.current = request;
    setPreviewing(true);
    setPreviewFeedback("");
    try {
      const audio = await new LocalKokoro(speech.baseUrl).synthesize(
        "Hello, I'll be your interviewer today. Let's work through the problem together.",
        { voice: speech.voice, signal: request.signal },
      );
      if (request.signal.aborted) return;
      previewUrl.current = URL.createObjectURL(audio);
      const player = new Audio(previewUrl.current);
      previewAudio.current = player;
      player.onended = player.onerror = () => {
        if (request.signal.aborted) return;
        if (player.error) setPreviewFeedback("Could not play voice preview.");
        stopPreview();
        setPreviewing(false);
      };
      await player.play();
    } catch {
      if (!request.signal.aborted) {
        stopPreview();
        setPreviewing(false);
        setPreviewFeedback(
          "Could not preview voice. Check your Local Speech URL and service.",
        );
      }
    }
  }

  const voiceOptions = voices.some(({ value }) => value === speech.voice)
    ? voices
    : [...voices, { value: speech.voice, label: "Saved voice" }];

  const resolvedSettings: AISettings = isCloudSettings(settings)
    ? {
        ...settings,
        apiKey: keyInput.trim() || (removeKey ? "" : settings.apiKey),
      }
    : settings;

  function resetAIConnection() {
    controller.current?.abort();
    controller.current = null;
    setAIProviderConnectionState("idle");
    setAIProviderConnectionError("");
  }

  function resetSpeechConnection() {
    speechController.current?.abort();
    speechController.current = null;
    setSpeechConnectionState("idle");
    setSpeechConnectionError("");
  }

  async function testSpeechConnection() {
    if (speechController.current) return;
    const request = new AbortController();
    speechController.current = request;
    setSpeechConnectionState("testing");
    setSpeechConnectionError("");
    try {
      const response = await fetch(speechUrl(speech.baseUrl, "/health"), {
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
      });
      if (!response.ok) throw new Error("Speech service unavailable");
      const health = await response.json();
      if (request.signal.aborted) return;
      // Models load on first use; not-loaded and working are healthy states.
      const capabilities = [health?.stt, health?.tts];
      if (
        capabilities.some(
          (capability) =>
            !capability ||
            !["ready", "not-loaded", "working"].includes(capability.status),
        )
      ) {
        setSpeechConnectionState("error");
        setSpeechConnectionError(
          "Speech recognition or voice playback is unavailable. Check the speech service and retry.",
        );
        return;
      }
      setSpeechConnectionState("connected");
    } catch {
      if (!request.signal.aborted) {
        setSpeechConnectionState("error");
        setSpeechConnectionError(
          "Could not reach the configured speech service. Check the Local Speech URL and that the service is running.",
        );
      }
    } finally {
      if (speechController.current === request) speechController.current = null;
    }
  }

  function selectProvider(provider: AIProviderId) {
    if (provider === settings.provider) return;
    resetAIConnection();
    setSettings({
      ...readProviderSettings(provider),
      interviewerVoiceEnabled: settings.interviewerVoiceEnabled,
    });
    setKeyInput("");
    setRemoveKey(false);
    if (provider === "ollama") {
      const saved = readProviderSettings("ollama");
      setOllamaModels(saved.model ? [saved.model] : []);
    }
  }

  async function testConnection() {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setAIProviderConnectionState("testing");
    setAIProviderConnectionError("");
    try {
      if (resolvedSettings.provider === "ollama") {
        const { listOllamaModels } = await import("@/lib/ai/ollama");
        const models = await listOllamaModels(resolvedSettings, request.signal);
        if (request.signal.aborted) return;
        if (models.length === 0) {
          setOllamaModels([]);
          setSettings({ ...resolvedSettings, model: "" });
          setAIProviderConnectionState("connected");
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
      if (!request.signal.aborted) setAIProviderConnectionState("connected");
    } catch {
      if (!request.signal.aborted) {
        setAIProviderConnectionState("error");
        setAIProviderConnectionError(
          resolvedSettings.provider === "ollama"
            ? "Could not connect to the configured Ollama server. Check the Server URL and that Ollama is running."
            : "Could not connect to the provider. Check your API key and selected model.",
        );
      }
    } finally {
      if (controller.current === request) controller.current = null;
    }
  }

  function save() {
    try {
      speechUrl(speech.baseUrl, "/health");
      saveSpeechSettings({
        baseUrl: speech.baseUrl.trim(),
        voice: speech.voice.trim(),
      });
      saveSettings(resolvedSettings);
      onSaved();
    } catch {
      setSaveError(
        "Could not save settings. Check the local speech URL and browser storage permissions.",
      );
    }
  }

  const canTest =
    resolvedSettings.provider === "ollama"
      ? Boolean(resolvedSettings.baseUrl.trim())
      : Boolean(resolvedSettings.apiKey.trim() && resolvedSettings.model);

  return (
    <div className="flex flex-col gap-4">
      {appearance && (
        <>
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
        </>
      )}

      <Accordion multiple defaultValue={["speech", "provider"]}>
        <AccordionItem value="speech">
          <AccordionTrigger>Speech</AccordionTrigger>
          <AccordionContent>
            <FieldGroup className="gap-4">
              <Field orientation="horizontal">
                <FieldLabel htmlFor="settings-interviewer-voice">
                  Interviewer voice
                </FieldLabel>
                <Switch
                  id="settings-interviewer-voice"
                  checked={settings.interviewerVoiceEnabled}
                  onCheckedChange={(interviewerVoiceEnabled) =>
                    setSettings({ ...settings, interviewerVoiceEnabled })
                  }
                  size="sm"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="settings-speech-voice">Voice</FieldLabel>
                <div className="flex items-center gap-2">
                  <Select
                    items={voiceOptions}
                    value={speech.voice}
                    onValueChange={(value) => {
                      if (value !== null) {
                        stopPreview();
                        setPreviewing(false);
                        setPreviewFeedback("");
                        setSpeech({ ...speech, voice: value });
                      }
                    }}
                  >
                    <SelectTrigger
                      id="settings-speech-voice"
                      size="sm"
                      className="min-w-0 flex-1"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {voiceOptions.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Preview voice"
                    title="Preview voice"
                    disabled={previewing || !speech.baseUrl.trim()}
                    onClick={previewVoice}
                  >
                    <PlayIcon />
                  </Button>
                </div>
                {previewing || previewFeedback ? (
                  <FieldDescription role="status">
                    {previewing ? "Previewing voice…" : previewFeedback}
                  </FieldDescription>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="settings-speech-url">
                  Local Speech URL
                </FieldLabel>
                <Input
                  id="settings-speech-url"
                  value={speech.baseUrl}
                  inputMode="url"
                  spellCheck={false}
                  onChange={(event) => {
                    stopPreview();
                    setPreviewing(false);
                    setPreviewFeedback("");
                    resetSpeechConnection();
                    setSpeech({ ...speech, baseUrl: event.target.value });
                  }}
                />
              </Field>
            </FieldGroup>
            <ConnectionTest
              state={speechConnectionState}
              error={speechConnectionError}
              disabled={!speech.baseUrl.trim()}
              onTest={testSpeechConnection}
            />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="provider">
          <AccordionTrigger>AI Provider</AccordionTrigger>
          <AccordionContent>
            <FieldSet disabled={testing}>
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
                      <FieldLabel htmlFor="settings-api-key">
                        API Key
                      </FieldLabel>
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
                          resetAIConnection();
                        }}
                      />
                      <FieldDescription>
                        Stored only in this browser. OpenMock does not persist
                        API keys on its server.
                      </FieldDescription>
                      {settings.apiKey && !removeKey ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRemoveKey(true);
                            setKeyInput("");
                            resetAIConnection();
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
                            resetAIConnection();
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
                          resetAIConnection();
                        }}
                      />
                      <FieldDescription>
                        Requests go from this browser to your Ollama server.
                        Ollama must allow this site through CORS.
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
                          if (value) {
                            resetAIConnection();
                            setSettings({ ...settings, model: value });
                          }
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
            <ConnectionTest
              state={aiProviderConnectionState}
              error={aiProviderConnectionError}
              disabled={!canTest}
              onTest={testConnection}
            >
              <FieldDescription>
                {settings.provider === "ollama"
                  ? aiProviderConnectionState === "connected" &&
                    ollamaModels.length === 0
                    ? "No local models found. Install a model in Ollama, then test again."
                    : "Connection testing reads the models installed on your configured Ollama instance."
                  : `Connection testing makes a small ${settings.provider === "openai" ? "OpenAI" : "Anthropic"} request. Provider usage charges may apply.`}
              </FieldDescription>
            </ConnectionTest>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Separator />
      {saveError ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Could not save settings</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={testing || !resolvedSettings.model}
          onClick={save}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export function SettingsDialog({
  initialSettings,
  onClose,
}: {
  initialSettings: AISettings;
  onClose: () => void;
}) {
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
            Appearance, interview preferences, and your AI provider, on this
            browser.
          </DialogDescription>
        </DialogHeader>
        <AISettingsForm
          initialSettings={initialSettings}
          onSaved={onClose}
          appearance
        />
      </DialogContent>
    </Dialog>
  );
}
