import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  ArchitectureDiagram,
  DiagramEdge,
  DiagramNode,
  DiagramPlacement,
} from "./types";

const nodeTypes = new Set<DiagramNode["type"]>([
  "rectangle",
  "ellipse",
  "diamond",
  "frame",
]);
const maxNodes = 80;
const maxEdges = 120;

function compactLabel(value: string | null | undefined): string | undefined {
  const compact = value?.replace(/\s+/g, " ").trim();
  return compact ? compact.slice(0, 160) : undefined;
}

function placement(element: ExcalidrawElement): DiagramPlacement {
  const { x, y, width, height, frameId, groupIds } = element;
  return {
    ...([x, y, width, height].every(Number.isFinite)
      ? { bounds: { x, y, width, height } }
      : {}),
    ...(frameId ? { frameId } : {}),
    ...(groupIds?.length ? { groupIds } : {}),
  };
}

export function normalizeExcalidrawScene(
  elements: readonly ExcalidrawElement[],
): ArchitectureDiagram {
  const visible = elements.filter((element) => !element.isDeleted);
  const textById = new Map(
    visible
      .filter((element) => element.type === "text")
      .map((element) => [element.id, element]),
  );
  const labelsByContainer = new Map<string, string[]>();
  const containersByText = new Map<string, string>();
  for (const element of visible) {
    for (const binding of element.boundElements ?? []) {
      if (binding.type === "text") containersByText.set(binding.id, element.id);
    }
  }

  for (const element of visible) {
    if (element.type !== "text" || !element.containerId) continue;
    const label = compactLabel(element.text);
    if (!label) continue;
    const labels = labelsByContainer.get(element.containerId) ?? [];
    labels.push(label);
    labelsByContainer.set(element.containerId, labels);
  }

  function labelFor(element: ExcalidrawElement): string | undefined {
    const labels = [...(labelsByContainer.get(element.id) ?? [])];
    for (const binding of element.boundElements ?? []) {
      if (binding.type !== "text") continue;
      const boundText = textById.get(binding.id);
      const label =
        boundText?.type === "text" ? compactLabel(boundText.text) : undefined;
      if (label && !labels.includes(label)) labels.push(label);
    }
    if (labels.length > 0) return compactLabel(labels.join(" "));
    return element.type === "frame" ? compactLabel(element.name) : undefined;
  }

  const nodes: DiagramNode[] = visible
    .filter(
      (element): element is ExcalidrawElement & { type: DiagramNode["type"] } =>
        nodeTypes.has(element.type as DiagramNode["type"]),
    )
    .slice(0, maxNodes)
    .map((element) => {
      const label = labelFor(element);
      return {
        id: element.id,
        type: element.type,
        ...placement(element),
        ...(label ? { label } : {}),
      };
    });

  const nodeIds = new Set(nodes.map(({ id }) => id));
  const edges: DiagramEdge[] = [];
  for (const element of visible) {
    if (element.type !== "arrow" && element.type !== "line") continue;
    const from = element.startBinding?.elementId;
    const to = element.endBinding?.elementId;
    const resolvedFrom = from && nodeIds.has(from) ? from : undefined;
    const resolvedTo = to && nodeIds.has(to) ? to : undefined;
    const label = labelFor(element);
    if (!resolvedFrom && !resolvedTo && !label) continue;
    edges.push({
      id: element.id,
      type: element.type,
      ...placement(element),
      ...(resolvedFrom ? { from: resolvedFrom } : {}),
      ...(resolvedTo ? { to: resolvedTo } : {}),
      ...(label ? { label } : {}),
    });
    if (edges.length === maxEdges) break;
  }

  const texts = visible.flatMap((element) => {
    if (element.type !== "text") return [];
    // originalText preserves authored line breaks rather than renderer wrapping.
    const text = element.originalText ?? element.text;
    if (!text.trim()) return [];
    const containerId = element.containerId ?? containersByText.get(element.id);
    return [
      {
        id: element.id,
        text,
        ...placement(element),
        ...(containerId ? { containerId } : {}),
      },
    ];
  });

  return { nodes, edges, texts };
}

export function captureArchitectureDiagram(
  readScene: () => readonly ExcalidrawElement[],
): ArchitectureDiagram {
  return normalizeExcalidrawScene(readScene());
}
