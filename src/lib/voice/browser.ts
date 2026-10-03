export interface BrowserRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export function recognitionConstructor():
  (new () => BrowserRecognition) | undefined {
  if (typeof window === "undefined") return undefined;
  const browser = window as unknown as {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
export function finalTranscript(
  event: Parameters<NonNullable<BrowserRecognition["onresult"]>>[0],
): string {
  const parts: string[] = [];
  for (let index = event.resultIndex; index < event.results.length; index++) {
    const result = event.results[index];
    if (result.isFinal) parts.push(result[0].transcript);
  }
  return parts.join(" ").trim();
}
