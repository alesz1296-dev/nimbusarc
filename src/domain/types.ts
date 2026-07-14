export type CloudProvider = "aws" | "azure" | "gcp";

export type CertificationTrack = "aws-saa";

export type LearningDomain =
  | "security"
  | "reliability"
  | "performance"
  | "cost"
  | "operations";

export type Difficulty = "foundational" | "associate" | "advanced";

export type RelationalTablePreview = {
  name: string;
  columns: string[];
  rows: string[][];
};

export type DocumentCollectionPreview = {
  name: string;
  partitionKey: string;
  sortKey?: string;
  documents: Array<Record<string, string | number | boolean>>;
};

export type CacheEntryPreview = {
  key: string;
  ttl?: string;
  value: string;
};

export type DatabaseInspectionModel =
  | {
      kind: "relational";
      engine: string;
      tables: RelationalTablePreview[];
    }
  | {
      kind: "document";
      engine: string;
      collections: DocumentCollectionPreview[];
    }
  | {
      kind: "cache";
      engine: string;
      entries: CacheEntryPreview[];
    };

export type ServiceLearningProfile = {
  summary: string[];
  features: string[];
  useCases: string[];
  limitations: string[];
  configuration: string[];
  advancedConfiguration: string[];
  connectionNotes?: Record<string, string>;
};

export type CloudService = {
  id: string;
  provider: CloudProvider;
  name: string;
  category: string;
  shortDescription: string;
  configurationGuidance?: string[];
  certificationTracks: CertificationTrack[];
  examSignals: string[];
  commonUseCases: string[];
  commonTraps: string[];
  docsUrl: string;
  allowedConnections: string[];
  learningProfile?: ServiceLearningProfile;
  databaseInspection?: DatabaseInspectionModel;
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
