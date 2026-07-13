import type { Scenario } from "../../domain/types";
import { Panel } from "../../ui/Panel";

type ArchitectureCanvasPreviewProps = {
  scenario: Scenario;
};

const previewNodes = [
  { label: "Route 53", x: 8, y: 16 },
  { label: "ALB", x: 32, y: 16 },
  { label: "Auto Scaling", x: 52, y: 48 },
  { label: "RDS", x: 74, y: 66 },
  { label: "CloudWatch", x: 72, y: 24 },
];

export function ArchitectureCanvasPreview({ scenario }: ArchitectureCanvasPreviewProps) {
  return (
    <Panel title="Architecture Canvas" eyebrow={scenario.title}>
      <div className="canvas-preview" aria-label="Architecture canvas placeholder">
        <div className="zone zone--internet">Internet</div>
        <div className="zone zone--public">Public Subnet</div>
        <div className="zone zone--private">Private Subnet</div>
        <div className="zone zone--data">Data Layer</div>
        {previewNodes.map((node) => (
          <div
            className="canvas-node"
            key={node.label}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            {node.label}
          </div>
        ))}
      </div>
    </Panel>
  );
}
