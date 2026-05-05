// Modifier add / remove — unified pill model.
// All modifiers are pills. Value-mods (.min(18)) have inline-editable values.
// Flag-mods (.int()) are name-only. ALL pills have hover-×. The only way to
// add is the floating "+ mod" menu.

function StateModifierAddRemove() {
  return (
    <div style={{ position: "relative", width: 1200, height: 720 }}>
      {/* Frame 1: rest */}
      <div style={{ position: "absolute", left: 24, top: 60, width: 560, height: 140 }}>
        <Pane tab="① Rest — pills + “+ mod” chip">
          <div style={{ padding: 12 }}>
            <div className="row">
              <span className="grip">⋮⋮</span>
              <Input value="age" width={60} mono />
              <span className="muted">:</span>
              <TypeChip value="Number" />
              <ModPill name=".int()" />
              <ModPill name=".min" value="18" />
              <ModPill name=".max" value="99" />
              <ModPill name=".optional()" />
              <AddModChip />
            </div>
          </div>
        </Pane>
      </div>

      {/* Frame 2: hover a pill — × appears, value highlighted */}
      <div style={{ position: "absolute", left: 24, top: 230, width: 560, height: 170 }}>
        <Pane tab="② Hover a pill — × to remove">
          <div style={{ padding: 12 }}>
            <div className="row">
              <Input value="age" width={60} mono />
              <span className="muted">:</span>
              <TypeChip value="Number" />
              <ModPill name=".int()" />
              <ModPill name=".min" value="18" accent showRemove />
              <ModPill name=".max" value="99" />
              <ModPill name=".optional()" />
              <AddModChip />
            </div>
            <div style={{ padding: "8px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
              Click <span className="mono">×</span> → remove the pill. Click the value chip{" "}
              <span className="mono">18</span> → inline edit.
            </div>
          </div>
        </Pane>
      </div>

      {/* Frame 3: inline edit */}
      <div style={{ position: "absolute", left: 24, top: 430, width: 560, height: 170 }}>
        <Pane tab="③ Click value — inline number edit">
          <div style={{ padding: 12 }}>
            <div className="row">
              <Input value="age" width={60} mono />
              <span className="muted">:</span>
              <TypeChip value="Number" />
              <ModPill name=".int()" />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "1px 4px 1px 6px",
                  border: "1.25px solid var(--accent)",
                  borderRadius: 3,
                  background: "#fff7f3",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--accent)",
                }}
              >
                <span>.min</span>
                <span style={{ color: "var(--ink-faint)" }}>=</span>
                <span
                  style={{
                    background: "#fff",
                    border: "1.25px solid var(--accent)",
                    borderRadius: 2,
                    padding: "0 3px",
                    minWidth: 20,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  21
                  <span
                    style={{
                      display: "inline-block",
                      width: 1,
                      height: 11,
                      background: "var(--accent)",
                      marginLeft: 1,
                      animation: "caret 1s steps(1) infinite",
                    }}
                  />
                </span>
              </span>
              <ModPill name=".max" value="99" />
              <ModPill name=".optional()" />
              <AddModChip />
            </div>
            <div style={{ padding: "8px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
              Type a number. Enter commits, Esc reverts. No popover, no dialog.
            </div>
          </div>
          <style>{`@keyframes caret { 50% { opacity: 0; } }`}</style>
        </Pane>
      </div>

      {/* Frame 4: floating add menu */}
      <div style={{ position: "absolute", right: 24, top: 60, width: 580, height: 540 }}>
        <Pane tab="④ Click + mod — floating add menu">
          <div style={{ padding: 12 }}>
            <div className="row">
              <Input value="age" width={60} mono />
              <span className="muted">:</span>
              <TypeChip value="Number" accent />
              <ModPill name=".int()" />
              <ModPill name=".min" value="18" />
              <ModPill name=".max" value="99" />
              <ModPill name=".optional()" />
              <AddModChip active />
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 320,
              top: 70,
              width: 230,
              border: "1.5px solid var(--accent)",
              borderRadius: 6,
              background: "#fff",
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
              padding: 8,
            }}
          >
            <div
              style={{
                padding: "0 4px 6px",
                borderBottom: "1px dashed var(--accent)",
                fontSize: 11,
                color: "var(--ink-faint)",
                fontFamily: "var(--mono)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Input value="" placeholder="filter…" width={120} mono />
              <span>z.number()</span>
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--ink-faint)",
                padding: "6px 4px 2px",
                fontFamily: "var(--mono)",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Refinements
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
                { n: ".positive()", d: "> 0" },
                { n: ".negative()", d: "< 0" },
                { n: ".finite()", d: "no Infinity" },
                { n: ".safe()", d: "within Number.MAX_SAFE_INTEGER" },
                { n: ".multipleOf(…)", d: "step", val: true },
              ].map((m, i) => (
                <div
                  key={i}
                  style={{
                    padding: "4px 6px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    borderRadius: 3,
                    background: i === 0 ? "rgba(210,74,42,0.08)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{m.n}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: "var(--ink-faint)" }}>{m.d}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--ink-faint)",
                padding: "6px 4px 2px",
                fontFamily: "var(--mono)",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              Wrappers
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
                { n: ".nullable()", d: "allow null" },
                { n: ".default(…)", d: "fallback value" },
                { n: ".describe(…)", d: "metadata" },
              ].map((m, i) => (
                <div
                  key={i}
                  style={{
                    padding: "4px 6px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{m.n}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, color: "var(--ink-faint)" }}>{m.d}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                padding: "6px 4px 0",
                borderTop: "1px dashed var(--ink)",
                marginTop: 4,
                fontSize: 10,
                color: "var(--ink-faint)",
                fontFamily: "var(--mono)",
              }}
            >
              ↑↓ navigate · Enter to add · Esc to close
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              right: 14,
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--ink-soft)",
              paddingTop: 8,
              borderTop: "1px dashed var(--ink-faint)",
            }}
          >
            Compiles to:{" "}
            <span style={{ color: "var(--ink)" }}>z.number().int().min(18).max(99).optional()</span>
          </div>
        </Pane>
      </div>

      {/* Annotations */}
      <Anno x={26} y={26} w={420} ink>
        <strong>One model · pills only.</strong> No toggles, no checkboxes. Every modifier is a
        pill, every add goes through the floating menu.
      </Anno>
      <Anno x={605} y={20} w={280}>
        <strong>Floating menu</strong> — appears anchored under the{" "}
        <span className="mono">+ mod</span> chip; type-aware list; already-applied items hidden.
      </Anno>
      <Anno x={605} y={530} w={280} ink>
        Live z-string preview anchors the user — what compiles to what is never a mystery.
      </Anno>

      <Arrow from={{ x: 605, y: 60 }} to={{ x: 540, y: 100 }} curve={-15} />
      <Arrow from={{ x: 605, y: 560 }} to={{ x: 540, y: 580 }} curve={-15} />
    </div>
  );
}

window.StateModifierAddRemove = StateModifierAddRemove;
