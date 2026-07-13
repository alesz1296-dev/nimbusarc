export type CloudProvider = "aws" | "azure" | "gcp";

export type CertificationTrack = "aws-saa";

export type LearningDomain =
  | "security"
  | "reliability"
  | "performance"
  | "cost"
  | "operations";

export type Difficulty = "foundational" | "associate" | "advanced";

export type CloudService = {
  id: string;
  provider: CloudProvider;
  name: string;
  category: string;
  shortDescription: string;
  certificationTracks: CertificationTrack[];
  examSignals: string[];
  commonUseCases: string[];
  commonTraps: string[];
  docsUrl: string;
  allowedConnections: string[];
};

export type RuleType =
  | "requires-service"
  | "requires-connection"
  | "requires-zone"
  | "forbids-service"
  | "detects-antipattern";

export type RuleSeverity = "info" | "warning" | "critical";

export type Rule = {
  id: string;
  provider: CloudProvider;
  type: RuleType;
  severity: RuleSeverity;
  domain: LearningDomain;
  points: number;
  message: string;
  hint: string;
  docsRefs: string[];
};

export type Scenario = {
  id: string;
  provider: CloudProvider;
  certificationTrack: CertificationTrack;
  title: string;
  domain: LearningDomain;
  difficulty: Difficulty;
  prompt: string;
  requirements: string[];
  constraints: string[];
  rules: Rule[];
};

export type ProviderRegistryEntry = {
  id: CloudProvider;
  name: string;
  enabled: boolean;
  activeTrack?: CertificationTrack;
};
