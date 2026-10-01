export type DiagramPlacement = {
  bounds?: { x: number; y: number; width: number; height: number };
  frameId?: string;
  groupIds?: readonly string[];
};

export type DiagramNode = DiagramPlacement & {
  id: string;
  type: string;
  label?: string;
};

export type DiagramEdge = DiagramPlacement & {
  id: string;
  type: string;
  from?: string;
  to?: string;
  label?: string;
};

export type ArchitectureDiagram = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  texts?: (DiagramPlacement & {
    id: string;
    text: string;
    containerId?: string;
  })[];
};
