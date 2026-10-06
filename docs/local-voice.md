# Local Voice

Whisper converts recorded speech to candidate text. Kokoro converts sentence-sized
interviewer text chunks to browser audio while the LLM continues generating.
The interview engine still accepts text;
speech providers and the configured LLM provider are independent.

## Start

```sh
docker compose up --build
```

Open http://localhost:3000. Later starts can use `docker compose up`.
OpenMock and Speech run in separate containers; CUDA and NVIDIA Container Toolkit
are not required. To use a development Next.js server instead, run
`docker compose up --build speech` and `npm run dev`.

In Settings, Local Speech defaults to `http://localhost:8001`. This URL is resolved
by the browser, so use localhost rather than the Compose hostname `speech`.
The URL and voice override are saved in browser preferences independently of
the AI provider. Leave voice blank to use the service's `KOKORO_VOICE`.

Configure Ollama, OpenAI, or Anthropic as usual. Compose does not install or
configure an LLM. A locally installed Ollama remains reachable directly from the
browser at its configured URL, and must allow the OpenMock origin through CORS.

## Models and resources

The defaults are `WHISPER_MODEL=base.en`, CPU int8, four CPU threads, and
`KOKORO_VOICE=af_heart` (American English). Set these variables in `.env` or your
shell, then recreate Speech with `docker compose up -d --force-recreate speech`.
For faster transcription use `tiny.en`; for better accuracy try `small.en`.
Settings does not change the server's Whisper model.

The first request for each capability loads its model and may download weights.
The named Compose volume `speech-models` is mounted at `/models`: Whisper weights
live in `/models/whisper`, Hugging Face Kokoro/voice assets in `/models/huggingface`,
and supporting caches in `/models/cache`. Restarts reuse these files. Images and
model downloads need internet access initially; cached inference is local.
Do not run `docker compose down -v` if you want to preserve model caches.
English NLP assets and CPU PyTorch are installed when building the image.

Models load lazily and remain resident after use. Only one inference runs at a
time; a concurrent request receives 429 instead of joining an unbounded queue.
The browser retries 429 responses up to twelve times with cancellable waits of
one to five seconds. Muting voice, ending the interview, or starting another
turn cancels pending playback retries. Other errors are not automatically retried.
Recordings are limited to two minutes / 10 MiB and synthesized text to 8000
characters. Each speech chunk returns a complete in-memory 24 kHz WAV. This is
sentence-level pipelining, not streaming bytes within one WAV or partial STT.
Text chunks flush on sentence punctuation/newlines or around 160 characters at
word boundaries. One browser AudioContext schedules decoded chunks back-to-back,
so Kokoro synthesizes the next chunk while queued speech plays.

Partial interviewer text is used only for early speech; the existing final
validated turn remains the sole source for the transcript, storage, and evaluation.
If LLM generation fails, pending audio is cancelled. Speech already heard cannot
be retracted. A failed speech chunk is skipped without failing the interview.

Actual combined resident memory has not yet been measured on this environment.
No RAM or latency guarantee is claimed for 8 GB laptops. Measure the service
after an idle start, first STT, first TTS, and repeated alternating turns:

```sh
docker stats --no-stream
```

Record Speech's memory and peak during a two-minute recording and a long TTS
response. Budget Docker and the LLM separately; an 8B Ollama model can consume
much more memory than speech. Approximate model download sizes are omitted
because the selected upstream revisions and supporting assets vary.

The supplied image is CPU-only. Faster-whisper supports optional NVIDIA inference,
but GPU deployment needs a separate CUDA-capable image, compatible cuBLAS/cuDNN,
GPU access, and `WHISPER_DEVICE=cuda`; simply changing the environment variable
in this CPU image is insufficient. GPU deployment is not validated in this slice.
`auto` in the service falls back to CPU. Kokoro uses CPU in this implementation.

## Manual checks

These examples use curl; on Windows use `curl.exe`. Use a short speech recording
such as WAV, WebM, Ogg, or MP4 for STT:

```sh
curl http://localhost:8001/health
curl -f -F "audio=@answer.wav" http://localhost:8001/stt/transcribe
curl -f -H "Content-Type: application/json" -d '{"text":"Why would you use Kafka here?","voice":"af_heart"}' http://localhost:8001/tts/synthesize --output interviewer.wav
```

For Windows PowerShell, write the JSON to a file and use `--data-binary @request.json`
if your shell changes quotes. STT should return `{ "text": "...", "language": "en" }`.
Open `interviewer.wav` in an audio player to verify TTS. Health returns per-capability
`ready` and `status` (`not-loaded`, `working`, `ready`, or `error`); `not-loaded`
is expected before first use. The Docker healthcheck checks HTTP reachability,
not whether lazy models have already been loaded.

For the full flow:

1. Configure an AI provider and start an interview. The interviewer generates
   the first question from the definition, current stage, problem, and selected
   Practice/Mock mode. Wait for the opening turn before answering.
2. Click the microphone, allow permission, speak, and click Stop.
3. Wait for Transcribing; review/edit the resulting candidate draft.
4. Click Send. This is exactly the typed-answer submission path.
   Alternatively, use the recording bar's Send arrow to transcribe and submit
   directly. Cancel (X or Escape) discards audio and preserves your typed draft
   without calling Whisper. The monochrome waveform reflects microphone volume.
   Keyboard: Ctrl+M (⌘M on macOS) starts recording, or stops it for review.
   Enter during recording transcribes and sends; Escape cancels. Repeated Enter
   or microphone shortcuts during transcription are ignored. In the normal
   composer, Enter sends and Shift+Enter inserts a new line.
   The header uses the same recording state: shortcut hint when idle,
   Listening while recording, and Transcribing while Whisper runs.
   The microphone shortcut works across the room, including the diagram workspace,
   and matches the physical M key on non-Latin layouts. Starting recording stops
   any interviewer audio. Development logs named `Microphone shortcut detected`
   include the key/code, recording state, selected action, and ignored reason;
   these diagnostics are disabled in production.
5. Confirm audio begins during the streamed response, and the complete final
   interviewer text remains visible unchanged.
6. Disable interviewer voice, then send another answer. No TTS request should appear.
7. Stop Speech (`docker compose stop speech`), then try dictation and send a typed
   answer. Speech errors should appear while the text interview remains usable.

Frontend tests mock Speech and browser recording/playback:

```sh
npm run check
node --test tests/components/local-voice.test.mjs tests/lib/voice/local-speech.test.mjs
```

The Speech HTTP contract tests also mock inference and require only small Python
test dependencies (use a virtual environment):

```sh
python -m pip install -r tests/services/speech/requirements.txt
python tests/services/speech/test_api.py
```

## Privacy and troubleshooting

Recorded audio travels directly from the browser to the configured local Speech
URL, never through the OpenMock backend. The service does not persist recordings,
log raw audio or transcripts, or send audio to an LLM. The resulting text follows
the existing interview provider and logging policies. `LOG_LEVEL=trace` exposes
full transcripts and TTS text in the browser's diagnostic logs; DEBUG records only
speech lifecycle metadata. No logging level dumps binary audio. Local Speech does
not make a cloud-configured LLM local.

Ports bind to loopback only. CORS allows localhost:3000 and 127.0.0.1:3000 by
default; set `SPEECH_ALLOWED_ORIGINS` to the exact browser origin for another
local port. Keep the configured endpoint on a trusted local machine. Do not
publish the unauthenticated service to the internet.

- Microphone permission: allow access in browser site settings. Recording requires
  a secure context (localhost or HTTPS) and MediaRecorder support.
- Service unavailable: check `docker compose ps`, `/health`, URL, and exact CORS
  origin. The text composer still works. Mixed HTTP/HTTPS or browser local-network
  permissions may block remote pages; use the local OpenMock page.
- Slow CPU transcription: use shorter answers or `tiny.en`, close other CPU-heavy
  tasks, and tune `SPEECH_CPU_THREADS`. Requests time out after three minutes.
- Model download: allow Hugging Face access and check `docker compose logs speech`.
  Failed first-use downloads can be retried; existing weights remain cached.
- Docker memory: increase Docker Desktop's allocation or use `tiny.en` and a smaller
  LLM. Check actual memory with `docker stats`; do not assume speech is the largest
  consumer.
- Playback blocked: browsers may require a user gesture. Use Retry audio. Text
  remains visible even if synthesis or playback fails.
- Voice failure: use an available American English voice such as `af_heart` or
  `am_adam`. Arbitrary voice paths, other languages, and mixtures are rejected.

Realtime conversation, VAD, automatic end-of-turn detection, streaming audio bytes, barge-in,
WebRTC, and cloud speech providers are deferred. The next step is a real CPU
smoke test and resource baseline across representative laptops before extending
conversation behavior.

## Latency measurement

At DEBUG or TRACE (including production), the existing browser logger emits metadata-only
`Voice latency` events once per turn for LLM first token, TTS first chunk submitted,
TTS first audio received, and first audio playback. `elapsedMs` is relative to Send;
`sinceFirstTokenMs` uses the first nonempty message snapshot from the existing SDK
partial-output stream. It excludes JSON envelope tokens. No speech text is logged.
INFO-level builds emit no voice timing events. Each event carries the same
`interviewId` and `turnId` as the engine, STT and TTS calls.

The optional `tests/voice-browser-smoke.mjs` requires Playwright and Chrome outside
application dependencies. With OpenMock and Speech running, invoke
`node tests/voice-browser-smoke.mjs` in an environment with Playwright, or supply
its module path as the first argument. The test uses actual browser decoding and
Kokoro with a deterministic timed text stream, without LLM credentials.

On this machine, a warm CPU smoke check measured chunk submission at 241 ms,
WAV received at 904 ms, and playback scheduled at 908 ms from the first message
token, before the test stream completed at about 4 seconds. Browser decode/schedule
took 3–4 ms. Warm 45-character HTTP synthesis took 531–751 ms versus 1758–2051 ms
for 133 characters; WAV transfer added 2–5 ms. These are observations, not latency
guarantees. Cold model initialization, actual LLM speed, CPU contention, browser
autoplay policy, and audio-device latency can add delay. Scheduled playback
timings measure the Web Audio timeline, not acoustic output at the speakers.
