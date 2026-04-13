/**
 * Tests for src/mobject/graph/
 */

import { describe, it, expect } from "vitest";
import "../helpers/point-matchers.js";

import { np } from "../../src/core/math/index.js";
import { Graph, DiGraph } from "../../src/mobject/graph/index.js";
import type { Hashable, EdgeTuple } from "../../src/mobject/graph/index.js";

describe("Graph", () => {
  describe("constructor", () => {
    it("creates an empty graph with no vertices or edges", () => {
      const g = new Graph([], []);
      expect(g.vertices.size).toBe(0);
      expect(g.edges.size).toBe(0);
    });

    it("creates a graph with vertices and edges", () => {
      const vertices: Hashable[] = [1, 2, 3, 4];
      const edges: EdgeTuple[] = [[1, 2], [2, 3], [3, 4]];
      const g = new Graph(vertices, edges);
      expect(g.vertices.size).toBe(4);
      expect(g.edges.size).toBe(3);
    });

    it("creates a single-vertex graph", () => {
      const g = new Graph([1], []);
      expect(g.vertices.size).toBe(1);
      expect(g.edges.size).toBe(0);
    });
  });

  describe("vertex operations", () => {
    it("retrieves a vertex via getVertex", () => {
      const g = new Graph([1, 2], [[1, 2]]);
      const mob = g.getVertex(1);
      expect(mob).toBeDefined();
    });

    it("throws when accessing non-existent vertex", () => {
      const g = new Graph([1], []);
      expect(() => g.getVertex(99)).toThrow();
    });

    it("adds a new vertex", () => {
      const g = new Graph([1, 2], [[1, 2]]);
      g.addVertex(3);
      expect(g.vertices.size).toBe(3);
    });

    it("throws when adding a duplicate vertex", () => {
      const g = new Graph([1, 2], [[1, 2]]);
      expect(() => g.addVertex(1)).toThrow(/already used/);
    });

    it("removes vertices and incident edges", () => {
      const g = new Graph([1, 2, 3], [[1, 2], [2, 3]]);
      const removed = g.removeVertices(2);
      expect(g.vertices.size).toBe(2);
      expect(g.edges.size).toBe(0);
      expect(removed.submobjects.length).toBeGreaterThan(0);
    });
  });

  describe("edge operations", () => {
    it("adds a new edge between existing vertices", () => {
      const g = new Graph([1, 2, 3], [[1, 2]]);
      g.addEdge([2, 3]);
      expect(g.edges.size).toBe(2);
    });

    it("adds edge and auto-creates missing vertices", () => {
      const g = new Graph([1], []);
      g.addEdge([1, 2]);
      expect(g.vertices.size).toBe(2);
      expect(g.edges.size).toBe(1);
    });

    it("removes edges", () => {
      const g = new Graph([1, 2, 3], [[1, 2], [2, 3]]);
      g.removeEdges([1, 2]);
      expect(g.edges.size).toBe(1);
      expect(g.vertices.size).toBe(3); // vertices remain
    });

    it("throws when removing non-existent edge", () => {
      const g = new Graph([1, 2], [[1, 2]]);
      expect(() => g.removeEdges([1, 3])).toThrow();
    });
  });

  describe("layout", () => {
    it("applies circular layout", () => {
      const g = new Graph([1, 2, 3], [[1, 2], [2, 3], [3, 1]], {
        layout: "circular",
      });
      // Vertices should be placed on a circle
      expect(g.vertices.size).toBe(3);
    });

    it("applies manual layout via Map", () => {
      const layoutMap = new Map<Hashable, ReturnType<typeof np.array>>();
      layoutMap.set(1, np.array([0, 0, 0]));
      layoutMap.set(2, np.array([1, 0, 0]));
      const g = new Graph([1, 2], [[1, 2]], {
        layout: layoutMap,
      });
      expect(g.vertices.size).toBe(2);
    });

    it("changes layout after construction", () => {
      const g = new Graph([1, 2, 3], [[1, 2], [2, 3]]);
      g.changeLayout({ layout: "circular" });
      expect(g.vertices.size).toBe(3);
    });

    it("applies tree layout", () => {
      const g = new Graph(
        [1, 2, 3, 4, 5, 6, 7],
        [[1, 2], [1, 3], [2, 4], [2, 5], [3, 6], [3, 7]],
        {
          layout: "tree",
          rootVertex: 1,
        },
      );
      expect(g.vertices.size).toBe(7);
    });
  });

  describe("toString", () => {
    it("describes the graph", () => {
      const g = new Graph([1, 2, 3], [[1, 2], [2, 3]]);
      expect(g.toString()).toContain("Undirected");
      expect(g.toString()).toContain("3 vertices");
      expect(g.toString()).toContain("2 edges");
    });
  });
});

describe("DiGraph", () => {
  describe("constructor", () => {
    it("creates a directed graph", () => {
      const g = new DiGraph([1, 2, 3], [[1, 2], [2, 3]]);
      expect(g.vertices.size).toBe(3);
      expect(g.edges.size).toBe(2);
    });

    it("creates an empty directed graph", () => {
      const g = new DiGraph([], []);
      expect(g.vertices.size).toBe(0);
      expect(g.edges.size).toBe(0);
    });
  });

  describe("toString", () => {
    it("describes the directed graph", () => {
      const g = new DiGraph([1, 2], [[1, 2]]);
      expect(g.toString()).toContain("Directed");
      expect(g.toString()).toContain("2 vertices");
      expect(g.toString()).toContain("1 edges");
    });
  });
});
