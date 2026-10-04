import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadComponent,
  hookHarness,
  findElement,
} from "../helpers/components.mjs";

function harness({ storageFails = false } = {}) {
  const hooks = hookHarness();
  const interview = {
    id: "session-1",
    status: "in-progress",
    messages: [{ role: "candidate", content: "Answer" }],
  };
  const workspace = { type: "code", code: "saved solution" };
  let current = interview,
    pending = false,
    saved;
  const events = [];
  const controls = {
    problem: { id: "problem-1" },
    definition: { id: "dsa" },
    operation: null,
    beginOperation() {
      if (pending || current.status === "completed") return null;
      pending = true;
      return { interview: current };
    },
    commitOperation(_, completed) {
      current = completed;
      events.push("commit");
    },
    endOperation() {
      pending = false;
    },
  };
  const dialog = Object.fromEntries(
    [
      "AlertDialog",
      "AlertDialogAction",
      "AlertDialogCancel",
      "AlertDialogContent",
      "AlertDialogDescription",
      "AlertDialogFooter",
      "AlertDialogHeader",
      "AlertDialogTitle",
      "AlertDialogTrigger",
    ].map((name) => [name, name]),
  );
  const { FinishInterviewButton } = loadComponent(
    "src/components/finish-interview-button.tsx",
    {
      react: hooks.react,
      "next/navigation": {
        useRouter: () => ({ replace: (url) => events.push(url) }),
      },
      "@/components/ui/button": { Button: "button" },
      "@/components/ui/alert-dialog": dialog,
      "@/components/interview-session-context": {
        useInterviewSession: () => controls,
        useCaptureWorkspace: () => () => workspace,
      },
      "@/lib/interview/engine": {
        buildInterviewContext() {},
        completeInterview: (value) => ({ ...value, status: "completed" }),
      },
      "@/lib/interview/session-storage": {
        saveInterviewSession(value) {
          if (storageFails) throw new Error("Storage denied");
          saved = value;
          events.push("save");
        },
      },
    },
  );
  return {
    render: () => hooks.render(FinishInterviewButton, {}),
    events,
    workspace,
    get saved() {
      return saved;
    },
  };
}

test("Finish opens confirmation without completing; confirmation saves completion before navigation and rejects duplicates", () => {
  const h = harness();
  let tree = h.render();
  assert.equal(tree.props.open, false);
  assert.equal(
    findElement(tree, (n) => n.type === "AlertDialogTitle").props.children,
    "Finish interview?",
  );
  tree.props.onOpenChange(true);
  tree = h.render();
  assert.equal(tree.props.open, true);
  assert.deepEqual(h.events, []);
  const confirm = findElement(tree, (n) => n.type === "AlertDialogAction");
  confirm.props.onClick();
  confirm.props.onClick();
  assert.deepEqual(h.events, [
    "save",
    "commit",
    "/interviews/session-1/result",
  ]);
  assert.equal(h.saved.interview.status, "completed");
  assert.equal(h.saved.evaluationWorkspace, h.workspace);
  assert.equal(h.saved.evaluationContext.problem.id, "problem-1");
  assert.equal(Object.hasOwn(h.saved, "interactionMode"), false);
  assert.equal(h.render().props.open, false);
});

test("Cancel leaves the interview untouched; failed persistence keeps confirmation open and avoids navigation", () => {
  const cancel = harness();
  cancel.render().props.onOpenChange(true);
  cancel.render().props.onOpenChange(false);
  assert.deepEqual(cancel.events, []);
  const h = harness({ storageFails: true });
  h.render().props.onOpenChange(true);
  findElement(
    h.render(),
    (n) => n.type === "AlertDialogAction",
  ).props.onClick();
  assert.deepEqual(h.events, []);
  assert.equal(h.render().props.open, true);
  assert.ok(findElement(h.render(), (n) => n.props.role === "alert"));
});
