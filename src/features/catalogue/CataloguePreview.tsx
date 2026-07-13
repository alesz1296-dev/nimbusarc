import type { CloudService } from "../../domain/types";
import { Panel } from "../../ui/Panel";

type CataloguePreviewProps = {
  services: CloudService[];
};

export function CataloguePreview({ services }: CataloguePreviewProps) {
  return (
    <Panel title="Catalogue Preview" eyebrow="Official docs ready">
      <div className="catalogue-list" id="catalogue">
        {services.map((service) => (
          <a href={service.docsUrl} key={service.id} rel="noreferrer" target="_blank">
            <span>{service.name}</span>
            <small>{service.examSignals[0]}</small>
          </a>
        ))}
      </div>
    </Panel>
  );
}
