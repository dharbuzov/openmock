import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";

const { normalizeExcalidrawScene } = load(
  "../src/lib/diagram/normalize-excalidraw.ts",
);
const element = (id, type, extra = {}) => ({
  id,
  type,
  isDeleted: false,
  boundElements: null,
  ...extra,
});

test("normalizes Excalidraw nodes and edges without rendering data", () => {
  const diagram = normalizeExcalidrawScene([
    element("api", "rectangle", {
      boundElements: [{ id: "label", type: "text" }],
      strokeColor: "secret",
    }),
    element("label", "text", { text: "API", containerId: "api" }),
    element("db", "ellipse"),
    element("edge", "arrow", {
      startBinding: { elementId: "api" },
      endBinding: { elementId: "db" },
    }),
  ]);
  assert.deepEqual(diagram, {
    nodes: [
      { id: "api", type: "rectangle", label: "API" },
      { id: "db", type: "ellipse" },
    ],
    edges: [{ id: "edge", type: "arrow", from: "api", to: "db" }],
    texts: [{ id: "label", text: "API", containerId: "api" }],
  });
  assert.ok(!JSON.stringify(diagram).includes("strokeColor"));
});

test("preserves standalone notes, full bound text, and spatial relationships", () => {
  const note =
    "Capacity: 10000 requests/s\n  Retry after 30s\n" + "detail ".repeat(40);
  const diagram = normalizeExcalidrawScene([
    element("frame", "frame", {
      name: "Region",
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    }),
    element("api", "rectangle", {
      x: 20,
      y: 40,
      width: 100,
      height: 80,
      frameId: "frame",
      boundElements: [{ id: "label", type: "text" }],
    }),
    element("label", "text", {
      text: "API\nservice",
      originalText: "API service",
      x: 30,
      y: 50,
      width: 80,
      height: 20,
    }),
    element("db", "ellipse", { x: 300, y: 40, width: 100, height: 80 }),
    element("arrow", "arrow", {
      startBinding: { elementId: "api" },
      endBinding: { elementId: "db" },
      boundElements: [{ id: "edge-label", type: "text" }],
    }),
    element("edge-label", "text", {
      text: "async writes",
      containerId: "arrow",
    }),
    element("note", "text", {
      text: note,
      x: 20,
      y: 200,
      width: 240,
      height: 120,
      frameId: "frame",
      groupIds: ["api-notes"],
      fontFamily: 5,
      version: 42,
    }),
    element("deleted", "text", { text: "removed", isDeleted: true }),
    element("blank", "text", { text: " \n " }),
  ]);
  assert.equal(diagram.nodes.find(({ id }) => id === "api").frameId, "frame");
  assert.deepEqual(diagram.nodes.find(({ id }) => id === "api").bounds, {
    x: 20,
    y: 40,
    width: 100,
    height: 80,
  });
  assert.equal(diagram.edges[0].from, "api");
  assert.equal(diagram.edges[0].to, "db");
  assert.equal(diagram.edges[0].label, "async writes");
  assert.deepEqual(
    diagram.texts.map(({ id, text, containerId }) => ({
      id,
      text,
      containerId,
    })),
    [
      { id: "label", text: "API service", containerId: "api" },
      { id: "edge-label", text: "async writes", containerId: "arrow" },
      { id: "note", text: note, containerId: undefined },
    ],
  );
  assert.deepEqual(diagram.texts[2].bounds, {
    x: 20,
    y: 200,
    width: 240,
    height: 120,
  });
  assert.equal(diagram.texts[2].frameId, "frame");
  assert.deepEqual(diagram.texts[2].groupIds, ["api-notes"]);
  assert.ok(!JSON.stringify(diagram).includes("fontFamily"));
  assert.ok(!JSON.stringify(diagram).includes("version"));
});
