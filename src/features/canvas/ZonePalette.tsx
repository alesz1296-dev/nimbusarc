import { ArrowDown, ArrowUp, CircleHelp, GripVertical, Layers, Plus, Trash2 } from "lucide-react";
import type { DragEvent } from "react";
import type { ArchitectureZone } from "../../domain/graph";
import type { CloudService } from "../../domain/types";
import { Panel } from "../../ui/Panel";
import { AwsServiceIcon } from "../../ui/AwsServiceIcon";
import { isNetworkPaletteService, networkPaletteServiceIds } from "./networkPaletteServices";

type ZoneAddKind = "region" | "vpc" | "availability-zone" | "subnet-public" | "subnet-private";

type ZonePaletteProps = {
  services: CloudService[];
  zones: ArchitectureZone[];
  selectedZoneId?: string;
  onAddService: (service: CloudService) => void;
  onAddRouteTable: () => void;
  onInspectService: (service: CloudService) => void;
  onAddZone: (kind: ZoneAddKind) => void;
  onReorderZoneLayer: (zoneId: string, direction: "up" | "down") => void;
  onSelectZone: (zoneId: string) => void;
  onDeleteSelectedZone: () => void;
};

const zoneActions: Array<{ kind: ZoneAddKind; label: string; detail: string }> = [
  { kind: "region", label: "AWS Region", detail: "Regional boundary" },
  { kind: "vpc", label: "VPC", detail: "Isolated network" },
  { kind: "availability-zone", label: "Availability Zone", detail: "Independent AZ" },
  { kind: "subnet-public", label: "Public Subnet", detail: "Ingress or edge subnet" },
  { kind: "subnet-private", label: "Private Subnet", detail: "Application or data subnet" },
];

function formatZoneScope(zone: ArchitectureZone) {
  const details = [zone.kind.replaceAll("-", " ")];

  if (zone.config?.subnetAccess) {
    details.push(zone.config.subnetAccess);
  }

  if (zone.config?.cidrIpv4) {
    details.push(zone.config.cidrIpv4);
  } else if (zone.config?.cidrBlock) {
    details.push(zone.config.cidrBlock);
  }

  if (zone.config?.cidrIpv6) {
    details.push(zone.config.cidrIpv6);
  }

  return details.join(" · ");
}

function handleZoneActionDragStart(event: DragEvent<HTMLButtonElement>, kind: ZoneAddKind) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("application/x-nimbusarc-palette", JSON.stringify({
    type: "zone",
    zoneKind: kind,
  }));
}

function handleServiceDragStart(event: DragEvent<HTMLElement>, service: CloudService) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("application/x-nimbusarc-palette", JSON.stringify({
    type: "service",
    serviceId: service.id,
  }));
}

export function ZonePalette({
  services,
  zones,
  selectedZoneId,
  onAddService,
  onAddRouteTable,
  onInspectService,
  onAddZone,
  onReorderZoneLayer,
  onSelectZone,
  onDeleteSelectedZone,
}: ZonePaletteProps) {
  const orderedZones = [...zones].sort((left, right) => (right.layerOrder ?? 0) - (left.layerOrder ?? 0));
  const paletteServices = services.filter((service) =>
    isNetworkPaletteService(service.id)
    && !["aws-vpc", "aws-public-subnet", "aws-private-subnet"].includes(service.id)
    && networkPaletteServiceIds.includes(service.id as (typeof networkPaletteServiceIds)[number]),
  );

  return (
    <Panel
      title="Network Scopes"
      eyebrow="AWS SAA"
      actions={<span>{zones.length} defined</span>}
    >
      <div className="zone-palette" id="network-scopes">
        <div className="zone-palette__actions">
          {zoneActions.map((action) => (
            <button
              className="zone-action"
              draggable
              key={action.kind}
              onClick={() => onAddZone(action.kind)}
              onDragStart={(event) => handleZoneActionDragStart(event, action.kind)}
              type="button"
            >
              <span className="zone-action__icon"><Plus size={15} aria-hidden="true" /></span>
              <span><strong>{action.label}</strong><small>{action.detail}</small></span>
            </button>
          ))}
          <button className="zone-action" onClick={onAddRouteTable} type="button">
            <span className="zone-action__icon"><Plus size={15} aria-hidden="true" /></span>
            <span><strong>Route Table</strong><small>Subnet routing rules</small></span>
          </button>
        </div>
        <div className="zone-palette__list">
          <div className="zone-palette__list-header">
            <span>Defined scopes</span>
            <button className="icon-button" disabled={!selectedZoneId} onClick={onDeleteSelectedZone} title="Delete selected scope and children" type="button"><Trash2 size={15} aria-hidden="true" /></button>
          </div>
          {orderedZones.map((zone, index) => (
            <div className={`zone-palette__item ${selectedZoneId === zone.id ? "zone-palette__item--selected" : ""}`} key={zone.id}>
              <button
                className="zone-palette__item-main"
                draggable
                onClick={() => onSelectZone(zone.id)}
                onDragStart={(event) => handleZoneActionDragStart(event, zone.kind === "subnet" ? (zone.config?.subnetAccess === "public" ? "subnet-public" : "subnet-private") : zone.kind as ZoneAddKind)}
                type="button"
              >
                <GripVertical size={14} aria-hidden="true" />
                <Layers size={15} aria-hidden="true" />
                <span><strong>{zone.label}</strong><small>{formatZoneScope(zone)}</small></span>
              </button>
              <div className="zone-palette__layer-actions">
                <button
                  className="icon-button"
                  disabled={index === 0}
                  onClick={() => onReorderZoneLayer(zone.id, "up")}
                  title="Bring this scope forward"
                  type="button"
                >
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button
                  className="icon-button"
                  disabled={index === orderedZones.length - 1}
                  onClick={() => onReorderZoneLayer(zone.id, "down")}
                  title="Send this scope backward"
                  type="button"
                >
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="zone-palette__services">
          <div className="zone-palette__list-header">
            <span>Network services</span>
            <span>{paletteServices.length} available</span>
          </div>
          {paletteServices.map((service) => (
            <div className="service-tile" key={service.id}>
              <div
                aria-label={`Add ${service.name} to the canvas`}
                className="service-tile__main"
                draggable
                onClick={() => onAddService(service)}
                onDragStart={(event) => handleServiceDragStart(event, service)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onAddService(service);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <AwsServiceIcon label={service.name} serviceId={service.id} />
                <span className="service-tile__content">
                  <span>{service.name}</span>
                  <small>{service.category}</small>
                </span>
              </div>
              <button
                aria-label={`More information about ${service.name}`}
                className="service-tile__info"
                onClick={() => onInspectService(service)}
                title={`Learn more about ${service.name}`}
                type="button"
              >
                <CircleHelp aria-hidden="true" size={16} />
              </button>
            </div>
          ))}
        </div>
        <p className="zone-palette__hint">Drag services or scopes into the canvas, or reorder scopes here to control which layer sits above or below the others.</p>
      </div>
    </Panel>
  );
}
