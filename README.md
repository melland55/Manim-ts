# manim-ts

TypeScript port of [Manim](https://github.com/ManimCommunity/manim) — the mathematical animation engine created by 3Blue1Brown. Converted using a swarm of Claude Code agents.

## Setup

### Prerequisites
- Node.js 20+
- Python 3.10+ (for dependency analysis)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

### 1. Install dependencies

```bash
npm install
```

### 2. Clone Manim source

```bash
git clone https://github.com/ManimCommunity/manim.git ./manim-source
```

### 3. Analyze dependency graph

```bash
python3 scripts/analyze-deps.py ./manim-source/manim
```

This produces `task-graph.json` — the complete module dependency graph with topological layers.

### 4. Run the conversion

```bash
# Dry run first — see the plan without spawning agents
npx tsx src/orchestrator.ts --dry-run

# Run for real (4 parallel agents by default)
npx tsx src/orchestrator.ts

# Tune concurrency based on your machine + rate limits
npx tsx src/orchestrator.ts --max-parallel=6

# Resume from a specific layer
npx tsx src/orchestrator.ts --start-layer=3

# Convert a single module
npx tsx src/orchestrator.ts --only=geometry.line
```

## Project Structure

```
├── CLAUDE.md               # Claude Code shared context
├── CONVENTIONS.md           # Conversion rules (injected into every agent)
├── task-graph.json          # Generated dependency graph
├── src/
│   ├── core/
│   │   ├── types.ts         # Core interfaces (the contract)
│   │   ├── math/            # numpy replacement (Layer -1)
│   │   └── color/           # Color system (Layer -1)
│   ├── orchestrator.ts      # Agent swarm orchestrator
│   └── prompt-builder.ts    # Per-module prompt generator
├── scripts/
│   └── analyze-deps.py      # Manim source analyzer
├── briefs/                  # Generated agent task briefs
├── output/                  # Raw agent output
└── tests/                   # Vitest tests
```

## How It Works

1. `analyze-deps.py` parses Manim's Python source tree, extracts imports, and builds a DAG
2. The DAG is topologically sorted into layers (modules with no cross-deps can run in parallel)
3. The orchestrator spawns Claude Code agents layer-by-layer
4. Each agent receives: the Python source, shared conventions, type stubs, and already-converted dependencies
5. After each layer, `tsc --noEmit` gates progress — fix-up agents run if there are type errors
6. Results are logged and saved incrementally

## Key Decisions

| Python | TypeScript |
|--------|-----------|
| numpy arrays | `Float64Array` + `gl-matrix` |
| Cairo rendering | Canvas2D (to be manually ported) |
| OpenGL rendering | WebGL2 (to be manually ported) |
| `**kwargs` | Typed options objects |
| Global `config` | Module-scoped singleton |
| Generators for animation | Async iterators / scheduler |
