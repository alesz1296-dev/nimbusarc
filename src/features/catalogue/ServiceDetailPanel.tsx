import { ExternalLink, X } from "lucide-react";
import { useState } from "react";
import type { CloudService } from "../../domain/types";
import { AwsServiceIcon } from "../../ui/AwsServiceIcon";
import { Panel } from "../../ui/Panel";

type ServiceDetailPanelProps = {
  service?: CloudService;
  onClose?: () => void;
};

export function ServiceDetailPanel({ service, onClose }: ServiceDetailPanelProps) {
  const closeAction = onClose ? (
    <button
      aria-label="Close service details"
      className="panel__close"
      onClick={onClose}
      type="button"
    >
      <X aria-hidden="true" size={15} />
    </button>
  ) : undefined;

  if (!service) {
    return (
      <Panel actions={closeAction} title="Service Details" eyebrow="Learning reference">
        <p className="service-detail__empty">
          Use the info button on any service to explore what it does, where it fits, and how to configure it.
        </p>
      </Panel>
    );
  }

  return (
    <Panel actions={closeAction} title="Service Details" eyebrow={service.category}>
      <div className="service-detail">
        <div className="service-detail__identity">
          <AwsServiceIcon label={service.name} serviceId={service.id} size="md" />
          <div>
            <strong>{service.name}</strong>
            <p>{service.shortDescription}</p>
          </div>
        </div>

        <ServiceAccordion open items={[service.shortDescription]} title="Summary" />
        <ServiceAccordion
          items={service.configurationGuidance ?? ["Review placement, connectivity, security, and scaling choices for this service."]}
          title="Configuration"
        />
        <ServiceAccordion items={service.examSignals} title="Features" />
        <ServiceAccordion items={service.commonTraps} title="Limitations" />
        <ServiceAccordion items={getAdvancedConfiguration(service)} title="Advanced configuration" />
        <ServiceAccordion items={service.commonUseCases} title="Use Cases" />

        <a className="service-detail__docs" href={service.docsUrl} rel="noreferrer" target="_blank">
          Official documentation
          <ExternalLink aria-hidden="true" size={14} />
        </a>
      </div>
    </Panel>
  );
}

function ServiceAccordion({ items, title, open = false }: { items: string[]; title: string; open?: boolean }) {
  const [isOpen, setIsOpen] = useState(open);

  return (
    <details
      className="service-detail__section"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      open={isOpen}
    >
      <summary>{title}</summary>
      <ul>
        {items.map((item) => (
          <li key={`${title}-${item}`}>{item}</li>
        ))}
      </ul>
    </details>
  );
}

function getAdvancedConfiguration(service: CloudService): string[] {
  const categoryGuidance: Record<string, string[]> = {
    Actors: ["Keep the actor outside AWS trust boundaries and model the request origin explicitly."],
    Networking: ["Validate route tables, CIDR overlap, ingress and egress paths, and Availability Zone placement."],
    Edge: ["Review cache behaviors, origin failover, TLS policy, invalidation strategy, and regional coverage."],
    Compute: ["Review instance or runtime limits, health checks, scaling signals, deployment strategy, and failure recovery."],
    Storage: ["Review lifecycle transitions, data protection, access policies, replication, and recovery objectives."],
    Database: ["Review capacity mode, backup and restore behavior, failover, replicas, indexes, and service quotas."],
    "Application Integration": ["Review retry behavior, idempotency, delivery guarantees, ordering, throttling, and dead-letter handling."],
    Analytics: ["Review retention, partitioning, throughput, replay behavior, encryption, and downstream failure handling."],
    Security: ["Review key or policy scope, auditability, rotation, service integration, and least-privilege boundaries."],
    Operations: ["Review retention, alert thresholds, cross-account collection, dashboards, and incident response paths."],
  };

  return [
    ...(categoryGuidance[service.category] ?? ["Review service quotas, regional availability, IAM permissions, and failure behavior."]),
    "Confirm current quotas, pricing, and regional feature availability in the official documentation.",
  ];
}
