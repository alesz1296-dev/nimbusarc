import type {
  ArchitectureEdge,
  ArchitectureEdgeKind,
  ArchitectureEdgeId,
  ArchitectureGraph,
  ArchitectureNode,
  ArchitectureNodeConfig,
  ArchitectureRouteTable,
  ArchitectureRouteTableId,
  ArchitectureNodeId,
  ArchitectureZone,
  ArchitectureZoneId,
  CanvasPoint,
  GraphSelection,
  LearnerScenarioState,
} from "./graph";
import { createIdleSimulation } from "./flowSimulation";

export type AddNodeInput = {
  id?: ArchitectureNodeId;
  serviceId: string;
  label: string;
  position: CanvasPoint;
  zoneId?: ArchitectureZoneId;
  config?: ArchitectureNodeConfig;
};

export type ConnectNodesInput = {
  id?: ArchitectureEdgeId;
  sourceNodeId: ArchitectureNodeId;
  targetNodeId: ArchitectureNodeId;
  kind?: ArchitectureEdgeKind;
  label?: string;
  direction?: "one-way" | "two-way";
};

export type AddZoneInput = {
  id?: ArchitectureZoneId;
  provider: ArchitectureGraph["provider"];
  kind: ArchitectureZone["kind"];
  label: string;
  layerOrder?: number;
  parentZoneId?: ArchitectureZoneId;
  description?: string;
  config?: ArchitectureZone["config"];
  layout?: ArchitectureZone["layout"];
};

export type AddRouteTableInput = {
  id?: ArchitectureRouteTableId;
  provider: ArchitectureGraph["provider"];
  label: string;
  vpcId?: ArchitectureZoneId;
  associatedSubnetIds: ArchitectureZoneId[];
  routes: ArchitectureRouteTable["routes"];
};

function createNodeId(graph: ArchitectureGraph): ArchitectureNodeId {
  return `node-${graph.nodes.length + 1}`;
}

function createEdgeId(graph: ArchitectureGraph): ArchitectureEdgeId {
  return `edge-${graph.edges.length + 1}`;
}

function createZoneId(graph: ArchitectureGraph, kind: ArchitectureZone["kind"]): ArchitectureZoneId {
  return `${kind}-${graph.zones.length + 1}`;
}

function createRouteTableId(graph: ArchitectureGraph): ArchitectureRouteTableId {
  return `route-table-${(graph.routeTables ?? []).length + 1}`;
}

function getNextZoneLayerOrder(graph: ArchitectureGraph) {
  return graph.zones.reduce((maxOrder, zone) => Math.max(maxOrder, zone.layerOrder ?? 0), 0) + 1;
}

function hasZone(graph: ArchitectureGraph, zoneId?: ArchitectureZoneId): boolean {
  if (!zoneId) {
    return true;
  }

  return graph.zones.some((zone) => zone.id === zoneId);
}

function hasNode(graph: ArchitectureGraph, nodeId: ArchitectureNodeId): boolean {
  return graph.nodes.some((node) => node.id === nodeId);
}

function uniqueNodeIds(nodeIds: ArchitectureNodeId[]) {
  return [...new Set(nodeIds)];
}

function markEditing(state: LearnerScenarioState) {
  return {
    ...state,
    status: "editing" as const,
  };
}

export function addNode(graph: ArchitectureGraph, input: AddNodeInput): ArchitectureGraph {
  if (input.id && hasNode(graph, input.id)) {
    return graph;
  }

  if (!hasZone(graph, input.zoneId)) {
    return graph;
  }

  const nextNode: ArchitectureNode = {
    id: input.id ?? createNodeId(graph),
    serviceId: input.serviceId,
    label: input.label,
    position: input.position,
    zoneId: input.zoneId,
    config: input.config ?? {},
  };

  return {
    ...graph,
    nodes: [...graph.nodes, nextNode],
  };
}

export function addZone(graph: ArchitectureGraph, input: AddZoneInput): ArchitectureGraph {
  if (input.id && graph.zones.some((zone) => zone.id === input.id)) {
    return graph;
  }

  if (!hasZone(graph, input.parentZoneId)) {
    return graph;
  }

  const nextZone: ArchitectureZone = {
    id: input.id ?? createZoneId(graph, input.kind),
    provider: input.provider,
    kind: input.kind,
    label: input.label,
    layerOrder: input.layerOrder ?? getNextZoneLayerOrder(graph),
    parentZoneId: input.parentZoneId,
    description: input.description,
    config: input.config,
    layout: input.layout,
  };

  return { ...graph, zones: [...graph.zones, nextZone] };
}

export function addRouteTable(graph: ArchitectureGraph, input: AddRouteTableInput): ArchitectureGraph {
  const routeTables = graph.routeTables ?? [];
  const nextId = input.id ?? createRouteTableId(graph);

  if (routeTables.some((routeTable) => routeTable.id === nextId)) {
    return graph;
  }

  const validSubnetIds = input.associatedSubnetIds.filter((subnetId) => hasZone(graph, subnetId));

  if (validSubnetIds.length !== input.associatedSubnetIds.length || (input.vpcId && !hasZone(graph, input.vpcId))) {
    return graph;
  }

  const nextRouteTable: ArchitectureRouteTable = {
    id: nextId,
    provider: input.provider,
    label: input.label,
    vpcId: input.vpcId,
    associatedSubnetIds: validSubnetIds,
    routes: input.routes,
  };

  return {
    ...graph,
    routeTables: [...routeTables, nextRouteTable],
  };
}

export function updateRouteTable(
  graph: ArchitectureGraph,
  routeTableId: ArchitectureRouteTableId,
  changes: Partial<Pick<ArchitectureRouteTable, "label" | "vpcId" | "associatedSubnetIds" | "routes">>,
): ArchitectureGraph {
  const routeTables = graph.routeTables ?? [];

  if (changes.vpcId && !hasZone(graph, changes.vpcId)) {
    return graph;
  }

  if (changes.associatedSubnetIds?.some((subnetId) => !hasZone(graph, subnetId))) {
    return graph;
  }

  return {
    ...graph,
    routeTables: routeTables.map((routeTable) =>
      routeTable.id === routeTableId ? { ...routeTable, ...changes } : routeTable,
    ),
  };
}

export function updateZone(
  graph: ArchitectureGraph,
  zoneId: ArchitectureZoneId,
  changes: Partial<Pick<ArchitectureZone, "label" | "description" | "parentZoneId" | "config" | "layout" | "layerOrder">>,
): ArchitectureGraph {
  if (changes.parentZoneId === zoneId || (changes.parentZoneId && !hasZone(graph, changes.parentZoneId))) {
    return graph;
  }

  return {
    ...graph,
    zones: graph.zones.map((zone) => zone.id === zoneId ? { ...zone, ...changes } : zone),
  };
}

export function reorderZoneLayer(
  graph: ArchitectureGraph,
  zoneId: ArchitectureZoneId,
  direction: "up" | "down",
): ArchitectureGraph {
  const orderedZones = [...graph.zones].sort((left, right) => (left.layerOrder ?? 0) - (right.layerOrder ?? 0));
  const zoneIndex = orderedZones.findIndex((zone) => zone.id === zoneId);

  if (zoneIndex < 0) {
    return graph;
  }

  const swapIndex = direction === "up" ? zoneIndex + 1 : zoneIndex - 1;

  if (swapIndex < 0 || swapIndex >= orderedZones.length) {
    return graph;
  }

  const currentZone = orderedZones[zoneIndex];
  const swapZone = orderedZones[swapIndex];
  const currentOrder = currentZone.layerOrder ?? zoneIndex + 1;
  const swapOrder = swapZone.layerOrder ?? swapIndex + 1;

  return {
    ...graph,
    zones: graph.zones.map((zone) => {
      if (zone.id === currentZone.id) {
        return { ...zone, layerOrder: swapOrder };
      }

      if (zone.id === swapZone.id) {
        return { ...zone, layerOrder: currentOrder };
      }

      return zone;
    }),
  };
}

export function removeZone(graph: ArchitectureGraph, zoneId: ArchitectureZoneId): ArchitectureGraph {
  const ids = new Set<string>([zoneId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const zone of graph.zones) {
      if (zone.parentZoneId && ids.has(zone.parentZoneId) && !ids.has(zone.id)) {
        ids.add(zone.id);
        changed = true;
      }
    }
  }

  return {
    ...graph,
    zones: graph.zones.filter((zone) => !ids.has(zone.id)),
    routeTables: (graph.routeTables ?? [])
      .map((routeTable) => ({
        ...routeTable,
        associatedSubnetIds: routeTable.associatedSubnetIds.filter((subnetId) => !ids.has(subnetId)),
      }))
      .filter((routeTable) => !routeTable.vpcId || !ids.has(routeTable.vpcId))
      .filter((routeTable) => routeTable.associatedSubnetIds.length > 0),
    nodes: graph.nodes.map((node) => ids.has(node.zoneId ?? "") ? { ...node, zoneId: undefined } : node),
  };
}

export function moveNode(
  graph: ArchitectureGraph,
  nodeId: ArchitectureNodeId,
  position: CanvasPoint,
): ArchitectureGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === nodeId ? { ...node, position } : node,
    ),
  };
}

export function assignNodeToZone(
  graph: ArchitectureGraph,
  nodeId: ArchitectureNodeId,
  zoneId?: ArchitectureZoneId,
): ArchitectureGraph {
  if (!hasZone(graph, zoneId)) {
    return graph;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === nodeId ? { ...node, zoneId } : node,
    ),
  };
}

export function updateNodeConfig(
  graph: ArchitectureGraph,
  nodeId: ArchitectureNodeId,
  config: Partial<ArchitectureNodeConfig>,
): ArchitectureGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === nodeId ? { ...node, config: { ...node.config, ...config } } : node,
    ),
  };
}

export function updateNodeLabel(
  graph: ArchitectureGraph,
  nodeId: ArchitectureNodeId,
  label: string,
): ArchitectureGraph {
  const nextLabel = label.trim();

  if (!nextLabel) {
    return graph;
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === nodeId ? { ...node, label: nextLabel } : node,
    ),
  };
}

export function connectNodes(
  graph: ArchitectureGraph,
  input: ConnectNodesInput,
): ArchitectureGraph {
  if (input.sourceNodeId === input.targetNodeId) {
    return graph;
  }

  if (!hasNode(graph, input.sourceNodeId) || !hasNode(graph, input.targetNodeId)) {
    return graph;
  }

  const nextEdge: ArchitectureEdge = {
    id: input.id ?? createEdgeId(graph),
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    kind: input.kind ?? "request",
    label: input.label,
    direction: input.direction ?? "one-way",
  };

  return {
    ...graph,
    edges: [...graph.edges, nextEdge],
  };
}

export function removeNode(graph: ArchitectureGraph, nodeId: ArchitectureNodeId): ArchitectureGraph {
  return {
    ...graph,
    nodes: graph.nodes.filter((node) => node.id !== nodeId),
    edges: graph.edges.filter(
      (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
    ),
  };
}

export function removeNodes(
  graph: ArchitectureGraph,
  nodeIds: ArchitectureNodeId[],
): ArchitectureGraph {
  const nodeIdSet = new Set(nodeIds);

  return {
    ...graph,
    nodes: graph.nodes.filter((node) => !nodeIdSet.has(node.id)),
    edges: graph.edges.filter(
      (edge) => !nodeIdSet.has(edge.sourceNodeId) && !nodeIdSet.has(edge.targetNodeId),
    ),
  };
}

export function removeEdge(graph: ArchitectureGraph, edgeId: ArchitectureEdgeId): ArchitectureGraph {
  return {
    ...graph,
    edges: graph.edges.filter((edge) => edge.id !== edgeId),
  };
}

export function updateEdge(
  graph: ArchitectureGraph,
  edgeId: ArchitectureEdgeId,
  changes: Partial<Pick<ArchitectureEdge, "kind" | "label" | "direction" | "controls">>,
): ArchitectureGraph {
  return {
    ...graph,
    edges: graph.edges.map((edge) =>
      edge.id === edgeId ? { ...edge, ...changes } : edge,
    ),
  };
}

export function resetGraph(graph: ArchitectureGraph): ArchitectureGraph {
  return {
    ...graph,
    nodes: [],
    edges: [],
  };
}

export function clearSelection(): GraphSelection {
  return {};
}

export function selectNode(state: LearnerScenarioState, nodeId?: ArchitectureNodeId): LearnerScenarioState {
  return {
    ...state,
    selection: nodeId ? { nodeId, nodeIds: [nodeId] } : {},
  };
}

export function selectNodes(
  state: LearnerScenarioState,
  nodeIds: ArchitectureNodeId[],
): LearnerScenarioState {
  const nextNodeIds = uniqueNodeIds(nodeIds);

  return {
    ...state,
    selection:
      nextNodeIds.length > 0
        ? {
            nodeId: nextNodeIds[0],
            nodeIds: nextNodeIds,
          }
        : {},
  };
}

export function toggleNodeSelection(
  state: LearnerScenarioState,
  nodeId: ArchitectureNodeId,
): LearnerScenarioState {
  const selectedNodeIds = new Set(state.selection.nodeIds ?? (state.selection.nodeId ? [state.selection.nodeId] : []));

  if (selectedNodeIds.has(nodeId)) {
    selectedNodeIds.delete(nodeId);
  } else {
    selectedNodeIds.add(nodeId);
  }

  return selectNodes(state, [...selectedNodeIds]);
}

export function selectEdge(state: LearnerScenarioState, edgeId?: ArchitectureEdgeId): LearnerScenarioState {
  return {
    ...state,
    selection: edgeId ? { edgeId } : {},
  };
}

export function selectZone(state: LearnerScenarioState, zoneId?: ArchitectureZoneId): LearnerScenarioState {
  return {
    ...state,
    selection: zoneId ? { zoneId } : {},
  };
}

export function selectRouteTable(state: LearnerScenarioState, routeTableId?: ArchitectureRouteTableId): LearnerScenarioState {
  return {
    ...state,
    selection: routeTableId ? { routeTableId } : {},
  };
}

export function clearScenarioSelection(state: LearnerScenarioState): LearnerScenarioState {
  return {
    ...state,
    selection: clearSelection(),
  };
}

export function updateScenarioGraph(
  state: LearnerScenarioState,
  updater: (graph: ArchitectureGraph) => ArchitectureGraph,
): LearnerScenarioState {
  const nextGraph = updater(state.graph);

  if (nextGraph === state.graph) {
    return state;
  }

  return markEditing({
    ...state,
    graph: nextGraph,
    simulation: createIdleSimulation(),
  });
}

export function resetScenarioGraph(state: LearnerScenarioState): LearnerScenarioState {
  return {
    ...state,
    graph: resetGraph(state.graph),
    selection: clearSelection(),
    status: "idle",
    simulation: createIdleSimulation(),
  };
}
