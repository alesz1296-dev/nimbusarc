import type { ProviderRegistryEntry } from "./types";

export const providerRegistry: ProviderRegistryEntry[] = [
  {
    id: "aws",
    name: "Amazon Web Services",
    enabled: true,
    activeTrack: "aws-saa",
  },
  {
    id: "azure",
    name: "Microsoft Azure",
    enabled: false,
  },
  {
    id: "gcp",
    name: "Google Cloud",
    enabled: false,
  },
];
