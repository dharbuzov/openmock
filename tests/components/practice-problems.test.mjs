import { readFileSync } from "node:fs";
import { Database, Landmark, CircleHelp } from "lucide-react";
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
  "@/components/ui/field": {
    Field: "field",
    FieldGroup: "field-group",
    FieldLabel: "label",
  },
  "@/components/ui/button": { Button: "button", buttonVariants: () => "" },
  "@/components/ui/separator": { Separator: "separator" },
  "@/components/ui/select": Object.fromEntries(
    [
      "Select",
      "SelectContent",
      "SelectGroup",
      "SelectItem",
      "SelectTrigger",
      "SelectValue",
    ].map((name) => [name, name.toLowerCase()]),
  ),
  "./problem-metadata-badges": { ProblemMetadataBadges: "metadata" },
  "next/link": { __esModule: true, default: "a" },
};
const { filterProblems, availableCompanies } = loadComponent(
  "src/components/practice-problems.tsx",
  overrides,
);
function problem(id, options = {}) {
  return {
    id,
    title: id,
    interview: "system-design",
    difficulty: "medium",
    tags: ["payments"],
    topics: [],
    companies: [{ id: "Revolut", relation: "relevant" }],
    interviewTypes: [],
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
    interviewTypes: [
      { id: "system-design", name: "System Design" },
      { id: "dsa", name: "DSA" },
    ],
  };
  const render = () => hooks.render(PracticeProblems, props);
  let tree = render();
  findElement(
    tree,
    (node) => node.type === "button" && node.key === "system-design",
  ).props.onClick();
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
  const selected = findElement(
    tree,
    (node) => node.type === "button" && node.key === "system-design",
  );
  assert.equal(selected.props["aria-pressed"], true);
  assert.equal(selected.props.children[2].props.children, 4);
  const mobileSelect = findElement(tree, (node) => node.type === "select");
  assert.equal(mobileSelect.props.value, "system-design");
  mobileSelect.props.onValueChange("dsa");
  tree = render();
  assert.equal(
    findElement(tree, (node) => node.type === "ul").props.children[0].key,
    "dsa-payment",
  );
  findElement(tree, (node) => node.type === "select").props.onValueChange(
    "system-design",
  );
  tree = render();
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

test("new definitions flow through discovery and Practice navigation without UI registration", async () => {
  const template = readFileSync(
    "content/interviews/behavioral.md",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const documents = [
    ["sql", "SQL", "database", 40],
    ["payments-architecture", "Payments Architecture", "landmark", 10],
    ["zeta", "Zeta", "unknown-icon", undefined],
    ["beta", "Same name", undefined, undefined],
    ["alpha", "Same name", undefined, undefined],
  ].map(([id, name, icon, order]) =>
    template
      .replace("id: behavioral", `id: ${id}`)
      .replace("name: Behavioral", `name: ${name}`)
      .replace("icon: messages-square\n", icon ? `icon: ${icon}\n` : "")
      .replace("order: 30\n", order === undefined ? "" : `order: ${order}\n`),
  );
  const { getInterviewDefinitions } = loadComponent(
    "src/lib/interview/definitions.ts",
    {
      "node:fs/promises": {
        readdir: async () =>
          documents.map((_, i) => ({ name: `${i}.md`, isFile: () => true })),
        readFile: async (filename) =>
          documents[Number(filename.match(/(\d+)\.md$/)[1])],
      },
      "../config/config": { config: { interviews: { disabled: [] } } },
    },
  );
  const definitions = await getInterviewDefinitions();
  assert.deepEqual(
    definitions.map(({ id }) => id),
    ["payments-architecture", "sql", "alpha", "beta", "zeta"],
  );
  const loadedProblems = [problem("sql-query", { interview: "sql" })];
  const { default: PracticePage } = loadComponent("src/app/practice/page.tsx", {
    "@/lib/problems/loader": { getProblems: async () => loadedProblems },
    "@/lib/interview/definitions": {
      getInterviewDefinitions: async () => definitions,
    },
    "@/components/practice-problems": { PracticeProblems: "practice-problems" },
  });
  const page = await PracticePage();
  const props = findElement(
    page,
    (node) => node.type === "practice-problems",
  ).props;
  assert.equal(props.interviewTypes.length, 5);
  assert.equal(props.interviewTypes[1].icon, "database");
  assert.equal(props.interviewTypes[1].order, 40);
  assert.equal(props.interviewTypes[1].instructions, undefined);
  const hooks = hookHarness();
  const { PracticeProblems } = loadComponent(
    "src/components/practice-problems.tsx",
    { ...overrides, react: hooks.react },
  );
  let tree = hooks.render(PracticeProblems, props);
  const item = (id) =>
    findElement(tree, (node) => node.type === "button" && node.key === id);
  assert.equal(item("sql").props.children[0].type, Database);
  assert.equal(item("sql").props.children[1].props.children, "SQL");
  assert.equal(item("sql").props.children[2].props.children, 1);
  assert.equal(item("payments-architecture").props.children[0].type, Landmark);
  assert.equal(
    item("payments-architecture").props.children[2].props.children,
    0,
  );
  assert.equal(item("zeta").props.children[0].type, CircleHelp);
  assert.equal(item("alpha").props.children[0].type, CircleHelp);
  item("sql").props.onClick();
  tree = hooks.render(PracticeProblems, props);
  assert.equal(
    findElement(tree, (node) => node.type === "ul").props.children[0].key,
    "sql-query",
  );
  const mobileSelect = findElement(tree, (node) => node.type === "select");
  assert.equal(mobileSelect.props.value, "sql");
  assert.ok(
    mobileSelect.props.items.some(
      ({ value, label }) => value === "sql" && label === "SQL (1)",
    ),
  );
});
