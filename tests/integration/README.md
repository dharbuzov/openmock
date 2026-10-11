# Real Ollama interviewer checks

These opt-in checks are separate from `npm test`. They require the configured
local Ollama endpoint and the installed `qwen3:8b` model. An unavailable service
or model fails the run; there is no mock or replacement model.

```powershell
node tests/integration/ollama-interviewer.mjs --think=false --turns=10 --label=verification
node tests/integration/ollama-interviewer.mjs --think=true --turns=10 --label=verification
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
