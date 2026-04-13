/**
 * Mobjects used to represent mathematical graphs (think graph theory, not plotting).
 *
 * TypeScript port of manim/mobject/graph.py
 */

import GraphologyGraph from "graphology";

import type { NDArray } from "numpy-ts";

import { np } from "../../core/math/index.js";
import type { Point3D } from "../../core/math/index.js";
import { ORIGIN, UP, DOWN, LEFT, RIGHT } from "../../core/math/index.js";
import {
  ManimColor,
  type ParsableManimColor,
} from "../../utils/color/core.js";
import { BLACK, WHITE } from "../../utils/color/manim_colors.js";
import { Mobject, Group, overrideAnimate } from "../mobject/index.js";
import type { IScene } from "../../core/types.js";

// ─── Dependency stubs ────────────────────────────────────────
// These classes are not yet converted. We define minimal local stubs
// so this module compiles. Replace with real imports once the
// respective modules land.

// TODO: Replace with import from ../types/vectorized_mobject/index.js once converted
class VMobject extends Mobject {
  fillColor: ManimColor;
  fillOpacity: number;
  strokeColor: ManimColor;
  strokeOpacity: number;
  declare strokeWidth: number;

  constructor(options: VMobjectStubOptions = {}) {
    super({
      color: options.color ?? undefined,
      name: options.name,
    });
    this.fillColor = options.fillColor
      ? (ManimColor.parse(options.fillColor) as ManimColor)
      : (ManimColor.parse("#FFFFFF") as ManimColor);
    this.fillOpacity = options.fillOpacity ?? 0.0;
    this.strokeColor = options.strokeColor
      ? (ManimColor.parse(options.strokeColor) as ManimColor)
      : (ManimColor.parse("#FFFFFF") as ManimColor);
    this.strokeOpacity = options.strokeOpacity ?? 1.0;
    this.strokeWidth = options.strokeWidth ?? 4;
  }
}

interface VMobjectStubOptions {
  color?: ParsableManimColor;
  name?: string;
  fillColor?: ParsableManimColor;
  fillOpacity?: number;
  strokeColor?: ParsableManimColor;
  strokeOpacity?: number;
  strokeWidth?: number;
}

// TODO: Replace with import from ../geometry/arc.js once converted
class Dot extends VMobject {
  constructor(options: Record<string, unknown> = {}) {
    const { point, ...rest } = options;
    super(rest as VMobjectStubOptions);
    if (point) {
      this.moveTo(point as Point3D);
    }
  }
}

// TODO: Replace with import from ../geometry/arc.js once converted
class LabeledDot extends Dot {
  constructor(options: Record<string, unknown> = {}) {
    const { label, ...rest } = options;
    super(rest);
  }
}

// TODO: Replace with import from ../geometry/line.js once converted
class Line extends Mobject {
  constructor(options: Record<string, unknown> = {}) {
    const { start, end, z_index, zIndex, ...rest } = options;
    super({
      ...(rest as Record<string, unknown>),
      zIndex: (zIndex ?? z_index ?? 0) as number,
    });
  }

  setPointsByEnds(
    _start: Point3D | Mobject,
    _end: Point3D | Mobject,
    _options?: { buff?: number; pathArc?: number },
  ): this {
    return this;
  }

  addTip(_tipConfig?: Record<string, unknown>): this {
    return this;
  }

  popTips(): Mobject[] {
    return [];
  }
}

// TODO: Replace with import from ../text/tex_mobject.js once converted
class MathTex extends Mobject {
  constructor(texString: string | number, options: Record<string, unknown> = {}) {
    super({
      name: String(texString),
      ...options,
    });
  }
}

// TODO: Replace with import from ../animation/composition once converted
class AnimationGroup {
  constructor(..._args: unknown[]) {}
}

// TODO: Replace with import from ../animation/creation once converted
class Create {
  constructor(_mob: Mobject, _options?: Record<string, unknown>) {}
}

class Uncreate {
  constructor(_mob: Mobject, _options?: Record<string, unknown>) {}
}

// ─── Types ───────────────────────────────────────────────────

type Hashable = string | number;
type EdgeTuple = [Hashable, Hashable];

/** Callable layout function type */
type LayoutFunction = (
  graph: GraphologyGraph,
  scale: number | [number, number, number],
  ...args: unknown[]
) => Map<Hashable, Point3D>;

type LayoutName =
  | "circular"
  | "kamada_kawai"
  | "partite"
  | "planar"
  | "random"
  | "shell"
  | "spectral"
  | "spiral"
  | "spring"
  | "tree";

// ─── Layout key helpers ─────────────────────────────────────

function edgeKey(u: Hashable, v: Hashable): string {
  return `${u}:::${v}`;
}

function parseEdgeKey(key: string): EdgeTuple {
  const parts = key.split(":::");
  return [parts[0], parts[1]];
}

// ─── Layout implementations ─────────────────────────────────

function circularLayout(
  graph: GraphologyGraph,
  scale: number | [number, number, number] = 2,
): Map<Hashable, Point3D> {
  const s = typeof scale === "number" ? scale : scale[0];
  const nodes = graph.nodes();
  const n = nodes.length;
  const result = new Map<Hashable, Point3D>();
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    result.set(
      nodes[i],
      np.array([s * Math.cos(angle), s * Math.sin(angle), 0]),
    );
  }
  return result;
}

function randomLayout(
  graph: GraphologyGraph,
  scale: number | [number, number, number] = 2,
): Map<Hashable, Point3D> {
  const s = typeof scale === "number" ? scale : scale[0];
  const result = new Map<Hashable, Point3D>();
  for (const node of graph.nodes()) {
    result.set(
      node,
      np.array([
        2 * s * (Math.random() - 0.5),
        2 * s * (Math.random() - 0.5),
        0,
      ]),
    );
  }
  return result;
}

function shellLayout(
  graph: GraphologyGraph,
  scale: number | [number, number, number] = 2,
  nlist?: Hashable[][],
): Map<Hashable, Point3D> {
  const s = typeof scale === "number" ? scale : scale[0];
  const result = new Map<Hashable, Point3D>();

  if (!nlist || nlist.length === 0) {
    nlist = [graph.nodes()];
  }

  const nShells = nlist.length;
  for (let shellIdx = 0; shellIdx < nShells; shellIdx++) {
    const shell = nlist[shellIdx];
    const radius = s * ((shellIdx + 1) / nShells);
    const n = shell.length;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / Math.max(n, 1);
      result.set(
        shell[i],
        np.array([radius * Math.cos(angle), radius * Math.sin(angle), 0]),
      );
    }
  }
  return result;
}

function spiralLayout(
  graph: GraphologyGraph,
  scale: number | [number, number, number] = 2,
): Map<Hashable, Point3D> {
  const s = typeof scale === "number" ? scale : scale[0];
  const nodes = graph.nodes();
  const n = nodes.length;
  const result = new Map<Hashable, Point3D>();

  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const angle = 4 * Math.PI * t;
    const radius = s * t;
    result.set(
      nodes[i],
      np.array([radius * Math.cos(angle), radius * Math.sin(angle), 0]),
    );
  }
  return result;
}

function springLayout(
  graph: GraphologyGraph,
  scale: number | [number, number, number] = 2,
  iterations = 50,
  k?: number,
  seed?: number,
): Map<Hashable, Point3D> {
  const s = typeof scale === "number" ? scale : scale[0];
  const nodes = graph.nodes();
  const n = nodes.length;
  if (n === 0) return new Map();
  if (n === 1) {
    const result = new Map<Hashable, Point3D>();
    result.set(nodes[0], np.array([0, 0, 0]));
    return result;
  }

  const optimalDist = k ?? s / Math.sqrt(n);

  // Initialize positions randomly
  const rng = seed !== undefined ? mulberry32(seed) : Math.random;
  const pos: number[][] = nodes.map(() => [
    2 * s * (rng() - 0.5),
    2 * s * (rng() - 0.5),
  ]);

  // Build adjacency for quick lookup
  const nodeIndex = new Map<Hashable, number>();
  nodes.forEach((nd, i) => nodeIndex.set(nd, i));

  // Fruchterman-Reingold
  for (let iter = 0; iter < iterations; iter++) {
    const temperature = s * (1 - iter / iterations);
    const disp: number[][] = nodes.map(() => [0, 0]);

    // Repulsive forces
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const force = (optimalDist * optimalDist) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        disp[i][0] += fx;
        disp[i][1] += fy;
        disp[j][0] -= fx;
        disp[j][1] -= fy;
      }
    }

    // Attractive forces
    graph.forEachEdge((_edge, _attrs, source, target) => {
      const i = nodeIndex.get(source)!;
      const j = nodeIndex.get(target)!;
      const dx = pos[i][0] - pos[j][0];
      const dy = pos[i][1] - pos[j][1];
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const force = (dist * dist) / optimalDist;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      disp[i][0] -= fx;
      disp[i][1] -= fy;
      disp[j][0] += fx;
      disp[j][1] += fy;
    });

    // Apply displacement with temperature limiting
    for (let i = 0; i < n; i++) {
      const dispLen =
        Math.sqrt(disp[i][0] * disp[i][0] + disp[i][1] * disp[i][1]) || 0.001;
      const scale = Math.min(dispLen, temperature) / dispLen;
      pos[i][0] += disp[i][0] * scale;
      pos[i][1] += disp[i][1] * scale;
    }
  }

  // Rescale to fit in [-scale, scale]
  let xMin = Infinity,
    xMax = -Infinity,
    yMin = Infinity,
    yMax = -Infinity;
  for (const p of pos) {
    xMin = Math.min(xMin, p[0]);
    xMax = Math.max(xMax, p[0]);
    yMin = Math.min(yMin, p[1]);
    yMax = Math.max(yMax, p[1]);
  }
  const w = xMax - xMin || 1;
  const h = yMax - yMin || 1;
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  const sf = (2 * s) / Math.max(w, h);

  const result = new Map<Hashable, Point3D>();
  for (let i = 0; i < n; i++) {
    result.set(
      nodes[i],
      np.array([(pos[i][0] - cx) * sf, (pos[i][1] - cy) * sf, 0]),
    );
  }
  return result;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kamadaKawaiLayout(
  graph: GraphologyGraph,
  scale: number | [number, number, number] = 2,
  dist?: Map<Hashable, Map<Hashable, number>>,
): Map<Hashable, Point3D> {
  // Simplified: fall back to spring layout with distance hints
  // A full KK implementation would use shortest-path distances
  return springLayout(graph, scale, 100);
}

function partiteLayout(
  graph: GraphologyGraph,
  scale: number | [number, number, number] = 2,
  partitions?: Hashable[][],
): Map<Hashable, Point3D> {
  if (!partitions || partitions.length === 0) {
    throw new Error(
      "The partite layout requires partitions parameter to contain the partition of the vertices",
    );
  }

  const s = typeof scale === "number" ? scale : scale[0];
  const result = new Map<Hashable, Point3D>();
  const partitionCount = partitions.length;

  // Collect unpartitioned nodes
  const assigned = new Set<Hashable>();
  for (const part of partitions) {
    for (const v of part) {
      assigned.add(v);
    }
  }
  const unassigned = graph.nodes().filter((n) => !assigned.has(n));
  const allPartitions = [...partitions];
  if (unassigned.length > 0) {
    allPartitions.push(unassigned);
  }

  const totalPartitions = allPartitions.length;
  for (let pi = 0; pi < totalPartitions; pi++) {
    const partition = allPartitions[pi];
    const x = totalPartitions > 1
      ? s * (2 * pi / (totalPartitions - 1) - 1)
      : 0;
    const n = partition.length;
    for (let i = 0; i < n; i++) {
      const y = n > 1 ? s * (2 * i / (n - 1) - 1) : 0;
      result.set(partition[i], np.array([x, y, 0]));
    }
  }
  return result;
}

function spectralLayout(
  graph: GraphologyGraph,
  scale: number | [number, number, number] = 2,
): Map<Hashable, Point3D> {
  // Simplified spectral: fall back to circular for now
  // A full implementation needs eigendecomposition of the Laplacian
  return circularLayout(graph, scale);
}

function planarLayout(
  graph: GraphologyGraph,
  scale: number | [number, number, number] = 2,
): Map<Hashable, Point3D> {
  // Simplified: fall back to spring layout
  // A full implementation needs planarity testing + Tutte embedding
  return springLayout(graph, scale, 100);
}

function treeLayout(
  graph: GraphologyGraph,
  scale: number | [number, number, number] | null = 2,
  rootVertex?: Hashable,
  vertexSpacing?: [number, number],
  orientation: "down" | "up" = "down",
): Map<Hashable, Point3D> {
  if (rootVertex === undefined || rootVertex === null) {
    throw new Error("The tree layout requires the root_vertex parameter");
  }

  // Check if tree (connected acyclic) - simplified check
  const nodes = graph.nodes();
  const edgeCount = graph.size;
  if (edgeCount !== nodes.length - 1) {
    throw new Error("The tree layout must be used with trees");
  }

  const children = new Map<Hashable, Hashable[]>();
  children.set(rootVertex, graph.neighbors(rootVertex));

  const stack: Hashable[][] = [[...children.get(rootVertex)!]];
  const stick: Hashable[] = [rootVertex];
  const parent = new Map<Hashable, Hashable>();
  for (const c of children.get(rootVertex)!) {
    parent.set(c, rootVertex);
  }
  const pos = new Map<Hashable, [number, number]>();
  const obstruction: number[] = new Array(nodes.length).fill(0);
  const o = orientation === "down" ? -1 : 1;

  function slide(v: Hashable, dx: number): void {
    let level: Hashable[] = [v];
    while (level.length > 0) {
      const nextLevel: Hashable[] = [];
      for (const u of level) {
        const [x, y] = pos.get(u)!;
        const newX = x + dx;
        const yIdx = Math.abs(y);
        obstruction[yIdx] = Math.max(newX + 1, obstruction[yIdx]);
        pos.set(u, [newX, y]);
        const ch = children.get(u) ?? [];
        nextLevel.push(...ch);
      }
      level = nextLevel;
    }
  }

  while (stack.length > 0) {
    const C = stack[stack.length - 1];
    if (C.length === 0) {
      const p = stick.pop()!;
      stack.pop();
      const cp = children.get(p) ?? [];
      const y = o * stack.length;
      const yIdx = Math.abs(y);

      if (cp.length === 0) {
        const x = obstruction[yIdx];
        pos.set(p, [x, y]);
      } else {
        let x = 0;
        for (const c of cp) {
          x += pos.get(c)![0];
        }
        x /= cp.length;
        pos.set(p, [x, y]);
        const ox = obstruction[yIdx];
        if (x < ox) {
          slide(p, ox - x);
          x = ox;
        }
      }
      obstruction[yIdx] = (pos.get(p)?.[0] ?? 0) + 1;
      continue;
    }

    const t = C.pop()!;
    const pt = parent.get(t)!;
    const ct = graph.neighbors(t).filter((u) => u !== String(pt) && u !== pt);
    for (const c of ct) {
      parent.set(c, t);
    }
    children.set(t, [...ct]);
    stack.push([...ct]);
    stick.push(t);
  }

  // Rescale
  const positions = Array.from(pos.values());
  if (positions.length === 0) {
    return new Map();
  }

  let xMin = Infinity,
    xMax = -Infinity,
    yMin = Infinity,
    yMax = -Infinity;
  for (const [x, y] of positions) {
    xMin = Math.min(xMin, x);
    xMax = Math.max(xMax, x);
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
  }

  const center = [(xMin + xMax) / 2, (yMin + yMax) / 2];
  const height = yMax - yMin;
  const width = xMax - xMin;

  let sf: number | [number, number, number];
  if (vertexSpacing !== undefined) {
    sf = [vertexSpacing[0], vertexSpacing[1], 0];
  } else if (scale === null) {
    sf = [1, 1, 0];
  } else if (typeof scale === "number") {
    if (width > 0 || height > 0) {
      const uniformSf = (2 * scale) / Math.max(width, height);
      sf = [uniformSf, uniformSf, 0];
    } else {
      sf = [1, 1, 0];
    }
  } else {
    const sw =
      scale[0] !== null && width > 0 ? (2 * scale[0]) / width : 1;
    const sh =
      scale[1] !== null && height > 0 ? (2 * scale[1]) / height : 1;
    sf = [sw, sh, 0];
  }

  const result = new Map<Hashable, Point3D>();
  for (const [v, [x, y]] of pos.entries()) {
    const sfArr = typeof sf === "number" ? [sf, sf, 0] : sf;
    result.set(
      v,
      np.array([
        (x - center[0]) * sfArr[0],
        (y - center[1]) * sfArr[1],
        0,
      ]),
    );
  }
  return result;
}

// ─── Layout registry ────────────────────────────────────────

const _layouts: Record<LayoutName, LayoutFunction> = {
  circular: circularLayout as LayoutFunction,
  kamada_kawai: kamadaKawaiLayout as LayoutFunction,
  partite: partiteLayout as LayoutFunction,
  planar: planarLayout as LayoutFunction,
  random: randomLayout as LayoutFunction,
  shell: shellLayout as LayoutFunction,
  spectral: spectralLayout as LayoutFunction,
  spiral: spiralLayout as LayoutFunction,
  spring: springLayout as LayoutFunction,
  tree: treeLayout as LayoutFunction,
};

// ─── Layout determination ───────────────────────────────────

function determineGraphLayout(
  graph: GraphologyGraph,
  layout: LayoutName | Map<Hashable, Point3D> | LayoutFunction = "spring",
  layoutScale: number | [number, number, number] = 2,
  layoutConfig: Record<string, unknown> = {},
): Map<Hashable, Point3D> {
  if (layout instanceof Map) {
    return layout;
  }

  if (typeof layout === "string" && layout in _layouts) {
    const layoutFn = _layouts[layout as LayoutName];
    return layoutFn(graph, layoutScale, ...Object.values(layoutConfig));
  }

  if (typeof layout === "function") {
    return (layout as LayoutFunction)(
      graph,
      layoutScale,
      ...Object.values(layoutConfig),
    );
  }

  throw new Error(
    `The layout '${String(layout)}' is neither a recognized layout, a layout function, nor a vertex placement dictionary.`,
  );
}

// ─── GenericGraph options ───────────────────────────────────

export interface GenericGraphOptions {
  labels?: boolean | Map<Hashable, Mobject>;
  labelFillColor?: ParsableManimColor;
  layout?: LayoutName | Map<Hashable, Point3D> | LayoutFunction;
  layoutScale?: number | [number, number, number];
  layoutConfig?: Record<string, unknown>;
  vertexType?: new (options: Record<string, unknown>) => Mobject;
  vertexConfig?: Record<string, unknown>;
  vertexMobjects?: Map<Hashable, Mobject>;
  edgeType?: new (options: Record<string, unknown>) => Mobject;
  partitions?: Hashable[][];
  rootVertex?: Hashable;
  edgeConfig?: Record<string, unknown>;
}

// ─── GenericGraph ───────────────────────────────────────────

export class GenericGraph extends VMobject {
  _graph: GraphologyGraph;
  _labels: Map<Hashable, Mobject>;
  _layout: Map<Hashable, Point3D>;
  _vertexConfig: Map<Hashable, Record<string, unknown>>;
  _edgeConfig: Map<string, Record<string, unknown>>;
  _tipConfig: Map<string, Record<string, unknown>>;
  defaultVertexConfig: Record<string, unknown>;
  defaultEdgeConfig: Record<string, unknown>;
  vertices: Map<Hashable, Mobject>;
  edges: Map<string, Mobject>;

  constructor(
    vertexList: Hashable[],
    edgeList: EdgeTuple[],
    options: GenericGraphOptions = {},
  ) {
    super();

    const {
      labels = false,
      labelFillColor = BLACK,
      layout = "spring",
      layoutScale = 2,
      layoutConfig,
      vertexType: vertexTypeProp = Dot,
      vertexConfig: vertexConfigProp,
      vertexMobjects: vertexMobjectsProp,
      edgeType = Line,
      partitions,
      rootVertex,
      edgeConfig: edgeConfigProp,
    } = options;

    let vertexType = vertexTypeProp;

    // Build internal graphology graph
    const nxGraph = this._emptyGraphologyGraph();
    for (const v of vertexList) {
      nxGraph.addNode(String(v));
    }
    for (const [u, v] of edgeList) {
      if (!nxGraph.hasEdge(String(u), String(v))) {
        nxGraph.addEdge(String(u), String(v));
      }
    }
    this._graph = nxGraph;

    // Handle labels
    if (labels instanceof Map) {
      this._labels = new Map(labels);
    } else if (labels === true) {
      this._labels = new Map<Hashable, Mobject>();
      for (const v of vertexList) {
        this._labels.set(
          v,
          new MathTex(v, { color: labelFillColor }),
        );
      }
    } else {
      this._labels = new Map();
    }

    if (this._labels.size > 0 && vertexType === Dot) {
      vertexType = LabeledDot as unknown as typeof Dot;
    }

    const vertexMobjects = vertexMobjectsProp ?? new Map<Hashable, Mobject>();

    // Build vertex config
    let vertexConfig = vertexConfigProp ?? {};
    let defaultVertexConfig: Record<string, unknown> = {};
    if (Object.keys(vertexConfig).length > 0) {
      defaultVertexConfig = {};
      for (const [k, v] of Object.entries(vertexConfig)) {
        if (!vertexList.includes(k as Hashable) && !vertexList.includes(Number(k))) {
          defaultVertexConfig[k] = v;
        }
      }
    }
    this.defaultVertexConfig = defaultVertexConfig;

    this._vertexConfig = new Map();
    for (const v of vertexList) {
      const specific =
        (vertexConfig as Record<string, unknown>)[String(v)] ??
        { ...defaultVertexConfig };
      this._vertexConfig.set(
        v,
        typeof specific === "object" && specific !== null
          ? { ...(specific as Record<string, unknown>) }
          : { ...defaultVertexConfig },
      );
    }

    for (const [v, label] of this._labels.entries()) {
      const cfg = this._vertexConfig.get(v) ?? {};
      cfg["label"] = label;
      this._vertexConfig.set(v, cfg);
    }

    // Create vertex mobjects
    this.vertices = new Map<Hashable, Mobject>();
    for (const v of vertexList) {
      if (vertexMobjects.has(v)) {
        this.vertices.set(v, vertexMobjects.get(v)!);
      } else {
        const cfg = this._vertexConfig.get(v) ?? {};
        this.vertices.set(v, new vertexType(cfg));
      }
    }

    // Apply layout
    this._layout = new Map();
    this.changeLayout({
      layout,
      layoutScale,
      layoutConfig,
      partitions,
      rootVertex,
    });

    // Build edge config
    let edgeConfig = edgeConfigProp ?? {};
    let defaultTipConfig: Record<string, unknown> = {};
    let defaultEdgeConfig: Record<string, unknown> = {};
    if (Object.keys(edgeConfig).length > 0) {
      defaultTipConfig = (edgeConfig as Record<string, unknown>)["tip_config"] as Record<string, unknown> ?? {};
      delete (edgeConfig as Record<string, unknown>)["tip_config"];
      defaultEdgeConfig = {};
      for (const [k, v] of Object.entries(edgeConfig)) {
        // Non-tuple keys are global config
        if (!k.includes(",")) {
          defaultEdgeConfig[k] = v;
        }
      }
    }
    this.defaultEdgeConfig = defaultEdgeConfig;

    this._edgeConfig = new Map();
    this._tipConfig = new Map();
    for (const [u, v] of edgeList) {
      const ek = edgeKey(u, v);
      const edgeSpecific = (edgeConfig as Record<string, unknown>)[`${u},${v}`];
      if (edgeSpecific && typeof edgeSpecific === "object") {
        const cfg = { ...(edgeSpecific as Record<string, unknown>) };
        this._tipConfig.set(
          ek,
          (cfg["tip_config"] as Record<string, unknown>) ?? { ...defaultTipConfig },
        );
        delete cfg["tip_config"];
        this._edgeConfig.set(ek, cfg);
      } else {
        this._tipConfig.set(ek, { ...defaultTipConfig });
        this._edgeConfig.set(ek, { ...defaultEdgeConfig });
      }
    }

    // Create edges - implemented by subclasses
    this.edges = new Map();
    this._populateEdgeDict(edgeList, edgeType);

    // Add all vertex and edge mobjects as submobjects
    for (const mob of this.vertices.values()) {
      this.add(mob);
    }
    for (const mob of this.edges.values()) {
      this.add(mob);
    }

    // Add updater to keep edges connected to vertices
    this.addUpdater((_mob: Mobject) => this.updateEdges(this));
  }

  protected _emptyGraphologyGraph(): GraphologyGraph {
    throw new Error("To be implemented in concrete subclasses");
  }

  protected _populateEdgeDict(
    _edges: EdgeTuple[],
    _edgeType: new (options: Record<string, unknown>) => Mobject,
  ): void {
    throw new Error("To be implemented in concrete subclasses");
  }

  getVertex(v: Hashable): Mobject {
    const mob = this.vertices.get(v);
    if (!mob) {
      throw new Error(`No vertex with identifier '${v}'`);
    }
    return mob;
  }

  private _createVertex(
    vertex: Hashable,
    position?: Point3D,
    label: boolean | Mobject = false,
    labelFillColor: ParsableManimColor = BLACK,
    vertexType: new (options: Record<string, unknown>) => Mobject = Dot,
    vertexConfig?: Record<string, unknown>,
    vertexMobject?: Mobject,
  ): [Hashable, Point3D, Record<string, unknown>, Mobject] {
    const npPosition: Point3D = position ?? this.getCenter();

    if (vertexConfig === undefined) {
      vertexConfig = {};
    }

    if (this.vertices.has(vertex)) {
      throw new Error(
        `Vertex identifier '${vertex}' is already used for a vertex in this graph.`,
      );
    }

    let resolvedLabel: Mobject | null = null;
    if (label === true) {
      resolvedLabel = new MathTex(vertex, { color: labelFillColor });
    } else if (this._labels.has(vertex)) {
      resolvedLabel = this._labels.get(vertex)!;
    } else if (label instanceof Mobject) {
      resolvedLabel = label;
    }

    const baseConfig = { ...this.defaultVertexConfig };
    Object.assign(baseConfig, vertexConfig);
    vertexConfig = baseConfig;

    let vType = vertexType;
    if (resolvedLabel !== null) {
      vertexConfig["label"] = resolvedLabel;
      if (vertexType === Dot) {
        vType = LabeledDot as unknown as typeof Dot;
      }
    }

    const mob = vertexMobject ?? new vType(vertexConfig);
    mob.moveTo(npPosition);

    return [vertex, npPosition, vertexConfig, mob];
  }

  private _addCreatedVertex(
    vertex: Hashable,
    position: Point3D,
    vertexConfig: Record<string, unknown>,
    vertexMobject: Mobject,
  ): Mobject {
    if (this.vertices.has(vertex)) {
      throw new Error(
        `Vertex identifier '${vertex}' is already used for a vertex in this graph.`,
      );
    }

    this._graph.addNode(String(vertex));
    this._layout.set(vertex, position);

    if ("label" in vertexConfig) {
      this._labels.set(vertex, vertexConfig["label"] as Mobject);
    }

    this._vertexConfig.set(vertex, vertexConfig);
    this.vertices.set(vertex, vertexMobject);
    vertexMobject.moveTo(position);
    this.add(vertexMobject);

    return vertexMobject;
  }

  addVertex(
    vertex: Hashable,
    options: {
      position?: Point3D;
      label?: boolean | Mobject;
      labelFillColor?: ParsableManimColor;
      vertexType?: new (options: Record<string, unknown>) => Mobject;
      vertexConfig?: Record<string, unknown>;
      vertexMobject?: Mobject;
    } = {},
  ): Mobject {
    const {
      position,
      label = false,
      labelFillColor = BLACK,
      vertexType = Dot,
      vertexConfig,
      vertexMobject,
    } = options;

    const created = this._createVertex(
      vertex,
      position,
      label,
      labelFillColor,
      vertexType,
      vertexConfig,
      vertexMobject,
    );
    return this._addCreatedVertex(...created);
  }

  private _createVertices(
    vertices: Hashable[],
    options: {
      positions?: Map<Hashable, Point3D>;
      labels?: boolean | Map<Hashable, boolean | Mobject>;
      labelFillColor?: ParsableManimColor;
      vertexType?: new (options: Record<string, unknown>) => Mobject;
      vertexConfig?: Record<string, unknown>;
      vertexMobjects?: Map<Hashable, Mobject>;
    } = {},
  ): Array<[Hashable, Point3D, Record<string, unknown>, Mobject]> {
    const {
      positions: positionsProp,
      labels: labelsProp = false,
      labelFillColor = BLACK,
      vertexType = Dot,
      vertexConfig: vertexConfigProp,
      vertexMobjects: vertexMobjectsProp,
    } = options;

    const positions = positionsProp ?? new Map<Hashable, Point3D>();
    const vertexMobjects = vertexMobjectsProp ?? new Map<Hashable, Mobject>();

    const graphCenter = this.getCenter();
    const resolvedPositions = new Map<Hashable, Point3D>();
    for (const v of vertices) {
      resolvedPositions.set(v, positions.get(v) ?? graphCenter);
    }

    let resolvedLabels: Map<Hashable, boolean | Mobject>;
    if (typeof labelsProp === "boolean") {
      resolvedLabels = new Map(
        vertices.map((v) => [v, labelsProp]),
      );
    } else {
      resolvedLabels = new Map(
        vertices.map((v) => [v, labelsProp.get(v) ?? false]),
      );
    }

    const baseVertexConfig = { ...this.defaultVertexConfig };
    if (vertexConfigProp) {
      for (const [k, v] of Object.entries(vertexConfigProp)) {
        if (!vertices.includes(k as Hashable) && !vertices.includes(Number(k))) {
          baseVertexConfig[k] = v;
        }
      }
    }

    const perVertexConfig = new Map<Hashable, Record<string, unknown>>();
    for (const v of vertices) {
      const specific = vertexConfigProp?.[String(v)];
      if (specific && typeof specific === "object") {
        perVertexConfig.set(v, {
          ...baseVertexConfig,
          ...(specific as Record<string, unknown>),
        });
      } else {
        perVertexConfig.set(v, { ...baseVertexConfig });
      }
    }

    return vertices.map((v) =>
      this._createVertex(
        v,
        resolvedPositions.get(v),
        resolvedLabels.get(v) ?? false,
        labelFillColor,
        vertexType,
        perVertexConfig.get(v),
        vertexMobjects.get(v),
      ),
    );
  }

  addVertices(
    vertices: Hashable[],
    options: {
      positions?: Map<Hashable, Point3D>;
      labels?: boolean | Map<Hashable, boolean | Mobject>;
      labelFillColor?: ParsableManimColor;
      vertexType?: new (options: Record<string, unknown>) => Mobject;
      vertexConfig?: Record<string, unknown>;
      vertexMobjects?: Map<Hashable, Mobject>;
    } = {},
  ): Mobject[] {
    return this._createVertices(vertices, options).map((created) =>
      this._addCreatedVertex(...created),
    );
  }

  private _removeVertex(vertex: Hashable): Group {
    if (!this.vertices.has(vertex)) {
      throw new Error(
        `The graph does not contain a vertex with identifier '${vertex}'`,
      );
    }

    this._graph.dropNode(String(vertex));
    this._layout.delete(vertex);
    this._labels.delete(vertex);
    this._vertexConfig.delete(vertex);

    const toRemove: Mobject[] = [];

    // Remove incident edges
    const edgesToRemove: string[] = [];
    for (const ek of this.edges.keys()) {
      const [u, v] = parseEdgeKey(ek);
      if (u === String(vertex) || v === String(vertex)) {
        edgesToRemove.push(ek);
      }
    }
    for (const ek of edgesToRemove) {
      this._edgeConfig.delete(ek);
      toRemove.push(this.edges.get(ek)!);
      this.edges.delete(ek);
    }

    toRemove.push(this.vertices.get(vertex)!);
    this.vertices.delete(vertex);

    this.remove(...toRemove);
    return new Group(...toRemove);
  }

  removeVertices(...vertices: Hashable[]): Group {
    const mobjects: Mobject[] = [];
    for (const v of vertices) {
      const removed = this._removeVertex(v);
      mobjects.push(...removed.submobjects);
    }
    return new Group(...mobjects);
  }

  addEdge(
    edge: EdgeTuple,
    options: {
      edgeType?: new (options: Record<string, unknown>) => Mobject;
      edgeConfig?: Record<string, unknown>;
    } = {},
  ): Group {
    const {
      edgeType = Line,
      edgeConfig: edgeConfigProp,
    } = options;

    const config = edgeConfigProp ?? { ...this.defaultEdgeConfig };
    const addedMobjects: Mobject[] = [];

    const [u, v] = edge;

    // Add vertices if they don't exist
    if (!this.vertices.has(u)) {
      addedMobjects.push(this.addVertex(u));
    }
    if (!this.vertices.has(v)) {
      addedMobjects.push(this.addVertex(v));
    }

    this._graph.addEdge(String(u), String(v));

    const baseConfig = { ...this.defaultEdgeConfig, ...config };
    const ek = edgeKey(u, v);
    this._edgeConfig.set(ek, baseConfig);

    const edgeMobject = new edgeType({
      start: this.getVertex(u).getCenter(),
      end: this.getVertex(v).getCenter(),
      zIndex: -1,
      ...baseConfig,
    });
    this.edges.set(ek, edgeMobject);
    this.add(edgeMobject);
    addedMobjects.push(edgeMobject);

    return new Group(...addedMobjects);
  }

  addEdges(
    edges: EdgeTuple[],
    options: {
      edgeType?: new (options: Record<string, unknown>) => Mobject;
      edgeConfig?: Record<string, unknown>;
      vertexOptions?: Record<string, unknown>;
    } = {},
  ): Group {
    const {
      edgeType = Line,
      edgeConfig: edgeConfigProp,
    } = options;

    const edgeConfig = edgeConfigProp ?? {};

    // Separate per-edge config from global config
    const nonEdgeSettings: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(edgeConfig)) {
      if (!k.includes(",")) {
        nonEdgeSettings[k] = v;
      }
    }

    const baseEdgeConfig = { ...this.defaultEdgeConfig, ...nonEdgeSettings };
    const perEdgeConfig = new Map<string, Record<string, unknown>>();
    for (const [u, v] of edges) {
      const key = `${u},${v}`;
      const specific = edgeConfig[key];
      if (specific && typeof specific === "object") {
        perEdgeConfig.set(
          edgeKey(u, v),
          { ...baseEdgeConfig, ...(specific as Record<string, unknown>) },
        );
      } else {
        perEdgeConfig.set(edgeKey(u, v), { ...baseEdgeConfig });
      }
    }

    // Add missing vertices
    const edgeVertices = new Set<Hashable>();
    for (const [u, v] of edges) {
      edgeVertices.add(u);
      edgeVertices.add(v);
    }
    const newVertices = [...edgeVertices].filter((v) => !this.vertices.has(v));
    const addedVertices = this.addVertices(newVertices);

    const addedMobjects: Mobject[] = [...addedVertices];
    for (const [u, v] of edges) {
      const ek = edgeKey(u, v);
      const result = this.addEdge([u, v], {
        edgeType,
        edgeConfig: perEdgeConfig.get(ek),
      });
      addedMobjects.push(...result.submobjects);
    }

    return new Group(...addedMobjects);
  }

  private _removeEdge(edge: EdgeTuple): Mobject {
    const ek = edgeKey(edge[0], edge[1]);
    if (!this.edges.has(ek)) {
      throw new Error(`The graph does not contain edge '${edge}'`);
    }

    const edgeMobject = this.edges.get(ek)!;
    this.edges.delete(ek);

    if (this._graph.hasEdge(String(edge[0]), String(edge[1]))) {
      this._graph.dropEdge(String(edge[0]), String(edge[1]));
    }
    this._edgeConfig.delete(ek);

    this.remove(edgeMobject);
    return edgeMobject;
  }

  removeEdges(...edges: EdgeTuple[]): Group {
    const edgeMobjects = edges.map((e) => this._removeEdge(e));
    return new Group(...edgeMobjects);
  }

  static fromGraphology<T extends typeof GenericGraph>(
    this: T,
    graph: GraphologyGraph,
    options: GenericGraphOptions = {},
  ): InstanceType<T> {
    const vertices = graph.nodes();
    const edges: EdgeTuple[] = [];
    graph.forEachEdge((_edge, _attrs, source, target) => {
      edges.push([source, target]);
    });
    return new (this as unknown as new (
      vertices: Hashable[],
      edges: EdgeTuple[],
      options: GenericGraphOptions,
    ) => InstanceType<T>)(vertices, edges, options);
  }

  changeLayout(options: {
    layout?: LayoutName | Map<Hashable, Point3D> | LayoutFunction;
    layoutScale?: number | [number, number, number];
    layoutConfig?: Record<string, unknown>;
    partitions?: Hashable[][];
    rootVertex?: Hashable;
  } = {}): this {
    const {
      layout = "spring",
      layoutScale = 2,
      layoutConfig: layoutConfigProp,
      partitions,
      rootVertex,
    } = options;

    const layoutConfig = layoutConfigProp ?? {};
    if (partitions !== undefined && !("partitions" in layoutConfig)) {
      layoutConfig["partitions"] = partitions;
    }
    if (rootVertex !== undefined && !("rootVertex" in layoutConfig)) {
      layoutConfig["rootVertex"] = rootVertex;
    }

    this._layout = determineGraphLayout(
      this._graph,
      layout,
      layoutScale,
      layoutConfig,
    );

    for (const [v, mob] of this.vertices.entries()) {
      const pos = this._layout.get(String(v));
      if (pos) {
        mob.moveTo(pos);
      }
    }
    return this;
  }

  updateEdges(_graph: GenericGraph): void {
    throw new Error("To be implemented in concrete subclasses");
  }
}

// ─── Graph (undirected) ─────────────────────────────────────

export class Graph extends GenericGraph {
  protected _emptyGraphologyGraph(): GraphologyGraph {
    return new GraphologyGraph({ type: "undirected" });
  }

  protected _populateEdgeDict(
    edges: EdgeTuple[],
    edgeType: new (options: Record<string, unknown>) => Mobject,
  ): void {
    for (const [u, v] of edges) {
      const ek = edgeKey(u, v);
      const cfg = this._edgeConfig.get(ek) ?? {};
      this.edges.set(
        ek,
        new edgeType({
          start: this.getVertex(u).getCenter(),
          end: this.getVertex(v).getCenter(),
          zIndex: -1,
          ...cfg,
        }),
      );
    }
  }

  updateEdges(graph: GenericGraph): void {
    for (const [ek, edge] of graph.edges.entries()) {
      const [u, v] = parseEdgeKey(ek);
      const uMob = graph.vertices.get(u);
      const vMob = graph.vertices.get(v);
      if (uMob && vMob && edge instanceof Line) {
        edge.setPointsByEnds(uMob.getCenter(), vMob.getCenter(), {
          buff: (this._edgeConfig.get(ek)?.["buff"] as number) ?? 0,
          pathArc: (this._edgeConfig.get(ek)?.["pathArc"] as number) ?? 0,
        });
      }
    }
  }

  toString(): string {
    return `Undirected graph on ${this.vertices.size} vertices and ${this.edges.size} edges`;
  }
}

// ─── DiGraph (directed) ─────────────────────────────────────

export class DiGraph extends GenericGraph {
  protected _emptyGraphologyGraph(): GraphologyGraph {
    return new GraphologyGraph({ type: "directed" });
  }

  protected _populateEdgeDict(
    edges: EdgeTuple[],
    edgeType: new (options: Record<string, unknown>) => Mobject,
  ): void {
    for (const [u, v] of edges) {
      const ek = edgeKey(u, v);
      const cfg = this._edgeConfig.get(ek) ?? {};
      const edgeMob = new edgeType({
        start: this.getVertex(u),
        end: this.getVertex(v),
        zIndex: -1,
        ...cfg,
      });
      this.edges.set(ek, edgeMob);
    }

    // Add tips for directed edges
    for (const [u, v] of edges) {
      const ek = edgeKey(u, v);
      const edge = this.edges.get(ek);
      const tipConfig = this._tipConfig.get(ek) ?? {};
      if (edge && edge instanceof Line) {
        edge.addTip(tipConfig);
      }
    }
  }

  updateEdges(graph: GenericGraph): void {
    for (const [ek, edge] of graph.edges.entries()) {
      const [u, v] = parseEdgeKey(ek);
      const uMob = graph.vertices.get(u);
      const vMob = graph.vertices.get(v);
      if (uMob && vMob && edge instanceof Line) {
        const tips = edge.popTips();
        const tip = tips.length > 0 ? tips[0] : null;
        edge.setPointsByEnds(uMob, vMob, {
          buff: (this._edgeConfig.get(ek)?.["buff"] as number) ?? 0,
          pathArc: (this._edgeConfig.get(ek)?.["pathArc"] as number) ?? 0,
        });
        if (tip) {
          edge.addTip({ tip });
        }
      }
    }
  }

  toString(): string {
    return `Directed graph on ${this.vertices.size} vertices and ${this.edges.size} edges`;
  }
}

// ─── Re-export types ────────────────────────────────────────

export type {
  Hashable,
  EdgeTuple,
  LayoutFunction,
  LayoutName,
};
