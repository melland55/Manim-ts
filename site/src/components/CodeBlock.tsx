import { Highlight, themes } from "prism-react-renderer";

interface Props {
  code: string;
  language: "python" | "typescript" | "tsx";
}

export function CodeBlock({ code, language }: Props) {
  return (
    <Highlight code={code.trim()} language={language} theme={themes.vsDark}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <div className="code-block">
          <pre className={className} style={{ ...style, background: "transparent" }}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        </div>
      )}
    </Highlight>
  );
}
