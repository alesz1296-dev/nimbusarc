import { TerminalSquare } from "lucide-react";
import { useMemo, useState } from "react";
import type { ArchitectureGraph, ArchitectureNode, ArchitectureZone } from "../../domain/graph";
import type { CloudService } from "../../domain/types";
import { Panel } from "../../ui/Panel";

type CloudShellPanelProps = {
  graph: ArchitectureGraph;
  servicesById: Map<string, CloudService>;
};

type ShellEntry = {
  id: string;
  command: string;
  output: string;
};

const starterCommands = [
  "help",
  "list-services",
  "list-zones",
  "show-connections",
  "aws ec2 describe-instances",
  "aws ec2 describe-subnets",
  "aws ec2 describe-vpcs",
  "aws elbv2 describe-load-balancers",
  "aws rds describe-db-instances",
  "aws lambda list-functions",
  "aws s3 ls",
];

function toJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function summarizeNode(node: ArchitectureNode, servicesById: Map<string, CloudService>) {
  const service = servicesById.get(node.serviceId);

  return {
    id: node.id,
    name: node.label,
    serviceId: node.serviceId,
    serviceName: service?.name ?? node.serviceId,
    category: service?.category ?? "Unknown",
    zoneId: node.zoneId ?? null,
    position: node.position,
    config: node.config,
  };
}

function summarizeZone(zone: ArchitectureZone) {
  return {
    id: zone.id,
    name: zone.label,
    kind: zone.kind,
    parentZoneId: zone.parentZoneId ?? null,
    layerOrder: zone.layerOrder ?? null,
    config: zone.config ?? {},
    layout: zone.layout ?? null,
  };
}

function matchNode(graph: ArchitectureGraph, input: string) {
  const normalized = input.trim().toLowerCase();
  return graph.nodes.find((node) => node.id.toLowerCase() === normalized || node.label.toLowerCase() === normalized);
}

function matchZone(graph: ArchitectureGraph, input: string) {
  const normalized = input.trim().toLowerCase();
  return graph.zones.find((zone) => zone.id.toLowerCase() === normalized || zone.label.toLowerCase() === normalized);
}

function runShellCommand(command: string, graph: ArchitectureGraph, servicesById: Map<string, CloudService>) {
  const normalized = command.trim();
  const lowered = normalized.toLowerCase();

  if (!normalized) {
    return "";
  }

  if (lowered === "help") {
    return [
      "NimbusArc CloudShell supports a focused set of read-only commands against the current canvas.",
      "",
      ...starterCommands,
      "describe service <service label or node id>",
      "describe zone <zone label or zone id>",
      "clear",
    ].join("\n");
  }

  if (lowered === "clear") {
    return "__CLEAR__";
  }

  if (lowered === "list-services") {
    if (graph.nodes.length === 0) {
      return "No services are currently placed on the canvas.";
    }

    return toJson(graph.nodes.map((node) => summarizeNode(node, servicesById)));
  }

  if (lowered === "list-zones") {
    if (graph.zones.length === 0) {
      return "No zones are currently defined on the canvas.";
    }

    return toJson(graph.zones.map(summarizeZone));
  }

  if (lowered === "show-connections") {
    if (graph.edges.length === 0) {
      return "No connections are currently modeled.";
    }

    return toJson(graph.edges.map((edge) => ({
      id: edge.id,
      source: graph.nodes.find((node) => node.id === edge.sourceNodeId)?.label ?? edge.sourceNodeId,
      target: graph.nodes.find((node) => node.id === edge.targetNodeId)?.label ?? edge.targetNodeId,
      kind: edge.kind,
      direction: edge.direction ?? "one-way",
      controls: edge.controls ?? {},
    })));
  }

  if (lowered.startsWith("describe service ")) {
    const target = normalized.slice("describe service ".length);
    const node = matchNode(graph, target);
    return node ? toJson(summarizeNode(node, servicesById)) : `Service "${target}" was not found on the canvas.`;
  }

  if (lowered.startsWith("describe zone ")) {
    const target = normalized.slice("describe zone ".length);
    const zone = matchZone(graph, target);
    return zone ? toJson(summarizeZone(zone)) : `Zone "${target}" was not found on the canvas.`;
  }

  if (lowered === "aws ec2 describe-instances") {
    const instances = graph.nodes.filter((node) => node.serviceId === "aws-ec2");
    return instances.length > 0
      ? toJson({ Reservations: [{ Instances: instances.map((node) => summarizeNode(node, servicesById)) }] })
      : toJson({ Reservations: [] });
  }

  if (lowered === "aws ec2 describe-subnets") {
    const subnets = graph.zones.filter((zone) => zone.kind === "subnet");
    return toJson({ Subnets: subnets.map(summarizeZone) });
  }

  if (lowered === "aws ec2 describe-vpcs") {
    const vpcs = graph.zones.filter((zone) => zone.kind === "vpc");
    return toJson({ Vpcs: vpcs.map(summarizeZone) });
  }

  if (lowered === "aws elbv2 describe-load-balancers") {
    const loadBalancers = graph.nodes.filter((node) => ["aws-alb", "aws-nlb"].includes(node.serviceId));
    return toJson({
      LoadBalancers: loadBalancers.map((node) => ({
        LoadBalancerName: node.label,
        Type: node.serviceId === "aws-nlb" ? "network" : "application",
        Scheme: node.config.publicAccess ? "internet-facing" : "internal",
        ZoneId: node.zoneId ?? null,
      })),
    });
  }

  if (lowered === "aws rds describe-db-instances") {
    const dbInstances = graph.nodes.filter((node) => node.serviceId === "aws-rds");
    return toJson({
      DBInstances: dbInstances.map((node) => ({
        DBInstanceIdentifier: node.label,
        Engine: node.config.rdsEngine ?? "postgres",
        DBInstanceClass: node.config.rdsInstanceClass ?? "db.t4g.micro",
        MultiAZ: Boolean(node.config.multiAz),
        StorageType: node.config.rdsStorageType ?? "gp3",
        AllocatedStorage: node.config.rdsStorageGb ?? 20,
      })),
    });
  }

  if (lowered === "aws lambda list-functions") {
    const functions = graph.nodes.filter((node) => node.serviceId === "aws-lambda");
    return toJson({
      Functions: functions.map((node) => ({
        FunctionName: node.label,
        Runtime: node.config.lambdaRuntime ?? "python3.13",
        MemorySize: node.config.lambdaMemoryMb ?? 128,
        Timeout: node.config.lambdaTimeoutSeconds ?? 3,
      })),
    });
  }

  if (lowered === "aws s3 ls") {
    const buckets = graph.nodes.filter((node) => node.serviceId === "aws-s3");
    return buckets.length > 0
      ? buckets.map((node) => `2026-07-13 00:00:00 ${node.label}`).join("\n")
      : "";
  }

  return `Command not recognized: ${normalized}\nTry "help" to see supported CloudShell commands.`;
}

export function CloudShellPanel({ graph, servicesById }: CloudShellPanelProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ShellEntry[]>([
    {
      id: "welcome",
      command: "help",
      output: "NimbusArc CloudShell is ready. Type a supported command or click a starter command below.",
    },
  ]);
  const prompt = useMemo(() => `nimbusarc@cloudshell:${graph.provider}$`, [graph.provider]);

  function execute(command: string) {
    const trimmed = command.trim();

    if (!trimmed) {
      return;
    }

    const output = runShellCommand(trimmed, graph, servicesById);

    if (output === "__CLEAR__") {
      setHistory([]);
      setInput("");
      return;
    }

    setHistory((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        command: trimmed,
        output,
      },
    ]);
    setInput("");
  }

  return (
    <Panel
      title="CloudShell"
      eyebrow="CLI emulator"
      actions={<TerminalSquare size={16} aria-hidden="true" />}
    >
      <div className="cloudshell">
        <div className="cloudshell__starters" role="list" aria-label="Starter CloudShell commands">
          {starterCommands.map((command) => (
            <button className="service-category-chip" key={command} onClick={() => execute(command)} type="button">
              <span>{command}</span>
            </button>
          ))}
        </div>
        <div className="cloudshell__terminal" role="log" aria-label="CloudShell output">
          {history.map((entry) => (
            <div className="cloudshell__entry" key={entry.id}>
              <div className="cloudshell__prompt-line">
                <span className="cloudshell__prompt">{prompt}</span>
                <span>{entry.command}</span>
              </div>
              <pre className="cloudshell__output">{entry.output}</pre>
            </div>
          ))}
        </div>
        <form
          className="cloudshell__composer"
          onSubmit={(event) => {
            event.preventDefault();
            execute(input);
          }}
        >
          <span className="cloudshell__prompt">{prompt}</span>
          <input
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type a supported AWS-style command"
            type="text"
            value={input}
          />
        </form>
      </div>
    </Panel>
  );
}
