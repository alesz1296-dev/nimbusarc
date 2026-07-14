import { MapPinned, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ArchitectureNode } from "../../domain/graph";
import type { CloudService } from "../../domain/types";
import { AwsServiceIcon } from "../../ui/AwsServiceIcon";
import { Panel } from "../../ui/Panel";

type ResourceInventoryPanelProps = {
  nodes: ArchitectureNode[];
  servicesById: Map<string, CloudService>;
  selectedNodeId?: string;
  onSelectNode: (nodeId: string) => void;
  onLocateNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
};

export function ResourceInventoryPanel({
  nodes,
  servicesById,
  selectedNodeId,
  onSelectNode,
  onLocateNode,
  onDeleteNode,
}: ResourceInventoryPanelProps) {
  const [query, setQuery] = useState("");

  const groupedCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();

    for (const node of nodes) {
      const label = servicesById.get(node.serviceId)?.name ?? node.label;
      const current = counts.get(label);
      counts.set(label, { label, count: (current?.count ?? 0) + 1 });
    }

    return [...counts.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }, [nodes, servicesById]);

  const visibleNodes = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return nodes.filter((node) => {
      const service = servicesById.get(node.serviceId);
      const text = [
        node.label,
        service?.name ?? "",
        service?.category ?? "",
        node.zoneId ?? "",
      ].join(" ").toLowerCase();

      return !normalized || text.includes(normalized);
    });
  }, [nodes, query, servicesById]);

  return (
    <Panel title="Resource Inventory" eyebrow="Canvas resources" actions={<span>{nodes.length} total</span>}>
      <div className="inventory-panel">
        <label className="service-search" htmlFor="inventory-search">
          <Search aria-hidden="true" size={15} />
          <input
            id="inventory-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find services on canvas"
            type="search"
            value={query}
          />
        </label>
        <div className="inventory-panel__counts" role="list" aria-label="Service counts">
          {groupedCounts.map((entry) => (
            <span className="service-category-chip" key={entry.label}>
              <span>{entry.label}</span>
              <small>{entry.count}</small>
            </span>
          ))}
        </div>
        <div className="inventory-panel__list">
          {visibleNodes.map((node) => {
            const service = servicesById.get(node.serviceId);
            const isSelected = selectedNodeId === node.id;

            return (
              <div className={`inventory-item ${isSelected ? "inventory-item--selected" : ""}`} key={node.id}>
                <button className="inventory-item__main" onClick={() => onSelectNode(node.id)} type="button">
                  <AwsServiceIcon label={node.label} serviceId={node.serviceId} size="sm" />
                  <span>
                    <strong>{node.label}</strong>
                    <small>{service?.name ?? node.serviceId}{node.zoneId ? ` · ${node.zoneId}` : ""}</small>
                  </span>
                </button>
                <div className="inventory-item__actions">
                  <button className="icon-button" onClick={() => onLocateNode(node.id)} title="Locate this resource" type="button">
                    <MapPinned size={15} aria-hidden="true" />
                  </button>
                  <button className="icon-button" onClick={() => onDeleteNode(node.id)} title="Delete this resource" type="button">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
          {visibleNodes.length === 0 ? (
            <p className="service-list__empty">No canvas resources match this search.</p>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
