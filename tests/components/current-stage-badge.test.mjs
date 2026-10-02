import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "../register-typescript.mjs";
let session = {
  interview: { stage: { current: "discover" } },
  definition: {
    stages: [
      { id: "discover", name: "Discover the Problem" },
      { id: "explore-options" },
    ],
  },
};
const compiled = { exports: {} };
const code = ts.transpileModule(
  readFileSync("src/components/current-stage-badge.tsx", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;
new Function("require", "module", "exports", code)(
  (name) => {
    if (name === "./interview-session-context")
      return { useInterviewSession: () => session };
    if (name === "@/components/ui/badge")
      return {
        Badge: ({ variant, ...props }) =>
          React.createElement("span", { ...props, "data-variant": variant }),
      };
    return load(name);
  },
  compiled,
  compiled.exports,
);
const render = (numbered) =>
  renderToStaticMarkup(
    React.createElement(compiled.exports.CurrentStageBadge, { numbered }),
  );

test("both header badges follow the active stage and definition order without separate state", () => {
  assert.match(render(false), /Discover the Problem/);
  assert.match(render(true), /Stage 1 · Discover the Problem/);
  session.interview.stage.current = "explore-options";
  assert.match(render(false), /Explore Options/);
  assert.match(render(true), /Stage 2 · Explore Options/);
  assert.ok(!render(false).includes("Discover the Problem"));
  session.interview.stage.current = "unknown";
  assert.equal(render(false), "");
  assert.equal(render(true), "");
});

test("terminal stage explicitly displays stages complete", () => {
  session.interview.stage.current = null;
  assert.match(render(false), /Stages complete/);
  assert.match(render(true), /Stages complete/);
});
