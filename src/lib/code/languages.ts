// Non-Java starters are intentionally problem-independent demo scaffolds.
export const codeLanguages = [
  {
    id: "java",
    label: "Java 21",
    monacoLanguage: "java",
    extension: "java",
    starterCode: "class Solution {\n    // Write your solution here.\n}\n",
  },
  {
    id: "python",
    label: "Python 3",
    monacoLanguage: "python",
    extension: "py",
    starterCode:
      "class Solution:\n    def solve(self):\n        # Adapt the signature to the problem.\n        pass\n",
  },
  {
    id: "javascript",
    label: "JavaScript",
    monacoLanguage: "javascript",
    extension: "js",
    starterCode:
      "function solve() {\n    // Adapt the signature to the problem.\n    // Write your solution here.\n}\n",
  },
  {
    id: "typescript",
    label: "TypeScript",
    monacoLanguage: "typescript",
    extension: "ts",
    starterCode:
      "function solve(): void {\n    // Adapt the signature to the problem.\n    // Write your solution here.\n}\n",
  },
  {
    id: "cpp",
    label: "C++ 20",
    monacoLanguage: "cpp",
    extension: "cpp",
    starterCode:
      "#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    void solve() {\n        // Adapt the signature to the problem.\n    }\n};\n",
  },
  {
    id: "csharp",
    label: "C# / .NET",
    monacoLanguage: "csharp",
    extension: "cs",
    starterCode:
      "public class Solution\n{\n    public void Solve()\n    {\n        // Adapt the signature to the problem.\n    }\n}\n",
  },
  {
    id: "go",
    label: "Go",
    monacoLanguage: "go",
    extension: "go",
    starterCode:
      "package main\n\nfunc solve() {\n    // Adapt the signature to the problem.\n}\n",
  },
  {
    id: "kotlin",
    label: "Kotlin",
    monacoLanguage: "kotlin",
    extension: "kt",
    starterCode:
      "class Solution {\n    fun solve() {\n        // Adapt the signature to the problem.\n    }\n}\n",
  },
  {
    id: "rust",
    label: "Rust",
    monacoLanguage: "rust",
    extension: "rs",
    starterCode:
      "struct Solution;\n\nimpl Solution {\n    pub fn solve() {\n        // Adapt the signature to the problem.\n        todo!();\n    }\n}\n",
  },
] as const;

export type CodeLanguageId = (typeof codeLanguages)[number]["id"];
export const defaultCodeLanguage = codeLanguages[0];
