import {
  CircleHelp,
  CodeXml,
  Database,
  Landmark,
  LayoutGrid,
  MessagesSquare,
  Network,
  type LucideIcon,
} from "lucide-react";

const icons = new Map<string, LucideIcon>([
  ["circle-help", CircleHelp],
  ["code-xml", CodeXml],
  ["database", Database],
  ["landmark", Landmark],
  ["layout-grid", LayoutGrid],
  ["messages-square", MessagesSquare],
  ["network", Network],
]);

export function resolveIcon(name?: string): LucideIcon {
  return icons.get(name ?? "") ?? CircleHelp;
}
