import { AlertTriangle, Boxes, DollarSign, Gauge, Network, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { ArchitectureGraph, ArchitectureZone } from "../../domain/graph";
import type { CloudService } from "../../domain/types";
import { ArchitectureAnalysisPanel } from "../analysis/ArchitectureAnalysisPanel";
import { ServicePalette } from "./ServicePalette";
import { ZonePalette } from "./ZonePalette";

type CanvasPaletteProps = {
  mode: "services" | "network" | "security" | "costs" | "quotas" | "issues" | "configuration";
  onModeChange: (mode: "services" | "network" | "security" | "costs" | "quotas" | "issues" | "configuration") => void;
  highlightedFindingId?: string;
  highlightedFindingVersion?: number;
  refreshKey?: number;
  services: CloudService[];
  servicesById: Map<string, CloudService>;
  graph: ArchitectureGraph;
  zones: ArchitectureZone[];
  selectedZoneId?: string;
  activeNodeCount: number;
  onAddService: (service: CloudService) => void;
  onAddRouteTable: () => void;
  onInspectService: (service: CloudService) => void;
  onAddZone: (kind: "region" | "vpc" | "availability-zone" | "subnet-public" | "subnet-private") => void;
  onReorderZoneLayer: (zoneId: string, direction: "up" | "down") => void;
  onSelectZone: (zoneId: string) => void;
  onDeleteSelectedZone: () => void;
  onRefreshChecks?: () => void;
};

export function CanvasPalette({ mode, onModeChange, ...props }: CanvasPaletteProps) {
  return (
    <div className="canvas-palette">
      <div className="palette-mode-switch" role="tablist" aria-label="Canvas palette mode">
        <button className={mode === "services" ? "palette-mode palette-mode--active" : "palette-mode"} onClick={() => onModeChange("services")} role="tab" aria-selected={mode === "services"} type="button"><Boxes size={16} aria-hidden="true" /> Core services</button>
        <button className={mode === "network" ? "palette-mode palette-mode--active" : "palette-mode"} onClick={() => onModeChange("network")} role="tab" aria-selected={mode === "network"} type="button"><Network size={16} aria-hidden="true" /> Networking</button>
        <button className={mode === "issues" ? "palette-mode palette-mode--active" : "palette-mode"} onClick={() => onModeChange("issues")} role="tab" aria-selected={mode === "issues"} type="button"><AlertTriangle size={16} aria-hidden="true" /> Architecture</button>
        <button className={mode === "configuration" ? "palette-mode palette-mode--active" : "palette-mode"} onClick={() => onModeChange("configuration")} role="tab" aria-selected={mode === "configuration"} type="button"><SlidersHorizontal size={16} aria-hidden="true" /> Configuration</button>
        <button className={mode === "security" ? "palette-mode palette-mode--active" : "palette-mode"} onClick={() => onModeChange("security")} role="tab" aria-selected={mode === "security"} type="button"><ShieldCheck size={16} aria-hidden="true" /> Security and Access</button>
        <button className={mode === "costs" ? "palette-mode palette-mode--active" : "palette-mode"} onClick={() => onModeChange("costs")} role="tab" aria-selected={mode === "costs"} type="button"><DollarSign size={16} aria-hidden="true" /> Costs</button>
        <button className={mode === "quotas" ? "palette-mode palette-mode--active" : "palette-mode"} onClick={() => onModeChange("quotas")} role="tab" aria-selected={mode === "quotas"} type="button"><Gauge size={16} aria-hidden="true" /> Quotas</button>
      </div>
      {mode === "services" ? <ServicePalette activeNodeCount={props.activeNodeCount} onAddService={props.onAddService} onInspectService={props.onInspectService} services={props.services} /> : null}
      {mode === "network" ? (
        <ZonePalette
          onAddService={props.onAddService}
          onAddRouteTable={props.onAddRouteTable}
          onAddZone={props.onAddZone}
          onDeleteSelectedZone={props.onDeleteSelectedZone}
          onInspectService={props.onInspectService}
          onReorderZoneLayer={props.onReorderZoneLayer}
          onSelectZone={props.onSelectZone}
          selectedZoneId={props.selectedZoneId}
          services={props.services}
          zones={props.zones}
        />
      ) : null}
      {mode === "security" ? (
        <ArchitectureAnalysisPanel
          eyebrow="AWS SAA"
          fixedTab="security"
          graph={props.graph}
          highlightedFindingId={props.highlightedFindingId}
          highlightedFindingVersion={props.highlightedFindingVersion}
          refreshKey={props.refreshKey}
          onRefreshChecks={props.onRefreshChecks}
          servicesById={props.servicesById}
          title="Security and Access"
        />
      ) : null}
      {mode === "issues" ? (
        <ArchitectureAnalysisPanel
          eyebrow="AWS SAA"
          fixedTab="issues"
          graph={props.graph}
          highlightedFindingId={props.highlightedFindingId}
          highlightedFindingVersion={props.highlightedFindingVersion}
          refreshKey={props.refreshKey}
          onRefreshChecks={props.onRefreshChecks}
          servicesById={props.servicesById}
          title="Architecture Errors"
        />
      ) : null}
      {mode === "configuration" ? (
        <ArchitectureAnalysisPanel
          eyebrow="AWS SAA"
          fixedTab="configuration"
          graph={props.graph}
          highlightedFindingId={props.highlightedFindingId}
          highlightedFindingVersion={props.highlightedFindingVersion}
          refreshKey={props.refreshKey}
          onRefreshChecks={props.onRefreshChecks}
          servicesById={props.servicesById}
          title="Configuration Checks"
        />
      ) : null}
      {mode === "costs" ? (
        <ArchitectureAnalysisPanel
          eyebrow="AWS SAA"
          fixedTab="cost"
          graph={props.graph}
          refreshKey={props.refreshKey}
          onRefreshChecks={props.onRefreshChecks}
          servicesById={props.servicesById}
          title="Costs"
        />
      ) : null}
      {mode === "quotas" ? (
        <ArchitectureAnalysisPanel
          eyebrow="AWS SAA"
          fixedTab="quotas"
          graph={props.graph}
          refreshKey={props.refreshKey}
          onRefreshChecks={props.onRefreshChecks}
          servicesById={props.servicesById}
          title="Service Quotas"
        />
      ) : null}
    </div>
  );
}
