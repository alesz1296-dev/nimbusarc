import type { CloudService } from "../../domain/types";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { ChevronDown, ChevronUp, CircleHelp, Search } from "lucide-react";
import { Panel } from "../../ui/Panel";
import { AwsServiceIcon } from "../../ui/AwsServiceIcon";

type ServicePaletteProps = {
  services: CloudService[];
  onAddService: (service: CloudService) => void;
  onInspectService: (service: CloudService) => void;
  activeNodeCount: number;
};

export function ServicePalette({ services, onAddService, onInspectService, activeNodeCount }: ServicePaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const serviceListRef = useRef<HTMLDivElement | null>(null);
  const categories = useMemo(() => {
    const counts = services.reduce<Record<string, number>>((acc, service) => {
      acc[service.category] = (acc[service.category] ?? 0) + 1;
      return acc;
    }, {});

    return [
      { name: "All", count: services.length },
      ...Object.entries(counts)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, count]) => ({ name, count })),
    ];
  }, [services]);
  const visibleServices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return services.filter((service) => {
      const matchesCategory = selectedCategory === "All" || service.category === selectedCategory;
      const searchableText = [
        service.name,
        service.category,
        service.shortDescription,
        ...service.examSignals,
        ...service.commonUseCases,
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [query, selectedCategory, services]);

  function scrollServiceList(direction: "up" | "down") {
    const container = serviceListRef.current;

    if (!container) {
      return;
    }

    const delta = container.clientHeight * 0.72 * (direction === "down" ? 1 : -1);
    container.scrollBy({ top: delta, behavior: "smooth" });
  }

  return (
    <Panel
      title="Service Palette"
      eyebrow="AWS SAA"
      actions={<span>{activeNodeCount} placed</span>}
    >
      <div className="service-palette-controls">
        <label className="service-search" htmlFor="service-search">
          <Search aria-hidden="true" size={15} />
          <input
            id="service-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search services"
            type="search"
            value={query}
          />
        </label>
        <div aria-label="Filter services by category" className="service-category-filter" role="list">
          {categories.map((category) => (
            <button
              className={`service-category-chip${category.name === selectedCategory ? " service-category-chip--active" : ""}`}
              key={category.name}
              onClick={() => setSelectedCategory(category.name)}
              type="button"
            >
              <span>{category.name}</span>
              <small>{category.count}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="service-list-shell">
        <button
          className="service-list-scroll"
          onClick={() => scrollServiceList("up")}
          title="Scroll services up"
          type="button"
        >
          <ChevronUp size={16} aria-hidden="true" />
        </button>
        <div className="service-list" id="services" ref={serviceListRef}>
        {visibleServices.map((service) => (
          <div className="service-tile" key={service.id}>
            <button
              className="service-tile__main"
              draggable
              onDragStart={(event) => handleServiceDragStart(event, service)}
              onClick={() => onAddService(service)}
              type="button"
            >
              <AwsServiceIcon label={service.name} serviceId={service.id} />
              <span className="service-tile__content">
                <span>{service.name}</span>
                <small>{service.category}</small>
              </span>
            </button>
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
        {visibleServices.length === 0 ? (
          <p className="service-list__empty">No services match this filter.</p>
        ) : null}
        </div>
        <button
          className="service-list-scroll"
          onClick={() => scrollServiceList("down")}
          title="Scroll services down"
          type="button"
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
    </Panel>
  );
}

function handleServiceDragStart(event: DragEvent<HTMLButtonElement>, service: CloudService) {
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("application/x-nimbusarc-palette", JSON.stringify({
    type: "service",
    serviceId: service.id,
  }));
}
