import { useMemo, useState } from "react";

export interface WorkflowGraphNode {
  id: string;
  kind: "page" | "form" | "field" | "button";
  label: string;
  url?: string;
  status?: "discovered" | "visited" | "completed" | "failed" | "blocked";
}

export interface WorkflowGraphEdge {
  id: string;
  from: string;
  to: string;
  kind: "navigation" | "contains" | "workflow" | "suggested";
  observed: boolean;
  label?: string;
}

const COLUMN_WIDTH = 230;

export function WorkflowMap({ nodes, edges }: { nodes: WorkflowGraphNode[]; edges: WorkflowGraphEdge[] }) {
  const flow = useMemo(() => buildFlow(nodes, edges), [nodes, edges]);
  const [selected, setSelected] = useState<string | null>(flow[0]?.page.id ?? null);
  const active = flow.find((column) => column.page.id === selected) ?? null;
  const height = Math.max(220, 92 + Math.max(0, ...flow.map((column) => column.fields.length)) * 22);

  if (flow.length === 0) {
    return <p className="text-sm text-slate-600">The website flow appears after the scanner reads the pages.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Read left to right. Each box is a page. The lines under it are the fields on that page and the dummy data that belongs there.
      </p>
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <svg width={Math.max(640, flow.length * COLUMN_WIDTH + 24)} height={height} role="img" aria-label="Website flow">
          {flow.slice(0, -1).map((column, index) => {
            const next = flow[index + 1];
            if (!next) return null;
            return (
              <line
                key={`${column.page.id}-${next.page.id}`}
                x1={28 + index * COLUMN_WIDTH + 180}
                y1={42}
                x2={28 + (index + 1) * COLUMN_WIDTH}
                y2={42}
                stroke="#9A3412"
                strokeWidth={1.5}
                markerEnd="url(#flow-arrow)"
              />
            );
          })}
          <defs>
            <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="#9A3412" />
            </marker>
          </defs>
          {flow.map((column, index) => {
            const chosen = column.page.id === selected;
            const x = 28 + index * COLUMN_WIDTH;
            return (
              <g key={column.page.id} transform={`translate(${x} 16)`} onClick={() => setSelected(column.page.id)} className="cursor-pointer">
                <rect width={190} height={52} rx={10} fill={chosen ? "#FFEDD5" : "#FFFBF5"} stroke={statusColor(column.page.status)} />
                <text x={10} y={20} fontSize={10} fill="#9A3412">
                  Page {index + 1}
                </text>
                <text x={10} y={38} fontSize={13} fill="#1C1917">
                  {column.page.label.slice(0, 24)}
                </text>
                {column.fields.length === 0 ? (
                  <text x={4} y={78} fontSize={11} fill="#78716C">
                    No data fields
                  </text>
                ) : (
                  column.fields.map((field, fieldIndex) => (
                    <text key={field.id} x={4} y={84 + fieldIndex * 22} fontSize={11} fill="#1C1917">
                      {field.label.slice(0, 34)}
                    </text>
                  ))
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {active ? (
        <div className="rounded-xl border border-slate-200 p-3 text-sm">
          <p className="font-medium">{active.page.label}</p>
          {active.page.url ? <p className="break-all text-slate-600">{active.page.url}</p> : null}
          {active.fields.length ? (
            <ul className="mt-2 space-y-1 text-slate-700">
              {active.fields.map((field) => (
                <li key={field.id}>{field.label}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-slate-600">This page has no fields that need dummy data.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function buildFlow(nodes: WorkflowGraphNode[], edges: WorkflowGraphEdge[]) {
  const pages = nodes.filter((node) => node.kind === "page");
  const incoming = new Set(edges.filter((edge) => edge.kind === "navigation" || edge.kind === "workflow").map((edge) => edge.to));
  const ordered: WorkflowGraphNode[] = [];
  const seen = new Set<string>();
  const visit = (page: WorkflowGraphNode) => {
    if (seen.has(page.id)) return;
    seen.add(page.id);
    ordered.push(page);
    for (const edge of edges) {
      if (edge.from !== page.id || (edge.kind !== "navigation" && edge.kind !== "workflow")) continue;
      const next = pages.find((item) => item.id === edge.to);
      if (next) visit(next);
    }
  };
  for (const page of pages) {
    if (!incoming.has(page.id)) visit(page);
  }
  for (const page of pages) visit(page);
  return ordered.map((page) => ({
    page,
    fields: fieldsUnder(page.id, nodes, edges),
  }));
}

function fieldsUnder(pageId: string, nodes: WorkflowGraphNode[], edges: WorkflowGraphEdge[]) {
  const childIds = new Set(edges.filter((edge) => edge.from === pageId && edge.kind === "contains").map((edge) => edge.to));
  const fieldIds = new Set(
    edges
      .filter((edge) => childIds.has(edge.from) && edge.kind === "contains")
      .map((edge) => edge.to),
  );
  return nodes.filter((node) => fieldIds.has(node.id) && node.kind === "field");
}

function statusColor(status: WorkflowGraphNode["status"]): string {
  if (status === "completed") return "#047857";
  if (status === "failed" || status === "blocked") return "#BE123C";
  if (status === "visited") return "#C2410C";
  return "#CBD5E1";
}
