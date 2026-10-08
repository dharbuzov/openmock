"use client";

import { useEffect, useRef, useState } from "react";
import type { Monaco } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { useInterviewCode } from "@/components/interview-code-context";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  codeLanguages,
  defaultCodeLanguage,
  type CodeLanguageId,
} from "@/lib/code/languages";

const languageItems = codeLanguages.map(({ id, label }) => ({
  value: id,
  label,
}));

const Editor = dynamic(
  () => import("@monaco-editor/react").then((module) => module.default),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="p-4 text-sm text-muted-foreground">
        Loading editor…
      </p>
    ),
  },
);

// Inherit syntax, cursor, selection and diagnostics from Monaco's native theme.
function applyDarkTheme(monaco: Monaco) {
  const background = getComputedStyle(document.documentElement)
    .getPropertyValue("--workspace")
    .trim();
  monaco.editor.defineTheme("openmock-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": background,
      "editorGutter.background": background,
    },
  });
  monaco.editor.setTheme("openmock-dark");
}

export function CodeWorkspace({ starterCode }: { starterCode: string }) {
  const { resolvedTheme } = useTheme();
  const codeRef = useInterviewCode();
  const monacoRef = useRef<Monaco | null>(null);
  useEffect(() => {
    if (resolvedTheme === "dark" && monacoRef.current) {
      applyDarkTheme(monacoRef.current);
    }
  }, [resolvedTheme]);
  const [language, setLanguage] =
    useState<(typeof codeLanguages)[number]>(defaultCodeLanguage);
  const [buffers, setBuffers] = useState<
    Partial<Record<CodeLanguageId, string>>
  >(() => ({
    java: starterCode || defaultCodeLanguage.starterCode,
  }));
  const content = buffers[language.id] ?? language.starterCode;
  useEffect(() => {
    codeRef.current = {
      language: language.label,
      filename: `Solution.${language.extension}`,
      code: content,
    };
  }, [codeRef, language.label, language.extension, content]);

  return (
    <section
      aria-label="Coding workspace"
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b px-4">
        <h2 className="min-w-0 truncate font-mono text-xs">
          Solution.{language.extension}
        </h2>
        <div className="flex items-center gap-3">
          <Select
            items={languageItems}
            value={language.id}
            onValueChange={(id) => {
              const next = codeLanguages.find((item) => item.id === id);
              if (next) setLanguage(next);
            }}
          >
            <SelectTrigger size="sm" aria-label="Programming language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {languageItems.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={language.monacoLanguage}
          value={content}
          onChange={(value) =>
            setBuffers((current) => ({
              ...current,
              [language.id]: value ?? "",
            }))
          }
          onMount={(_, monaco) => {
            monacoRef.current = monaco;
            if (resolvedTheme === "dark") applyDarkTheme(monaco);
          }}
          theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
          loading={
            <p role="status" className="p-4 text-sm text-muted-foreground">
              Loading editor…
            </p>
          }
          options={{
            ariaLabel: `${language.label} solution editor`,
            automaticLayout: true,
            minimap: { enabled: false },
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: 13,
            lineHeight: 22,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            folding: false,
            glyphMargin: false,
            lineDecorationsWidth: 8,
            lineNumbersMinChars: 3,
            renderLineHighlight: "line",
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            padding: { top: 16, bottom: 16 },
            tabSize: 4,
            wordWrap: "on",
          }}
        />
      </div>
    </section>
  );
}
