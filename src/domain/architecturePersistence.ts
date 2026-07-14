import type { ArchitectureGraph } from "./graph";

export const ARCHITECTURE_FILE_VERSION = 1;
export const ARCHITECTURE_STORAGE_KEY = "nimbusarc.current-architecture";

export type ArchitectureFile = {
  format: "nimbusarc-architecture";
  version: number;
  exportedAt: string;
  graph: ArchitectureGraph;
};

export function createArchitectureFile(graph: ArchitectureGraph): ArchitectureFile {
  return {
    format: "nimbusarc-architecture",
    version: ARCHITECTURE_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    graph,
  };
}

export function serializeArchitecture(graph: ArchitectureGraph) {
  return JSON.stringify(createArchitectureFile(graph), null, 2);
}

export function parseArchitectureFile(raw: string): ArchitectureGraph {
  const parsed: unknown = JSON.parse(raw);

  if (!isRecord(parsed) || parsed.format !== "nimbusarc-architecture" || parsed.version !== ARCHITECTURE_FILE_VERSION) {
    throw new Error("This is not a supported NimbusArc architecture file.");
  }

  if (!isArchitectureGraph(parsed.graph)) {
    throw new Error("The architecture file does not contain a valid graph.");
  }

  return parsed.graph;
}

export function loadSavedArchitecture(): ArchitectureGraph | undefined {
  try {
    const saved = window.localStorage.getItem(ARCHITECTURE_STORAGE_KEY);
    return saved ? parseArchitectureFile(saved) : undefined;
  } catch {
    return undefined;
  }
}

export function saveArchitecture(graph: ArchitectureGraph) {
  window.localStorage.setItem(ARCHITECTURE_STORAGE_KEY, serializeArchitecture(graph));
}

export function downloadArchitecture(graph: ArchitectureGraph, filename = "nimbusarc-architecture.json") {
  const blob = new Blob([serializeArchitecture(graph)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isArchitectureGraph(value: unknown): value is ArchitectureGraph {
  return isRecord(value)
    && (value.provider === "aws" || value.provider === "azure" || value.provider === "gcp")
    && Array.isArray(value.zones)
    && Array.isArray(value.nodes)
    && Array.isArray(value.edges);
}
