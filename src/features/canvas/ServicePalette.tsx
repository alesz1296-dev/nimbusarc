import type { CloudService } from "../../domain/types";
import { Panel } from "../../ui/Panel";

type ServicePaletteProps = {
  services: CloudService[];
};

export function ServicePalette({ services }: ServicePaletteProps) {
  return (
    <Panel title="Service Palette" eyebrow="AWS SAA" actions={<span>{services.length}</span>}>
      <div className="service-list" id="services">
        {services.map((service) => (
          <button className="service-tile" key={service.id} type="button">
            <span>{service.name}</span>
            <small>{service.category}</small>
          </button>
        ))}
      </div>
    </Panel>
  );
}
