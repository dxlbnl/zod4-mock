// hifi/code.jsx — syntax-highlighted code rendering.
function CodeView({ lines }) {
  return (
    <div className="code">
      {lines.map((line, i) => {
        const meta = line[line.length - 1];
        const isMeta = meta && typeof meta === "object" && !Array.isArray(meta);
        const tokens = isMeta ? line.slice(0, -1) : line;
        const active = isMeta && meta.active;
        return (
          <div key={i} className={"ln" + (active ? " active" : "")}>
            <span className="gutter">{i + 1}</span>
            <span className="content">
              {tokens.map(([cls, text], j) => (
                <span key={j} className={cls}>
                  {text}
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
window.CodeView = CodeView;
