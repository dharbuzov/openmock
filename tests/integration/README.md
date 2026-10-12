# Real Ollama interviewer checks

These opt-in checks are separate from `npm test`. They require the configured
local Ollama endpoint and the installed `qwen3:8b` model. An unavailable service
or model fails the run; there is no mock or replacement model.
Use `--model=NAME` to explicitly select another installed model.

```powershell
node tests/integration/ollama-interviewer.mjs --think=false --turns=10 --label=verification
node tests/integration/ollama-interviewer.mjs --think=true --turns=10 --label=verification
node tests/integration/ollama-interviewer.mjs --think=false --turns=10 --active-minutes-per-turn=8 --require-complete=true --label=complete
node tests/integration/ollama-evaluator.mjs
```

The endpoint defaults to OpenMock's `defaultOllamaSettings.baseUrl`. Override
with `--endpoint=http://localhost:11434` when browser settings use another port.
The harness runs the production engine, DSA definition, Two Sum resource,
prompt loader, model factory, provider adapter, SDK parser, and response callback.
It serves actual prompt resources over local HTTP. A temporary SDK middleware
sets the supported `providerOptions.ollama.think` value; inference fetches are
never mocked or rewritten. Streaming matches the interview UI by default;
`--stream=false` exercises the nonstreaming path.

Each run saves sanitized TRACE events, the Ollama version/model/template,
final interview state, and a summary under ignored `logs/ollama-*/` directories.
TRACE includes assembled requests, role order, raw responses and thinking,
completion metadata, parsed turns, and engine decisions. Read the transcript
to assess correctness, role adherence, and stage guidance. Automated success
means generation/parsing completed without a detected echo; it does **not**
certify the reply's technical accuracy or stage behavior.

Replay the full-echo implementation turn from a captured baseline:

```powershell
node tests/integration/ollama-interviewer.mjs --think=false --label=replay --replay=logs/ollama-baseline-think-false-TIMESTAMP/trace.jsonl
node tests/integration/ollama-interviewer.mjs --think=true --label=replay --replay=logs/ollama-baseline-think-false-TIMESTAMP/trace.jsonl
```

Replay preserves the captured definition, conversation, and active elapsed time.
It uses the current production prompt. The model's normal sampling remains
enabled, so repeated runs are behavioral checks rather than deterministic tests.
Fast regression coverage is in `tests/lib/ai/interviewer-echo.test.mjs`; its
injected responses verify boundary behavior, not real-model quality.

The complete-flow run uses a controlled active elapsed clock to exercise every
stage and requires the final stage to close. It is a scheduling check, not a claim
that the fixed candidate script provides realistic responses for every question.
The evaluator harness checks basic Principal evidence, substantial level-specific
evidence, interruption, demonstrated weakness, and a closing turn that must not
ask another question. It records full evidence/results under ignored
`logs/ollama-calibration-*`. Live behavioral failures are intentionally failures;
they must not be reported as successful calibration because JSON parsed.

Production Ollama models receive `providerOptions.ollama.think: false` through
the model factory's default-settings middleware for both interviewer and evaluator,
with strict structured output unchanged. No temperature, sampling, or model context
parameters are changed. The installed v3 provider already defaults to false;
the explicit setting makes the policy reviewable and regression-tested.

Some models cannot disable thinking. Ollama's [thinking documentation](https://docs.ollama.com/capabilities/thinking)
describes `/api/show` → `thinking.values`: false must be supported to disable it.
GPT-OSS exposes low/medium/high rather than an off mode. This provider version
accepts boolean thinking options, so OpenMock does not silently substitute a named
effort level or switch models when disabling thinking is unsupported.

Interviewer context retains full constraints, active stage, approved transition,
workspace, latest candidate turn, recent continuity, and up to 32 deduplicated
observations with their source messages. The request explicitly records reduced
coverage. Stored history and observations are unchanged; evaluation uses all of
them. Application request caps are 64,000 characters for interviewer and 256,000
for evaluator, including schemas at the provider boundary. Essential payloads
that cannot fit fail explicitly instead of truncating workspace or constraints.
These are application caps, not model context-window claims. Use
`interviewerInput(context, system, budget)` for smaller deterministic payloads;
the production boundary still enforces the cap. A model with a smaller window
may require a smaller budget and output reserve; automatic context-window discovery
is not implemented. No `num_ctx` or provider-wide token limit is assumed.

`LLM_CONTEXT_SIZE` logs serialized input characters and an approximate characters/4
token estimate, including the response schema. `INTERVIEW_CONTEXT` reports omitted
history and observation counts. Existing completion logs record actual provider
usage when available; estimates are not billing or tokenizer-exact measurements.
