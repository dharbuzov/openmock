# Local Voice implementation

## Files added

- `Dockerfile`, `.dockerignore`, and `compose.yaml`: separate application and CPU
  Speech containers, loopback ports, and persistent model volume.
- `services/speech/app.py`, `engines.py`, `requirements.txt`, and `Dockerfile`:
  minimal HTTP service and lazy faster-whisper/Kokoro adapters.
- `src/lib/voice/local-speech.ts`: direct browser HTTP adapters and independent
  speech configuration.
- `src/lib/voice/sentence-buffer.ts`, `audio-queue.ts`, and `speech-stream.ts`:
  sentence buffering, continuous Web Audio scheduling, serial synthesis concurrent
  with LLM generation, cancellation, and development-only latency milestones.
- `tests/lib/voice/local-speech.test.mjs`,
  `tests/components/local-voice.test.mjs`,
  `tests/services/speech/test_api.py`, and `tests/services/speech/requirements.txt`:
  mocked adapter, lifecycle, and HTTP contract coverage.
- `docs/local-voice.md` and this report.
- `tests/lib/voice/speech-stream.test.mjs` and `tests/voice-browser-smoke.mjs`:
  pipeline/cancellation coverage and optional actual Chrome/Kokoro latency check.

## Files modified

- `src/lib/voice/stt.ts` and `tts.ts`: explicit asynchronous speech contracts.
- `src/lib/settings/storage.ts`: independent speech preferences using existing
  browser storage; changing LLM providers preserves speech configuration.
- `src/components/settings-dialog.tsx`: existing fields for speech URL and voice.
- `src/components/use-interview-voice.ts`: MediaRecorder, local transcription,
  Kokoro playback, cancellation, microphone cleanup, and graceful failure.
- `src/components/ai-interviewer.tsx`: transcription fills the editable draft;
  Send remains the single text execution path. Existing partial message snapshots
  feed speech during generation; final text and interview state are unchanged.
- `src/components/interview-controls-context.tsx`: recording/audio capability
  detection and independent interviewer playback. Setup and room sessions have
  one interaction model: type or record speech to compose a text answer.
- `tests/all.test.mjs`, `tests/components/ai-interviewer.test.mjs`,
  `interview-controls.test.mjs`, and `interview-setup.test.mjs`: register new tests
  and replace obsolete browser recognition expectations.
- `next.config.ts`: standalone Docker output.
- `.dependency-cruiser.cjs`: enforce engine independence from speech.
- `.env.example`, `.gitignore`, and `README.md`: speech configuration and setup.
- Removed `src/lib/voice/browser.ts`, which used browser speech recognition.

## Architecture and validation

The engine and AI provider implementation are unchanged. The runner also accepts
an opening turn with no candidate message, using the same provider and streaming
path. The interviewer prompt owns the definition-aware opening; it cannot advance
the stage or create candidate observations. The opening is saved in the session.
The header and composer share one recording state in the controls context.
Speech is an
adapter at the interview UI boundary. Audio goes directly from the browser to
Speech; text goes through the existing configured LLM provider. No Next.js audio
proxy or inference code is introduced. Browser recognition and synthesis APIs
are removed. Sentence-level TTS pipelining uses complete small WAV responses;
Realtime conversation, VAD, partial STT, and streaming bytes within a WAV remain deferred.

Validation: `npm run check` passes (171 tests, TypeScript, ESLint, and dependency
boundaries). There is one pre-existing unused-variable lint warning in
`tests/lib/problems/schema.test.mjs`. Eight Python HTTP contract tests pass with
mocked engines. Production build, Compose configuration, and formatting checks
pass. Python test dependencies were installed temporarily for verification and
removed afterward.

Both Docker images now build, and the running containers have been updated.
Real CPU Kokoro synthesis returns browser-playable WAV. A concurrent-request
smoke check received four 429 responses followed by two successful 200 audio
responses through the browser adapters. Busy requests now retry up to twelve
times with cancellable waits and honor the service's Retry-After header;
repeated Retry audio clicks reuse pending synthesis. Failed speech chunks are
skipped without invalidating the interview.

An actual headless Chrome/Kokoro test with a deterministic text stream measured
first chunk submission at 241 ms, first WAV received at 904 ms, and first Web Audio
playback scheduled at 908 ms from first message text. Text generation continued
until about four seconds. Decode/scheduling took 3–4 ms. This validates the
pipeline with real audio, not real LLM performance or acoustic speaker latency.

Real Whisper inference, microphone-to-model audio quality, autoplay behavior in
other browsers, and combined model memory remain unverified. No measured RAM figure
or 8 GB performance guarantee is claimed.

## Run and manual verification

Run `docker compose up --build`, then open http://localhost:3000. Later starts use
`docker compose up`. Configure the existing LLM provider independently. Settings
defaults to Local Speech at http://localhost:8001; Whisper uses `base.en` on CPU,
and Kokoro uses `af_heart` unless overridden.

The [Local Voice guide](local-voice.md#manual-checks) provides STT multipart and
TTS JSON curl commands, followed by the full recording → draft → Send → text →
audio interview check. It also covers first-use downloads, persistent model
caches, CORS, microphone permissions, CPU latency, Docker memory, and playback
errors.

Recommended next step: run real Whisper and full browser interview smoke checks,
and record memory after STT, TTS, and alternating turns on representative laptops
before adding realtime conversation.
