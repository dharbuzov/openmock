import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadComponent,
  hookHarness,
  findElement,
} from "../helpers/components.mjs";
const overrides = {
  "@/components/ui/combobox": Object.fromEntries(
    [
      "Combobox",
      "ComboboxInput",
      "ComboboxContent",
      "ComboboxEmpty",
      "ComboboxItem",
      "ComboboxList",
    ].map((name) => [name, name.toLowerCase()]),
  ),
  "@/components/ui/input": { Input: "input" },
  "@/components/ui/toggle-group": {
    ToggleGroup: "toggle-group",
    ToggleGroupItem: "toggle-item",
  },
  "@/components/ui/field": { Field: "field", FieldLabel: "label" },
  "@/components/ui/button": { buttonVariants: () => "" },
  "./problem-metadata-badges": { ProblemMetadataBadges: "metadata" },
  "next/link": { __esModule: true, default: "a" },
};
const { filterProblems, availableCompanies, problemDifficulty } = loadComponent(
  "src/components/practice-problems.tsx",
  overrides,
);
function problem(id, options = {}) {
  return {
    id,
    title: id,
    interview: "system-design",
    complexity: "medium",
    difficulty: "medium",
    tags: ["payments"],
    topics: [],
    companies: [{ id: "Revolut", relation: "relevant" }],
    categories: [],
    content:
      "## Description\nDesign a payment service.\n\n## Scale\nsecret-capacity",
    ...options,
  };
}
const problems = [
  problem("payment"),
  problem("easy-payment", { difficulty: "easy" }),
  problem("other-company", {
    companies: [{ id: "Google", relation: "reported" }],
  }),
  problem("dsa-payment", { interview: "dsa" }),
  problem("queue", {
    title: "Queue",
    tags: [],
    content: "## Description\nDesign a queue.",
  }),
];
const all = { category: "", difficulty: "", company: "", search: "" };
const ids = (filters) =>
  filterProblems(problems, { ...all, ...filters }).map(({ id }) => id);

test("category, difficulty, canonical company and search combine with AND semantics", () => {
  assert.deepEqual(
    ids({
      category: "system-design",
      difficulty: "medium",
      company: "Revolut",
      search: "payment",
    }),
    ["payment"],
  );
  assert.equal(ids(all).length, 5);
  assert.equal(ids({ category: "dsa" }).length, 1);
  assert.equal(ids({ difficulty: "easy" }).length, 1);
  assert.deepEqual(ids({ company: "Google" }), ["other-company"]);
  assert.deepEqual(ids({ company: "revolut" }), []);
});

test("search matches title, candidate description, type, tags and companies without exposing hidden context", () => {
  for (const search of [
    "payment",
    "SERVICE",
    "system-design",
    "payments",
    "revolut",
  ])
    assert.ok(ids({ search }).includes("payment"), search);
  assert.equal(ids({ search: "secret-capacity" }).length, 0);
  assert.equal(ids({ search: "   " }).length, 5);
  assert.equal(
    problemDifficulty(
      problem("legacy", { difficulty: undefined, complexity: "high" }),
    ),
    "hard",
  );
});

test("companies are deduplicated from loaded metadata and retain canonical values", () => {
  assert.deepEqual(availableCompanies(problems), [
    { value: "Google", label: "Google" },
    { value: "Revolut", label: "Revolut" },
  ]);
  assert.deepEqual(availableCompanies([]), []);
  assert.deepEqual(
    availableCompanies([
      problem("slug", { companies: [{ id: "example-co" }] }),
    ]),
    [{ value: "example-co", label: "Example Co" }],
  );
});

test("Practice controls filter rows and metadata stays display-only", () => {
  const hooks = hookHarness();
  const { PracticeProblems } = loadComponent(
    "src/components/practice-problems.tsx",
    { ...overrides, react: hooks.react },
  );
  const props = {
    problems,
    categories: [
      { id: "system-design", name: "System Design" },
      { id: "dsa", name: "DSA" },
    ],
  };
  const render = () => hooks.render(PracticeProblems, props);
  let tree = render();
  findElement(
    tree,
    (node) => node.props["aria-label"] === "Interview category",
  ).props.onValueChange(["system-design"]);
  findElement(
    tree,
    (node) => node.props["aria-labelledby"] === "practice-difficulty",
  ).props.onValueChange(["medium"]);
  const combo = findElement(tree, (node) => node.type === "combobox");
  assert.equal(combo.props.items[0].label, "All companies");
  combo.props.onValueChange({ value: "Revolut", label: "Revolut" });
  findElement(
    tree,
    (node) => node.props.id === "practice-search",
  ).props.onChange({ target: { value: "payment" } });
  tree = render();
  const list = findElement(tree, (node) => node.type === "ul");
  assert.equal(list.props.children.length, 1);
  assert.equal(list.props.children[0].key, "payment");
  const badges = findElement(tree, (node) => node.type === "metadata");
  assert.equal(badges.props.onClick, undefined);
  assert.equal(
    findElement(tree, (node) => node.type === "a").props.href,
    "/practice/payment/setup",
  );
  findElement(
    tree,
    (node) => node.props.id === "practice-search",
  ).props.onChange({ target: { value: "missing" } });
  tree = render();
  assert.ok(
    findElement(
      tree,
      (node) =>
        node.type === "p" &&
        node.props.children === "No problems match these filters.",
    ),
  );
});
