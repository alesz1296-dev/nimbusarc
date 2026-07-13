import type { Scenario } from "../../domain/types";
import { Panel } from "../../ui/Panel";
import { StatusPill } from "../../ui/StatusPill";

type ScenarioPlayerPreviewProps = {
  scenario: Scenario;
};

export function ScenarioPlayerPreview({ scenario }: ScenarioPlayerPreviewProps) {
  return (
    <Panel
      title="Scenario"
      eyebrow={scenario.certificationTrack.toUpperCase()}
      actions={<StatusPill label={scenario.difficulty} tone="active" />}
    >
      <div className="scenario-panel" id="scenario">
        <p>{scenario.prompt}</p>
        <h3>Requirements</h3>
        <ul>
          {scenario.requirements.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
