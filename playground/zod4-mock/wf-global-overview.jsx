// Global overview: left-pane accordion containing World / Subjects / Schemas,
// with the rest of the playground (workspace + code + data) on the right.
// Two artboards: full overview, and an accordion zoom-in showing all states.

function GlobalOverview() {
  return (
    <div style={{ position: "relative", width: 1320, height: 880 }}>
      {/* ─────── App chrome ─────── */}
      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          right: 16,
          bottom: 16,
          border: "1.5px solid var(--ink)",
          borderRadius: 8,
          background: "#fff",
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gridTemplateRows: "40px 1fr",
          overflow: "hidden",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            gridColumn: "1 / -1",
            borderBottom: "1.5px solid var(--ink)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "0 14px",
            fontFamily: "var(--hand-bold)",
            background: "var(--paper)",
          }}
        >
          <span style={{ fontSize: 18 }}>zod4-mock</span>
          <span style={{ flex: 1 }} />
          <span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
            seed 42
          </span>
          <span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
            3–10 items
          </span>
          <span
            style={{
              border: "1px solid var(--ink)",
              borderRadius: 4,
              padding: "2px 8px",
              fontFamily: "var(--mono)",
              fontSize: 11,
            }}
          >
            ⌘K
          </span>
        </div>

        {/* Left accordion */}
        <div
          style={{
            borderRight: "1.5px solid var(--ink)",
            background: "var(--paper)",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Accordion />
        </div>

        {/* Right workspace = code + data + builder anchor */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            minHeight: 0,
            minWidth: 0,
          }}
        >
          {/* Builder area takes the left column, full height */}
          <div
            style={{
              gridRow: "1 / span 2",
              borderRight: "1.5px solid var(--ink)",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <PaneHeader>
              Builder · <span style={{ color: "var(--accent)" }}>User</span>
            </PaneHeader>
            <div style={{ padding: 14, overflow: "hidden", flex: 1, minHeight: 0 }}>
              <FakeBuilder />
            </div>
          </div>
          <div
            style={{
              borderBottom: "1.5px solid var(--ink)",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <PaneHeader>Code · zod schema</PaneHeader>
            <div
              style={{
                padding: 10,
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--ink-soft)",
                lineHeight: 1.55,
                flex: 1,
                overflow: "hidden",
              }}
            >
              <div>const User = defineSubjectType("User",</div>
              <div>&nbsp;&nbsp;z.object({"{"}</div>
              <div>
                &nbsp;&nbsp;&nbsp;&nbsp;id: <span style={{ color: "var(--accent)" }}>z.uuid()</span>
                ,
              </div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;name: z.string().min(2),</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;age: z.number().int().min(18),</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;…</div>
              <div>&nbsp;&nbsp;{"}"}));</div>
              <div style={{ marginTop: 6 }}>
                const world = makeWorld({"{"} seed:42 {"}"})
              </div>
              <div>&nbsp;&nbsp;.withSubjects(User, Order)</div>
              <div>&nbsp;&nbsp;.withSchema(UserDto);</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              minWidth: 0,
            }}
          >
            <PaneHeader>Data · world.generate()</PaneHeader>
            <div
              style={{
                padding: 10,
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--ink-soft)",
                lineHeight: 1.55,
                flex: 1,
                overflow: "hidden",
              }}
            >
              <div>[</div>
              <div>&nbsp;&nbsp;{"{"}</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;"id": "9f2e…",</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;"name": "Marcia Lee",</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;"age": 34,</div>
              <div>&nbsp;&nbsp;&nbsp;&nbsp;…</div>
              <div>&nbsp;&nbsp;{"}"},</div>
              <div>&nbsp;&nbsp;…</div>
              <div>]</div>
            </div>
          </div>
        </div>
      </div>

      {/* Annotations */}
      <Anno x={28} y={68} w={300} ink>
        <strong>Left pane = single accordion.</strong> Three sections, only one expanded at a time.
        Holds every piece of global state in the order you build: World → Subjects → Schemas.
      </Anno>
      <Arrow from={{ x: 200, y: 130 }} to={{ x: 180, y: 165 }} curve={-12} />

      <Anno x={28} y={510} w={300}>
        <strong>Subjects expanded by default</strong> on first load — that's where 90% of the work
        happens. World stays collapsed (set seed once and forget) and Schemas comes after.
      </Anno>

      <Anno x={870} y={68} w={420} ink>
        <strong>Right side = workspace.</strong> The accordion's <em>active row</em> drives what the
        Builder shows — clicking <code style={{ fontFamily: "var(--mono)" }}>User</code> in the
        Subjects list opens its property tree here.
      </Anno>
      <Arrow from={{ x: 880, y: 110 }} to={{ x: 850, y: 145 }} curve={-15} />

      <Anno x={870} y={760} w={420}>
        Code + Data panes always reflect the <em>whole world</em>, not just the active subject — so
        users see how their edit ripples globally, even mid-edit.
      </Anno>
    </div>
  );
}

function PaneHeader({ children }) {
  return (
    <div
      style={{
        borderBottom: "1.5px dashed var(--ink-faint)",
        padding: "6px 12px",
        fontFamily: "var(--hand-bold)",
        fontSize: 13,
        background: "var(--paper-2)",
      }}
    >
      {children}
    </div>
  );
}

function Accordion() {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* World — collapsed */}
      <AccordionRow kind="World" meta="seed 42 · 3–10" expanded={false} chip="🎲" />

      {/* Subjects — expanded, primary */}
      <AccordionRow kind="Subjects" meta="3" expanded={true} active>
        <SubjectListItem name="User" active count="6 props" />
        <SubjectListItem name="Order" count="4 props" />
        <SubjectListItem name="Product" count="5 props" />
        <AddRow label="+ Add subject" />
      </AccordionRow>

      {/* Schemas — collapsed */}
      <AccordionRow kind="Schemas" meta="2" expanded={false} />

      <div style={{ flex: 1 }} />

      {/* Footer status strip */}
      <div
        style={{
          borderTop: "1.5px solid var(--ink)",
          padding: "8px 12px",
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--ink-soft)",
          background: "var(--paper-2)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>✓ valid</span>
        <span>↻ regenerated 240ms ago</span>
      </div>
    </div>
  );
}

function AccordionRow({ kind, meta, expanded, active, chip, children }) {
  return (
    <div
      style={{
        borderBottom: "1.5px solid var(--ink)",
        background: active ? "#fff" : "transparent",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: "var(--ink-faint)",
            width: 12,
          }}
        >
          {expanded ? "▾" : "▸"}
        </span>
        <span
          style={{
            fontFamily: "var(--hand-bold)",
            fontSize: 17,
            color: active ? "var(--accent)" : "var(--ink)",
          }}
        >
          {kind}
        </span>
        <span style={{ flex: 1 }} />
        {chip && <span style={{ fontSize: 13 }}>{chip}</span>}
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--ink-faint)",
            padding: "1px 6px",
            border: "1px solid var(--ink-faint)",
            borderRadius: 8,
          }}
        >
          {meta}
        </span>
      </div>
      {expanded && <div style={{ padding: "0 8px 10px" }}>{children}</div>}
    </div>
  );
}

function SubjectListItem({ name, active, count }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        margin: "2px 4px",
        borderRadius: 4,
        background: active ? "var(--accent-soft)" : "transparent",
        border: active ? "1.25px solid var(--accent)" : "1.25px solid transparent",
        fontFamily: "var(--hand)",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--ink-faint)",
          width: 10,
        }}
      >
        ≡
      </span>
      <span
        style={{
          fontFamily: "var(--hand-bold)",
          fontSize: 15,
          color: active ? "var(--accent)" : "var(--ink)",
        }}
      >
        {name}
      </span>
      <span style={{ flex: 1 }} />
      <span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 10 }}>
        {count}
      </span>
    </div>
  );
}

function AddRow({ label }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        margin: "4px 4px 0",
        borderRadius: 4,
        border: "1.25px dashed var(--ink-faint)",
        fontFamily: "var(--hand)",
        fontSize: 13,
        color: "var(--ink-soft)",
        cursor: "pointer",
      }}
    >
      {label}
    </div>
  );
}

// Faded builder content — the user is in the middle of editing User.
function FakeBuilder() {
  return (
    <div
      style={{
        border: "1.5px dashed var(--ink-faint)",
        borderRadius: 6,
        height: "100%",
        padding: 10,
        background: "var(--paper)",
        fontFamily: "var(--hand)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflow: "hidden",
      }}
    >
      {[
        ["id", "UUID", [".uuid()"]],
        ["name", "String", [".min", "2"]],
        ["age", "Number", [".int()", ".min 18"]],
        ["email", "Email", []],
        ["address", "Object", ["{ … }"]],
        ["orders", "Array<Order>", [".min 0", ".max 8"]],
      ].map(([k, t, mods]) => (
        <div
          key={k}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            border: "1.25px dashed var(--ink-faint)",
            borderRadius: 4,
            background: "#fff",
            fontFamily: "var(--mono)",
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--ink-faint)" }}>⋮⋮</span>
          <span>{k}</span>
          <span className="muted">:</span>
          <span
            style={{
              border: "1px solid var(--ink)",
              borderRadius: 3,
              padding: "0 5px",
              fontSize: 11,
            }}
          >
            {t}
          </span>
          {mods.map((m, i) => (
            <span
              key={i}
              style={{
                border: "1px solid var(--ink-faint)",
                borderRadius: 3,
                padding: "0 5px",
                fontSize: 10,
                color: "var(--ink-soft)",
              }}
            >
              {m}
            </span>
          ))}
          <span style={{ flex: 1 }} />
          <span
            style={{
              border: "1px dashed var(--ink-faint)",
              borderRadius: 3,
              padding: "0 5px",
              fontSize: 10,
              color: "var(--ink-faint)",
            }}
          >
            + mod
          </span>
        </div>
      ))}
      <div
        style={{
          padding: "4px 8px",
          border: "1.25px dashed var(--ink-faint)",
          borderRadius: 4,
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--ink-faint)",
          textAlign: "center",
        }}
      >
        + Add property
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Accordion zoom: shows all three sections expanded next to each other
// so the reader can compare what each holds.
function AccordionZoom() {
  return (
    <div style={{ position: "relative", width: 1100, height: 720 }}>
      <Anno x={20} y={6} w={500} ink>
        <strong>Accordion sections, side-by-side.</strong> In the real UI only one is open at a
        time; here we show all three so you can compare what lives in each.
      </Anno>

      {/* World */}
      <ColumnFrame x={20} y={60} title="① World" subtitle="set once, rarely revisit">
        <FieldRow label="seed">
          <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>42</span>
          <span style={{ flex: 1 }} />
          <span className="badge">🎲 randomize</span>
        </FieldRow>
        <FieldRow label="items">
          <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>3</span>
          <span className="muted" style={{ fontSize: 11 }}>
            min
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>10</span>
          <span className="muted" style={{ fontSize: 11 }}>
            max
          </span>
        </FieldRow>
        <FieldRow label="locale">
          <Pill>en-US</Pill>
        </FieldRow>
        <Note>determinism: same seed = same data, every reload.</Note>
      </ColumnFrame>

      {/* Subjects */}
      <ColumnFrame
        x={380}
        y={60}
        title="② Subjects"
        subtitle="source of truth · the data shapes"
        accent
      >
        <ListItem active>
          User <span className="muted">· 6 props</span>
        </ListItem>
        <ListItem>
          Order <span className="muted">· 4 props</span>
        </ListItem>
        <ListItem>
          Product <span className="muted">· 5 props</span>
        </ListItem>
        <DashedRow>+ Add subject</DashedRow>
        <Note>active subject's properties open in the Builder pane on the right.</Note>
        <div style={{ marginTop: 8 }}>
          <SubLabel>
            Relationships <span className="muted">· 2</span>
          </SubLabel>
          <RelLine left="User" rel="1:*" right="Order" />
          <RelLine left="Order" rel="*:*" right="Product" />
        </div>
      </ColumnFrame>

      {/* Schemas */}
      <ColumnFrame x={740} y={60} title="③ Schemas" subtitle="output shapes · API DTOs">
        <ListItem>
          UserResponseDto <span className="muted">→ User</span>
        </ListItem>
        <ListItem>
          OrderListItemDto <span className="muted">→ Order</span>
        </ListItem>
        <DashedRow>+ Add schema</DashedRow>
        <Note>each schema binds to a Subject and re-shapes its keys for output.</Note>
      </ColumnFrame>

      {/* Why this order */}
      <div
        style={{
          position: "absolute",
          left: 20,
          top: 540,
          right: 20,
          border: "1.5px dashed var(--accent)",
          borderRadius: 8,
          padding: 14,
          background: "rgba(210,74,42,0.04)",
        }}
      >
        <div style={{ fontFamily: "var(--hand-bold)", fontSize: 16, marginBottom: 8 }}>
          Why this order?
        </div>
        <div
          style={{
            display: "flex",
            gap: 24,
            fontFamily: "var(--hand)",
            fontSize: 14,
            color: "var(--ink-soft)",
          }}
        >
          <div style={{ flex: 1 }}>
            <strong style={{ color: "var(--accent)" }}>① World</strong> first because seed + size
            are the cheapest decisions and they govern everything below.
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ color: "var(--accent)" }}>② Subjects</strong> next because they're the
            source of truth — schemas can't exist without them.
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ color: "var(--accent)" }}>③ Schemas</strong> last because they're a{" "}
            <em>view</em> on subjects — defined later, when the user knows what API shape they want.
          </div>
        </div>
      </div>

      <Arrow from={{ x: 360, y: 200 }} to={{ x: 395, y: 200 }} curve={0} />
      <Arrow from={{ x: 720, y: 200 }} to={{ x: 755, y: 200 }} curve={0} />
    </div>
  );
}

function ColumnFrame({ x, y, title, subtitle, accent, children }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 340,
        height: 460,
        border: "1.5px solid var(--ink)",
        borderRadius: 6,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1.5px solid var(--ink)",
          background: accent ? "var(--accent-soft)" : "var(--paper)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--hand-bold)",
            fontSize: 18,
            color: accent ? "var(--accent)" : "var(--ink)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "var(--hand)",
            fontSize: 12,
            color: "var(--ink-soft)",
          }}
        >
          {subtitle}
        </div>
      </div>
      <div style={{ padding: 12, flex: 1, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        marginBottom: 4,
        border: "1.25px dashed var(--ink-faint)",
        borderRadius: 4,
        background: "var(--paper)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--ink-faint)",
          width: 56,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function ListItem({ active, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        marginBottom: 3,
        border: active ? "1.25px solid var(--accent)" : "1.25px dashed var(--ink-faint)",
        background: active ? "var(--accent-soft)" : "transparent",
        borderRadius: 4,
        fontFamily: "var(--hand-bold)",
        fontSize: 14,
        color: active ? "var(--accent)" : "var(--ink)",
      }}
    >
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-faint)" }}>≡</span>
      {children}
    </div>
  );
}

function DashedRow({ children }) {
  return (
    <div
      style={{
        padding: "6px 10px",
        marginTop: 6,
        border: "1.25px dashed var(--ink-faint)",
        borderRadius: 4,
        fontFamily: "var(--hand)",
        fontSize: 13,
        color: "var(--ink-soft)",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span
      style={{
        border: "1px solid var(--ink)",
        borderRadius: 10,
        padding: "0 8px",
        fontFamily: "var(--mono)",
        fontSize: 11,
      }}
    >
      {children}
    </span>
  );
}

function SubLabel({ children }) {
  return (
    <div
      style={{
        fontFamily: "var(--hand-bold)",
        fontSize: 12,
        color: "var(--ink-soft)",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        padding: "6px 4px 4px",
      }}
    >
      {children}
    </div>
  );
}

function RelLine({ left, rel, right }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        marginBottom: 3,
        fontFamily: "var(--mono)",
        fontSize: 11,
        border: "1.25px dashed var(--ink-faint)",
        borderRadius: 4,
      }}
    >
      <span>{left}</span>
      <span className="muted">—</span>
      <span style={{ color: "var(--accent)" }}>{rel}</span>
      <span className="muted">—</span>
      <span>{right}</span>
    </div>
  );
}

function Note({ children }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: "6px 8px",
        borderLeft: "2px solid var(--accent)",
        fontFamily: "var(--hand)",
        fontSize: 12,
        color: "var(--ink-soft)",
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

Object.assign(window, { GlobalOverview, AccordionZoom });
