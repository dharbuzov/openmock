"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { codeLanguages, defaultCodeLanguage, type CodeLanguageId } from "@/lib/code/languages";

const languageItems = codeLanguages.map(({ id, label }) => ({ value: id, label }));

const Editor = dynamic(() => import("@monaco-editor/react").then((module) => module.default), {
  ssr: false,
  loading: () => <p role="status" className="p-4 text-sm text-muted-foreground">Loading editor…</p>,
});

export function CodeWorkspace({ starterCode }: { starterCode: string }) {
  const [runRequested, setRunRequested] = useState(false);
  const [language, setLanguage] = useState<(typeof codeLanguages)[number]>(defaultCodeLanguage);
  const [buffers, setBuffers] = useState<Partial<Record<CodeLanguageId, string>>>(() => ({
    java: starterCode || defaultCodeLanguage.starterCode,
  }));

  return (
    <section aria-label="Coding workspace" className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b px-4">
        <h2 className="min-w-0 truncate font-mono text-xs">Solution.{language.extension}</h2>
        <div className="flex items-center gap-3">
          <Select items={languageItems} value={language.id} onValueChange={(id) => {
            const next = codeLanguages.find((item) => item.id === id);
            if (next) setLanguage(next);
          }}>
            <SelectTrigger size="sm" aria-label="Programming language"><SelectValue /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {languageItems.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setRunRequested(true)} title="Preview only; execution is not connected">
            <Play aria-hidden="true" data-icon="inline-start" />Run
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={language.monacoLanguage}
          value={buffers[language.id] ?? language.starterCode}
          onChange={(value) => setBuffers((current) => ({ ...current, [language.id]: value ?? "" }))}
          theme="vs"
          loading={<p role="status" className="p-4 text-sm text-muted-foreground">Loading editor…</p>}
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
      <section aria-labelledby="test-results-heading" className="flex h-40 shrink-0 flex-col border-t">
        <div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
          <h3 id="test-results-heading" className="text-xs font-medium">Test Results</h3>
          <span className="text-xs text-muted-foreground">Preview</span>
        </div>
        <div role="status" className="flex flex-col gap-2 overflow-y-auto p-4 text-xs leading-5">
          <p className="font-mono">{runRequested ? "Run requested — execution unavailable." : "No tests run."}</p>
          <p className="text-muted-foreground">Execution is not connected yet. Your code is editable, but Run does not compile or evaluate it.</p>
        </div>
      </section>
    </section>
  );
}
