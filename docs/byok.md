# Settings and BYOK integration

Open Settings from the gear in the application header or Interview Room. Choose System, Light, or Dark; theme changes apply immediately and persist. Add an OpenAI API key, choose GPT-4.1 mini or GPT-4.1, then Save. Test connection makes a small, billable text request to the selected model. Model access depends on the OpenAI account.

API keys are hidden after saving. An empty replacement field preserves the saved key; Remove saved key followed by Save clears it. Remember API key defaults off: sessionStorage retains the key through refreshes in that tab's browser session. With Remember enabled, localStorage retains it until removal. Browser session restoration may restore sessionStorage according to browser behavior. Browser storage is not encrypted secret storage; scripts running on this origin can access it.

## Request boundary

The official OpenAI SDK runs in the browser using the candidate's own key and an explicit OpenAI API base URL. No application environment key, server proxy, database, or server-side key persistence is used. Redirects are rejected. SDK logging and automatic retries are disabled. Raw provider errors are replaced with fixed messages without retaining the original error as a cause.

Interview requests use the Responses API with `store: false`. This disables storing responses for later API retrieval; OpenAI's own data retention policies still apply. See the [official API documentation](https://developers.openai.com/api/docs/quickstart).

Each Send snapshots the problem type, title, full Markdown, conversation, and (for DSA) active language and current editor buffer. Code edits update an interview-scoped ref and never issue AI requests. System Design sends no canvas data. Pending requests are cancelled when the panel unmounts. Failed sends retain the candidate message and offer Retry without adding a duplicate message.

Conversation and language buffers remain in memory. Reloading the interview clears them. Panel proportions and normal preferences persist separately. Run and Test Results have been removed; code execution is not implemented.

## Verification

Passed:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `node --test tests/byok.test.mjs` (3 tests)
- Browser: shared-header and interview Settings actions; Light/Dark/System; theme restoration after refresh; saved key remains masked; session and remembered dummy-key save/refresh; dummy-key removal; missing-key Send opens Settings without losing the draft.
- Browser: invalid-key Test connection and interview requests show sanitized failure messages; candidate message appears immediately; Send is disabled during a request.
- Browser: all nine languages, filenames and Monaco rendered language identifiers; edited Java/Python buffers restored when switching.
- Browser: full-height Monaco; Excalidraw light/dark styling; both System Design resize separators; shared saved proportions across rooms.
- Automated: session-only vs remembered storage lifetime and migration, removal, blocked storage, exact OpenAI endpoint, redirect policy, model, full problem/conversation/code payload, no code in System Design context, mocked successful connection/interview, and sanitized errors with logging off.

Not verified live: successful Test connection and real DSA/System Design AI responses. No valid API key was provided. Success paths were tested with mocked SDK HTTP responses, not a live model. Enter a valid key through Settings (not chat), test the connection, and send an answer in each interview to complete live verification.

## Dependencies

- Added `openai` 6.49.0 and `next-themes` 0.4.6.
- Added shadcn Dialog, Input, Switch, Field, Label and Separator source primitives using the existing Base UI dependency.
- No state-management, execution, or test-runner dependencies.

## Files created

- `src/components/settings-provider.tsx`
- `src/components/settings-dialog.tsx`
- `src/components/interview-code-context.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/field.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/separator.tsx`
- `src/lib/settings/types.ts`
- `src/lib/settings/storage.ts`
- `src/lib/ai/openai.ts`
- `tests/byok.test.mjs`
- `docs/byok.md`

## Files changed

- `package.json` and `package-lock.json`
- `src/app/layout.tsx` and `src/app/globals.css`
- `src/components/header.tsx`
- `src/components/interview-room.tsx`
- `src/components/interview-panes.tsx`
- `src/components/ai-interviewer.tsx`
- `src/components/workspace/code-workspace.tsx`
- `src/components/workspace/excalidraw-workspace.tsx`
- `src/lib/ai/provider.ts` and `src/lib/ai/prompts.ts`

Problem Markdown, problem loader, routes, and interview engine were not changed for this integration.
