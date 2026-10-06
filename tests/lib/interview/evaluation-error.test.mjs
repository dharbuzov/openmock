import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";
const { evaluationFailure } = load("../src/lib/interview/evaluation-error.ts");
const { protectCredentials } = load("../src/lib/logging/sanitize.ts");

test("evaluation failures classify underlying provider and SDK errors", () => {
  for (const [error, code] of [
    [
      Object.assign(new Error("fetch failed"), { code: "ECONNREFUSED" }),
      "PROVIDER_UNREACHABLE",
    ],
    [
      Object.assign(new Error("Unauthorized"), { statusCode: 401 }),
      "AUTHENTICATION_FAILED",
    ],
    [Object.assign(new Error("Limited"), { statusCode: 429 }), "RATE_LIMITED"],
    [
      Object.assign(new Error("Missing model"), { statusCode: 404 }),
      "MODEL_NOT_FOUND",
    ],
    [
      Object.assign(new Error("timeout"), { name: "TimeoutError" }),
      "REQUEST_TIMEOUT",
    ],
    [
      Object.assign(new Error("Invalid output"), {
        name: "AI_TypeValidationError",
      }),
      "STRUCTURED_OUTPUT_INVALID",
    ],
    [new Error("Empty response"), "EMPTY_RESPONSE"],
    [
      Object.assign(new Error("Evaluation failed"), {
        name: "EvaluationError",
      }),
      "EVALUATION_FAILED",
    ],
    [new Error("Unexpected internal exception"), "UNKNOWN"],
  ]) {
    assert.equal(
      evaluationFailure(new Error("Wrapper", { cause: error })).code,
      code,
    );
  }
});

test("diagnostics redact credentials and retain validation paths without SDK payloads", () => {
  const secret = "private-provider-key";
  const release = protectCredentials([secret]);
  try {
    const cause = Object.assign(
      new Error(`Type validation failed: Value: {"private":"payload"}`),
      {
        name: "AI_TypeValidationError",
        value: { secret, candidate: "sensitive evidence" },
        requestBody: "sensitive request",
        responseBody: "sensitive response",
        issues: [
          {
            path: ["competencies", 2, "expectation"],
            message: `Expected string, received null; apiKey=${secret}`,
          },
        ],
      },
    );
    const failure = evaluationFailure(
      new Error(`Wrapper ${secret}`, { cause }),
      {
        provider: "ollama",
        model: "qwen3:8b",
        requestId: "correlation-1",
      },
    );
    assert.equal(failure.code, "STRUCTURED_OUTPUT_INVALID");
    assert.match(
      failure.details,
      /competencies\[2\].expectation: Expected string, received null/,
    );
    assert.equal(failure.requestId, "correlation-1");
    assert.doesNotMatch(
      JSON.stringify(failure),
      /private-provider-key|sensitive evidence|sensitive request|sensitive response|payload/,
    );
  } finally {
    release();
  }
});
