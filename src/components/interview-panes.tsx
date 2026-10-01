"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { GroupImperativeHandle } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { defaultLayout, readLayout, saveLayout } from "@/lib/interview/layout-storage";

const desktopQuery = "(min-width: 1280px)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getSnapshot = () => window.matchMedia(desktopQuery).matches;
const getServerSnapshot = () => false;

// Server-rendered panels are passed as slots; only pane selection is client-side.
export function InterviewPanes({ problem, workspace, interviewer }: {
  problem: ReactNode;
  workspace: ReactNode;
  interviewer: ReactNode;
}) {
  const desktop = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [activePane, setActivePane] = useState<string | number | null>("workspace");
  const groupRef = useRef<GroupImperativeHandle>(null);
  useEffect(() => {
    if (desktop) groupRef.current?.setLayout(readLayout());
  }, [desktop]);
  function resetLayout() {
    groupRef.current?.setLayout(defaultLayout);
    saveLayout(defaultLayout);
  }
  const panels = [
    { value: "problem", label: "Problem", content: problem },
    { value: "workspace", label: "Workspace", content: workspace },
    { value: "interviewer", label: "AI Interviewer", content: interviewer },
  ];

  return (
    <Tabs value={activePane} onValueChange={setActivePane} className="min-h-0 flex-1 gap-0">
      <TabsList variant="line" aria-label="Interview panes" className="w-full shrink-0 border-b xl:hidden">
        {panels.map(({ value, label }) => <TabsTrigger key={value} id={`pane-tab-${value}`} value={value}>{label}</TabsTrigger>)}
      </TabsList>
      <ResizablePanelGroup
        orientation="horizontal"
        groupRef={groupRef}
        disabled={!desktop}
        defaultLayout={defaultLayout}
        resizeTargetMinimumSize={{ fine: 12, coarse: 24 }}
        onLayoutChanged={(layout, meta) => {
          if (desktop && meta.isUserInteraction) saveLayout(meta.requestedLayout ?? layout);
        }}
        className="min-h-0 flex-1 max-xl:[&>[data-panel]]:hidden! max-xl:[&>[data-panel][data-active=true]]:flex! max-xl:[&>[data-panel][data-active=true]]:flex-1!"
      >
        {panels.map(({ value, label, content }, index) => (
          <Fragment key={value}>
          {index > 0 && <ResizableHandle
            aria-label={`Resize ${panels[index - 1].label} and ${label}`}
            title="Drag to resize. Double-click to reset layout."
            disableDoubleClick
            onDoubleClick={resetLayout}
            className="z-10 cursor-col-resize bg-border data-[separator=hover]:bg-muted-foreground data-[separator=active]:bg-foreground max-xl:hidden"
          />}
          <ResizablePanel
            id={value}
            data-active={activePane === value}
            defaultSize={`${defaultLayout[value as keyof typeof defaultLayout]}%`}
            minSize={value === "workspace" ? "30%" : "15%"}
            maxSize={value === "workspace" ? "70%" : "40%"}
            className="min-h-0 min-w-0"
          >
          <TabsContent
            key={value}
            value={value}
            keepMounted
            hidden={!desktop && activePane !== value}
            inert={!desktop && activePane !== value}
            role={desktop ? "region" : "tabpanel"}
            aria-label={desktop ? label : undefined}
            aria-labelledby={desktop ? undefined : `pane-tab-${value}`}
            className="h-full min-h-0 min-w-0 overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            {content}
          </TabsContent>
          </ResizablePanel>
          </Fragment>
        ))}
      </ResizablePanelGroup>
    </Tabs>
  );
}
