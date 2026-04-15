import type { ExampleDef } from "../examples/registry";
import { CodeBlock } from "./CodeBlock";

export function ExampleCompare({ example }: { example: ExampleDef }) {
  const Live = example.live;
  const isLive = !!Live;

  return (
    <section className="example" id={example.id}>
      <header>
        <h3>{example.className}</h3>
        <span className="desc">{example.description}</span>
        <span className={`badge${isLive ? "" : " placeholder"}`}>
          {isLive ? "LIVE" : "PLACEHOLDER"}
        </span>
      </header>

      <div className="grid">
        <div className="pane">
          <div className="pane-title">
            <span className="tag ts">TS</span>
            manim-ts (ours)
          </div>
          <div className="render-area">
            {Live ? (
              <Live />
            ) : example.fallbackAsset ? (
              <video src={example.fallbackAsset} muted loop autoPlay playsInline controls />
            ) : (
              <div className="placeholder">
                Live manim-ts render coming soon.
                <br />
                (See code at right for reference.)
              </div>
            )}
          </div>
          <CodeBlock code={example.manimTsSource} language="typescript" />
        </div>

        <div className="pane">
          <div className="pane-title">
            <span className="tag py">PY</span>
            Manim Community (reference)
          </div>
          <div className="render-area">
            {example.reference.kind === "video" ? (
              <video
                src={example.reference.src}
                muted
                loop
                autoPlay
                playsInline
                controls
              />
            ) : (
              <img src={example.reference.src} alt={example.className} />
            )}
          </div>
          <CodeBlock code={example.pythonSource} language="python" />
        </div>
      </div>
    </section>
  );
}
