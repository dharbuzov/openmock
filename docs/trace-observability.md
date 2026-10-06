# Interview TRACE observability

Set `LOG_LEVEL=trace` before starting Next.js. Restart development or rebuild
production assets after changing it: `next.config.ts` inlines the same level for
the browser. Existing Pino console/file destinations are unchanged. The interview,
BYOK LLM, and speech client run in the browser, so their logs appear in the browser
console; Node `LOG_TO_FILE` does not collect browser logs. No collector was added.

INFO records lifecycle, stage transitions and connection tests. DEBUG records
operations, IDs, endpoint/method/status, sizes, token usage and durations. TRACE
adds full content and diagnostic bodies. Select a `turnId` to follow one candidate
interaction; `interviewId` identifies its session and `requestId` distinguishes
provider and HTTP calls. Recorded answers and draft dictation retain their context
when sent. Retrying the same candidate message keeps its turn ID with new request
IDs. Speech preview and connection tests are configuration operations, not turns.

## Events and timing

| Event                                                   | Level | Contents                                                                                |
| ------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------- |
| `CANDIDATE_AUDIO_INPUT`                                 | DEBUG | Audio size/type and turn identity; no audio content                                     |
| `STT_REQUEST`, `STT_COMPLETED`                          | DEBUG | Endpoint, audio size/type, transcript length, elapsed time                              |
| `STT_RESPONSE`                                          | TRACE | Entire speech service JSON, including transcript and available metadata                 |
| `CANDIDATE_INPUT`                                       | TRACE | Complete submitted answer, opening/retry flags                                          |
| `INTERVIEW_STATE_BEFORE`                                | TRACE | Full state, problem, definition and supplied workspace                                  |
| `LLM_STARTED`, `LLM_COMPLETED`, `LLM_REQUEST_COMPLETED` | DEBUG | Call lifecycle, token usage and durations                                               |
| `LLM_REQUEST`                                           | TRACE | System prompt, complete history, generation settings and provider schema/options        |
| `HTTP_REQUEST_BODY`, `HTTP_RESPONSE_BODY`               | TRACE | Exact textual wire bodies, including the full SSE/NDJSON response                       |
| `HTTP_RESPONSE`                                         | DEBUG | Method, endpoint, status, sizes and time to response headers                            |
| `LLM_RAW_RESPONSE`                                      | TRACE | SDK provider result before parsing; ordered provider chunks for streaming               |
| `LLM_PARSED_RESPONSE`, `LLM_PARSE_ERROR`                | TRACE | Validated output, or complete invalid text and parsing diagnostics                      |
| `PARSE_COMPLETED`                                       | DEBUG | SDK final structured-output parsing/validation time                                     |
| `INTERVIEW_DECISION`                                    | TRACE | Model decision and the actual applied decision, including opening constraints           |
| `STAGE_TRANSITION`                                      | DEBUG | Explicit previous/next stage; an INFO lifecycle event also records it                   |
| `INTERVIEW_STATE_AFTER`                                 | TRACE | Full resulting state and stage information                                              |
| `ENGINE_COMPLETED`                                      | DEBUG | Complete runner time, including LLM work                                                |
| `FRONTEND_RESPONSE`                                     | TRACE | The committed interviewer message and state returned to the UI                          |
| `TTS_REQUEST`, `TTS_RESPONSE`                           | TRACE | Complete text/voice; response status, content type, audio byte count and time           |
| `TTS_STARTED`, `TTS_COMPLETED`                          | DEBUG | Text length, endpoint and synthesis lifecycle metadata                                  |
| `Voice latency`                                         | DEBUG | First token, synthesis, audio receipt and playback milestones                           |
| `TURN_COMPLETED`                                        | INFO  | Time from submission/STT start to final text commit and queued TTS synthesis completion |

Durations overlap: engine time includes LLM/parsing work, and streamed TTS can
start before generation finishes. `TURN_COMPLETED` measures the turn's critical
path, not a sum of overlapping timings, and does not wait for audible playback to
finish. For voice-off turns it ends at the final text commit. Dictation review
and retry delays belong to the same interaction timeline. Cancelled or failed
generation does not emit a successful completion event.

Streaming wire-body observation reads a cloned response independently, so its
complete-body event can appear after parsed output or frontend commit. HTTP and
SDK result events are different representations: the former is the provider's
original wire body; the latter is the AI SDK provider result before structured
parsing. This intentionally exposes differences between these boundaries. Speech
payloads are logged once by STT/TTS-specific events rather than duplicated by a
generic HTTP body logger. Audio/binary buffers are represented only by size/type.

Errors include component, operation, correlation context, duration, and sanitized
messages/stack frames. HTTP status and endpoint are recorded at the transport
boundary, including complete textual provider error bodies at TRACE. TRACE also
preserves parser exception text and validation details that lower-level error
logs omit. No Authorization/Cookie headers are logged by the wire observer.
Credential fields, recognizable secrets, and active provider keys echoed anywhere
in content are redacted. Error and payload logging is guarded so sink/serialization
failures cannot change a request result. Full-body observation and stream payload
collection are enabled only at TRACE.

## Complete example

[trace-example.jsonl](trace-example.jsonl) is a full, untruncated capture generated
by the integration test using mock Whisper, Ollama and Kokoro HTTP responses. It
contains the real configured prompt, history, structured schema, raw wire/model
responses, parsed decision, state transition, final response and speech metadata
under one `turnId`. It is an illustrative fixture, not a live provider session.

To regenerate it in PowerShell:

```powershell
$env:OPENMOCK_TRACE_EXAMPLE_FILE = 'docs/trace-example.jsonl'
node tests/lib/logging/trace-pipeline.test.mjs
Remove-Item Env:OPENMOCK_TRACE_EXAMPLE_FILE
```

## Implementation files

| Files                                                                                                     | Change                                                                                |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/lib/logging/logger.ts`, `src/lib/logging/sanitize.ts`                                                | Nonthrowing Pino boundary, TRACE diagnostic errors, secret redaction, binary omission |
| `src/lib/logging/turn.ts`                                                                                 | Explicit per-interaction correlation context                                          |
| `src/lib/ai/logging.ts`, `src/lib/ai/model.ts`                                                            | SDK generation/stream/parsing and textual wire-body observation                       |
| `src/lib/ai/provider.ts`, `src/lib/ai/evaluation.ts`                                                      | Correlated interview/evaluation calls and level-specific payloads                     |
| `src/lib/ai/prompt-loader.ts`, `src/lib/ai/prompts.ts`                                                    | Propagate turn context to prompt-loading failures                                     |
| `src/lib/ai/ollama.ts`                                                                                    | Connection test transport/lifecycle logging                                           |
| `src/lib/interview/runner.ts`                                                                             | Before/after states, decisions, transitions, timings and errors                       |
| `src/lib/voice/local-speech.ts`, `src/lib/voice/speech-stream.ts`                                         | STT/TTS observability, correlated latency and synthesis completion                    |
| `src/components/ai-interviewer.tsx`, `src/components/use-interview-voice.ts`                              | Carry context from dictation/submission to frontend commit and speech                 |
| `src/components/settings-dialog.tsx`, `src/app/api/interview/route.ts`                                    | Provider/speech connection events and interview start                                 |
| `tests/lib/logging/trace-pipeline.test.mjs`, `tests/lib/logging/logging.test.mjs`                         | Full streamed/nonstreamed pipeline, content/redaction/binary and failing-sink checks  |
| `tests/ai-sdk.test.mjs`, `tests/lib/voice/speech-stream.test.mjs`                                         | Updated TRACE semantics and correlated DEBUG timing checks                            |
| `tests/components/ai-interviewer.test.mjs`, `tests/components/local-voice.test.mjs`, `tests/all.test.mjs` | Update test harnesses and register observability tests                                |
| `README.md`, `docs/local-voice.md`, `docs/trace-observability.md`, `docs/trace-example.jsonl`             | Level semantics, runtime behavior, file inventory and captured example                |

No prompts, provider payloads, settings persistence, or state-machine rules changed.
