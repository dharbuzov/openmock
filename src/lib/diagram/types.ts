export type DiagramNode = {
  id: string;
  type: "rectangle" | "ellipse" | "diamond" | "frame";
  label?: string;
};

export type DiagramEdge = {
  id: string;
  type: "arrow" | "line";
  from?: string;
  to?: string;
  label?: string;
};

export type ArchitectureDiagram = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};
