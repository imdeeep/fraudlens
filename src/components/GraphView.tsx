"use client";
import { useEffect, useRef } from "react";
import type { AnalyzeResponse } from "@/lib/types";

type Props = {
  result: AnalyzeResponse;
  onSelect: (entityId: string | null, info: string) => void;
};

// Node palette (§14) tuned for #010102 canvas
function nodeColor(id: string, result: AnalyzeResponse): string {
  const ent = result.entities.find((e) => e.id === id);
  const risk = result.riskResults.find((r) => r.entityId === id);
  const chain = result.transactionChain;
  if (chain.length > 0) {
    const label = ent?.label ?? id.split(":")[1] ?? id;
    if (label === chain[0]) return "#4f8ff7"; // victim blue
    if (label === chain[chain.length - 1]) return "#991b1b"; // cash-out dark red
    if (chain.includes(label)) return "#f59e0b"; // mule orange
  }
  if ((risk?.score ?? 0) >= 60) return "#ef4444"; // high-risk red
  if (id.startsWith("phone:")) return "#a78bfa"; // violet
  if (id.startsWith("device:")) return "#a78bfa";
  if (id.startsWith("imei:") || id.startsWith("imsi:")) return "#a78bfa";
  if (id.startsWith("acct:") || id.startsWith("upi:")) return "#5e6ad2"; // lavender purple
  if (id.startsWith("ip:")) return "#22d3ee"; // cyan
  if (id.startsWith("txn:")) return "#8a8f98";
  return "#8a8f98";
}

export function GraphView({ result, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cytoscape = (await import("cytoscape")).default;
      if (!ref.current || cancelled) return;
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      const nodes = result.entities.map((e) => ({
        data: {
          id: e.id,
          label: e.label.length > 18 ? e.label.slice(0, 17) + "…" : e.label,
          fullLabel: e.label,
          type: e.type,
          color: nodeColor(e.id, result),
          score: e.riskScore ?? "",
        },
      }));
      const edges = result.relationships.map((r) => {
        const isTransfer = r.relationshipType.startsWith("transfer");
        const isIp =
          r.relationshipType.startsWith("shared_ip") || r.relationshipType === "used_ip";
        return {
          data: {
            id: r.id,
            source: r.sourceEntityId,
            target: r.targetEntityId,
            label: isTransfer
              ? `₹${(r.amount ?? 0).toLocaleString("en-IN")}`
              : r.confidence < 1
                ? "contextual"
                : "",
            isTransfer,
            isIp,
          },
        };
      });
      const cy = cytoscape({
        container: ref.current,
        elements: [...nodes, ...edges],
        style: [
          {
            selector: "node",
            style: {
              "background-color": "data(color)",
              label: "data(label)",
              color: "#f7f8f8",
              "font-size": "9px",
              "text-valign": "bottom",
              "text-margin-y": 6,
              width: 26,
              height: 26,
              "border-width": 1,
              "border-color": "#34343a",
            } as unknown as Record<string, string | number>,
          },
          {
            selector: "edge",
            style: {
              width: "data(isTransfer)",
              // cytoscape style mapping handled below via classes
              "line-color": "#3e3e44",
              "target-arrow-color": "#3e3e44",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              color: "#d0d6e0",
              "font-size": "8px",
              label: "data(label)",
            } as unknown as Record<string, string | number>,
          },
        ],
        layout: { name: "cose", animate: false, nodeRepulsion: 8000, idealEdgeLength: 110 } as never,
      });
      // Post-style edges by class
      cy.edges().forEach((e) => {
        const d = e.data();
        if (d.isTransfer) {
          e.style({ width: 4, "line-color": "#828fff", "target-arrow-color": "#828fff" });
        } else if (d.isIp) {
          e.style({
            width: 1.5,
            "line-color": "#22d3ee",
            "target-arrow-color": "#22d3ee",
            "line-style": "dashed",
          });
        } else {
          e.style({ width: 1.5 });
        }
      });
      cy.on("tap", "node", (evt) => {
        const n = evt.target;
        const id = n.id() as string;
        const ent = result.entities.find((e) => e.id === id);
        const risk = result.riskResults.find((r) => r.entityId === id);
        const linked = result.relationships
          .filter((r) => r.sourceEntityId === id || r.targetEntityId === id)
          .slice(0, 8)
          .map((r) => `${r.sourceEntityId} → ${r.targetEntityId} (${r.relationshipType}, ${r.confidence})`)
          .join("\n");
        const ev = [
          ...new Set(
            result.relationships
              .filter((r) => r.sourceEntityId === id || r.targetEntityId === id)
              .flatMap((r) => r.evidenceIds)
          ),
        ].join(", ");
        onSelect(
          id,
          [
            `Type: ${ent?.type ?? "?"}`,
            `Label: ${ent?.label ?? id}`,
            `Risk: ${risk ? `${risk.score} (${risk.band})` : "-"}`,
            ev ? `Evidence: ${ev}` : "Evidence: -",
            linked ? `Links:\n${linked}` : "Links: -",
          ].join("\n")
        );
      });
      cy.on("tap", (evt) => {
        if (evt.target === cy) onSelect(null, "");
      });
      cyRef.current = cy;
    })();
    return () => {
      cancelled = true;
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [result, onSelect]);

  return (
    <div>
      <div ref={ref} className="cy-container" />
      <p className="mt-2 text-xs text-inksubtle">
        <span className="text-inkmuted">→ thick lavender</span> = money movement ·{" "}
        <span className="text-inkmuted">solid</span> = shared identifier ·{" "}
        <span className="text-cyan-300">dashed</span> = contextual IP (not proof). Click a node for
        details.
      </p>
    </div>
  );
}
