// Direction C — Miller Columns (side-by-side levels).
// Like macOS Finder columns: each click on a drillable property opens a
// new column to its right. Always shows the path levels you've traversed.
// Great for comparing siblings across levels, deep hierarchies, and
// visualizing the binding flow Subject → Schema.

function DirectionC() {
  const colW = 230;

  const Column = ({ title, subtitle, rows, active, accent, footer }) => (
    <div
      style={{
        width: colW,
        minWidth: colW,
        borderRight: "1.25px dashed var(--ink)",
        display: "flex",
        flexDirection: "column",
        background: active ? "#fff" : "#fbf9f1",
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          borderBottom: "1.25px dashed var(--ink)",
          background: accent ? "rgba(210,74,42,0.08)" : active ? "#faf7ee" : "#f3efe2",
        }}
      >
        <div style={{ fontFamily: "var(--hand-bold)", fontSize: 16 }}>{title}</div>
        <div className="label-sub" style={{ fontSize: 12 }}>
          {subtitle}
        </div>
      </div>
      <div style={{ flex: 1, padding: "4px 0" }}>
        {rows.map((r, i) => (
          <div
            key={i}
            className="row"
            style={{
              padding: "5px 8px",
              background: r.active ? "rgba(210,74,42,0.08)" : "transparent",
              borderBottom: "1px dashed #ddd9cb",
            }}
          >
            <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{r.key}</span>
            <span style={{ flex: 1 }} />
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: r.active ? "var(--accent)" : "var(--ink-soft)",
              }}
            >
              {r.type}
            </span>
            {r.drillable && (
              <span className="muted" style={{ fontSize: 14, marginLeft: 4 }}>
                ›
              </span>
            )}
          </div>
        ))}
      </div>
      {footer}
    </div>
  );

  return (
    <div style={{ position: "relative", width: 1200, height: 880 }}>
      {/* ───── Builder pane ───── */}
      <div style={{ position: "absolute", left: 24, top: 60, width: 1152, height: 540 }}>
        <Pane tab="Builder · Miller Columns">
          <SubjectTabs active="User" />
          <div style={{ display: "flex", height: 460, overflow: "hidden" }}>
            <Column
              title="User"
              subtitle="Subject · 7 props"
              rows={[
                { key: "id", type: "UUID" },
                { key: "firstName", type: "String" },
                { key: "email", type: "Email" },
                { key: "age", type: "Number?" },
                { key: "address", type: "Object", drillable: true, active: true },
                { key: "orders", type: "Array", drillable: true },
                { key: "role", type: "Enum" },
              ]}
              active
              footer={
                <div style={{ padding: 8 }}>
                  <Btn>+ prop</Btn>
                </div>
              }
            />
            <Column
              title="address"
              subtitle="Object · 4 props"
              rows={[
                { key: "street", type: "String" },
                { key: "city", type: "String" },
                { key: "zip", type: "String" },
                { key: "geo", type: "Object", drillable: true, active: true },
              ]}
              active
              footer={
                <div style={{ padding: 8 }}>
                  <Btn>+ prop</Btn>
                </div>
              }
            />
            <Column
              title="geo"
              subtitle="Object · 2 props"
              accent
              rows={[
                { key: "lat", type: "Number", active: true },
                { key: "lng", type: "Number" },
              ]}
              active
              footer={
                <div style={{ padding: 8 }}>
                  <Btn>+ prop</Btn>
                </div>
              }
            />
            {/* Detail column for the selected leaf */}
            <div style={{ flex: 1, padding: "12px 16px", background: "#fff" }}>
              <div className="label-sub" style={{ fontSize: 12, marginBottom: 4 }}>
                EDITING
              </div>
              <div className="label-h">User.address.geo.lat</div>
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  type
                </span>
                <Dropdown value="Number" />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <ModPill name=".int()" />
                <ModPill name=".min" value="-90" />
                <ModPill name=".max" value="90" />
                <AddModChip />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <span className="muted" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
                  add via floating menu →
                </span>
                <ModPill name=".optional()" />
                <ModPill name=".nullable()" />
              </div>

              <hr style={{ border: 0, borderTop: "1.25px dashed var(--ink)", margin: "18px 0" }} />

              <div className="label-sub" style={{ fontSize: 12, marginBottom: 6 }}>
                BIND TO SUBJECT
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <Dropdown value="Auto" />
                <span className="muted" style={{ fontSize: 11 }}>
                  or
                </span>
                <Dropdown value="Bind path…" accent hatched />
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--accent)" }}>
                ⚠ inferred from name "lat"
              </div>
            </div>
          </div>
        </Pane>
      </div>

      {/* ───── Code pane ───── */}
      <div style={{ position: "absolute", left: 24, top: 620, width: 564, height: 220 }}>
        <Pane tab="Code">
          <CodeMock
            lines={[
              "address: z.object({",
              "  street: z.string(),",
              "  city:   z.string(),",
              "  zip:    z.string().regex(...),",
              "  geo: z.object({",
              "▸   lat: z.number().min(-90).max(90),",
              "    lng: z.number().min(-180).max(180),",
              "  }),",
              "}),",
            ]}
          />
        </Pane>
      </div>

      {/* ───── Data pane ───── */}
      <div style={{ position: "absolute", right: 24, top: 620, width: 564, height: 220 }}>
        <Pane tab="Data">
          <JsonMock
            lines={[
              "{",
              "  …",
              "  address: {",
              "    street: '441 Pine St',",
              "    city:   'Boise',",
              "    zip:    '83702',",
              "    geo: { lat: 43.61, lng: -116.20 }",
              "  }",
              "}",
            ]}
          />
        </Pane>
      </div>

      {/* ───── Annotations ───── */}
      <Anno x={26} y={26} w={320} ink>
        <strong>Direction C · Miller Columns</strong>
        <br />
        Each drilled level opens a new column to the right. Path is the columns themselves.
      </Anno>

      <Anno x={930} y={20} w={230}>
        Last column is always the <strong>detail editor</strong> for the selected leaf — modifiers,
        optional/nullable, bind config.
      </Anno>

      <Anno x={20} y={170} w={170}>
        Active row in each column is hatched + carries forward as title of the next column.
      </Anno>

      <Anno x={500} y={130} w={170}>
        Accent column = <em>currently focused</em> object you're editing into.
      </Anno>

      <Anno x={930} y={310} w={230}>
        <strong>Bind path</strong> uses dot-notation: <span className="mono">address.geo.lat</span>.
        Inline ⚠ flags type mismatch with the bound subject field.
      </Anno>

      <Anno x={26} y={830} w={350} ink>
        <strong>Tradeoff:</strong> needs ≥1100px to show 3+ columns. Collapses to Direction B
        (drill-down) under 900px.
      </Anno>

      {/* Arrows */}
      <Arrow from={{ x: 350, y: 50 }} to={{ x: 360, y: 100 }} curve={-15} />
      <Arrow from={{ x: 928, y: 50 }} to={{ x: 870, y: 110 }} curve={-30} />
      <Arrow from={{ x: 195, y: 200 }} to={{ x: 220, y: 220 }} curve={-10} />
      <Arrow from={{ x: 510, y: 165 }} to={{ x: 540, y: 200 }} curve={-15} />
      <Arrow from={{ x: 928, y: 350 }} to={{ x: 880, y: 430 }} curve={-25} />
    </div>
  );
}

window.DirectionC = DirectionC;
