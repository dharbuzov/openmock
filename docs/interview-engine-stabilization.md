# Interview engine stabilization — 2026-10-12

The engine remains the sole owner of stage transitions. All changes preserve
definition-driven behavior, competency IDs, recommendation values, structured
output, and the shared OpenAI/Anthropic/Ollama boundary. No dependencies or
sampling parameters were changed.

## Confirmed causes and hypotheses

Confirmed from source and regression checks:

- Stage allowances used equal shares even though the definitions reserved much
  more time for coding or architecture than for introductions and wrap-up.
- Interviewer requests included every message and every accumulated observation;
  reference-ID enums also grew with the full transcript.
- Same-turn transition regeneration discarded observations from the unpublished
  source-stage readiness response.
- The DSA definition declared five level IDs without defining their expectations.
- Strong Hire validation permitted required competencies to be unassessed or mixed.
- The installed Ollama provider already defaulted to `think: false`. Missing
  explicit application configuration was a policy/test gap, not proof that thinking
  was previously enabled on the wire.

Real `qwen3:8b` checks confirmed repeated questions, premature verbal stage
announcements despite false readiness, inflated Principal recommendations, and
continuation of technical discussion during final closure. These are behavioral
observations for this model, not proven defects shared by all providers.

Verdict-first structured output may anchor later ratings. Evidence-first ordering
produced better calibration in the observed runs, but stochastic sampling prevents
a causal claim from this small sample. A final task reminder after historical
candidate questions improved the observed closing reply. Prompt compliance and
technical accuracy remain model-dependent.

## Files changed and behavior

| Files                                                                                                           | Change and before/after behavior                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/ai/model.ts`                                                                                           | Explicit Ollama-only default middleware supplies `providerOptions.ollama.think: false`; strict structured output is retained. OpenAI and Anthropic receive no Ollama options.                                                                                                                                                                                                                                          |
| `content/prompts/evaluator.md`, `src/lib/ai/evaluation.ts`                                                      | Separate correctness, selected-level evidence, missed opportunities, and demonstrated weaknesses. Ratings precede the verdict in the schema. Strong Hire rejects any required competency outside positive/strong-positive. Full evaluation evidence is retained, with explicit oversized-input failure.                                                                                                                |
| `content/interviews/dsa.md`                                                                                     | Added observable level expectations; a correct easy solution alone no longer defines the Principal bar. Advanced evidence can still arise through discussion of a simple problem.                                                                                                                                                                                                                                      |
| `content/interviews/{dsa,system-design,behavioral}.md`, `src/lib/interview/{types,definition-schema,engine}.ts` | Optional positive `stagePacing` weights replace equal allocation for authored definitions. Unused time redistributes proportionally. Existing readiness, 50% extension, eight-exchange cap, pause handling, and participation gate remain. Unweighted definitions retain equal-share fallback.                                                                                                                         |
| `src/lib/interview/runner.ts`                                                                                   | Source observations survive destination regeneration provisionally and commit only with the successful destination response. Failed requests leave both stage and evidence uncommitted.                                                                                                                                                                                                                                |
| `src/lib/ai/{prompts,provider,logging}.ts`, `content/prompts/interviewer.md`                                    | Deterministic request construction keeps complete active-stage data, approved transition, constraints, workspace, recent turns, and bounded deduplicated evidence with its source messages. Active-stage evidence is prioritized. Remaining space retains older transcript. Reduced coverage is explicit. Closing turns receive a distinct closure task. Logs record estimated context and actual usage when supplied. |
| `tests/lib/ai/{context,model-options}.test.mjs`                                                                 | Long histories, repeated observations, large workspace/candidate input, small budgets, active-stage retention, source-reference schemas, production stream/nonstream Ollama bodies, provider isolation, and context/usage logs.                                                                                                                                                                                        |
| `tests/lib/interview/{calibration,progression,definition-schema}.test.mjs`, `tests/all.test.mjs`                | Principal calibration invariants, missing versus negative evidence, substantial evidence acceptance, stage weights, short complete DSA flows, provisional evidence preservation, atomic failure, schema validation, and registration. Existing custom-definition fixtures now rename pacing metadata with stage IDs.                                                                                                   |
| `tests/integration/ollama-{interviewer,evaluator}.mjs`                                                          | Explicit installed-model selection, controlled active-clock complete-flow checks, real evaluator scenarios, and a closure check. Inference is never mocked.                                                                                                                                                                                                                                                            |
| `content/interviews/README.md`, `tests/integration/README.md`                                                   | Definition pacing/level authoring, context budgets, estimation limitations, integration commands, and thinking compatibility.                                                                                                                                                                                                                                                                                          |

## Validation

- `npm test`: 272 passed, one existing skipped, zero failed (273 total).
- `npm run typecheck`: passed.
- `npm run lint`: zero errors; six existing warnings.
- `npm run check:boundaries`: passed.
- `git diff --check`: passed.
- Real Ollama 0.40.3, installed `qwen3:8b`, thinking disabled: streamed interviewer
  requests retained structured JSON and usage data. Initial 11-request smoke run
  parsed successfully but exposed behavioral problems; parsing was not counted
  as proof of interview coherence.
- Real calibration fixtures returned Mixed for basic Principal evidence, Strong
  Hire for substantial level-specific evidence, incomplete for no assessment
  opportunity, and No Hire for an explicit correctness violation. The basic
  Principal case was also rerun against the final rating descriptions and remained
  Mixed. Results are in ignored `logs/ollama-calibration-*` directories.
- A fresh final-closure check produced: “Thank you for the discussion. Please
  finish when you're ready for feedback.” Earlier closing failures are preserved
  in logs rather than hidden by the later successful check.
- The final complete-flow run passed: nine real streamed requests, zero failures,
  every DSA stage completed, and a closing statement inviting feedback. It uses a
  controlled active clock; output is in `logs/stabilization-live-complete-final.txt`
  and `logs/ollama-stabilization-final-think-false-1791794513523/`.

Unit tests with injected evaluations verify contracts, not semantic correctness
of an LLM's judgments. Real evaluator fixtures provide the separate behavioral
check. OpenAI and Anthropic compatibility was tested through their real adapters
with captured requests; authenticated cloud inference was not exercised.

## Risks and trade-offs

- Timing weights protect core activities, but the engine still uses the model's
  advisory readiness and a candidate-response opportunity gate. It cannot prove
  that an activity was meaningfully performed from free-form text. Very short or
  overdue interviews provide opportunities without guaranteeing full assessment.
- The eight-exchange cap remains generic. Readiness can end any stage earlier;
  repeated follow-ups cannot keep one stage open indefinitely.
- Interviewer requests are capped at 64,000 serialized characters; evaluator
  requests at 256,000, including provider schemas. These are application payload
  caps, not universal model windows. Character/4 estimates are approximate.
  Automatic model-window discovery and tokenizer-specific budgeting are not
  implemented. Smaller configured windows may need smaller input budgets and
  an output reserve. No Ollama `num_ctx` or cloud-wide limit is silently changed.
- Oversized essential input fails explicitly. Workspace and problem constraints
  are never clipped; evaluator evidence is never silently summarized or discarded.
  Persisted transcript and observations remain complete even when the interviewer
  sees a reduced record. At extreme lengths, evaluation may fail its cap and need
  a deliberate larger-budget strategy.
- First/latest evidence per competency and stage plus recent evidence cannot
  represent every nuance. Omission counts and coverage instructions prevent the
  reduced request from posing as a complete record; evaluation still receives it all.
- Contradictory Strong Hire outputs fail validation rather than silently changing
  the verdict. A model can still overstate evidence consistently across all fields;
  schema validation cannot establish semantic truth. Live samples are limited and
  the model may still repeat questions or make incorrect technical claims.
- Some thinking models lack an off mode. [Ollama's thinking documentation](https://docs.ollama.com/capabilities/thinking)
  explains `thinking.values` from `/api/show`; GPT-OSS exposes named effort levels
  instead of false. The installed provider accepts booleans, so OpenMock does not
  substitute an effort level or a different model silently.
