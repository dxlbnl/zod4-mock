// hifi/export.jsx — Export-all sheet.

function ExportSheet({ open, onClose }) {
  const { Icon, USER_CODE_LINES, CodeView } = window;
  const [include, setInclude] = React.useState({ schemas: true, world: true });

  if (!open) return null;

  // The "table of contents" reflects the single-file layout
  const toc = [
    { section: "Schemas", items: include.schemas ? ["User", "Order", "Product"] : [] },
    { section: "World", items: include.world ? ["users[6]", "orders[4]", "products[5]"] : [] },
  ];
  const totalLines = (include.schemas ? 44 : 0) + (include.world ? 142 : 0) + 8;

  return (
    <div className="export-mask" onClick={onClose}>
      <div className="export-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="export-head">
          <Icon name="package" size={16} />
          <h2>Export</h2>
          <span className="sub">single file · world.ts · {totalLines} lines</span>
          <div className="actions">
            <button className="btn">
              <Icon name="copy" size={12} /> Copy
            </button>
            <button className="btn primary">
              <Icon name="download" size={12} /> Download world.ts
            </button>
            <button className="icon-btn" onClick={onClose}>
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>

        <div className="export-body">
          <div className="export-files">
            <div className="grp">In file</div>
            {toc.map((sec) => (
              <React.Fragment key={sec.section}>
                <div
                  className="export-file"
                  style={{ color: "var(--ink-2)", cursor: "default", background: "transparent" }}
                >
                  <span>// {sec.section}</span>
                </div>
                {sec.items.map((name) => (
                  <div key={name} className="export-file" style={{ paddingLeft: 24 }}>
                    <span>{name}</span>
                  </div>
                ))}
              </React.Fragment>
            ))}
            <div className="grp" style={{ marginTop: 8 }}>
              Tip
            </div>
            <div
              style={{ padding: "4px 10px", color: "var(--ink-2)", fontSize: 11, lineHeight: 1.5 }}
            >
              Everything bundles into a single{" "}
              <span className="mono" style={{ color: "var(--ink-0)" }}>
                world.ts
              </span>{" "}
              that re-exports each schema and the generated world.
            </div>
          </div>

          <div className="export-preview">
            <div className="export-preview-head">
              <span>preview</span>
              <span>·</span>
              <span className="file">world.ts</span>
              <span className="actions">
                <button className="icon-btn">
                  <Icon name="copy" size={12} />
                </button>
                <button className="icon-btn">
                  <Icon name="download" size={13} />
                </button>
              </span>
            </div>
            <div className="export-preview-body">
              <CodeView lines={USER_CODE_LINES} />
            </div>
          </div>
        </div>

        <div className="export-options">
          <span className="label">Include</span>
          <div className="seg">
            <button
              aria-pressed={include.schemas}
              onClick={() => setInclude((s) => ({ ...s, schemas: !s.schemas }))}
            >
              Schemas
            </button>
            <button
              aria-pressed={include.world}
              onClick={() => setInclude((s) => ({ ...s, world: !s.world }))}
            >
              Generated world
            </button>
          </div>
          <div
            style={{
              marginLeft: "auto",
              color: "var(--ink-2)",
              fontSize: 11,
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            <span className="kbd">esc</span> close · <span className="kbd">⌘ ⏎</span> download
          </div>
        </div>
      </div>
    </div>
  );
}

window.ExportSheet = ExportSheet;
