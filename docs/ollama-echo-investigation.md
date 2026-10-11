# Real Ollama echo investigation — 2026-10-11

## Finding and evidence

The echo originates in Qwen3's generated JSON, before OpenMock parsing or state
application. It is interviewer-role drift during native structured generation.
The previous role clarification alone did not prevent it. The prompt lacked a
complete explicit output contract separating spoken interviewer text, evidence,
and readiness; the active stage was supplied in user-context data rather than
restated in the next-turn system task. The successful prompt comparison supports
this diagnosis; it does not establish a defect inside Ollama's decoder.

Environment: real Ollama `0.23.2`, `http://localhost:11434`, `qwen3:8b`, Q4_K_M,
model digest `500a1f067a9f782620b40bee6f7b0c89e17ae61f686b92c24933e4ca4b2b8b41`.
The loaded model's runtime context is 4,096 tokens; model metadata advertises
40,960. No replacement model or mocked inference was used.

On baseline candidate turn 5, Ollama returned this exact candidate sentence in
the structured `message` field:

> I will implement a single pass in Java: look up the complement, return the earlier index and current index if present, otherwise insert the current value and index.

The raw completion had `done_reason: "stop"`, 2,754 prompt tokens, 340 generated
tokens, and no thinking. `LLM_PARSED_RESPONSE`, `INTERVIEW_DECISION`, and
`INTERVIEW_STATE_AFTER` retained the same text. The wire roles were
`system, user(context), assistant, user(candidate), ... assistant, user(candidate)`.
The inspected chat template places each message under its corresponding role
and opens an assistant turn after the final user message.

With `think: true`, baseline turn 3 returned only the candidate's question:
“Should I check before inserting the current element?” The wire response included
7,566 characters of separate thinking and ended normally. Later replies repeated
that earlier question and the earlier hash-map sentence. The adapter separates
`message.thinking` from `message.content`; the copied text was in **content**.
Toggling thinking alone therefore did not resolve the bug.

Flow inspected: frontend `send` → `acceptCandidateMessage` → session commit →
`processCandidateMessage` → engine planning/context → global prompt + definition
→ candidate/user and interviewer/assistant history → Ollama SDK `/api/chat`
→ structured parsing → `applyInterviewTurn(turn.message)` → session persistence
and display callback → rendering `message.content`. No candidate-text fallback
or role reassignment was found. Streaming drafts are held until validation and
commit. The real harness exercises this engine/provider/callback path in Node;
browser rendering and local-storage behavior were inspected and covered by fast
tests, rather than exercised in a live browser session.

## Changes

- `content/prompts/interviewer.md`: explicitly define every output field and keep
  spoken replies separate from candidate answers, evaluator descriptions, and
  evidence.
- `src/lib/ai/prompts.ts`: append a next-turn system task with the engine's active
  stage and approved transition. No stage state or transition logic is added.
- `tests/lib/ai/interviewer-echo.test.mjs`: 16 fast cases cover the original
  brute-force exchange, hash-map sentence, candidate question, and reproduced
  implementation echo; verify roles, ordered history, separate thinking, raw vs
  parsed output, callbacks, and persistence in both response modes.
- `tests/lib/ai/prompt-resources.test.mjs`: check task ordering and engine-supplied
  destination/transition across interview definitions.
- `tests/integration/ollama-interviewer.mjs` and its README: opt-in real-model
  harness, thinking comparison, sanitized traces, and captured-state replay.

Provider defaults, OpenAI/Anthropic adapters, definitions, schema validation, and
engine transition ownership remain intact. There is no response rewriting,
keyword filtering, retry-to-hide-echo behavior, or Two Sum logic in production.

## Real results

Each full run includes one real opening plus ten candidate turns: brute force,
optimization, candidate questions, implementation, duplicate/negative-value edge
cases, overflow, complexity, and alternatives. Both thinking values were verified
in actual wire requests using supported `providerOptions.ollama.think`.

| Run | Non-echo candidate replies | Echo failures | Mean candidate latency |
| --- | ---: | ---: | ---: |
| Baseline, thinking OFF | 9/10 | 1 full | 8.9 s |
| Baseline, thinking ON | 7/10 | 3 current/older partial or full | 26.2 s |
| Final prompt, thinking OFF | 10/10 | 0 | 6.5 s |
| Final prompt, thinking ON | 10/10 | 0 | 22.3 s |

Both final captured-state replays also produced interviewer replies with no echo:
OFF/nonstreaming and ON/streaming. Final verification therefore passed **22
candidate/replay calls, failed 0 echo checks**, plus two successful openings,
with 25 real provider requests including an engine-approved regeneration.
These counts certify generation/parsing and echo checks, not all semantic quality.
Baseline ON counts include transcript review of older-message echoes that the
initial current-message-only detector missed; the harness now checks history too.

Thinking ON approved the implementation transition on candidate turn 4 and
regenerated an appropriate entry question through the engine. OFF reached
implementation through the existing follow-up safeguard on turn 8. Both modes
discussed complexity while still in implementation; the runs did not exercise
every destination stage. Defaults were not changed based on these samples.

`npm run check` passed: **250 tests**, lint (six existing warnings), typecheck, and
dependency boundaries. Targeted formatting and `git diff --check` passed.

## Evidence artifacts and limitations

Each directory below contains `trace.jsonl`, `summary.json`, `environment.json`,
and `interview.json` under ignored local `logs/`:

- Baseline OFF: `logs/ollama-baseline-think-false-1791744916437/`
- Baseline ON: `logs/ollama-baseline-think-true-1791745020320/`
- Final OFF: `logs/ollama-fixed-think-false-1791745430822/`
- Final ON: `logs/ollama-fixed-think-true-1791745512905/`
- Final replay OFF: `logs/ollama-final-replay-think-false-1791745770387/`
- Final replay ON: `logs/ollama-final-replay-think-true-1791745788367/`

Existing TRACE sanitation protects secrets. Requests, raw streamed content,
thinking, finish metadata, parsed responses, and stage decisions are retained.

The reproduced echo regression is resolved in these actual-model samples.
Qwen3 still sometimes gives unsolicited hints, asks already-covered questions,
and announces an unapproved next stage—particularly with thinking OFF and when
replaying an already-drifted history. The engine never accepts those verbal
announcements as state transitions. This is not a claim that all interview quality
or stage-following problems are solved. Normal model sampling is nondeterministic;
twenty fresh candidate turns plus two replays cannot guarantee zero future echoes.
Longer sessions also need separate evaluation at the actual 4,096-token context.
