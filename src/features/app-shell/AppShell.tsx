import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Boxes, Cloud, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import { providerRegistry } from "../../domain/providerRegistry";
import { scenarios, services } from "../../data/providers";
import { assessArchitectureValidation } from "../../domain/architectureValidation";
import { assessArchitectureConfiguration } from "../../domain/configurationValidation";
import { assessArchitectureSecurity } from "../../domain/securitySimulation";
import { canServicesConnect, getConnectableServiceIds, inferConnectionBlueprint } from "../../domain/connectionRules";
import { simulateArchitectureGraph } from "../../domain/flowSimulation";
import { createIdleSimulation } from "../../domain/flowSimulation";
import { createPreviewLearnerScenarioState } from "../../domain/graphFactory";
import { downloadArchitecture, loadSavedArchitecture, saveArchitecture } from "../../domain/architecturePersistence";
import {
  addNode,
  addZone,
  clearScenarioSelection,
  connectNodes,
  moveNode,
  removeNodes,
  removeEdge,
  removeZone,
  reorderZoneLayer,
  resetScenarioGraph,
  selectEdge,
  selectNode,
  selectNodes,
  toggleNodeSelection,
  updateEdge,
  updateNodeConfig,
  updateNodeLabel,
  updateZone,
  updateScenarioGraph,
} from "../../domain/graphCommands";
import type {
  ArchitectureGraph,
  ArchitectureNodeId,
  ArchitectureZoneId,
  CanvasPoint,
  LearnerScenarioState,
} from "../../domain/graph";
import type { CloudService } from "../../domain/types";
import { ArchitectureCanvasPreview } from "../canvas/ArchitectureCanvasPreview";
import { CloudShellPanel } from "../canvas/CloudShellPanel";
import { ArchitectureInspector } from "../canvas/ArchitectureInspector";
import { CataloguePreview } from "../catalogue/CataloguePreview";
import { ResourceInventoryPanel } from "../canvas/ResourceInventoryPanel";
import { ServiceDetailPanel } from "../catalogue/ServiceDetailPanel";
import { FeedbackPreview } from "../feedback/FeedbackPreview";
import { ScenarioPlayerPreview } from "../scenario-player/ScenarioPlayerPreview";
import { CanvasPalette } from "../canvas/CanvasPalette";
import { StatusPill } from "../../ui/StatusPill";
import type { AnalysisTab } from "../analysis/ArchitectureAnalysisPanel";

const activeScenario = scenarios[0];

const zoneYPositions: Record<string, number> = {
  "aws-global-edge": 12,
  "aws-public-subnet-a": 24,
  "aws-public-subnet-b": 24,
  "aws-private-subnet-a": 50,
  "aws-private-subnet-b": 50,
  "aws-data-tier": 72,
  "aws-region-primary": 18,
};

const zoneXSlots = [18, 34, 50, 66, 82];
const movementDelta = 6;
const maxHistoryDepth = 80;

function clampPosition(position: CanvasPoint): CanvasPoint {
  return {
    x: Math.max(8, Math.min(92, position.x)),
    y: Math.max(10, Math.min(88, position.y)),
  };
}

function getZoneIdForPosition(graph: ArchitectureGraph, position: CanvasPoint): ArchitectureZoneId | undefined {
  const containingZones = graph.zones
    .filter((zone) => zone.layout && position.x >= zone.layout.x && position.x <= zone.layout.x + zone.layout.width && position.y >= zone.layout.y && position.y <= zone.layout.y + zone.layout.height)
    .sort((a, b) => (a.layout!.width * a.layout!.height) - (b.layout!.width * b.layout!.height));

  if (containingZones[0]) {
    return containingZones[0].id;
  }

  if (position.y <= 18) {
    return "aws-global-edge";
  }

  if (position.y >= 39 && position.y <= 60) {
    return position.x >= 50 ? "aws-public-subnet-b" : "aws-public-subnet-a";
  }

  if (position.y >= 63 && position.y <= 84) {
    return position.x >= 50 ? "aws-private-subnet-b" : "aws-private-subnet-a";
  }

  if (position.y >= 84) {
    return "aws-data-tier";
  }

  return "aws-region-primary";
}

function getSuggestedZoneId(service: CloudService): ArchitectureZoneId {
  if (
    service.id === "aws-user" ||
    service.id === "aws-client" ||
    service.id === "aws-route-53" ||
    service.id === "aws-cloudfront"
  ) {
    return "aws-global-edge";
  }

  if (service.id === "aws-s3") {
    return "aws-data-tier";
  }

  if (service.id === "aws-rds") {
    return "aws-private-subnet-b";
  }

  if (service.id === "aws-alb" || service.id === "aws-public-subnet") {
    return "aws-public-subnet-a";
  }

  if (
    service.id === "aws-auto-scaling" ||
    service.id === "aws-private-subnet"
  ) {
    return "aws-private-subnet-a";
  }

  return "aws-region-primary";
}

function getSuggestedNodePosition(
  graph: ArchitectureGraph,
  zoneId: ArchitectureZoneId,
) {
  const existingNodesInZone = graph.nodes.filter((node) => node.zoneId === zoneId).length;
  const x = zoneXSlots[existingNodesInZone % zoneXSlots.length];
  const yOffset = Math.floor(existingNodesInZone / zoneXSlots.length) * 8;

  return {
    x,
    y: Math.min((zoneYPositions[zoneId] ?? 18) + yOffset, 88),
  };
}

function getNewZoneLayout(graph: ArchitectureGraph, kind: "region" | "vpc" | "availability-zone" | "subnet", parentZoneId?: ArchitectureZoneId) {
  const siblings = graph.zones.filter((zone) => zone.kind === kind && zone.parentZoneId === parentZoneId);
  if (kind === "region") return { x: 2.5 + siblings.length * 2, y: 16 + siblings.length * 2, width: 95 - siblings.length * 4, height: 81.5 - siblings.length * 4 };
  if (kind === "vpc") return { x: 6 + siblings.length * 2, y: 23 + siblings.length * 2, width: 88 - siblings.length * 4, height: 70 - siblings.length * 4 };
  const column = siblings.length % 2;
  const row = Math.floor(siblings.length / 2);
  return kind === "availability-zone"
    ? { x: column ? 51 : 9, y: 31 + row * 8, width: 40, height: 57 - row * 8 }
    : { x: column ? 53.5 : 11.5, y: 39 + row * 24, width: 35, height: 21 };
}

type ZoneAddKind = "region" | "vpc" | "availability-zone" | "subnet-public" | "subnet-private";

type PaletteDropPayload =
  | { type: "service"; serviceId: string }
  | { type: "zone"; zoneKind: ZoneAddKind };

type ClipboardSnapshot =
  | {
      type: "nodes";
      nodes: LearnerScenarioState["graph"]["nodes"];
    }
  | {
      type: "zone";
      zone: LearnerScenarioState["graph"]["zones"][number];
    };

function parseNameParts(label: string) {
  const match = label.trim().match(/^(.*?)(?:_(\d+))?$/);
  return {
    baseName: (match?.[1]?.trim() || label.trim() || "Resource"),
    currentIndex: match?.[2] ? Number(match[2]) : 0,
  };
}

function getNextAvailableLabel(existingLabels: string[], sourceLabel: string) {
  const { baseName, currentIndex } = parseNameParts(sourceLabel);
  const normalized = new Set(existingLabels);
  let nextIndex = Math.max(currentIndex + 1, 2);

  while (normalized.has(`${baseName}_${nextIndex}`)) {
    nextIndex += 1;
  }

  return `${baseName}_${nextIndex}`;
}

export function AppShell() {
  const activeProvider = providerRegistry.find((provider) => provider.enabled);
  const servicesById = new Map(services.map((service) => [service.id, service]));
  const [scenarioState, setScenarioState] = useState(() => {
    const savedGraph = loadSavedArchitecture();
    const initialState = createPreviewLearnerScenarioState(activeScenario);
    return savedGraph?.provider === activeScenario.provider
      ? { ...initialState, graph: savedGraph, status: "editing" as const }
      : initialState;
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string>();
  const [inspectedServiceId, setInspectedServiceId] = useState<string>(services[0]?.id ?? "");
  const [paletteMode, setPaletteMode] = useState<"services" | "network" | "security" | "costs" | "quotas" | "issues" | "configuration">("services");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isInspectorVisible, setIsInspectorVisible] = useState(true);
  const [isServiceDetailVisible, setIsServiceDetailVisible] = useState(true);
  const [locatedNodeRequest, setLocatedNodeRequest] = useState<{ nodeId: string; requestId: number }>();
  const [focusedCheck, setFocusedCheck] = useState<{ tab: Extract<AnalysisTab, "issues" | "configuration" | "security">; findingId: string; requestId: number }>();
  const [checkRefreshVersion, setCheckRefreshVersion] = useState(0);
  const scenarioStateRef = useRef(scenarioState);
  const undoStackRef = useRef<LearnerScenarioState[]>([]);
  const redoStackRef = useRef<LearnerScenarioState[]>([]);
  const clipboardRef = useRef<ClipboardSnapshot | null>(null);
  const [, setHistoryVersion] = useState(0);
  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;
  const architectureValidation = assessArchitectureValidation(scenarioState.graph, servicesById);
  const configurationValidation = assessArchitectureConfiguration(scenarioState.graph);
  const securityAssessment = assessArchitectureSecurity(scenarioState.graph, servicesById);

  function handleRefreshChecks() {
    setCheckRefreshVersion((version) => version + 1);
  }

  function handleSaveArchitecture() {
    saveArchitecture(scenarioStateRef.current.graph);
  }

  function handleExportArchitecture() {
    downloadArchitecture(scenarioStateRef.current.graph, `${activeScenario.id}.json`);
  }

  function handleImportArchitecture(graph: ArchitectureGraph) {
    if (graph.provider !== activeScenario.provider) {
      return;
    }

    applyScenarioStateChange((currentState) => ({
      ...currentState,
      graph: { ...graph, scenarioId: activeScenario.id },
      selection: {},
      simulation: createIdleSimulation(),
      status: "editing",
    }), { trackHistory: true });
  }

  function handleApplyTemplate(graph: ArchitectureGraph) {
    applyScenarioStateChange((currentState) => ({
      ...currentState,
      graph: { ...graph, scenarioId: activeScenario.id },
      selection: {},
      simulation: createIdleSimulation(),
      status: "editing",
    }), { trackHistory: true });
  }

  useEffect(() => {
    scenarioStateRef.current = scenarioState;
  }, [scenarioState]);

  function commitScenarioState(nextState: LearnerScenarioState, options?: { trackHistory?: boolean; clearRedo?: boolean }) {
    const currentState = scenarioStateRef.current;

    if (nextState === currentState) {
      return;
    }

    if (options?.trackHistory) {
      undoStackRef.current = [...undoStackRef.current.slice(-(maxHistoryDepth - 1)), currentState];

      if (options.clearRedo ?? true) {
        redoStackRef.current = [];
      }

      setHistoryVersion((version) => version + 1);
    }

    scenarioStateRef.current = nextState;
    setScenarioState(nextState);
  }

  function applyScenarioStateChange(
    updater: (state: LearnerScenarioState) => LearnerScenarioState,
    options?: { trackHistory?: boolean; clearRedo?: boolean },
  ) {
    commitScenarioState(updater(scenarioStateRef.current), options);
  }

  function handleAddService(service: CloudService) {
    applyScenarioStateChange((currentState) => {
      const selectedZoneId = currentState.selection.zoneId;
      const zoneId = selectedZoneId ?? getSuggestedZoneId(service);
      const position = getSuggestedNodePosition(currentState.graph, zoneId);
      const nextNodeId = `node-${currentState.graph.nodes.length + 1}`;

      const nextState = updateScenarioGraph(currentState, (graph) =>
        addNode(graph, {
          id: nextNodeId,
          serviceId: service.id,
          label: service.name,
          position,
          zoneId,
        }),
      );

      return selectNode(nextState, nextNodeId);
    }, { trackHistory: true });
  }

  function createDroppedServiceState(currentState: LearnerScenarioState, service: CloudService, position: CanvasPoint) {
    const zoneId = getZoneIdForPosition(currentState.graph, position) ?? currentState.selection.zoneId ?? getSuggestedZoneId(service);
    const nextNodeId = `node-${currentState.graph.nodes.length + 1}`;
    const nextState = updateScenarioGraph(currentState, (graph) =>
      addNode(graph, {
        id: nextNodeId,
        serviceId: service.id,
        label: service.name,
        position,
        zoneId,
      }),
    );

    return selectNode(nextState, nextNodeId);
  }

  function handleInspectService(service: CloudService) {
    setInspectedServiceId(service.id);
    setIsServiceDetailVisible(true);
  }

  function handleCanvasPaletteDrop(payload: PaletteDropPayload, position: CanvasPoint) {
    applyScenarioStateChange((currentState) => {
      if (payload.type === "service") {
        const service = servicesById.get(payload.serviceId);
        return service ? createDroppedServiceState(currentState, service, position) : currentState;
      }

      return createZoneState(currentState, payload.zoneKind, position);
    }, { trackHistory: true });
  }

  function createZoneState(
    currentState: LearnerScenarioState,
    kind: ZoneAddKind,
    dropPosition?: CanvasPoint,
  ) {
      const selectedZone = currentState.graph.zones.find((zone) => zone.id === currentState.selection.zoneId);
      const resolvedKind = kind === "subnet-public" || kind === "subnet-private" ? "subnet" : kind;
      const parentZoneId = resolvedKind === "region"
        ? undefined
        : resolvedKind === "vpc"
          ? (selectedZone?.kind === "region" ? selectedZone.id : currentState.graph.zones.find((zone) => zone.kind === "region")?.id)
          : resolvedKind === "availability-zone"
            ? (selectedZone?.kind === "vpc" ? selectedZone.id : currentState.graph.zones.find((zone) => zone.kind === "vpc")?.id)
            : (selectedZone?.kind === "vpc" || selectedZone?.kind === "availability-zone" ? selectedZone.id : currentState.graph.zones.find((zone) => zone.kind === "vpc")?.id);
      const count = currentState.graph.zones.filter((zone) => zone.kind === resolvedKind).length + 1;
      const id = `${resolvedKind}-${count}`;
      const subnetAccess = kind === "subnet-public" ? "public" : kind === "subnet-private" ? "private" : undefined;
      const label = resolvedKind === "availability-zone"
        ? `Availability Zone ${count}`
        : resolvedKind === "subnet"
          ? `${subnetAccess === "public" ? "Public" : "Private"} Subnet ${count}`
          : `${resolvedKind === "vpc" ? "Application" : "AWS"} ${resolvedKind.toUpperCase()} ${count}`;
      const defaultLayout = getNewZoneLayout(currentState.graph, resolvedKind, parentZoneId);
      const layout = dropPosition
        ? {
            ...defaultLayout,
            x: Math.max(2, Math.min(94 - defaultLayout.width, dropPosition.x - (defaultLayout.width / 2))),
            y: Math.max(2, Math.min(94 - defaultLayout.height, dropPosition.y - (defaultLayout.height / 2))),
          }
        : defaultLayout;
      const nextState = updateScenarioGraph(currentState, (graph) => addZone(graph, {
        id,
        provider: currentState.provider,
        kind: resolvedKind,
        label,
        parentZoneId,
        layout,
        config: resolvedKind === "subnet" ? { subnetAccess: subnetAccess ?? "private" } : undefined,
      }));
      return { ...nextState, selection: { zoneId: id } };
  }

  function handleAddZone(kind: ZoneAddKind) {
    applyScenarioStateChange((currentState) => createZoneState(currentState, kind), { trackHistory: true });
  }

  function handleSelectZone(zoneId: ArchitectureZoneId) {
    setIsConnecting(false);
    setIsInspectorVisible(true);
    setScenarioState((currentState) => ({ ...currentState, selection: { zoneId } }));
  }

  function handleDeleteSelectedZone() {
    applyScenarioStateChange((currentState) => currentState.selection.zoneId
      ? { ...updateScenarioGraph(currentState, (graph) => removeZone(graph, currentState.selection.zoneId!)), selection: {} }
      : currentState, { trackHistory: true });
  }

  function handleUpdateSelectedZone(changes: Parameters<typeof updateZone>[2]) {
    applyScenarioStateChange((currentState) => currentState.selection.zoneId
      ? updateScenarioGraph(currentState, (graph) => updateZone(graph, currentState.selection.zoneId!, changes))
      : currentState, { trackHistory: true });
  }

  function handleUpdateZoneLayout(zoneId: ArchitectureZoneId, layout: NonNullable<ArchitectureGraph["zones"][number]["layout"]>) {
    applyScenarioStateChange((currentState) => {
      return updateScenarioGraph(currentState, (graph) => updateZone(graph, zoneId, { layout }));
    }, { trackHistory: true });
  }

  function handleReorderZoneLayer(zoneId: ArchitectureZoneId, direction: "up" | "down") {
    applyScenarioStateChange((currentState) =>
      updateScenarioGraph(currentState, (graph) => reorderZoneLayer(graph, zoneId, direction)),
    { trackHistory: true });
  }

  function handleSelectNode(nodeId: ArchitectureNodeId) {
    applyScenarioStateChange((currentState) => {
      const sourceNodeId = currentState.selection.nodeId;

      if (isConnecting && sourceNodeId && sourceNodeId !== nodeId) {
        const sourceNode = currentState.graph.nodes.find((node) => node.id === sourceNodeId);
        const targetNode = currentState.graph.nodes.find((node) => node.id === nodeId);

        if (!sourceNode || !targetNode) {
          setIsConnecting(false);
          setConnectionMessage(undefined);
          return clearScenarioSelection(currentState);
        }

        const validation = canServicesConnect(
          servicesById.get(sourceNode.serviceId),
          servicesById.get(targetNode.serviceId),
        );

        if (!validation.allowed) {
          setConnectionMessage(validation.reason);
          return selectNode(currentState, sourceNodeId);
        }

        const blueprint = inferConnectionBlueprint(sourceNode, targetNode);

        const nextState = updateScenarioGraph(currentState, (graph) =>
          connectNodes(graph, {
            sourceNodeId,
            targetNodeId: nodeId,
            kind: blueprint.kind,
            label: blueprint.label,
            direction: blueprint.direction,
          }),
        );

        setIsConnecting(false);
        setConnectionMessage(undefined);
        setIsInspectorVisible(true);
        return selectNode(nextState, nodeId);
      }

      setConnectionMessage(undefined);
      setIsInspectorVisible(true);
      return selectNode(currentState, nodeId);
    });
  }

  function handleToggleNodeSelection(nodeId: ArchitectureNodeId) {
    setConnectionMessage(undefined);
    setIsConnecting(false);
    applyScenarioStateChange((currentState) => toggleNodeSelection(currentState, nodeId));
  }

  function handleSelectNodes(nodeIds: ArchitectureNodeId[]) {
    setConnectionMessage(undefined);
    setIsConnecting(false);
    applyScenarioStateChange((currentState) => selectNodes(currentState, nodeIds));
  }

  function handleClearSelection() {
    setIsConnecting(false);
    setConnectionMessage(undefined);
    applyScenarioStateChange((currentState) => clearScenarioSelection(currentState));
  }

  function handleMoveSelectedNode(direction: "up" | "down" | "left" | "right") {
    applyScenarioStateChange((currentState) => {
      const selectedNodeIds = currentState.selection.nodeIds ?? (currentState.selection.nodeId ? [currentState.selection.nodeId] : []);

      if (selectedNodeIds.length === 0) {
        return currentState;
      }

      return updateScenarioGraph(currentState, (graph) => {
        let nextGraph = graph;

        for (const selectedNodeId of selectedNodeIds) {
          const selectedNode = nextGraph.nodes.find((node) => node.id === selectedNodeId);

          if (!selectedNode) {
            continue;
          }

          const nextPosition = clampPosition({
            x:
              direction === "left"
                ? selectedNode.position.x - movementDelta
                : direction === "right"
                  ? selectedNode.position.x + movementDelta
                  : selectedNode.position.x,
            y:
              direction === "up"
                ? selectedNode.position.y - movementDelta
                : direction === "down"
                  ? selectedNode.position.y + movementDelta
                  : selectedNode.position.y,
          });

          const movedGraph = moveNode(nextGraph, selectedNodeId, nextPosition);
          const nextZoneId = getZoneIdForPosition(nextGraph, nextPosition);

          nextGraph = {
            ...movedGraph,
            nodes: movedGraph.nodes.map((node) =>
              node.id === selectedNodeId ? { ...node, zoneId: nextZoneId } : node,
            ),
          };
        }

        return nextGraph;
      });
    }, { trackHistory: true });
  }

  function handleDragNode(
    nodeId: ArchitectureNodeId,
    position: CanvasPoint,
    anchorPosition?: CanvasPoint,
  ) {
    const nextPosition = clampPosition(position);

    applyScenarioStateChange((currentState) => {
      return updateScenarioGraph(currentState, (graph) => {
        const selectedNodeIds = currentState.selection.nodeIds ?? (currentState.selection.nodeId ? [currentState.selection.nodeId] : []);
        const shouldMoveSelection = selectedNodeIds.includes(nodeId) && selectedNodeIds.length > 1;
        const movedNodeIds = shouldMoveSelection ? selectedNodeIds : [nodeId];
        const sourceNode = graph.nodes.find((node) => node.id === nodeId);

        if (!sourceNode) {
          return graph;
        }

        const dragOrigin = anchorPosition ?? sourceNode.position;
        const deltaX = nextPosition.x - dragOrigin.x;
        const deltaY = nextPosition.y - dragOrigin.y;

        let nextGraph = graph;

        for (const movedNodeId of movedNodeIds) {
          const currentNode = nextGraph.nodes.find((node) => node.id === movedNodeId);

          if (!currentNode) {
            continue;
          }

          const resolvedPosition = shouldMoveSelection
            ? clampPosition({
                x: currentNode.position.x + deltaX,
                y: currentNode.position.y + deltaY,
              })
            : nextPosition;

          const movedGraph = moveNode(nextGraph, movedNodeId, resolvedPosition);
          const nextZoneId = getZoneIdForPosition(nextGraph, resolvedPosition);

          nextGraph = {
            ...movedGraph,
            nodes: movedGraph.nodes.map((node) =>
              node.id === movedNodeId ? { ...node, zoneId: nextZoneId } : node,
            ),
          };
        }

        return nextGraph;
      });
    }, { trackHistory: true });
  }

  function handleDeleteSelectedNodes() {
    applyScenarioStateChange((currentState) => {
      const selectedNodeIds = currentState.selection.nodeIds ?? (currentState.selection.nodeId ? [currentState.selection.nodeId] : []);

      if (selectedNodeIds.length === 0) {
        return currentState;
      }

      return clearScenarioSelection(
        updateScenarioGraph(currentState, (graph) => removeNodes(graph, selectedNodeIds)),
      );
    }, { trackHistory: true });
    setIsConnecting(false);
    setConnectionMessage(undefined);
  }

  function handleDeleteNodeById(nodeId: string) {
    applyScenarioStateChange((currentState) =>
      clearScenarioSelection(updateScenarioGraph(currentState, (graph) => removeNodes(graph, [nodeId]))),
    { trackHistory: true });
    setIsConnecting(false);
    setConnectionMessage(undefined);
  }

  function handleResetGraph() {
    setIsConnecting(false);
    setConnectionMessage(undefined);
    applyScenarioStateChange((currentState) => resetScenarioGraph(currentState), { trackHistory: true });
  }

  function handleToggleConnectMode() {
    if ((scenarioState.selection.nodeIds?.length ?? 0) > 1 || !scenarioState.selection.nodeId) {
      return;
    }

    setIsConnecting((currentValue) => {
      const nextValue = !currentValue;

      if (!nextValue) {
        setConnectionMessage(undefined);
      }

      return nextValue;
    });
  }

  function handleEdgeConnectStart(nodeId: ArchitectureNodeId) {
    applyScenarioStateChange((currentState) => selectNode(currentState, nodeId));
    setConnectionMessage(undefined);
    setIsConnecting(true);
    setIsInspectorVisible(true);
  }

  function handleSelectEdge(edgeId: string) {
    setIsConnecting(false);
    setConnectionMessage(undefined);
    setIsInspectorVisible(true);
    applyScenarioStateChange((currentState) => selectEdge(currentState, edgeId));
  }

  function handleDeleteSelectedEdge() {
    applyScenarioStateChange((currentState) => {
      const selectedEdgeId = currentState.selection.edgeId;

      if (!selectedEdgeId) {
        return currentState;
      }

      return clearScenarioSelection(
        updateScenarioGraph(currentState, (graph) => removeEdge(graph, selectedEdgeId)),
      );
    }, { trackHistory: true });
  }

  function handleUpdateSelectedNodeLabel(label: string) {
    applyScenarioStateChange((currentState) => {
      if ((currentState.selection.nodeIds?.length ?? 0) > 1) {
        return currentState;
      }
      const nodeId = currentState.selection.nodeId;
      return nodeId
        ? updateScenarioGraph(currentState, (graph) => updateNodeLabel(graph, nodeId, label))
        : currentState;
    }, { trackHistory: true });
  }

  function handleUpdateSelectedNodeConfig(config: Parameters<typeof updateNodeConfig>[2]) {
    applyScenarioStateChange((currentState) => {
      if ((currentState.selection.nodeIds?.length ?? 0) > 1) {
        return currentState;
      }
      const nodeId = currentState.selection.nodeId;
      return nodeId
        ? updateScenarioGraph(currentState, (graph) => updateNodeConfig(graph, nodeId, config))
        : currentState;
    }, { trackHistory: true });
  }

  function handleUpdateSelectedEdge(changes: Parameters<typeof updateEdge>[2]) {
    applyScenarioStateChange((currentState) => {
      const edgeId = currentState.selection.edgeId;
      return edgeId
        ? updateScenarioGraph(currentState, (graph) => updateEdge(graph, edgeId, changes))
        : currentState;
    }, { trackHistory: true });
  }

  function handleRunSimulation() {
    setIsConnecting(false);
    setConnectionMessage(undefined);
    applyScenarioStateChange((currentState) => ({
      ...currentState,
      simulation: simulateArchitectureGraph(currentState.graph),
    }), { trackHistory: true });
  }

  function handleCopySelection() {
    const currentState = scenarioStateRef.current;
    const selectedNodeIds = currentState.selection.nodeIds ?? (currentState.selection.nodeId ? [currentState.selection.nodeId] : []);

    if (selectedNodeIds.length > 0) {
      const nodes = currentState.graph.nodes
        .filter((node) => selectedNodeIds.includes(node.id))
        .map((node) => ({
          ...node,
          config: { ...node.config },
          position: { ...node.position },
        }));

      clipboardRef.current = { type: "nodes", nodes };
      return;
    }

    if (currentState.selection.zoneId) {
      const zone = currentState.graph.zones.find((entry) => entry.id === currentState.selection.zoneId);

      if (zone) {
        clipboardRef.current = {
          type: "zone",
          zone: {
            ...zone,
            config: zone.config ? { ...zone.config } : undefined,
            layout: zone.layout ? { ...zone.layout } : undefined,
          },
        };
      }
    }
  }

  function handlePasteSelection() {
    const clipboard = clipboardRef.current;

    if (!clipboard) {
      return;
    }

    applyScenarioStateChange((currentState) => {
      if (clipboard.type === "zone") {
        const existingLabels = currentState.graph.zones.map((zone) => zone.label);
        const nextLabel = getNextAvailableLabel(existingLabels, clipboard.zone.label);
        const nextId = `${clipboard.zone.kind}-${currentState.graph.zones.length + 1}`;
        const layout = clipboard.zone.layout
          ? {
              ...clipboard.zone.layout,
              x: Math.min(94 - clipboard.zone.layout.width, clipboard.zone.layout.x + 4),
              y: Math.min(94 - clipboard.zone.layout.height, clipboard.zone.layout.y + 4),
            }
          : undefined;

        const nextState = updateScenarioGraph(currentState, (graph) => addZone(graph, {
          id: nextId,
          provider: clipboard.zone.provider,
          kind: clipboard.zone.kind,
          label: nextLabel,
          parentZoneId: clipboard.zone.parentZoneId,
          description: clipboard.zone.description,
          config: clipboard.zone.config ? { ...clipboard.zone.config } : undefined,
          layout,
        }));

        return { ...nextState, selection: { zoneId: nextId } };
      }

      let nextState = currentState;
      const existingLabels = currentState.graph.nodes.map((node) => node.label);
      const pastedIds: string[] = [];
      const labelPool = [...existingLabels];

      for (const node of clipboard.nodes) {
        const nextId = `node-${nextState.graph.nodes.length + 1}`;
        const nextLabel = getNextAvailableLabel(labelPool, node.label);
        labelPool.push(nextLabel);
        pastedIds.push(nextId);
        nextState = updateScenarioGraph(nextState, (graph) =>
          addNode(graph, {
            id: nextId,
            serviceId: node.serviceId,
            label: nextLabel,
            position: clampPosition({
              x: node.position.x + 5,
              y: node.position.y + 5,
            }),
            zoneId: node.zoneId,
            config: { ...node.config },
          }),
        );
      }

      return selectNodes(nextState, pastedIds);
    }, { trackHistory: true });
  }

  function handleLocateNode(nodeId: string) {
    setLocatedNodeRequest({ nodeId, requestId: Date.now() });
    setIsInspectorVisible(true);
    applyScenarioStateChange((currentState) => selectNode(currentState, nodeId));
  }

  function handleUndo() {
    const previousState = undoStackRef.current.at(-1);

    if (!previousState) {
      return;
    }

    redoStackRef.current = [scenarioStateRef.current, ...redoStackRef.current].slice(0, maxHistoryDepth);
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setHistoryVersion((version) => version + 1);
    setIsConnecting(false);
    setConnectionMessage(undefined);
    commitScenarioState(previousState);
  }

  function handleRedo() {
    const [nextState, ...remainingRedo] = redoStackRef.current;

    if (!nextState) {
      return;
    }

    undoStackRef.current = [...undoStackRef.current.slice(-(maxHistoryDepth - 1)), scenarioStateRef.current];
    redoStackRef.current = remainingRedo;
    setHistoryVersion((version) => version + 1);
    setIsConnecting(false);
    setConnectionMessage(undefined);
    commitScenarioState(nextState);
  }

  useEffect(() => {
    function handleHistoryShortcuts(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (target?.matches("input, select, textarea")) {
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (key === "c") {
        event.preventDefault();
        handleCopySelection();
        return;
      }

      if (key === "v") {
        event.preventDefault();
        handlePasteSelection();
        return;
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    }

    window.addEventListener("keydown", handleHistoryShortcuts);
    return () => window.removeEventListener("keydown", handleHistoryShortcuts);
  }, []);

  function canConnectToNode(nodeId: string) {
    const sourceNodeId = scenarioState.selection.nodeId;

    if (!isConnecting || (scenarioState.selection.nodeIds?.length ?? 0) > 1 || !sourceNodeId || sourceNodeId === nodeId) {
      return true;
    }

    const sourceNode = scenarioState.graph.nodes.find((node) => node.id === sourceNodeId);
    const targetNode = scenarioState.graph.nodes.find((node) => node.id === nodeId);

    return canServicesConnect(
      servicesById.get(sourceNode?.serviceId ?? ""),
      servicesById.get(targetNode?.serviceId ?? ""),
    ).allowed;
  }

  const selectedNodeIds = scenarioState.selection.nodeIds ?? (scenarioState.selection.nodeId ? [scenarioState.selection.nodeId] : []);
  const selectedSourceNode = selectedNodeIds.length === 1
    ? scenarioState.graph.nodes.find((node) => node.id === scenarioState.selection.nodeId)
    : undefined;
  const selectedSourceService = selectedSourceNode
    ? servicesById.get(selectedSourceNode.serviceId)
    : undefined;
  const connectableServiceNames = getConnectableServiceIds(selectedSourceService)
    .map((serviceId) => servicesById.get(serviceId)?.name)
    .filter((name): name is string => Boolean(name));
  const safeConnectionHint = connectionMessage
    ?? (isConnecting && selectedSourceService
      ? connectableServiceNames.length > 0
        ? `Connect ${selectedSourceService.name} to ${connectableServiceNames.join(", ")}.`
        : `Connect from ${selectedSourceService.name} to another supported AWS service.`
      : undefined);

  const selectedEdgeId = scenarioState.selection.edgeId;
  const selectedEdge = scenarioState.graph.edges.find((edge) => edge.id === selectedEdgeId);
  const inspectedService = servicesById.get(inspectedServiceId);

  function handleConnectionShortcut() {
    if (scenarioState.selection.nodeId) {
      handleToggleConnectMode();
    }
  }

  function handleOpenCheck(tab: Extract<AnalysisTab, "issues" | "configuration" | "security">, findingId: string) {
    setPaletteMode(tab);
    setFocusedCheck({ tab, findingId, requestId: Date.now() });
  }

  return (
    <main className={`app-shell ${sidebarExpanded ? "app-shell--sidebar-open" : "app-shell--sidebar-closed"}`}>
      <aside className={`sidebar ${sidebarExpanded ? "sidebar--expanded" : "sidebar--collapsed"}`}>
        <div className="sidebar__top">
          <button
            aria-expanded={sidebarExpanded}
            aria-label={sidebarExpanded ? "Collapse navigation" : "Expand navigation"}
            className="sidebar__toggle"
            onClick={() => setSidebarExpanded((currentValue) => !currentValue)}
            type="button"
          >
            {sidebarExpanded ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
          </button>
        </div>

        <div className="brand">
          <div className="brand__mark">
            <Cloud size={24} aria-hidden="true" />
          </div>
          <div className={`brand__copy ${sidebarExpanded ? "" : "brand__copy--hidden"}`}>
            <p className="eyebrow">Cloud Learning Platform</p>
            <h1>NimbusArc</h1>
          </div>
        </div>

        <nav className={`nav-stack ${sidebarExpanded ? "" : "nav-stack--hidden"}`} aria-label="Primary">
          <a className="nav-item nav-item--active" href="#scenario">
            <ShieldCheck size={18} aria-hidden="true" />
            Scenario
          </a>
          <a className="nav-item" href="#catalogue">
            <BookOpen size={18} aria-hidden="true" />
            Catalogue
          </a>
          <a className="nav-item" href="#services">
            <Boxes size={18} aria-hidden="true" />
            Services
          </a>
        </nav>

        <div className={`provider-card ${sidebarExpanded ? "" : "provider-card--hidden"}`}>
          <p className="eyebrow">Active Provider</p>
          <strong>{activeProvider?.name ?? "No provider"}</strong>
          <StatusPill label="AWS SAA enabled" tone="active" />
          <p>Azure and Google Cloud remain disabled until the AWS learning track is solid.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace__header">
          <div>
            <p className="eyebrow">Phase 0 Foundation</p>
            <h2>AWS SAA visual architecture trainer</h2>
          </div>
          <div className="header-metrics" aria-label="Project metrics">
            <span>{services.length} services</span>
            <span>{scenarios.length} scenario</span>
            <span>Provider-aware</span>
          </div>
        </header>

        <div className="learning-grid">
          <div className="left-rail">
            <CanvasPalette
              activeNodeCount={scenarioState.graph.nodes.length}
              graph={scenarioState.graph}
              highlightedFindingId={focusedCheck?.tab === paletteMode ? focusedCheck.findingId : undefined}
              highlightedFindingVersion={focusedCheck?.requestId}
              refreshKey={checkRefreshVersion}
              mode={paletteMode}
              onModeChange={setPaletteMode}
              onAddService={handleAddService}
              onInspectService={handleInspectService}
              onAddZone={handleAddZone}
              onReorderZoneLayer={handleReorderZoneLayer}
              onSelectZone={handleSelectZone}
              onDeleteSelectedZone={handleDeleteSelectedZone}
              onRefreshChecks={handleRefreshChecks}
              services={services}
              servicesById={servicesById}
              zones={scenarioState.graph.zones}
              selectedZoneId={scenarioState.selection.zoneId}
            />
          </div>
          <div className="canvas-column">
            <ArchitectureCanvasPreview
              architectureIssues={architectureValidation.issues}
              configurationIssues={configurationValidation.issues}
              securityFindings={securityAssessment.findings}
              canConnectNode={canConnectToNode}
              connectionHint={safeConnectionHint}
              graph={scenarioState.graph}
              onSaveArchitecture={handleSaveArchitecture}
              onExportArchitecture={handleExportArchitecture}
              onImportArchitecture={handleImportArchitecture}
              onApplyTemplate={handleApplyTemplate}
              onOpenCheck={handleOpenCheck}
              validationIssueCount={architectureValidation.issues.length + configurationValidation.issues.length + securityAssessment.findings.filter((finding) => finding.severity !== "pass").length}
              validationIssueNodeIds={[
                ...new Set([
                  ...architectureValidation.affectedNodeIds,
                  ...configurationValidation.affectedNodeIds,
                  ...securityAssessment.findings.map((finding) => finding.nodeId).filter(Boolean) as string[],
                ]),
              ]}
              validationIssueZoneIds={[
                ...new Set([
                  ...configurationValidation.affectedZoneIds,
                  ...architectureValidation.issues.map((issue) => issue.zoneId).filter(Boolean) as string[],
                ]),
              ]}
              onDragNode={handleDragNode}
              onDropPaletteItem={handleCanvasPaletteDrop}
              isConnecting={isConnecting}
              onConnectSelectedNode={handleConnectionShortcut}
              onClearSelection={handleClearSelection}
              onDeleteSelectedEdge={handleDeleteSelectedEdge}
              onDeleteSelectedNode={handleDeleteSelectedNodes}
              onDeleteSelectedZone={handleDeleteSelectedZone}
              onEdgeConnectStart={handleEdgeConnectStart}
              onMoveSelectedNode={handleMoveSelectedNode}
              onUpdateZoneLayout={handleUpdateZoneLayout}
              onResetGraph={handleResetGraph}
              onRedo={handleRedo}
              onRunSimulation={handleRunSimulation}
              onSelectEdge={handleSelectEdge}
              onSelectNode={handleSelectNode}
              onSelectNodes={handleSelectNodes}
              onToggleNodeSelection={handleToggleNodeSelection}
              onUndo={handleUndo}
              locatedNodeRequest={locatedNodeRequest}
              scenario={activeScenario}
              canRedo={canRedo}
              canUndo={canUndo}
              selectedEdgeId={selectedEdgeId}
              selectedNodeId={scenarioState.selection.nodeId}
              selectedNodeIds={selectedNodeIds}
              simulation={scenarioState.simulation}
              selectedZoneId={scenarioState.selection.zoneId}
              onSelectZone={handleSelectZone}
            />
            <CloudShellPanel
              graph={scenarioState.graph}
              servicesById={servicesById}
            />
          </div>
          <div className="right-rail">
            {isInspectorVisible ? (
              <ArchitectureInspector
                edge={selectedEdge}
                node={selectedSourceNode}
                onClose={() => setIsInspectorVisible(false)}
                onUpdateEdge={handleUpdateSelectedEdge}
                onUpdateNodeConfig={handleUpdateSelectedNodeConfig}
                onUpdateNodeLabel={handleUpdateSelectedNodeLabel}
                onUpdateZone={handleUpdateSelectedZone}
                service={selectedSourceService}
                servicesById={servicesById}
                zone={scenarioState.graph.zones.find((zone) => zone.id === scenarioState.selection.zoneId)}
              />
            ) : null}
            {isServiceDetailVisible ? (
              <ServiceDetailPanel
                onClose={() => setIsServiceDetailVisible(false)}
                service={inspectedService}
              />
            ) : null}
            <ResourceInventoryPanel
              onDeleteNode={handleDeleteNodeById}
              onLocateNode={handleLocateNode}
              onSelectNode={handleSelectNode}
              selectedNodeId={scenarioState.selection.nodeId}
              servicesById={servicesById}
              nodes={scenarioState.graph.nodes}
            />
            <ScenarioPlayerPreview scenario={activeScenario} />
            <FeedbackPreview scenario={activeScenario} />
            <CataloguePreview services={services.slice(0, 4)} />
          </div>
        </div>
      </section>
    </main>
  );
}
