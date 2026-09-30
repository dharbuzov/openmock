export type DiagramNode = {
  id: string;
  type: string;
  label?: string;
};

export type DiagramEdge = {
  id: string;
  type: string;
  from?: string;
  to?: string;
  label?: string;
};

export type ArchitectureDiagram = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};
