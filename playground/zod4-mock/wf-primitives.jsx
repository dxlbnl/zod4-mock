// Shared sketchy primitives + annotation helpers used by every wireframe.
// Exports to window so other Babel scripts can use them.

const Pill = ({ children, className = "", ...rest }) => (
  <span className={`pill ${className}`} {...rest}>
    {children}
  </span>
);

const Input = ({ value, placeholder, width, mono, accent, className = "" }) => (
  <span
    className={`input ${className} ${value ? "" : "placeholder"}`}
    style={{
      width: width || "auto",
      fontFamily: mono ? "var(--mono)" : "var(--hand)",
      fontSize: mono ? 12 : 14,
      borderColor: accent ? "var(--accent)" : "var(--ink)",
    }}
  >
    {value || placeholder || ""}
  </span>
);

const Dropdown = ({ value, width, accent, hatched }) => (
  <span
    className={`dropdown ${hatched ? "hatched" : ""}`}
    style={{
      width: width || "auto",
      borderColor: accent ? "var(--accent)" : "var(--ink)",
      color: accent ? "var(--accent)" : "var(--ink)",
    }}
  >
    {value}
  </span>
);

const Btn = ({ children, primary, dashed = true, onClick, style }) => (
  <button
    className={`btn ${primary ? "primary" : ""}`}
    onClick={onClick}
    style={{
      borderStyle: primary ? "solid" : dashed ? "dashed" : "solid",
      ...style,
    }}
  >
    {children}
  </button>
);

const Toggle = ({ label, on }) => (
  <span className={`toggle ${on ? "on" : ""}`}>
    <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{label}</span>
    <span className="knob" />
  </span>
);

const Badge = ({ children, kind }) => <span className={`badge ${kind || ""}`}>{children}</span>;

// A wiggly hand-drawn arrow between two points (uses SVG path noise)
function Arrow({
  from,
  to,
  curve = 30,
  dashed = false,
  color = "var(--accent)",
  label,
  labelSide = "mid",
}) {
  // from/to in container coords
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const mx = (from.x + to.x) / 2 + curve;
  const my = (from.y + to.y) / 2 - Math.abs(curve) * 0.4;
  // Add tiny jitter for hand-drawn feel
  const jitter = (n) => n + Math.sin(n * 13.37) * 1.5;
  const path = `M ${from.x} ${from.y} Q ${jitter(mx)} ${jitter(my)} ${to.x} ${to.y}`;

  const minX = Math.min(from.x, to.x, mx) - 10;
  const minY = Math.min(from.y, to.y, my) - 10;
  const maxX = Math.max(from.x, to.x, mx) + 10;
  const maxY = Math.max(from.y, to.y, my) + 10;
  const w = maxX - minX,
    h = maxY - minY;

  // Arrowhead
  const angle = Math.atan2(to.y - my, to.x - mx);
  const ah = 8;
  const ax1 = to.x - ah * Math.cos(angle - 0.5);
  const ay1 = to.y - ah * Math.sin(angle - 0.5);
  const ax2 = to.x - ah * Math.cos(angle + 0.5);
  const ay2 = to.y - ah * Math.sin(angle + 0.5);

  return (
    <svg
      className="anno-arrow"
      style={{ left: minX, top: minY, width: w, height: h, position: "absolute" }}
      viewBox={`${minX} ${minY} ${w} ${h}`}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={dashed ? "4 3" : "none"}
        strokeLinecap="round"
      />
      <path
        d={`M ${to.x} ${to.y} L ${ax1} ${ay1} M ${to.x} ${to.y} L ${ax2} ${ay2}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {label && (
        <text
          x={mx}
          y={my - 4}
          fontFamily="var(--hand)"
          fontSize="13"
          fill={color}
          textAnchor="middle"
        >
          {label}
        </text>
      )}
    </svg>
  );
}

// Annotation: positioned text + optional arrow target
function Anno({ x, y, w, children, ink, arrow }) {
  return (
    <div
      className="anno"
      style={{
        left: x,
        top: y,
        width: w || 180,
        color: ink ? "var(--ink)" : "var(--accent)",
      }}
    >
      {children}
    </div>
  );
}

// Dotted ring callout
function Ring({ x, y, w, h }) {
  return <div className="ring" style={{ left: x, top: y, width: w, height: h }} />;
}

// Pane with a tab label
function Pane({ tab, children, style, dashed }) {
  return (
    <div
      className="pane"
      style={{
        borderStyle: dashed ? "dashed" : "solid",
        ...style,
      }}
    >
      {tab && <div className="pane-tab">{tab}</div>}
      {children}
    </div>
  );
}

// Type chip — color-codes the type slot
function TypeChip({ value, accent, hatched }) {
  return (
    <span
      className="dropdown"
      style={{
        borderColor: accent ? "var(--accent)" : "var(--ink)",
        color: "var(--ink)",
        background: hatched ? "transparent" : "#faf7ee",
        backgroundImage: hatched
          ? "repeating-linear-gradient(45deg, rgba(210,74,42,0.10) 0 2px, transparent 2px 6px)"
          : undefined,
      }}
    >
      {value}
    </span>
  );
}

// Modifier pill: unified UI for ALL modifiers (.min, .max, .int, .optional, …)
// Flag-style (.int(), .optional()) → just the name. Value-style (.min(18)) →
// name + inline-editable value. Both have a × on hover.
function ModPill({ name, value, accent, showRemove }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 4px 1px 6px",
        border: "1.25px solid " + (accent ? "var(--accent)" : "var(--ink)"),
        borderRadius: 3,
        background: accent ? "#fff7f3" : "#fff",
        fontFamily: "var(--mono)",
        fontSize: 11,
        color: accent ? "var(--accent)" : "var(--ink)",
      }}
    >
      <span>{name}</span>
      {value !== undefined && (
        <>
          <span style={{ color: "var(--ink-faint)" }}>=</span>
          <span
            style={{
              background: "#faf7ee",
              border: "1px dashed var(--ink-faint)",
              borderRadius: 2,
              padding: "0 3px",
              cursor: "text",
              minWidth: 14,
              textAlign: "center",
            }}
          >
            {value}
          </span>
        </>
      )}
      {showRemove && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: accent ? "var(--accent)" : "var(--ink-faint)",
            color: "#fff",
            fontSize: 9,
            lineHeight: 1,
            marginLeft: 2,
            cursor: "pointer",
          }}
        >
          ×
        </span>
      )}
    </span>
  );
}

// Add-modifier chip: the ONLY way to add modifiers. Click → floating menu.
function AddModChip({ active }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 7px",
        border: "1.25px dashed " + (active ? "var(--accent)" : "var(--ink-faint)"),
        borderRadius: 3,
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#fff" : "var(--ink-faint)",
        fontFamily: "var(--mono)",
        fontSize: 11,
        cursor: "pointer",
      }}
    >
      + mod
    </span>
  );
}

// Parse modifiers prop entries: strings = flag, [name, value] = value-mod
function renderMods(modifiers, removableIdx) {
  return modifiers.map((m, i) => {
    const isArr = Array.isArray(m);
    const name = isArr ? m[0] : m;
    const value = isArr ? m[1] : undefined;
    return <ModPill key={i} name={name} value={value} showRemove={removableIdx === i} />;
  });
}

// Property row — unified pill model (no toggles).
function PropRow({
  keyName,
  type,
  modifiers = [],
  selected,
  warn,
  indent = 0,
  drillable,
  expanded,
  removableIdx,
  addOpen,
  mono,
}) {
  return (
    <div
      className="row"
      style={{
        paddingLeft: 8 + indent * 16,
        background: selected ? "rgba(210,74,42,0.06)" : "transparent",
      }}
    >
      <span className="grip">⋮⋮</span>
      <Input value={keyName} placeholder="key" width={110} mono />
      <span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
        :
      </span>
      <TypeChip value={type} accent={selected} />
      {renderMods(modifiers, removableIdx)}
      <AddModChip active={addOpen} />
      <span style={{ flex: 1 }} />
      {warn && (
        <span style={{ color: "var(--warn)", fontSize: 14 }} title="warning">
          ⚠
        </span>
      )}
      {drillable && (
        <span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 14 }}>
          {expanded ? "▾" : "›"}
        </span>
      )}
      <span className="muted" style={{ fontSize: 12 }}>
        ×
      </span>
    </div>
  );
}

// Header strip showing Subject tab list + add button
function SubjectTabs({ active = "User", subjects = ["User", "Invoice", "Address"] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: "8px 10px",
        borderBottom: "1.5px solid var(--ink)",
        alignItems: "center",
        background: "#faf7ee",
      }}
    >
      <span style={{ fontFamily: "var(--hand-bold)", fontSize: 16, marginRight: 6 }}>Subjects</span>
      {subjects.map((s) => (
        <span
          key={s}
          className="pill"
          style={{
            background: s === active ? "var(--accent)" : "#fff",
            color: s === active ? "#fff" : "var(--ink)",
            borderColor: s === active ? "var(--accent)" : "var(--ink)",
            fontFamily: "var(--mono)",
            fontSize: 12,
          }}
        >
          {s}
        </span>
      ))}
      <span className="btn" style={{ borderStyle: "dashed", fontSize: 12, padding: "1px 8px" }}>
        + Subject
      </span>
    </div>
  );
}

// World settings strip — at top of left pane
function WorldStrip() {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "8px 10px",
        borderBottom: "1.5px solid var(--ink)",
        alignItems: "center",
        background: "#fff",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontFamily: "var(--hand-bold)", fontSize: 14 }}>World</span>
      <span className="muted" style={{ fontSize: 12 }}>
        seed
      </span>
      <Input value="42" width={42} mono />
      <span className="btn" style={{ fontSize: 11, padding: "1px 6px" }}>
        🎲
      </span>
      <span className="muted" style={{ fontSize: 12 }}>
        items
      </span>
      <Input value="3" width={28} mono />
      <span className="muted">–</span>
      <Input value="10" width={32} mono />
    </div>
  );
}

// Code pane mock content
function CodeMock({ lines }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: "12px 14px",
        fontFamily: "var(--mono)",
        fontSize: 11.5,
        lineHeight: 1.55,
        color: "#222",
        background: "#fff",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {lines.join("\n")}
    </pre>
  );
}

// JSON pane mock content
function JsonMock({ lines }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: "12px 14px",
        fontFamily: "var(--mono)",
        fontSize: 11.5,
        lineHeight: 1.55,
        color: "#222",
        background: "#fbf9f1",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {lines.join("\n")}
    </pre>
  );
}

Object.assign(window, {
  Pill,
  Input,
  Dropdown,
  Btn,
  Toggle,
  Badge,
  Arrow,
  Anno,
  Ring,
  Pane,
  TypeChip,
  PropRow,
  ModPill,
  AddModChip,
  SubjectTabs,
  WorldStrip,
  CodeMock,
  JsonMock,
});
