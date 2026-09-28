export function Whiteboard() {
  return (
    <section aria-labelledby="workspace-heading" className="flex min-h-96 min-w-0 flex-col gap-6 border-b p-5 lg:border-r lg:border-b-0">
      <h2 id="workspace-heading" className="text-sm font-medium">Workspace</h2>
      <p className="text-sm leading-6 text-muted-foreground">Whiteboard placeholder. Use this space to plan an approach, sketch a design, or work through an algorithm.</p>
      <pre className="flex-1 whitespace-pre-wrap font-mono text-xs leading-7 text-muted-foreground">{"// 1. Clarify requirements\n// 2. Outline an approach\n// 3. Discuss trade-offs"}</pre>
      <p className="text-xs text-muted-foreground">Editing and drawing will be available in a future version.</p>
    </section>
  );
}
