import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import browserPino from "pino/browser.js";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { load } from "../../register-typescript.mjs";

const { wrapLogger, resolveLevel } = load("../src/lib/logging/logger.ts");
const { sanitize, safeError } = load("../src/lib/logging/sanitize.ts");
const secret = "sk-THIS_MUST_NEVER_APPEAR";
const context = {
  provider: "openai",
  model: "gpt-4.1",
  interviewId: "abc",
  apiKey: secret,
  api_key: secret,
  Authorization: `Bearer ${secret}`,
  nested: { accessToken: secret, deeper: { password: secret, cookie: secret } },
  settings: { provider: "openai", apiKey: secret },
  prompt: secret,
  unknown: secret,
  modelResponse: secret,
};

for (const runtime of ["node", "browser"]) {
  test(`${runtime} output redacts credentials at every log level`, () => {
    const output = [];
    const sink =
      runtime === "node"
        ? pino(
            { level: "trace" },
            { write: (line) => output.push(JSON.parse(line)) },
          )
        : browserPino({
            level: "trace",
            browser: { write: (entry) => output.push(entry) },
          });
    const logger = wrapLogger(sink);
    for (const level of ["trace", "debug", "info", "warn", "error", "fatal"])
      logger[level](context, "Provider event");
    assert.equal(output.length, 6);
    assert.ok(!JSON.stringify(output).includes(secret));
    assert.equal(output[0].provider, "openai");
    assert.equal(output[0].model, "gpt-4.1");
    assert.equal(output[0].Authorization, "[REDACTED]");
    assert.equal(output[0].nested.deeper.password, "[REDACTED]");
    assert.equal(context.apiKey, secret);
  });
  test(`${runtime} respects configured level`, () => {
    const output = [];
    const sink =
      runtime === "node"
        ? pino({ level: "warn" }, { write: (line) => output.push(line) })
        : browserPino({
            level: "warn",
            browser: { write: (entry) => output.push(entry) },
          });
    const logger = wrapLogger(sink);
    logger.debug(context, "Hidden event");
    logger.info(context, "Hidden event");
    logger.warn(context, "Visible event");
    assert.equal(output.length, 1);
  });
}

test("safe error excludes SDK payloads and redacts free text", () => {
  const error = Object.assign(new Error(secret), {
    name: "APIError",
    code: "RATE_LIMIT",
    statusCode: 429,
    config: context,
    request: context,
    headers: context,
    response: context,
  });
  error.toJSON = () => {
    throw new Error("must not call toJSON");
  };
  assert.deepEqual(safeError(error, { includeStack: false }), {
    name: "APIError",
    code: "RATE_LIMIT",
    statusCode: 429,
    message: "[REDACTED]",
  });
  assert.ok(!JSON.stringify(sanitize({ err: error })).includes(secret));
  assert.ok(
    !JSON.stringify(safeError({ name: secret, code: secret })).includes(secret),
  );
});

test("sanitation avoids getters and circular payloads", () => {
  const value = { provider: "openai" };
  value.nested = value;
  Object.defineProperty(value, "model", {
    get() {
      throw new Error(secret);
    },
    enumerable: true,
  });
  assert.equal(sanitize(value).nested, "[OMITTED]");
});

test("levels default safely", () => {
  assert.equal(resolveLevel(undefined, false), "debug");
  assert.equal(resolveLevel(undefined, true), "info");
  assert.equal(resolveLevel(secret, false), "info");
  assert.equal(resolveLevel("fatal", false), "fatal");
});

test("Pino file destination writes sanitized JSON", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "openmock-logging-"));
  const filename = path.join(directory, "logs", "openmock.log");
  const destination = pino.destination({
    dest: filename,
    mkdir: true,
    sync: true,
  });
  try {
    wrapLogger(pino({ level: "trace" }, destination)).info(
      context,
      "Provider event",
    );
    const output = readFileSync(filename, "utf8");
    assert.ok(!output.includes(secret));
    assert.equal(JSON.parse(output).interviewId, "abc");
  } finally {
    const closed = once(destination, "close");
    destination.end();
    await closed;
    rmSync(directory, { recursive: true });
  }
});

test("useful error messages and sanitized causes survive Node and browser logs", () => {
  const { EvaluationError } = load("../src/lib/ai/evaluation.ts");
  const { protectCredentials } = load("../src/lib/logging/sanitize.ts");
  const credential = "custom-provider-credential-123";
  const release = protectCredentials([credential]);
  try {
    const cause = new SyntaxError(
      "Unexpected token at position 42; key=" +
        secret +
        "; Bearer opaque-token; Authorization: Basic opaque-auth; apiKey=" +
        credential,
    );
    const error = new EvaluationError(
      "Model returned invalid evaluation JSON",
      { cause },
    );
    for (const factory of [pino, browserPino]) {
      const output = [];
      const sink =
        factory === pino
          ? pino(
              { level: "debug" },
              { write: (line) => output.push(JSON.parse(line)) },
            )
          : browserPino({
              level: "debug",
              browser: { write: (entry) => output.push(entry) },
            });
      wrapLogger(sink).error({ err: error }, "Evaluation failed");
      assert.equal(
        output[0].err.message,
        "Model returned invalid evaluation JSON",
      );
      assert.equal(output[0].err.cause.name, "SyntaxError");
      assert.match(
        output[0].err.cause.message,
        /Unexpected token at position 42/,
      );
      const serialized = JSON.stringify(output);
      for (const value of [secret, credential, "opaque-token", "opaque-auth"])
        assert.ok(!serialized.includes(value), value);
      assert.ok(output[0].err.stack.includes("at "));
    }
  } finally {
    release();
  }
});

test("production info logs omit stacks while debug logs retain sanitized frames", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    for (const level of ["info", "debug"]) {
      const output = [];
      wrapLogger(
        pino({ level }, { write: (line) => output.push(JSON.parse(line)) }),
      ).error({ err: new Error("Useful failure") }, "Evaluation failed");
      assert.equal(typeof output[0].err.stack === "string", level === "debug");
      assert.equal(output[0].err.message, "Useful failure");
    }
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("SDK response payloads are omitted while schema issues stay useful", () => {
  const { evaluationFailureDiagnostics } = load("../src/lib/ai/evaluation.ts");
  const cause = Object.assign(
    new Error(
      "Type validation failed: Value: raw-private-model-output. Error message: invalid",
    ),
    {
      name: "AI_TypeValidationError",
      cause: Object.assign(new Error("Validation failed"), {
        name: "ZodError",
        issues: [
          {
            path: ["competencies", 0, "rating"],
            message: "Invalid enum value " + secret,
            input: secret,
          },
        ],
      }),
    },
  );
  const error = Object.assign(new Error("Response did not match schema"), {
    text: "raw-private-model-output",
    cause,
  });
  const diagnostics = evaluationFailureDiagnostics(error);
  assert.equal(diagnostics.responseReceived, true);
  assert.equal(diagnostics.responseLength, 24);
  assert.equal(diagnostics.parseSucceeded, true);
  assert.equal(diagnostics.validationSucceeded, false);
  const output = sanitize({ err: error, ...diagnostics });
  assert.deepEqual(output.validationIssues[0].path, [
    "competencies",
    0,
    "rating",
  ]);
  assert.match(output.validationIssues[0].message, /Invalid enum value/);
  assert.ok(!JSON.stringify(output).includes(secret));
  assert.ok(!JSON.stringify(output).includes("raw-private-model-output"));
});

test("cause chains are bounded and circular causes do not recurse", () => {
  const error = new Error("Useful failure");
  error.cause = error;
  assert.equal(safeError(error).cause.message, "Cause chain omitted");
});

test("TRACE preserves diagnostic error content while redacting secrets and omitting binary bytes", () => {
  const logs = [];
  const log = wrapLogger(
    pino({ level: "trace" }, { write: (line) => logs.push(JSON.parse(line)) }),
  );
  const error = Object.assign(
    new SyntaxError('Invalid JSON "candidate content" ' + secret),
    {
      text: "complete model output " + secret,
      responseBody: "complete provider error body " + secret,
      data: { apiKey: secret, details: "useful diagnostic content" },
    },
  );
  log.trace(
    {
      err: error,
      audio: new Uint8Array([1, 2, 3]),
      blob: new Blob(["audio"]),
      array: new ArrayBuffer(7),
    },
    "PARSE_FAILED",
  );
  assert.ok(logs[0].err.message.includes('"candidate content"'));
  assert.equal(logs[0].err.text, "complete model output [REDACTED]");
  assert.equal(
    logs[0].err.responseBody,
    "complete provider error body [REDACTED]",
  );
  assert.equal(logs[0].err.data.details, "useful diagnostic content");
  assert.deepEqual(logs[0].audio, { binaryBytes: 3 });
  assert.equal(logs[0].blob.binaryBytes, 5);
  assert.equal(logs[0].array.binaryBytes, 7);
  assert.ok(!JSON.stringify(logs).includes(secret));
});

test("secret redaction preserves complete application payloads without truncation", () => {
  const { redactSecrets } = load("../src/lib/logging/sanitize.ts");
  const prompt = "Explain the cache design. ".repeat(1000);
  const shared = { content: "Actual diagram text", apiKey: secret };
  const payload = {
    request: {
      system: prompt,
      messages: Array.from({ length: 80 }, () => ({
        role: "user",
        content: prompt,
      })),
      workspace: { nodes: [shared], code: "const value = 42;" },
      definition: { instructions: prompt },
      problem: { description: prompt },
      settings: { model: "qwen3:8b", apiKey: secret },
      headers: {
        Authorization: "Bearer opaque",
        "x-api-key": secret,
        "Content-Type": "application/json",
      },
    },
    response: { content: [{ type: "text", text: prompt }], toolOutput: shared },
    sessionToken: secret,
  };
  for (const factory of [pino, browserPino]) {
    const output = [];
    const sink =
      factory === pino
        ? pino(
            { level: "debug" },
            { write: (line) => output.push(JSON.parse(line)) },
          )
        : browserPino({
            level: "debug",
            browser: { write: (entry) => output.push(entry) },
          });
    wrapLogger(sink).debug(payload, "AI request");
    assert.equal(output[0].request.system, prompt);
    assert.equal(output[0].request.messages.length, 80);
    assert.equal(output[0].request.messages[79].content, prompt);
    assert.equal(output[0].response.toolOutput.content, "Actual diagram text");
    assert.equal(
      output[0].request.workspace.nodes[0].content,
      "Actual diagram text",
    );
    assert.equal(output[0].request.headers["Content-Type"], "application/json");
    assert.equal(output[0].request.headers.Authorization, "[REDACTED]");
    assert.ok(!JSON.stringify(output).includes(secret));
  }
  assert.equal(payload.request.settings.apiKey, secret);
  assert.deepEqual(
    JSON.parse(JSON.stringify(redactSecrets({ a: shared, b: shared }))),
    {
      a: { content: "Actual diagram text", apiKey: "[REDACTED]" },
      b: { content: "Actual diagram text", apiKey: "[REDACTED]" },
    },
  );
});
