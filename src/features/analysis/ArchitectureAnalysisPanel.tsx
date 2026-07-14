import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, DollarSign, Gauge, RefreshCw, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import type { ArchitectureGraph } from "../../domain/graph";
import { assessArchitectureValidation, type ArchitectureIssue } from "../../domain/architectureValidation";
import { assessArchitectureConfiguration, type ConfigurationIssue } from "../../domain/configurationValidation";
import { estimateArchitectureCost, type CostAssumptions } from "../../domain/costEstimator";
import { assessArchitectureSecurity, type SecurityFinding } from "../../domain/securitySimulation";
import { assessServiceQuotas } from "../../domain/serviceQuotas";
import type { CloudService } from "../../domain/types";
import { Panel } from "../../ui/Panel";

type ArchitectureAnalysisPanelProps = {
  graph: ArchitectureGraph;
  servicesById: Map<string, CloudService>;
  onClose?: () => void;
  initialTab?: AnalysisTab;
  fixedTab?: AnalysisTab;
  highlightedFindingId?: string;
  highlightedFindingVersion?: number;
  refreshKey?: number;
  onRefreshChecks?: () => void;
  title?: string;
  eyebrow?: string;
};

export type AnalysisTab = "cost" | "security" | "quotas" | "issues" | "configuration";

const initialAssumptions: CostAssumptions = {
  monthlyHours: 730,
  monthlyRequestsMillions: 1,
  monthlyStorageGb: 100,
  monthlyDataTransferGb: 100,
};

export function ArchitectureAnalysisPanel({
  graph,
  servicesById,
  onClose,
  initialTab = "cost",
  fixedTab,
  highlightedFindingId,
  highlightedFindingVersion = 0,
  refreshKey = 0,
  onRefreshChecks,
  title = "Cost & Security",
  eyebrow = "Architecture analysis",
}: ArchitectureAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<AnalysisTab>(initialTab);
  const [assumptions, setAssumptions] = useState(initialAssumptions);
  const [lastCheckedAt, setLastCheckedAt] = useState(() => new Date());
  const costEstimate = useMemo(() => estimateArchitectureCost(graph, servicesById, assumptions), [assumptions, graph, servicesById]);
  const validation = assessArchitectureValidation(graph, servicesById);
  const configuration = assessArchitectureConfiguration(graph);
  const security = assessArchitectureSecurity(graph, servicesById);
  const quotas = assessServiceQuotas(graph, servicesById);
  const visibleTab = fixedTab ?? activeTab;
  useEffect(() => {
    setLastCheckedAt(new Date());
  }, [graph, refreshKey]);

  useEffect(() => {
    if (!highlightedFindingId) {
      return;
    }

    const highlightedElement = document.querySelector<HTMLElement>(`[data-finding-id="${highlightedFindingId}"]`);

    highlightedElement?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightedFindingId, highlightedFindingVersion, visibleTab]);

  function refreshChecks() {
    setLastCheckedAt(new Date());
    onRefreshChecks?.();
  }
  const closeAction = onClose ? (
    <button aria-label="Close architecture analysis" className="panel__close" onClick={onClose} type="button">
      <X aria-hidden="true" size={15} />
    </button>
  ) : undefined;

  const checkAction = (
    <button aria-label="Refresh checks" className="panel__icon-button" onClick={refreshChecks} title="Refresh checks" type="button">
      <RefreshCw aria-hidden="true" size={14} />
    </button>
  );
  return (
    <Panel actions={<div className="panel__actions-group">{checkAction}{closeAction}</div>} eyebrow={eyebrow} title={title}>
      <div className="analysis-panel">
        {fixedTab ? null : (
          <div className="analysis-tabs" role="tablist" aria-label="Architecture analysis views">
            <button className={activeTab === "cost" ? "analysis-tab analysis-tab--active" : "analysis-tab"} onClick={() => setActiveTab("cost")} role="tab" type="button">
              <DollarSign aria-hidden="true" size={15} />
              Cost estimate
            </button>
            <button className={activeTab === "security" ? "analysis-tab analysis-tab--active" : "analysis-tab"} onClick={() => setActiveTab("security")} role="tab" type="button">
              <ShieldCheck aria-hidden="true" size={15} />
              Security test
            </button>
            <button className={activeTab === "issues" ? "analysis-tab analysis-tab--active" : "analysis-tab"} onClick={() => setActiveTab("issues")} role="tab" type="button">
              <AlertTriangle aria-hidden="true" size={15} />
              Architecture
            </button>
            <button className={activeTab === "configuration" ? "analysis-tab analysis-tab--active" : "analysis-tab"} onClick={() => setActiveTab("configuration")} role="tab" type="button">
              <SlidersHorizontal aria-hidden="true" size={15} />
              Configuration
            </button>
            <button className={activeTab === "quotas" ? "analysis-tab analysis-tab--active" : "analysis-tab"} onClick={() => setActiveTab("quotas")} role="tab" type="button">
              <Gauge aria-hidden="true" size={15} />
              Quotas
            </button>
          </div>
        )}

        {visibleTab === "cost" ? (
          <CostView assumptions={assumptions} estimate={costEstimate} onChange={setAssumptions} />
        ) : null}
        {visibleTab === "security" ? (
          <SecurityView assessment={security} highlightedFindingId={highlightedFindingId} />
        ) : null}
        {visibleTab === "issues" ? (
          <IssuesView assessment={validation} highlightedFindingId={highlightedFindingId} lastCheckedAt={lastCheckedAt} />
        ) : null}
        {visibleTab === "configuration" ? (
          <ConfigurationView assessment={configuration} highlightedFindingId={highlightedFindingId} lastCheckedAt={lastCheckedAt} />
        ) : null}
        {visibleTab === "quotas" ? (
          <QuotaView assessment={quotas} />
        ) : null}
      </div>
    </Panel>
  );
}

function CostView({ assumptions, estimate, onChange }: { assumptions: CostAssumptions; estimate: ReturnType<typeof estimateArchitectureCost>; onChange: (assumptions: CostAssumptions) => void }) {
  function update(key: keyof CostAssumptions, value: string) {
    onChange({ ...assumptions, [key]: Number(value) || 0 });
  }

  return (
    <div className="analysis-view">
      <div className="analysis-total">
        <span>Estimated monthly baseline</span>
        <strong>${estimate.totalMonthlyCost.toFixed(2)}</strong>
      </div>
      <details className="analysis-assumptions" open>
        <summary>Usage assumptions</summary>
        <div className="analysis-input-grid">
          <label><span>Hours / month</span><input min="0" onChange={(event) => update("monthlyHours", event.target.value)} type="number" value={assumptions.monthlyHours} /></label>
          <label><span>Requests / month (M)</span><input min="0" onChange={(event) => update("monthlyRequestsMillions", event.target.value)} step="0.1" type="number" value={assumptions.monthlyRequestsMillions} /></label>
          <label><span>Storage (GB)</span><input min="0" onChange={(event) => update("monthlyStorageGb", event.target.value)} type="number" value={assumptions.monthlyStorageGb} /></label>
          <label><span>Transfer (GB)</span><input min="0" onChange={(event) => update("monthlyDataTransferGb", event.target.value)} type="number" value={assumptions.monthlyDataTransferGb} /></label>
        </div>
      </details>
      <div className="analysis-lines">
        {estimate.lines.length === 0 ? <p className="analysis-empty">Add services to calculate a baseline.</p> : estimate.lines.map((line) => (
          <div className="analysis-line" key={line.nodeId}>
            <div><strong>{line.serviceName}</strong><small>{line.detail}</small></div>
            <b>${line.monthlyCost.toFixed(2)}</b>
          </div>
        ))}
      </div>
      <p className="analysis-note">{estimate.disclaimer}</p>
    </div>
  );
}

function SecurityView({ assessment, highlightedFindingId }: { assessment: ReturnType<typeof assessArchitectureSecurity>; highlightedFindingId?: string }) {
  return (
    <div className="analysis-view">
      <div className="security-summary">
        <span className="security-summary__pass">{assessment.passed} passed</span>
        <span className="security-summary__warning">{assessment.warnings} warnings</span>
        <span className="security-summary__blocked">{assessment.blocked} blocked</span>
      </div>
      <p className="analysis-note">Checks IAM posture, public exposure, encryption, security groups, NACLs, routes, and modeled firewalls.</p>
      <div className="security-findings">
        {assessment.findings.length === 0 ? <p className="analysis-empty">Add services and connections to run security checks.</p> : assessment.findings.map((finding) => (
          <div
            className={`security-finding security-finding--${finding.severity} ${highlightedFindingId === finding.id ? "security-finding--selected" : ""}`}
            data-finding-id={finding.id}
            key={finding.id}
          >
            <strong>{finding.title}</strong>
            <span>{finding.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IssuesView({ assessment, highlightedFindingId, lastCheckedAt }: { assessment: ReturnType<typeof assessArchitectureValidation>; highlightedFindingId?: string; lastCheckedAt: Date }) {
  return (
    <div className="analysis-view">
      <div className="security-summary">
        <span className="security-summary__pass">{assessment.issues.length === 0 ? "Valid so far" : `${assessment.affectedNodeIds.length} resources flagged`}</span>
        <span className="security-summary__warning">{assessment.warnings} warnings</span>
        <span className="security-summary__blocked">{assessment.errors} errors</span>
      </div>
      <p className="analysis-note">Checks SAA architecture requirements such as correct placement, multi-AZ shape, DB subnet groups, and observability flow direction.</p>
      <p className="analysis-refresh-status"><ClipboardCheck aria-hidden="true" size={13} /> Auto-checked {lastCheckedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      <div className="security-findings">
        {assessment.issues.length === 0 ? <p className="analysis-empty">No architecture placement issues found yet.</p> : assessment.issues.map((issue) => (
          <IssueCard highlightedFindingId={highlightedFindingId} issue={issue} key={issue.id} />
        ))}
      </div>
    </div>
  );
}

function ConfigurationView({ assessment, highlightedFindingId, lastCheckedAt }: { assessment: ReturnType<typeof assessArchitectureConfiguration>; highlightedFindingId?: string; lastCheckedAt: Date }) {
  return (
    <div className="analysis-view">
      <div className="security-summary">
        <span className="security-summary__pass">{assessment.issues.length === 0 ? "Configuration valid" : `${assessment.affectedZoneIds.length} scopes flagged`}</span>
        <span className="security-summary__warning">{assessment.warnings} warnings</span>
        <span className="security-summary__blocked">{assessment.errors} errors</span>
      </div>
      <p className="analysis-note">Checks CIDR address families, route tables, DNS, subnet access, and network scope relationships.</p>
      <p className="analysis-refresh-status"><ClipboardCheck aria-hidden="true" size={13} /> Auto-checked {lastCheckedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      <div className="security-findings">
        {assessment.issues.length === 0 ? <p className="analysis-empty">No configuration errors found.</p> : assessment.issues.map((issue) => (
          <IssueCard highlightedFindingId={highlightedFindingId} issue={issue} key={issue.id} />
        ))}
      </div>
    </div>
  );
}

function IssueCard({
  issue,
  highlightedFindingId,
}: {
  issue: ArchitectureIssue | ConfigurationIssue;
  highlightedFindingId?: string;
}) {
  return (
    <div
      className={`security-finding security-finding--${issue.severity === "error" ? "critical" : "warning"} ${highlightedFindingId === issue.id ? "security-finding--selected" : ""}`}
      data-finding-id={issue.id}
    >
      <strong>{issue.title}</strong>
      <span>{issue.detail}</span>
      <small>{issue.recommendation}</small>
    </div>
  );
}

function QuotaView({ assessment }: { assessment: ReturnType<typeof assessServiceQuotas> }) {
  return (
    <div className="analysis-view">
      <div className="security-summary">
        <span className="security-summary__pass">{assessment.passed} healthy</span>
        <span className="security-summary__warning">{assessment.warnings} near limit</span>
        <span className="security-summary__blocked">{assessment.blocked} exceeded</span>
      </div>
      <p className="analysis-note">Tracks starter SAA quota baselines for EC2, EIP, ALB, NAT Gateway, Lambda, RDS, EBS, S3, VPCs, and subnets.</p>
      <div className="security-findings">
        {assessment.findings.map((finding) => (
          <div className={`security-finding security-finding--${finding.severity}`} key={finding.id}>
            <strong>{finding.title}</strong>
            <span>{finding.detail}</span>
            <small>{finding.scope.replace("-", " ")} quota: {finding.usage}/{finding.limit} {finding.unit}</small>
          </div>
        ))}
      </div>
      <p className="analysis-note">{assessment.disclaimer}</p>
    </div>
  );
}
