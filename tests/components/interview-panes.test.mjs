import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { load } from "../register-typescript.mjs";

test("resize handles register only on desktop while all three panel contents stay mounted", () => {
  let desktop = false;
  const layouts = [];
  const defaultLayout = { problem: 22, workspace: 56, interviewer: 22 };
  const savedLayout = { problem: 25, workspace: 50, interviewer: 25 };
  const overrides = {
    react: {
      Fragment: Symbol.for("react.fragment"),
      useState: (value) => [value, () => {}],
      useRef: () => ({
        current: { setLayout: (layout) => layouts.push(layout) },
      }),
      useEffect: (callback) => callback(),
      useSyncExternalStore: () => desktop,
    },
    "@/components/ui/resizable": {
      ResizablePanel: "panel",
      ResizablePanelGroup: "group",
      ResizableHandle: "handle",
    },
    "@/components/ui/tabs": {
      Tabs: "tabs",
      TabsList: "tab-list",
      TabsTrigger: "tab",
      TabsContent: "content",
    },
    "@/lib/interview/layout-storage": {
      defaultLayout,
      readLayout: () => savedLayout,
      saveLayout: () => {},
    },
  };
  const code = ts.transpileModule(
    readFileSync("src/components/interview-panes.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => overrides[name] ?? load(name),
    loadedModule,
    loadedModule.exports,
  );
  const props = {
    problem: "problem content",
    workspace: "workspace content",
    interviewer: "interviewer content",
  };
  function nodes(tree, type) {
    if (!tree || typeof tree !== "object") return [];
    return [
      ...(tree.type === type ? [tree] : []),
      ...[tree.props?.children]
        .flat(Infinity)
        .flatMap((child) => nodes(child, type)),
    ];
  }
  for (const widthIsDesktop of [false, true, false, true]) {
    desktop = widthIsDesktop;
    const tree = loadedModule.exports.InterviewPanes(props);
    assert.equal(nodes(tree, "handle").length, desktop ? 2 : 0);
    assert.deepEqual(
      nodes(tree, "panel").map(({ props }) => props.id),
      ["problem", "workspace", "interviewer"],
    );
    assert.deepEqual(
      nodes(tree, "content").map(({ props }) => props.children),
      Object.values(props),
    );
    assert.ok(nodes(tree, "content").every(({ props }) => props.keepMounted));
    assert.equal(nodes(tree, "group")[0].props.disabled, !desktop);
  }
  assert.deepEqual(layouts, [savedLayout, savedLayout]);
});
