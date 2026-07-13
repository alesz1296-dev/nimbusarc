import { BookOpen, Boxes, Cloud, ShieldCheck } from "lucide-react";
import { providerRegistry } from "../../domain/providerRegistry";
import { scenarios, services } from "../../data/providers";
import { ArchitectureCanvasPreview } from "../canvas/ArchitectureCanvasPreview";
import { CataloguePreview } from "../catalogue/CataloguePreview";
import { FeedbackPreview } from "../feedback/FeedbackPreview";
import { ScenarioPlayerPreview } from "../scenario-player/ScenarioPlayerPreview";
import { ServicePalette } from "../canvas/ServicePalette";
import { StatusPill } from "../../ui/StatusPill";

const activeScenario = scenarios[0];

export function AppShell() {
  const activeProvider = providerRegistry.find((provider) => provider.enabled);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__mark">
            <Cloud size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">Cloud Learning Platform</p>
            <h1>NimbusArc</h1>
          </div>
        </div>

        <nav className="nav-stack" aria-label="Primary">
          <a className="nav-item nav-item--active" href="#scenario">
            <ShieldCheck size={18} aria-hidden="true" />
            Scenario
          </a>
          <a className="nav-item" href="#catalogue">
            <BookOpen size={18} aria-hidden="true" />
            Catalogue
          </a>
          <a className="nav-item" href="#services">
            <Boxes size={18} aria-hidden="true" />
            Services
          </a>
        </nav>

        <div className="provider-card">
          <p className="eyebrow">Active Provider</p>
          <strong>{activeProvider?.name ?? "No provider"}</strong>
          <StatusPill label="AWS SAA enabled" tone="active" />
          <p>Azure and Google Cloud remain disabled until the AWS learning track is solid.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace__header">
          <div>
            <p className="eyebrow">Phase 0 Foundation</p>
            <h2>AWS SAA visual architecture trainer</h2>
          </div>
          <div className="header-metrics" aria-label="Project metrics">
            <span>{services.length} services</span>
            <span>{scenarios.length} scenario</span>
            <span>Provider-aware</span>
          </div>
        </header>

        <div className="learning-grid">
          <ServicePalette services={services} />
          <ArchitectureCanvasPreview scenario={activeScenario} />
          <div className="right-rail">
            <ScenarioPlayerPreview scenario={activeScenario} />
            <FeedbackPreview scenario={activeScenario} />
            <CataloguePreview services={services.slice(0, 4)} />
          </div>
        </div>
      </section>
    </main>
  );
}
