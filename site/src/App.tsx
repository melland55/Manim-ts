import { sections } from "./examples";
import { ExampleCompare } from "./components/ExampleCompare";

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">manim-ts</div>
        <div className="subtitle">Example Gallery</div>
        <nav>
          <h3>Examples</h3>
          <ul>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="section-link">
                  {section.title}
                </a>
                <ul className="sub">
                  {section.examples.map((ex) => (
                    <li key={ex.id}>
                      <a href={`#${ex.id}`}>{ex.className}</a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="content">
        <h1>Example Gallery</h1>
        <p>
          Side-by-side comparison: <strong>manim-ts</strong> on the left, the original
          Python <strong>Manim Community</strong> rendering on the right. Layout
          mirrors the{" "}
          <a href="https://docs.manim.community/en/stable/examples.html">
            official Manim Community examples page
          </a>
          .
        </p>

        {sections.map((section) => (
          <section key={section.id} id={section.id} className="gallery-section">
            <h2>{section.title}</h2>
            {section.examples.map((ex) => (
              <ExampleCompare key={ex.id} example={ex} />
            ))}
          </section>
        ))}
      </main>
    </div>
  );
}
