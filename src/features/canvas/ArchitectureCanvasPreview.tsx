import { useEffect, useState, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Download, FileStack, Link2, Lock, Play, Redo2, RotateCcw, Save, Search, ShieldCheck, SlidersHorizontal, Trash2, Undo2, Unlink, Upload } from "lucide-react";
import type { ArchitectureEdgeId, ArchitectureGraph, ArchitectureZone, ArchitectureZoneId, FlowSimulationSnapshot } from "../../domain/graph";
import type { ArchitectureIssue } from "../../domain/architectureValidation";
import type { ConfigurationIssue } from "../../domain/configurationValidation";
import type { SecurityFinding } from "../../domain/securitySimulation";
import type { Scenario } from "../../domain/types";
import { Panel } from "../../ui/Panel";
import { AwsServiceIcon, serviceAccentColorMap } from "../../ui/AwsServiceIcon";
import { architectureTemplates } from "../../domain/architectureTemplates";
import { parseArchitectureFile } from "../../domain/architecturePersistence";

type CanvasCheckTab = "issues" | "configuration" | "security";

type CanvasIssuePopover = {
  category: CanvasCheckTab;
  targetType: "node" | "zone";
  targetId: string;
};

type ArchitectureCanvasPreviewProps = {
  architectureIssues: ArchitectureIssue[];
  configurationIssues: ConfigurationIssue[];
  scenario: Scenario;
  graph: ArchitectureGraph;
  isConnecting: boolean;
  canRedo: boolean;
  canUndo: boolean;
  canConnectNode: (nodeId: string) => boolean;
  connectionHint?: string;
  securityFindings: SecurityFinding[];
  validationIssueCount?: number;
  validationIssueNodeIds?: string[];
  validationIssueZoneIds?: string[];
  selectedEdgeId?: ArchitectureEdgeId;
  locatedNodeRequest?: { nodeId: string; requestId: number };
  selectedNodeId?: string;
  selectedNodeIds: string[];
  simulation: FlowSimulationSnapshot;
  onConnectSelectedNode: () => void;
  onClearSelection: () => void;
  onDeleteSelectedEdge: () => void;
  onDeleteSelectedNode: () => void;
  onDeleteSelectedZone: () => void;
  onEdgeConnectStart: (nodeId: string) => void;
  onMoveSelectedNode: (direction: "up" | "down" | "left" | "right") => void;
  onDragNode: (nodeId: string, position: { x: number; y: number }, anchorPosition?: { x: number; y: number }) => void;
  onDropPaletteItem: (payload: { type: "service"; serviceId: string } | { type: "zone"; zoneKind: "region" | "vpc" | "availability-zone" | "subnet-public" | "subnet-private" }, position: { x: number; y: number }) => void;
  onUpdateZoneLayout: (zoneId: ArchitectureZoneId, layout: NonNullable<ArchitectureZone["layout"]>) => void;
  onResetGraph: () => void;
  onSaveArchitecture: () => void;
  onExportArchitecture: () => void;
  onImportArchitecture: (graph: ArchitectureGraph) => void;
  onApplyTemplate: (graph: ArchitectureGraph) => void;
  onRedo: () => void;
  onRunSimulation: () => void;
  onOpenCheck: (tab: CanvasCheckTab, findingId: string) => void;
  onSelectEdge: (edgeId: ArchitectureEdgeId) => void;
  onSelectNodes: (nodeIds: string[]) => void;
  onSelectNode: (nodeId: string) => void;
  onToggleNodeSelection: (nodeId: string) => void;
  onUndo: () => void;
  selectedZoneId?: ArchitectureZoneId;
  onSelectZone: (zoneId: ArchitectureZoneId) => void;
};

const zoneClassNames: Record<string, string> = {
  global: "zone zone--internet",
  edge: "zone zone--internet",
  region: "zone zone--region",
  vpc: "zone zone--vpc",
  "availability-zone": "zone zone--az",
  subnet: "zone zone--subnet",
  "data-tier": "zone zone--data-tier",
};

const edgeClassNames = {
  request: "canvas-edge canvas-edge--request",
  data: "canvas-edge canvas-edge--data",
  event: "canvas-edge canvas-edge--event",
  observe: "canvas-edge canvas-edge--observe",
};

const workspaceSize = {
  width: 180,
  height: 140,
};

const squareNodeServiceIds = new Set([
  "aws-ec2",
  "aws-lambda",
  "aws-efs",
  "aws-s3",
]);

export function ArchitectureCanvasPreview({
  architectureIssues,
  configurationIssues,
  scenario,
  graph,
  isConnecting,
  canRedo,
  canUndo,
  canConnectNode,
  connectionHint,
  securityFindings,
  validationIssueCount = 0,
  validationIssueNodeIds = [],
  validationIssueZoneIds = [],
  selectedEdgeId,
  locatedNodeRequest,
  selectedNodeId,
  selectedNodeIds,
  simulation,
  onConnectSelectedNode,
  onClearSelection,
  onDeleteSelectedEdge,
  onDeleteSelectedNode,
  onDeleteSelectedZone,
  onEdgeConnectStart,
  onMoveSelectedNode,
  onDragNode,
  onDropPaletteItem,
  onUpdateZoneLayout,
  onResetGraph,
  onSaveArchitecture,
  onExportArchitecture,
  onImportArchitecture,
  onApplyTemplate,
  onRedo,
  onRunSimulation,
  onOpenCheck,
  onSelectEdge,
  onSelectNodes,
  onSelectNode,
  onToggleNodeSelection,
  onUndo,
  selectedZoneId,
  onSelectZone,
}: ArchitectureCanvasPreviewProps) {
  const maxZoom = 2.2;
  const visibleZones = [...graph.zones].sort((left, right) => (left.layerOrder ?? 0) - (right.layerOrder ?? 0));
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = graph.edges.find((edge) => edge.id === selectedEdgeId);
  const selectedZone = graph.zones.find((zone) => zone.id === selectedZoneId);
  const hasNodeSelection = selectedNodeIds.length > 0;
  const hasSingleNodeSelection = selectedNodeIds.length === 1;
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgeSimulationById = new Map(simulation.edges.map((edge) => [edge.edgeId, edge]));
  const nodeSimulationById = new Map(simulation.nodes.map((node) => [node.nodeId, node]));
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedViewportRef = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isCanvasHovered, setIsCanvasHovered] = useState(false);
  const [isTabZoomActive, setIsTabZoomActive] = useState(false);
  const [activeIssuePopover, setActiveIssuePopover] = useState<CanvasIssuePopover | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [fileMessage, setFileMessage] = useState<string>();

  const architectureIssuesByNode = new Map<string, ArchitectureIssue[]>();
  const architectureIssuesByZone = new Map<string, ArchitectureIssue[]>();
  const configurationIssuesByNode = new Map<string, ConfigurationIssue[]>();
  const configurationIssuesByZone = new Map<string, ConfigurationIssue[]>();
  const securityFindingsByNode = new Map<string, SecurityFinding[]>();

  architectureIssues.forEach((issue) => {
    if (issue.nodeId) {
      architectureIssuesByNode.set(issue.nodeId, [...(architectureIssuesByNode.get(issue.nodeId) ?? []), issue]);
    }

    if (issue.zoneId) {
      architectureIssuesByZone.set(issue.zoneId, [...(architectureIssuesByZone.get(issue.zoneId) ?? []), issue]);
    }
  });

  configurationIssues.forEach((issue) => {
    if (issue.nodeId) {
      configurationIssuesByNode.set(issue.nodeId, [...(configurationIssuesByNode.get(issue.nodeId) ?? []), issue]);
    }

    if (issue.zoneId) {
      configurationIssuesByZone.set(issue.zoneId, [...(configurationIssuesByZone.get(issue.zoneId) ?? []), issue]);
    }
  });

  securityFindings
    .filter((finding) => finding.severity !== "pass")
    .forEach((finding) => {
      if (!finding.nodeId) {
        return;
      }

      securityFindingsByNode.set(finding.nodeId, [...(securityFindingsByNode.get(finding.nodeId) ?? []), finding]);
    });

  function isSquareNodeService(serviceId: string) {
    return squareNodeServiceIds.has(serviceId) || serviceId.includes("gateway");
  }

  function getWorkspaceMetrics(rect: DOMRect) {
    const workspaceWidth = rect.width * (workspaceSize.width / 100);
    const workspaceHeight = rect.height * (workspaceSize.height / 100);
    const fitZoom = Math.min(rect.width / workspaceWidth, rect.height / workspaceHeight);
    const minZoom = Math.min(fitZoom, 0.45);

    return {
      workspaceWidth,
      workspaceHeight,
      fitZoom,
      minZoom,
    };
  }

  function getOverviewViewport(rect: DOMRect) {
    const { workspaceWidth, workspaceHeight, fitZoom } = getWorkspaceMetrics(rect);
    const scaledWidth = workspaceWidth * fitZoom;
    const scaledHeight = workspaceHeight * fitZoom;

    return {
      zoom: Number(fitZoom.toFixed(2)),
      panOffset: {
        x: (rect.width - scaledWidth) / 2,
        y: (rect.height - scaledHeight) / 2,
      },
    };
  }

  function nudgeCanvas(direction: "up" | "down" | "left" | "right") {
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const stepX = rect.width * 0.16;
    const stepY = rect.height * 0.16;
    const delta = direction === "left"
      ? { x: stepX, y: 0 }
      : direction === "right"
        ? { x: -stepX, y: 0 }
        : direction === "up"
          ? { x: 0, y: stepY }
          : { x: 0, y: -stepY };

    setPanOffset((currentPan) => clampPan(zoom, {
      x: currentPan.x + delta.x,
      y: currentPan.y + delta.y,
    }));
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (target?.matches("input, select, textarea")) {
        return;
      }

      if (event.key === "Escape") {
        onClearSelection();
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedNodeIds.length > 0 || selectedNode) {
          onDeleteSelectedNode();
        } else if (selectedEdge) {
          onDeleteSelectedEdge();
        } else if (selectedZone) {
          onDeleteSelectedZone();
        }
      }

      if (event.key.toLowerCase() === "c" && hasSingleNodeSelection && selectedNode) {
        onConnectSelectedNode();
      }

      if (event.key === "Shift" && !event.repeat && hasSingleNodeSelection && selectedNode) {
        event.preventDefault();
        onConnectSelectedNode();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        onSelectNodes(graph.nodes.map((node) => node.id));
      }

      if (event.key.toLowerCase() === "r") {
        onRunSimulation();
      }

      if (event.key === "Tab" && isCanvasHovered) {
        event.preventDefault();
        setIsTabZoomActive(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Tab") {
        setIsTabZoomActive(false);
      }
    }

    function handleWindowBlur() {
      setIsTabZoomActive(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [graph.nodes, hasSingleNodeSelection, isCanvasHovered, onClearSelection, onConnectSelectedNode, onDeleteSelectedEdge, onDeleteSelectedNode, onDeleteSelectedZone, onRunSimulation, onSelectNodes, selectedEdge, selectedNode, selectedNodeIds.length, selectedZone]);

  useEffect(() => {
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect || hasInitializedViewportRef.current) {
      return;
    }

    const overview = getOverviewViewport(rect);
    setZoom(overview.zoom);
    setPanOffset(overview.panOffset);
    hasInitializedViewportRef.current = true;
  }, []);

  useEffect(() => {
    if (!locatedNodeRequest) {
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    const targetNode = graph.nodes.find((node) => node.id === locatedNodeRequest.nodeId);

    if (!rect || !targetNode) {
      return;
    }

    const { workspaceWidth, workspaceHeight } = getWorkspaceMetrics(rect);
    const nodeX = (targetNode.position.x / 100) * workspaceWidth;
    const nodeY = (targetNode.position.y / 100) * workspaceHeight;

    setPanOffset(clampPan(zoom, {
      x: (rect.width / 2) - (nodeX * zoom),
      y: (rect.height / 2) - (nodeY * zoom),
    }));
  }, [graph.nodes, locatedNodeRequest, zoom]);

  function toCanvasPercent(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    const { workspaceWidth, workspaceHeight } = getWorkspaceMetrics(rect);
    const x = (((clientX - rect.left - panOffset.x) / zoom) / workspaceWidth) * 100;
    const y = (((clientY - rect.top - panOffset.y) / zoom) / workspaceHeight) * 100;

    return {
      x: Math.max(4, Math.min(96, x)),
      y: Math.max(6, Math.min(94, y)),
    };
  }

  function toViewportPercent(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }

  function clampPan(nextZoom: number, nextPan: { x: number; y: number }) {
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect) {
      return nextPan;
    }

    const { workspaceWidth, workspaceHeight } = getWorkspaceMetrics(rect);
    const scaledWidth = workspaceWidth * nextZoom;
    const scaledHeight = workspaceHeight * nextZoom;
    const minX = scaledWidth <= rect.width ? (rect.width - scaledWidth) / 2 : rect.width - scaledWidth;
    const maxX = scaledWidth <= rect.width ? minX : 0;
    const minY = scaledHeight <= rect.height ? (rect.height - scaledHeight) / 2 : rect.height - scaledHeight;
    const maxY = scaledHeight <= rect.height ? minY : 0;

    return {
      x: Math.min(maxX, Math.max(minX, nextPan.x)),
      y: Math.min(maxY, Math.max(minY, nextPan.y)),
    };
  }

  function createEdgePath(source: { position: { x: number; y: number } }, target: { position: { x: number; y: number } }) {
    const deltaX = target.position.x - source.position.x;
    const deltaY = target.position.y - source.position.y;

    if (Math.abs(deltaX) < 1.2 || Math.abs(deltaY) < 1.2) {
      return `M ${source.position.x} ${source.position.y} L ${target.position.x} ${target.position.y}`;
    }

    const midX = source.position.x + (deltaX / 2);

    return `M ${source.position.x} ${source.position.y} L ${midX} ${source.position.y} L ${midX} ${target.position.y} L ${target.position.x} ${target.position.y}`;
  }

  function getSelectionRect() {
    if (!selectionBox) {
      return null;
    }

    const left = Math.min(selectionBox.start.x, selectionBox.current.x);
    const top = Math.min(selectionBox.start.y, selectionBox.current.y);
    const width = Math.abs(selectionBox.current.x - selectionBox.start.x);
    const height = Math.abs(selectionBox.current.y - selectionBox.start.y);

    return { left, top, width, height };
  }

  function clampZoneLayout(layout: NonNullable<ArchitectureZone["layout"]>) {
    const width = Math.max(8, Math.min(96, layout.width));
    const height = Math.max(8, Math.min(96, layout.height));
    const x = Math.max(0.5, Math.min(99.5 - width, layout.x));
    const y = Math.max(0.5, Math.min(99.5 - height, layout.y));

    return { x, y, width, height };
  }

  function getPointerCanvasDelta(startClient: { x: number; y: number }, currentClient: { x: number; y: number }) {
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect) {
      return { x: 0, y: 0 };
    }

    const { workspaceWidth, workspaceHeight } = getWorkspaceMetrics(rect);

    return {
      x: ((currentClient.x - startClient.x) / zoom / workspaceWidth) * 100,
      y: ((currentClient.y - startClient.y) / zoom / workspaceHeight) * 100,
    };
  }

  function getPopoverStyle(target: CanvasIssuePopover) {
    if (target.targetType === "node") {
      const node = graph.nodes.find((entry) => entry.id === target.targetId);

      if (!node) {
        return undefined;
      }

      return {
        left: `${Math.min(86, node.position.x + 6)}%`,
        top: `${Math.max(6, node.position.y - 8)}%`,
      };
    }

    const zone = graph.zones.find((entry) => entry.id === target.targetId);

    if (!zone?.layout) {
      return undefined;
    }

    return {
      left: `${Math.min(84, zone.layout.x + zone.layout.width - 2)}%`,
      top: `${Math.max(6, zone.layout.y + 4)}%`,
    };
  }

  function openIssuePopover(targetType: CanvasIssuePopover["targetType"], targetId: string, category: CanvasCheckTab, issueId: string) {
    setActiveIssuePopover({ category, targetType, targetId });
    onOpenCheck(category, issueId);
  }

  function beginZoneLayoutChange(
    event: ReactPointerEvent<HTMLElement>,
    zone: ArchitectureZone,
    mode: "move" | "resize-se" | "resize-e" | "resize-s",
  ) {
    if (!zone.layout) {
      return;
    }

    event.stopPropagation();
    onSelectZone(zone.id);

    const target = event.currentTarget;
    const startClient = { x: event.clientX, y: event.clientY };
    const startLayout = { ...zone.layout };
    target.setPointerCapture(event.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = getPointerCanvasDelta(startClient, { x: moveEvent.clientX, y: moveEvent.clientY });
      const nextLayout = mode === "move"
        ? {
            ...startLayout,
            x: startLayout.x + delta.x,
            y: startLayout.y + delta.y,
          }
        : {
            ...startLayout,
            width: mode === "resize-s" ? startLayout.width : startLayout.width + delta.x,
            height: mode === "resize-e" ? startLayout.height : startLayout.height + delta.y,
          };

      onUpdateZoneLayout(zone.id, clampZoneLayout(nextLayout));
    };

    const handlePointerEnd = () => {
      target.releasePointerCapture(event.pointerId);
      target.removeEventListener("pointermove", handlePointerMove);
      target.removeEventListener("pointerup", handlePointerEnd);
      target.removeEventListener("pointercancel", handlePointerEnd);
    };

    target.addEventListener("pointermove", handlePointerMove);
    target.addEventListener("pointerup", handlePointerEnd);
    target.addEventListener("pointercancel", handlePointerEnd);
  }

  const selectionRect = getSelectionRect();

  return (
    <Panel
      title="Architecture Canvas"
      eyebrow={scenario.title}
      actions={
        <div className="canvas-toolbar" aria-label="Canvas controls">
          <button className="icon-button" onClick={() => { onSaveArchitecture(); setFileMessage("Saved locally"); }} title="Save architecture locally" type="button">
            <Save size={16} aria-hidden="true" />
          </button>
          <button className="icon-button" onClick={onExportArchitecture} title="Export architecture JSON" type="button">
            <Download size={16} aria-hidden="true" />
          </button>
          <button className="icon-button" onClick={() => importInputRef.current?.click()} title="Import architecture JSON" type="button">
            <Upload size={16} aria-hidden="true" />
          </button>
          <input
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  onImportArchitecture(parseArchitectureFile(String(reader.result)));
                  setFileMessage(`Imported ${file.name}`);
                } catch (error) {
                  setFileMessage(error instanceof Error ? error.message : "Unable to import architecture file");
                }
              };
              reader.readAsText(file);
            }}
            ref={importInputRef}
            type="file"
          />
          <label className="canvas-toolbar__template" title="Start from a common architecture pattern">
            <FileStack aria-hidden="true" size={15} />
            <select
              aria-label="Architecture templates"
              defaultValue=""
              onChange={(event) => {
                const template = architectureTemplates.find((candidate) => candidate.id === event.target.value);
                if (!template) return;
                onApplyTemplate(template.createGraph(scenario));
                setFileMessage(`${template.name} loaded`);
                event.currentTarget.value = "";
              }}
            >
              <option value="">Templates</option>
              {architectureTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
          <button
            className="icon-button icon-button--run"
            disabled={graph.edges.length === 0}
            onClick={onRunSimulation}
            title="Run architecture flow"
            type="button"
          >
            <Play size={16} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            onClick={() => {
              const rect = canvasRef.current?.getBoundingClientRect();

              if (!rect) {
                return;
              }

              const overview = getOverviewViewport(rect);
              setZoom(overview.zoom);
              setPanOffset(overview.panOffset);
            }}
            title="Reset zoom"
            type="button"
          >
            <Search size={16} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl/Cmd+Z)"
            type="button"
          >
            <Undo2 size={16} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl/Cmd+Y)"
            type="button"
          >
            <Redo2 size={16} aria-hidden="true" />
          </button>
          <button
            className={`icon-button ${isConnecting ? "icon-button--active" : ""}`}
            disabled={!hasSingleNodeSelection}
            onClick={onConnectSelectedNode}
            title={isConnecting ? "Cancel connect mode (Shift or C)" : "Connect selected node (Shift or C)"}
            type="button"
          >
            <Link2 size={16} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            disabled={!hasNodeSelection}
            onClick={() => onMoveSelectedNode("left")}
            title="Move left"
            type="button"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            disabled={!hasNodeSelection}
            onClick={() => onMoveSelectedNode("up")}
            title="Move up"
            type="button"
          >
            <ArrowUp size={16} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            disabled={!hasNodeSelection}
            onClick={() => onMoveSelectedNode("down")}
            title="Move down"
            type="button"
          >
            <ArrowDown size={16} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            disabled={!hasNodeSelection}
            onClick={() => onMoveSelectedNode("right")}
            title="Move right"
            type="button"
          >
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            disabled={!hasNodeSelection && !selectedEdge && !selectedZone}
            onClick={hasNodeSelection ? onDeleteSelectedNode : selectedEdge ? onDeleteSelectedEdge : onDeleteSelectedZone}
            title={hasNodeSelection ? "Delete selected services" : selectedEdge ? "Delete selected connection" : "Delete selected scope"}
            type="button"
          >
            {hasNodeSelection || selectedZone ? <Trash2 size={16} aria-hidden="true" /> : <Unlink size={16} aria-hidden="true" />}
          </button>
          <button
            className="icon-button"
            disabled={graph.nodes.length === 0}
            onClick={onResetGraph}
            title="Reset canvas"
            type="button"
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        </div>
      }
    >
      <div
        className="canvas-preview"
        aria-label="Architecture canvas"
        ref={canvasRef}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("application/x-nimbusarc-palette")) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(event) => {
          const rawPayload = event.dataTransfer.getData("application/x-nimbusarc-palette");

          if (!rawPayload) {
            return;
          }

          const rect = canvasRef.current?.getBoundingClientRect();

          if (!rect) {
            return;
          }

          const { workspaceWidth, workspaceHeight } = getWorkspaceMetrics(rect);
          const position = {
            x: Math.max(4, Math.min(96, (((event.clientX - rect.left - panOffset.x) / zoom) / workspaceWidth) * 100)),
            y: Math.max(6, Math.min(94, (((event.clientY - rect.top - panOffset.y) / zoom) / workspaceHeight) * 100)),
          };

          try {
            onDropPaletteItem(JSON.parse(rawPayload), position);
            event.preventDefault();
          } catch {
            return;
          }
        }}
        onPointerEnter={() => setIsCanvasHovered(true)}
        onPointerLeave={() => {
          setIsCanvasHovered(false);
          setIsTabZoomActive(false);
        }}
        onWheel={(event) => {
          if (!isTabZoomActive) {
            return;
          }

          event.preventDefault();

          const rect = canvasRef.current?.getBoundingClientRect();

          if (!rect) {
            return;
          }

          const pointerX = event.clientX - rect.left;
          const pointerY = event.clientY - rect.top;
          const zoomDelta = event.deltaY < 0 ? 0.12 : -0.12;
          const { minZoom } = getWorkspaceMetrics(rect);
          const nextZoom = Math.max(minZoom, Math.min(maxZoom, Number((zoom + zoomDelta).toFixed(2))));

          if (nextZoom === zoom) {
            return;
          }

          const contentX = (pointerX - panOffset.x) / zoom;
          const contentY = (pointerY - panOffset.y) / zoom;
          const nextPan = clampPan(nextZoom, {
            x: pointerX - contentX * nextZoom,
            y: pointerY - contentY * nextZoom,
          });

          setZoom(nextZoom);
          setPanOffset(nextPan);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as HTMLElement).closest(".canvas-node, .zone, .canvas-edge-label, .canvas-toolbar, button, input, select, textarea")) {
            return;
          }

          setActiveIssuePopover(null);

          const start = toViewportPercent(event.clientX, event.clientY);

          if (!start) {
            return;
          }

          const target = event.currentTarget;
          setSelectionBox({ start, current: start });

          const handlePointerMove = (moveEvent: PointerEvent) => {
            const current = toViewportPercent(moveEvent.clientX, moveEvent.clientY);

            if (!current) {
              return;
            }

            setSelectionBox((existing) => (existing ? { ...existing, current } : existing));
          };

          const handlePointerEnd = () => {
            target.removeEventListener("pointermove", handlePointerMove);
            target.removeEventListener("pointerup", handlePointerEnd);
            target.removeEventListener("pointercancel", handlePointerEnd);

            setSelectionBox((existing) => {
              if (!existing) {
                onClearSelection();
                return null;
              }

              const left = Math.min(existing.start.x, existing.current.x);
              const top = Math.min(existing.start.y, existing.current.y);
              const right = Math.max(existing.start.x, existing.current.x);
              const bottom = Math.max(existing.start.y, existing.current.y);
              const rect = canvasRef.current?.getBoundingClientRect();

              if (!rect) {
                onClearSelection();
                return null;
              }

              const { workspaceWidth, workspaceHeight } = getWorkspaceMetrics(rect);

              const selectedIds = graph.nodes
                .filter((node) => (
                  (((node.position.x / 100) * workspaceWidth * zoom) + panOffset.x) >= ((left / 100) * rect.width) &&
                  (((node.position.x / 100) * workspaceWidth * zoom) + panOffset.x) <= ((right / 100) * rect.width) &&
                  (((node.position.y / 100) * workspaceHeight * zoom) + panOffset.y) >= ((top / 100) * rect.height) &&
                  (((node.position.y / 100) * workspaceHeight * zoom) + panOffset.y) <= ((bottom / 100) * rect.height)
                ))
                .map((node) => node.id);

              if (selectedIds.length > 0) {
                onSelectNodes(selectedIds);
              } else {
                onClearSelection();
              }

              return null;
            });
          };

          target.addEventListener("pointermove", handlePointerMove);
          target.addEventListener("pointerup", handlePointerEnd);
          target.addEventListener("pointercancel", handlePointerEnd);
        }}
        role="presentation"
      >
        {fileMessage ? <p aria-live="polite" className="canvas-preview__file-message">{fileMessage}</p> : null}
        <button
          aria-label="Pan canvas up"
          className="canvas-pan-button canvas-pan-button--top"
          onClick={() => nudgeCanvas("up")}
          type="button"
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button
          aria-label="Pan canvas left"
          className="canvas-pan-button canvas-pan-button--left"
          onClick={() => nudgeCanvas("left")}
          type="button"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <button
          aria-label="Pan canvas right"
          className="canvas-pan-button canvas-pan-button--right"
          onClick={() => nudgeCanvas("right")}
          type="button"
        >
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button
          aria-label="Pan canvas down"
          className="canvas-pan-button canvas-pan-button--bottom"
          onClick={() => nudgeCanvas("down")}
          type="button"
        >
          <ArrowDown size={16} aria-hidden="true" />
        </button>
        <div
          className="canvas-stage"
          style={{
            ["--canvas-workspace-width" as string]: `${workspaceSize.width}%`,
            ["--canvas-workspace-height" as string]: `${workspaceSize.height}%`,
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          }}
        >
          {visibleZones.map((zone) => (
            (() => {
              const zoneArchitectureIssues = architectureIssuesByZone.get(zone.id) ?? [];
              const zoneConfigurationIssues = configurationIssuesByZone.get(zone.id) ?? [];
              const hasZoneIssue = validationIssueZoneIds.includes(zone.id);
              const isZonePopoverOpen = activeIssuePopover?.targetType === "zone" && activeIssuePopover.targetId === zone.id;

              return (
                <div
                  className={`${zoneClassNames[zone.kind] ?? "zone zone--subnet"} ${zone.kind === "subnet" ? `zone--subnet-${zone.config?.subnetAccess ?? "private"}` : ""} ${selectedZoneId === zone.id ? "zone--selected" : ""} ${hasZoneIssue ? "zone--issue" : ""}`}
                  key={zone.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectZone(zone.id);
                  }}
                  onPointerDown={(event) => {
                    if ((event.target as HTMLElement).closest(".zone-resize-handle, .canvas-issue-badge, .canvas-issue-popover")) {
                      return;
                    }

                    beginZoneLayoutChange(event, zone, "move");
                  }}
                  style={zone.layout ? {
                    left: `${zone.layout.x}%`,
                    top: `${zone.layout.y}%`,
                    width: `${zone.layout.width}%`,
                    height: `${zone.layout.height}%`,
                    zIndex: zone.layerOrder ?? 1,
                  } : undefined}
                >
                  {zone.kind === "subnet" && zone.config?.subnetAccess === "private" ? (
                    <span className="zone__corner-badge zone__corner-badge--private" title="Private subnet">
                      <Lock size={12} aria-hidden="true" />
                    </span>
                  ) : null}
                  <div className="zone__issue-stack">
                    {zoneArchitectureIssues.length > 0 ? (
                      <button
                        aria-label={`Open ${zoneArchitectureIssues.length} architecture check${zoneArchitectureIssues.length === 1 ? "" : "s"} for ${zone.label}`}
                        className={`canvas-issue-badge canvas-issue-badge--architecture ${isZonePopoverOpen && activeIssuePopover.category === "issues" ? "canvas-issue-badge--active" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openIssuePopover("zone", zone.id, "issues", zoneArchitectureIssues[0].id);
                        }}
                        title={zoneArchitectureIssues[0].title}
                        type="button"
                      >
                        <AlertTriangle size={11} aria-hidden="true" />
                        {zoneArchitectureIssues.length > 1 ? <span>{zoneArchitectureIssues.length}</span> : null}
                      </button>
                    ) : null}
                    {zoneConfigurationIssues.length > 0 ? (
                      <button
                        aria-label={`Open ${zoneConfigurationIssues.length} configuration check${zoneConfigurationIssues.length === 1 ? "" : "s"} for ${zone.label}`}
                        className={`canvas-issue-badge canvas-issue-badge--configuration ${isZonePopoverOpen && activeIssuePopover.category === "configuration" ? "canvas-issue-badge--active" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openIssuePopover("zone", zone.id, "configuration", zoneConfigurationIssues[0].id);
                        }}
                        title={zoneConfigurationIssues[0].title}
                        type="button"
                      >
                        <SlidersHorizontal size={11} aria-hidden="true" />
                        {zoneConfigurationIssues.length > 1 ? <span>{zoneConfigurationIssues.length}</span> : null}
                      </button>
                    ) : null}
                  </div>
                  <span className="zone__label">{zone.label}</span>
                  {zone.config?.cidrBlock || zone.config?.regionCode || zone.config?.availabilityZoneName ? (
                    <span className="zone__detail">{zone.config.cidrBlock ?? zone.config.regionCode ?? zone.config.availabilityZoneName}</span>
                  ) : null}
                  {isZonePopoverOpen ? (
                    <div className="canvas-issue-popover" style={getPopoverStyle(activeIssuePopover)}>
                      <p className="canvas-issue-popover__eyebrow">{activeIssuePopover.category === "issues" ? "Architecture check" : "Configuration check"}</p>
                      <strong>{activeIssuePopover.category === "issues" ? zoneArchitectureIssues[0]?.title : zoneConfigurationIssues[0]?.title}</strong>
                      <span>{activeIssuePopover.category === "issues" ? zoneArchitectureIssues[0]?.detail : zoneConfigurationIssues[0]?.detail}</span>
                    </div>
                  ) : null}
                  {selectedZoneId === zone.id ? (
                    <>
                      <button
                        aria-label={`Resize ${zone.label} horizontally`}
                        className="zone-resize-handle zone-resize-handle--e"
                        onPointerDown={(event) => beginZoneLayoutChange(event, zone, "resize-e")}
                        type="button"
                      />
                      <button
                        aria-label={`Resize ${zone.label} vertically`}
                        className="zone-resize-handle zone-resize-handle--s"
                        onPointerDown={(event) => beginZoneLayoutChange(event, zone, "resize-s")}
                        type="button"
                      />
                      <button
                        aria-label={`Resize ${zone.label}`}
                        className="zone-resize-handle zone-resize-handle--se"
                        onPointerDown={(event) => beginZoneLayoutChange(event, zone, "resize-se")}
                        type="button"
                      />
                    </>
                  ) : null}
                </div>
              );
            })()
          ))}
          {graph.edges.length > 0 ? (
            <svg
              aria-hidden="true"
              className="canvas-edges"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
            <defs>
              <marker id="arrow-request" markerHeight="4" markerWidth="4" orient="auto-start-reverse" refX="3.6" refY="2" viewBox="0 0 4 4">
                <path d="M0,0 L4,2 L0,4 Z" fill="#66aef2" />
              </marker>
              <marker id="arrow-data" markerHeight="4" markerWidth="4" orient="auto-start-reverse" refX="3.6" refY="2" viewBox="0 0 4 4">
                <path d="M0,0 L4,2 L0,4 Z" fill="#58b8c4" />
              </marker>
              <marker id="arrow-event" markerHeight="4" markerWidth="4" orient="auto-start-reverse" refX="3.6" refY="2" viewBox="0 0 4 4">
                <path d="M0,0 L4,2 L0,4 Z" fill="#e4b34f" />
              </marker>
              <marker id="arrow-observe" markerHeight="4" markerWidth="4" orient="auto-start-reverse" refX="3.6" refY="2" viewBox="0 0 4 4">
                <path d="M0,0 L4,2 L0,4 Z" fill="#62c69a" />
              </marker>
              <marker id="arrow-flowing" markerHeight="4" markerWidth="4" orient="auto-start-reverse" refX="3.6" refY="2" viewBox="0 0 4 4">
                <path d="M0,0 L4,2 L0,4 Z" fill="#60d394" />
              </marker>
              <marker id="arrow-blocked" markerHeight="4" markerWidth="4" orient="auto-start-reverse" refX="3.6" refY="2" viewBox="0 0 4 4">
                <path d="M0,0 L4,2 L0,4 Z" fill="#f27d72" />
              </marker>
            </defs>
              {graph.edges.map((edge) => {
              const sourceNode = nodesById.get(edge.sourceNodeId);
              const targetNode = nodesById.get(edge.targetNodeId);

              if (!sourceNode || !targetNode) {
                return null;
              }

              const edgeSimulation = edgeSimulationById.get(edge.id);
              const forwardPath = createEdgePath(sourceNode, targetNode);
              const reversePath = createEdgePath(targetNode, sourceNode);
              const markerId = edgeSimulation?.status === "flowing"
                ? "arrow-flowing"
                : edgeSimulation?.status === "blocked"
                  ? "arrow-blocked"
                  : `arrow-${edge.kind}`;

              return (
                <g key={edge.id}>
                  {edgeSimulation?.status ? (
                    <path
                      className={`canvas-edge-aura canvas-edge-aura--${edgeSimulation.status}`}
                      d={forwardPath}
                    />
                  ) : null}
                  <path
                    className="canvas-edge-hitbox"
                    d={forwardPath}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectEdge(edge.id);
                    }}
                  />
                  <path
                    className={`${edgeClassNames[edge.kind]} ${edgeSimulation ? `canvas-edge--${edgeSimulation.status}` : ""} ${selectedEdgeId === edge.id ? "canvas-edge--selected" : ""}`}
                    d={forwardPath}
                    markerEnd={`url(#${markerId})`}
                    markerStart={edge.direction === "two-way" ? `url(#${markerId})` : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectEdge(edge.id);
                    }}
                  />
                  {edgeSimulation?.status !== "blocked" ? (
                    <g className={`canvas-flow-particles canvas-flow-particles--${edge.kind} ${edgeSimulation?.status === "flowing" ? "canvas-flow-particles--flowing" : ""}`}>
                      {["0s", "-1.35s"].map((begin) => (
                        <path className="canvas-flow-particle" d="M -1.15 -0.8 L 1.15 0 L -1.15 0.8 Z" key={`forward-${begin}`}>
                          <animateMotion begin={begin} dur="2.7s" path={forwardPath} repeatCount="indefinite" rotate="auto" />
                        </path>
                      ))}
                      {edge.direction === "two-way"
                        ? ["-0.65s", "-2s"].map((begin) => (
                            <path className="canvas-flow-particle" d="M -1.15 -0.8 L 1.15 0 L -1.15 0.8 Z" key={`reverse-${begin}`}>
                              <animateMotion begin={begin} dur="2.7s" path={reversePath} repeatCount="indefinite" rotate="auto" />
                            </path>
                          ))
                        : null}
                    </g>
                  ) : null}
                </g>
              );
              })}
            </svg>
          ) : null}
          {graph.edges.map((edge) => {
          const sourceNode = nodesById.get(edge.sourceNodeId);
          const targetNode = nodesById.get(edge.targetNodeId);

          if (!sourceNode || !targetNode || !edge.label) {
            return null;
          }

          const midpoint = {
            x: (sourceNode.position.x + targetNode.position.x) / 2,
            y: (sourceNode.position.y + targetNode.position.y) / 2,
          };

          return (
            <div
              className={`canvas-edge-label ${edgeSimulationById.get(edge.id) ? `canvas-edge-label--${edgeSimulationById.get(edge.id)?.status}` : ""} ${selectedEdgeId === edge.id ? "canvas-edge-label--selected" : ""}`}
              key={`${edge.id}-label`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectEdge(edge.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelectEdge(edge.id);
                }
              }}
              role="button"
              style={{ left: `${midpoint.x}%`, top: `${midpoint.y}%` }}
              tabIndex={0}
            >
              {edge.label}
            </div>
          );
          })}
          {graph.nodes.map((node) => (
          (() => {
            const nodeSimulation = nodeSimulationById.get(node.id);
            const isSelected = selectedNodeIds.includes(node.id);
            const isSquareNode = isSquareNodeService(node.serviceId);
            const hasValidationIssue = validationIssueNodeIds.includes(node.id);
            const nodeArchitectureIssues = architectureIssuesByNode.get(node.id) ?? [];
            const nodeConfigurationIssues = configurationIssuesByNode.get(node.id) ?? [];
            const nodeSecurityFindings = securityFindingsByNode.get(node.id) ?? [];
            const isNodePopoverOpen = activeIssuePopover?.targetType === "node" && activeIssuePopover.targetId === node.id;
            const activeNodeIssueTitle = activeIssuePopover?.category === "issues"
              ? nodeArchitectureIssues[0]?.title
              : activeIssuePopover?.category === "configuration"
                ? nodeConfigurationIssues[0]?.title
                : nodeSecurityFindings[0]?.title;
            const activeNodeIssueDetail = activeIssuePopover?.category === "issues"
              ? nodeArchitectureIssues[0]?.detail
              : activeIssuePopover?.category === "configuration"
                ? nodeConfigurationIssues[0]?.detail
                : nodeSecurityFindings[0]?.detail;

            return (
          <div
            className={`canvas-node ${isSquareNode ? "canvas-node--square" : ""} ${nodeSimulation ? `canvas-node--${nodeSimulation.status}` : ""} ${hasValidationIssue ? "canvas-node--issue" : ""} ${isSelected ? "canvas-node--selected" : ""} ${isConnecting && selectedNodeId !== node.id ? "canvas-node--connect-target" : ""} ${isConnecting && selectedNodeId !== node.id && !canConnectNode(node.id) ? "canvas-node--connect-disabled" : ""}`}
            key={node.id}
            onClick={(event) => {
              event.stopPropagation();

              if (event.ctrlKey || event.metaKey) {
                onToggleNodeSelection(node.id);
                return;
              }

              onSelectNode(node.id);
            }}
            onPointerDown={(event) => {
              if (isConnecting || (event.target as HTMLElement).closest("button")) {
                return;
              }

              event.stopPropagation();

              if (event.ctrlKey || event.metaKey) {
                return;
              }

              if (!selectedNodeIds.includes(node.id)) {
                onSelectNode(node.id);
              }

              const target = event.currentTarget;
              target.setPointerCapture(event.pointerId);
              const anchorPosition = { ...node.position };

              const handlePointerMove = (moveEvent: PointerEvent) => {
                const position = toCanvasPercent(moveEvent.clientX, moveEvent.clientY);

                if (!position) {
                  return;
                }

                onDragNode(node.id, position, anchorPosition);
              };

              const handlePointerEnd = () => {
                target.releasePointerCapture(event.pointerId);
                target.removeEventListener("pointermove", handlePointerMove);
                target.removeEventListener("pointerup", handlePointerEnd);
                target.removeEventListener("pointercancel", handlePointerEnd);
              };

              target.addEventListener("pointermove", handlePointerMove);
              target.addEventListener("pointerup", handlePointerEnd);
              target.addEventListener("pointercancel", handlePointerEnd);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectNode(node.id);
              }
            }}
            role="button"
            style={{
              left: `${node.position.x}%`,
              top: `${node.position.y}%`,
              ["--node-accent" as string]: serviceAccentColorMap[node.serviceId] ?? "#1477d4",
            }}
            tabIndex={0}
          >
            <button
              aria-label={`${isConnecting && selectedNodeId !== node.id ? "Connect to" : "Start a connection from"} ${node.label} on the left`}
              className={`canvas-node__port canvas-node__port--left ${isConnecting && selectedNodeId === node.id ? "canvas-node__port--active" : ""} ${isConnecting && selectedNodeId !== node.id && !canConnectNode(node.id) ? "canvas-node__port--disabled" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                if (isConnecting) {
                  onSelectNode(node.id);
                } else {
                  onEdgeConnectStart(node.id);
                }
              }}
              disabled={isConnecting && selectedNodeId !== node.id && !canConnectNode(node.id)}
              title={isConnecting && selectedNodeId !== node.id ? (canConnectNode(node.id) ? "Connect to this service" : "This service is not a valid target") : "Start a connection from this service"}
              type="button"
            >
              <Link2 size={10} aria-hidden="true" />
            </button>
            <button
              aria-label={`${isConnecting && selectedNodeId !== node.id ? "Connect to" : "Start a connection from"} ${node.label} on top`}
              className={`canvas-node__port canvas-node__port--top ${isConnecting && selectedNodeId === node.id ? "canvas-node__port--active" : ""} ${isConnecting && selectedNodeId !== node.id && !canConnectNode(node.id) ? "canvas-node__port--disabled" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                if (isConnecting) {
                  onSelectNode(node.id);
                } else {
                  onEdgeConnectStart(node.id);
                }
              }}
              disabled={isConnecting && selectedNodeId !== node.id && !canConnectNode(node.id)}
              title={isConnecting && selectedNodeId !== node.id ? (canConnectNode(node.id) ? "Connect to this service" : "This service is not a valid target") : "Start a connection from this service"}
              type="button"
            >
              <Link2 size={10} aria-hidden="true" />
            </button>
            <AwsServiceIcon label={node.label} serviceId={node.serviceId} size="sm" />
            <span className="canvas-node__content">
              <span className="canvas-node__label">{node.label}</span>
              {node.serviceId === "aws-alb" && node.config.trafficSharePercent ? (
                <span className="canvas-node__meta">
                  {Number.isInteger(node.config.trafficSharePercent)
                    ? `${node.config.trafficSharePercent}% traffic`
                    : `${node.config.trafficSharePercent.toFixed(1)}% traffic`}
                </span>
              ) : null}
              {node.serviceId === "aws-alb" && (node.config.targetGroupCount || node.config.targetsPerGroup) ? (
                <span className="canvas-node__elb-mode">
                  <span className="canvas-node__elb-visual" aria-hidden="true">
                    {Array.from({
                      length: Math.max(1, Math.min(node.config.targetGroupCount ?? 1, 4)),
                    }).map((_, index) => (
                      <span className="canvas-node__elb-group" key={`${node.id}-tg-${index}`} />
                    ))}
                  </span>
                  <span className="canvas-node__meta">
                    {node.config.targetGroupCount ?? 1} TG
                    {node.config.targetGroupCount === 1 ? "" : "s"}
                    {" - "}
                    {(node.config.targetGroupCount ?? 1) * (node.config.targetsPerGroup ?? 0)} targets
                  </span>
                </span>
              ) : null}
            </span>
            {nodeSimulation?.instanceCount ? (
              <span className="canvas-node__runtime" title={nodeSimulation.reason}>
                {nodeSimulation.instanceCount}
              </span>
            ) : null}
            {(nodeArchitectureIssues.length > 0 || nodeConfigurationIssues.length > 0 || nodeSecurityFindings.length > 0) ? (
              <div className="canvas-node__issue-stack">
                {nodeArchitectureIssues.length > 0 ? (
                  <button
                    aria-label={`Open ${nodeArchitectureIssues.length} architecture check${nodeArchitectureIssues.length === 1 ? "" : "s"} for ${node.label}`}
                    className={`canvas-issue-badge canvas-issue-badge--architecture ${isNodePopoverOpen && activeIssuePopover.category === "issues" ? "canvas-issue-badge--active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openIssuePopover("node", node.id, "issues", nodeArchitectureIssues[0].id);
                    }}
                    title={nodeArchitectureIssues[0].title}
                    type="button"
                  >
                    <AlertTriangle size={11} aria-hidden="true" />
                    {nodeArchitectureIssues.length > 1 ? <span>{nodeArchitectureIssues.length}</span> : null}
                  </button>
                ) : null}
                {nodeConfigurationIssues.length > 0 ? (
                  <button
                    aria-label={`Open ${nodeConfigurationIssues.length} configuration check${nodeConfigurationIssues.length === 1 ? "" : "s"} for ${node.label}`}
                    className={`canvas-issue-badge canvas-issue-badge--configuration ${isNodePopoverOpen && activeIssuePopover.category === "configuration" ? "canvas-issue-badge--active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openIssuePopover("node", node.id, "configuration", nodeConfigurationIssues[0].id);
                    }}
                    title={nodeConfigurationIssues[0].title}
                    type="button"
                  >
                    <SlidersHorizontal size={11} aria-hidden="true" />
                    {nodeConfigurationIssues.length > 1 ? <span>{nodeConfigurationIssues.length}</span> : null}
                  </button>
                ) : null}
                {nodeSecurityFindings.length > 0 ? (
                  <button
                    aria-label={`Open ${nodeSecurityFindings.length} security check${nodeSecurityFindings.length === 1 ? "" : "s"} for ${node.label}`}
                    className={`canvas-issue-badge canvas-issue-badge--security ${isNodePopoverOpen && activeIssuePopover.category === "security" ? "canvas-issue-badge--active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openIssuePopover("node", node.id, "security", nodeSecurityFindings[0].id);
                    }}
                    title={nodeSecurityFindings[0].title}
                    type="button"
                  >
                    <ShieldCheck size={11} aria-hidden="true" />
                    {nodeSecurityFindings.length > 1 ? <span>{nodeSecurityFindings.length}</span> : null}
                  </button>
                ) : null}
              </div>
            ) : null}
            {isNodePopoverOpen ? (
              <div className="canvas-issue-popover" style={getPopoverStyle(activeIssuePopover)}>
                <p className="canvas-issue-popover__eyebrow">
                  {activeIssuePopover.category === "issues"
                    ? "Architecture check"
                    : activeIssuePopover.category === "configuration"
                      ? "Configuration check"
                      : "Security check"}
                </p>
                <strong>{activeNodeIssueTitle}</strong>
                <span>{activeNodeIssueDetail}</span>
              </div>
            ) : null}
            <button
              aria-label={`${isConnecting && selectedNodeId !== node.id ? "Connect to" : "Start a connection from"} ${node.label} on right`}
              className={`canvas-node__port canvas-node__port--right ${isConnecting && selectedNodeId === node.id ? "canvas-node__port--active" : ""} ${isConnecting && selectedNodeId !== node.id && !canConnectNode(node.id) ? "canvas-node__port--disabled" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                if (isConnecting) {
                  onSelectNode(node.id);
                } else {
                  onEdgeConnectStart(node.id);
                }
              }}
              disabled={isConnecting && selectedNodeId !== node.id && !canConnectNode(node.id)}
              title={isConnecting && selectedNodeId !== node.id ? (canConnectNode(node.id) ? "Connect to this service" : "This service is not a valid target") : "Start a connection from this service"}
              type="button"
            >
              <Link2 size={10} aria-hidden="true" />
            </button>
            <button
              aria-label={`${isConnecting && selectedNodeId !== node.id ? "Connect to" : "Start a connection from"} ${node.label} on bottom`}
              className={`canvas-node__port canvas-node__port--bottom ${isConnecting && selectedNodeId === node.id ? "canvas-node__port--active" : ""} ${isConnecting && selectedNodeId !== node.id && !canConnectNode(node.id) ? "canvas-node__port--disabled" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                if (isConnecting) {
                  onSelectNode(node.id);
                } else {
                  onEdgeConnectStart(node.id);
                }
              }}
              disabled={isConnecting && selectedNodeId !== node.id && !canConnectNode(node.id)}
              title={isConnecting && selectedNodeId !== node.id ? (canConnectNode(node.id) ? "Connect to this service" : "This service is not a valid target") : "Start a connection from this service"}
              type="button"
            >
              <Link2 size={10} aria-hidden="true" />
            </button>
          </div>
            );
          })()
          ))}
        </div>
        {selectionRect ? (
          <div
            aria-hidden="true"
            className="canvas-selection-box"
            style={{
              left: `${selectionRect.left}%`,
              top: `${selectionRect.top}%`,
              width: `${selectionRect.width}%`,
              height: `${selectionRect.height}%`,
            }}
          />
        ) : null}
        {graph.nodes.length === 0 ? (
          <div className="canvas-preview__empty">
            Add AWS services to start shaping the architecture.
          </div>
        ) : null}
      </div>
      <div className="canvas-preview__meta">
        <span>{graph.nodes.length} nodes</span>
        <span>{graph.edges.length} connections</span>
        <span className={validationIssueCount > 0 ? "canvas-preview__issue-count" : ""}>{validationIssueCount} checks flagged</span>
        <span>{Math.round(zoom * 100)}% zoom</span>
        {simulation.summary ? <span>{simulation.summary}</span> : null}
        <span>
          {isConnecting && selectedNode
            ? connectionHint ?? `Connect from ${selectedNode.label} to another node`
            : selectedEdge
              ? "Selected connection. Use the unlink button or click elsewhere to clear it."
            : selectedNodeIds.length > 1
              ? `${selectedNodeIds.length} services selected. Delete, move, or drag them together.`
            : selectedNode
              ? `Selected: ${selectedNode.label}. Click a side link handle or press C, then click a target service.`
              : "Click a service, then use its side link handle to connect it to another service."}
        </span>
      </div>
      <div className="canvas-flow-legend" aria-label="Flow legend">
        <span className="flow-legend__item flow-legend__item--request">Request</span>
        <span className="flow-legend__item flow-legend__item--data">Data</span>
        <span className="flow-legend__item flow-legend__item--observe">Observability</span>
        <span className="flow-legend__item flow-legend__item--flowing">Flowing</span>
        <span className="flow-legend__item flow-legend__item--blocked">Blocked</span>
        <span className="flow-legend__item">`Ctrl/Cmd+Click` add selection</span>
        <span className="flow-legend__item">`Ctrl/Cmd+A` select all</span>
        <span className="flow-legend__item">`Ctrl/Cmd+C` copy</span>
        <span className="flow-legend__item">`Ctrl/Cmd+V` paste</span>
        <span className="flow-legend__item">`Ctrl/Cmd+Z` undo</span>
        <span className="flow-legend__item">`Ctrl/Cmd+Y` redo</span>
        <span className="flow-legend__item">`Tab+Scroll` zoom</span>
        <span className="flow-legend__item">`Delete` remove</span>
        <span className="flow-legend__item">`R` run</span>
      </div>
    </Panel>
  );
}
