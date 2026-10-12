import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { loadComponent } from "../../helpers/components.mjs";

const { getProblems, validateProblemDefinitions } = load(
  "../src/lib/problems/loader.ts",
);
const { getInterviewDefinitions } = load("../src/lib/interview/definitions.ts");

function catalog(documents, disabled = []) {
  return loadComponent("src/lib/problems/loader.ts", {
    "node:fs/promises": {
      readdir: async (directory) => {
        const prefix = path
          .relative(path.join(process.cwd(), "content", "problems"), directory)
          .split(path.sep)
          .filter(Boolean)
          .join("/");
        const names = new Map();
        for (const filename of Object.keys(documents)) {
          const relative = prefix
            ? filename.startsWith(`${prefix}/`)
              ? filename.slice(prefix.length + 1)
              : null
            : filename;
          if (!relative) continue;
          const [name, ...rest] = relative.split("/");
          names.set(name, rest.length > 0);
        }
        return [...names].map(([name, directory]) => ({
          name,
          isDirectory: () => directory,
          isFile: () => !directory,
        }));
      },
      readFile: async (filename) =>
        documents[
          path
            .relative(path.join(process.cwd(), "content", "problems"), filename)
            .split(path.sep)
            .join("/")
        ],
    },
    "../interview/definitions": {
      getInterviewDefinitions: async (options) =>
        [
          { id: "dsa", workspace: "code" },
          { id: "system-design", workspace: "diagram" },
        ].filter(
          ({ id }) => options?.includeDisabled || !disabled.includes(id),
        ),
    },
  });
}

const document = (interview, extra = "", id = "example") =>
  `---\nid: ${id}\ntitle: Example\ninterview: ${interview}\ndifficulty: medium\n${extra}---\n## Description\nPrompt`;

test("valid catalogs retain recursive discovery, sorting, lookup and disabled filtering", async () => {
  const loader = catalog({
    "dsa/nested/z.md": document(
      "dsa",
      "language: java\nstarterCode: class Solution {}\n",
      "z",
    ).replace("title: Example", "title: Zebra"),
    "system-design/a.md": document(
      "system-design",
      "companies: [Bitly]\n",
      "a",
    ).replace("title: Example", "title: Alpha"),
    "README.md": "Documentation, not a problem",
    "notes.txt": "Not Markdown",
  });
  assert.deepEqual(
    (await loader.getProblems()).map(({ id }) => id),
    ["a", "z"],
  );
  assert.equal((await loader.getProblem("z")).language, "java");
  assert.equal(await loader.getProblem("missing"), undefined);
  assert.deepEqual(
    (
      await catalog(
        {
          "dsa/z.md": document("dsa", "", "z"),
          "system-design/a.md": document("system-design", "", "a"),
        },
        ["dsa"],
      ).getProblems()
    ).map(({ id }) => id),
    ["a"],
  );
});

test("duplicates across types report id and both file paths even for disabled interviews", async () => {
  await assert.rejects(
    catalog(
      {
        "dsa/one.md": document("dsa"),
        "system-design/two.md": document("system-design"),
      },
      ["dsa"],
    ).getProblems(),
    (error) => {
      assert.match(error.message, /Duplicate problem id: example/);
      assert.ok(error.message.includes(path.join("dsa", "one.md")));
      assert.ok(error.message.includes(path.join("system-design", "two.md")));
      return true;
    },
  );
});

test("invalid files and references fail with file and field instead of disappearing", async () => {
  for (const source of [
    document("dsa", "topics: wrong\n"),
    document("missing"),
    document("system-design", "language: java\n"),
    document("system-design", "starterCode: return;\n"),
  ]) {
    await assert.rejects(
      catalog({ "nested/invalid.md": source }).getProblems(),
      (error) => {
        assert.ok(error.message.includes(path.join("nested", "invalid.md")));
        assert.match(error.message, /topics|interview|language|starterCode/);
        return true;
      },
    );
  }
});

test("coding metadata is optional and follows workspace capability for custom definitions", () => {
  const problem = {
    id: "custom",
    interview: "custom",
    language: "python",
    starterCode: "return 1",
  };
  assert.doesNotThrow(() =>
    validateProblemDefinitions(
      [problem],
      [{ id: "custom", workspace: "code" }],
    ),
  );
  assert.doesNotThrow(() =>
    validateProblemDefinitions(
      [{ id: "dsa", interview: "dsa" }],
      [{ id: "dsa", workspace: "code" }],
    ),
  );
});

test("every existing catalog file validates with its original id and metadata", async () => {
  async function files(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    return (
      await Promise.all(
        entries.map((entry) =>
          entry.isDirectory()
            ? files(path.join(directory, entry.name))
            : entry.name.endsWith(".md") && entry.name !== "README.md"
              ? [path.join(directory, entry.name)]
              : [],
        ),
      )
    ).flat();
  }
  const filenames = await files("content/problems");
  const problems = await getProblems();
  assert.equal(problems.length, filenames.length);
  assert.equal(new Set(problems.map(({ id }) => id)).size, filenames.length);
  for (const filename of filenames) {
    const source = await readFile(filename, "utf8");
    const id = /^id: (.+)$/m.exec(source)[1].trim();
    const problem = problems.find((problem) => problem.id === id);
    assert.ok(problem, filename);
    assert.ok(problem.content.includes("## Description"));
  }
});

test("all discovered problems reference discovered interview definitions", async () => {
  const [problems, definitions] = await Promise.all([
    getProblems(),
    getInterviewDefinitions(),
  ]);
  const behavioral = problems.find(({ id }) => id === "conflict-with-teammate");
  assert.equal(behavioral.interview, "behavioral");
  assert.equal(
    definitions.find(({ id }) => id === behavioral.interview).workspace,
    "none",
  );
});

test("unknown interview references fail clearly", async () => {
  const definitions = await getInterviewDefinitions();
  assert.throws(
    () =>
      validateProblemDefinitions(
        [
          {
            id: "unknown",
            title: "Unknown",
            interview: "missing",
            difficulty: "easy",
            categories: [],
            topics: [],
            companies: [],

            content: "Prompt",
          },
        ],
        definitions,
      ),
    /unknown interview definition: missing/,
  );
});
