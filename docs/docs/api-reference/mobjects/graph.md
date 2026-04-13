---
title: "Graph Theory"
sidebar_position: 8
---

# Graph Theory

The graph module provides classes for visualizing graph-theoretic structures -- vertices, edges, and their layouts. It uses the **graphology** library (replacing Python's networkx) as the underlying graph data structure.

## GenericGraph

The abstract base class for all graph mobjects. Manages vertices, edges, layout, and the underlying graphology instance.

```ts
import { GenericGraph } from "manim-ts/mobjects/graph";
```

### Key Properties

| Property | Type | Description |
|----------|------|-------------|
| `vertices` | `Map<Hashable, IMobject>` | Map of vertex keys to their mobject representations |
| `edges` | `Map<string, IMobject>` | Map of edge keys to their mobject representations |
| `graph` | `Graph (graphology)` | The underlying graphology graph instance |

### Key Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `addVertices()` | `(...vertices: Hashable[]) => this` | Adds vertices to the graph |
| `removeVertices()` | `(...vertices: Hashable[]) => this` | Removes vertices and their incident edges |
| `addEdges()` | `(...edges: EdgeTuple[]) => this` | Adds edges to the graph |
| `removeEdges()` | `(...edges: EdgeTuple[]) => this` | Removes edges from the graph |
| `changeLayout()` | `(layout: LayoutName \| LayoutFunction, options?: LayoutOptions) => this` | Repositions vertices using a layout algorithm |

---

## Graph

An undirected graph visualization.

```ts
import { Graph } from "manim-ts/mobjects/graph";
```

### GraphOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `vertices` | `Hashable[]` | `[]` | Array of vertex identifiers |
| `edges` | `EdgeTuple[]` | `[]` | Array of `[source, target]` tuples |
| `layout` | `LayoutName \| LayoutFunction` | `"spring"` | Layout algorithm or custom function |
| `layoutScale` | `number` | `2` | Scale factor for layout spacing |
| `layoutConfig` | `Record<string, any>` | `{}` | Additional options for the layout algorithm |
| `vertexConfig` | `Record<string, any>` | `{}` | Options for vertex mobjects (e.g., `{ radius: 0.2, color: BLUE }`) |
| `edgeConfig` | `Record<string, any>` | `{}` | Options for edge mobjects (e.g., `{ strokeWidth: 2 }`) |
| `vertexType` | `typeof Dot` | `Dot` | Class used to create vertex mobjects |
| `edgeType` | `typeof Line` | `Line` | Class used to create edge mobjects |
| `labels` | `boolean \| Record<Hashable, string>` | `false` | Whether to show labels; can be a map of custom label strings |
| `vertexMobjects` | `Record<Hashable, IMobject>` | `{}` | Pre-built mobjects to use as vertices |

```ts
const graph = new Graph({
  vertices: [1, 2, 3, 4, 5],
  edges: [[1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [1, 3]],
  layout: "spring",
  labels: true,
  vertexConfig: { radius: 0.3, color: BLUE },
  edgeConfig: { strokeWidth: 2 },
});
```

---

## DiGraph

A directed graph visualization. Edges are rendered as arrows.

```ts
import { DiGraph } from "manim-ts/mobjects/graph";
```

### DiGraphOptions

Same as `GraphOptions`, but edges are directed and rendered with arrow tips by default.

```ts
const digraph = new DiGraph({
  vertices: ["A", "B", "C", "D"],
  edges: [["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"]],
  layout: "circular",
  labels: true,
});
```

---

## Layout Functions

Layout algorithms position graph vertices in 2D or 3D space.

### Built-in Layouts

| Name | Description |
|------|-------------|
| `"spring"` | Force-directed spring layout (default) |
| `"circular"` | Vertices arranged in a circle |
| `"spectral"` | Layout based on graph Laplacian eigenvectors |
| `"shell"` | Concentric circles |
| `"kamada_kawai"` | Minimizes energy based on graph-theoretic distance |
| `"planar"` | Planar embedding (if the graph is planar) |
| `"random"` | Random vertex positions |
| `"spiral"` | Spiral arrangement |
| `"tree"` | Hierarchical tree layout (for trees/DAGs) |
| `"partite"` | Multipartite layout based on vertex sets |

### Custom Layout Function

You can provide a custom layout function:

```ts
const customLayout: LayoutFunction = (graph, scale) => {
  const positions: Record<Hashable, Point3D> = {};
  let i = 0;
  for (const vertex of graph.vertices.keys()) {
    positions[vertex] = np.array([i * scale, 0, 0]);
    i++;
  }
  return positions;
};

const graph = new Graph({
  vertices: [1, 2, 3],
  edges: [[1, 2], [2, 3]],
  layout: customLayout,
});
```

---

## Types

| Type | Definition | Description |
|------|------------|-------------|
| `Hashable` | `string \| number` | Valid vertex identifier types |
| `EdgeTuple` | `[Hashable, Hashable]` | A directed or undirected edge as a pair of vertex identifiers |
| `LayoutFunction` | `(graph: GenericGraph, scale: number) => Record<Hashable, Point3D>` | A function that computes vertex positions |
| `LayoutName` | `string` | Name of a built-in layout algorithm |

---

## Python to TypeScript Conversion

```python
# Python Manim
from manim import *

class GraphExample(Scene):
    def construct(self):
        vertices = [1, 2, 3, 4, 5]
        edges = [(1, 2), (2, 3), (3, 4), (4, 5), (5, 1)]
        graph = Graph(
            vertices, edges,
            layout="circular",
            labels=True,
            vertex_config={"radius": 0.3, "color": BLUE},
        )

        digraph = DiGraph(
            [1, 2, 3],
            [(1, 2), (2, 3), (3, 1)],
            layout="spring",
        )
```

```ts
// TypeScript manim-ts
import { Graph, DiGraph } from "manim-ts/mobjects/graph";
import { BLUE } from "manim-ts/core";

class GraphExample extends Scene {
  construct() {
    const graph = new Graph({
      vertices: [1, 2, 3, 4, 5],
      edges: [[1, 2], [2, 3], [3, 4], [4, 5], [5, 1]],
      layout: "circular",
      labels: true,
      vertexConfig: { radius: 0.3, color: BLUE },
    });

    const digraph = new DiGraph({
      vertices: [1, 2, 3],
      edges: [[1, 2], [2, 3], [3, 1]],
      layout: "spring",
    });
  }
}
```

### Key Differences

- **graphology replaces networkx**: The underlying graph library is graphology instead of networkx. The user-facing API remains the same.
- **Positional to named args**: Python's `Graph(vertices, edges, layout=...)` becomes `new Graph({ vertices, edges, layout: ... })`.
- **Tuples to arrays**: Python edge tuples `(1, 2)` become TypeScript arrays `[1, 2]`.
- **`snake_case` to `camelCase`**: `vertex_config` becomes `vertexConfig`.
