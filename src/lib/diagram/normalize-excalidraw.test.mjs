import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../../tests/register-typescript.mjs";

const { normalizeExcalidrawScene } = load("../src/lib/diagram/normalize-excalidraw.ts");
const element = (id, type, extra = {}) => ({ id, type, isDeleted: false, boundElements: null, ...extra });

test("normalizes Excalidraw nodes and edges without rendering data", () => {
  const diagram = normalizeExcalidrawScene([
    element("api", "rectangle", { boundElements: [{ id: "label", type: "text" }], strokeColor: "secret" }),
    element("label", "text", { text: "API", containerId: "api" }),
    element("db", "ellipse"),
    element("edge", "arrow", { startBinding: { elementId: "api" }, endBinding: { elementId: "db" } }),
  ]);
  assert.deepEqual(diagram, {
    nodes: [{ id: "api", type: "rectangle", label: "API" }, { id: "db", type: "ellipse" }],
    edges: [{ id: "edge", type: "arrow", from: "api", to: "db" }],
  });
  assert.ok(!JSON.stringify(diagram).includes("strokeColor"));
});
