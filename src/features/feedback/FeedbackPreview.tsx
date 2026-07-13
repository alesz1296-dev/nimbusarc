import type { Scenario } from "../../domain/types";
import { Panel } from "../../ui/Panel";

type FeedbackPreviewProps = {
  scenario: Scenario;
};

export function FeedbackPreview({ scenario }: FeedbackPreviewProps) {
  return (
    <Panel title="Feedback Engine" eyebrow="Rule preview">
      <div className="feedback-list">
        {scenario.rules.map((rule) => (
          <article className={`feedback-item feedback-item--${rule.severity}`} key={rule.id}>
            <strong>{rule.domain}</strong>
            <p>{rule.message}</p>
            <small>{rule.points} pts</small>
          </article>
        ))}
      </div>
    </Panel>
  );
}
