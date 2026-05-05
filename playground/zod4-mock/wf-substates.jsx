// Sub-states for the Subject/Property builder. Smaller artboards
// that show specific moments: empty state, adding first prop, mismatch
// warning, binding flow, array-of-objects, randomize seed.

// — 1. Empty state ————————————————————————————————
function StateEmpty() {
  return (
    <div style={{ position: "relative", width: 520, height: 380 }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <Pane tab="Builder · empty">
          <SubjectTabs active="" subjects={[]} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: 36,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 240,
                height: 90,
                border: "2px dashed var(--ink)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-soft)",
                fontFamily: "var(--hand)",
              }}
            >
              ( no subjects yet )
            </div>
            <div className="label-h" style={{ fontSize: 22 }}>
              Define your first subject
            </div>
            <div className="label-sub">
              A subject is your source-of-truth shape. Schemas anchor to it.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn primary>+ New subject</Btn>
              <Btn>Use template…</Btn>
            </div>
          </div>
        </Pane>
      </div>
      <Anno x={300} y={6} w={210}>
        Templates: <span className="mono">User · Invoice · Address · Order</span> — quick start.
      </Anno>
      <Arrow from={{ x: 410, y: 28 }} to={{ x: 350, y: 320 }} curve={40} />
    </div>
  );
}

// — 2. Adding first property (focus + tab flow) —————————
function StateAdding() {
  return (
    <div style={{ position: "relative", width: 560, height: 360 }}>
      <Pane tab="Add property — keyboard flow">
        <div style={{ padding: "14px 12px" }}>
          <div className="row" style={{ background: "rgba(210,74,42,0.06)" }}>
            <span className="grip">⋮⋮</span>
            <span
              className="input"
              style={{
                borderColor: "var(--accent)",
                minWidth: 110,
                fontFamily: "var(--mono)",
                fontSize: 12,
                position: "relative",
              }}
            >
              firstNa
              <span
                style={{
                  display: "inline-block",
                  width: 1,
                  height: 14,
                  background: "var(--accent)",
                  verticalAlign: "middle",
                  marginLeft: 1,
                  animation: "caret 1s steps(1) infinite",
                }}
              />
            </span>
            <span className="muted" style={{ fontFamily: "var(--mono)" }}>
              :
            </span>
            <Dropdown value="(type)" hatched />
            <span style={{ flex: 1 }} />
          </div>
          <div style={{ height: 14 }} />
          <div className="muted" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
            ↑↓ navigate · Tab → type · Enter → next row · Esc → discard
          </div>
        </div>
      </Pane>
      <Anno x={20} y={6} w={300} ink>
        <strong>Adding a property</strong> — focus lands on Key, Tab moves to Type. Enter commits
        and starts a new row. Power-user friendly.
      </Anno>
      <Anno x={300} y={210} w={220}>
        Type dropdown opens with Primitives at top, then Formats, then Complex.
      </Anno>
      <Arrow from={{ x: 320, y: 212 }} to={{ x: 270, y: 165 }} curve={-15} />
      <style>{`@keyframes caret { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

// — 3. Type-dropdown popover ——————————————————————
function StateDropdown() {
  const Section = ({ title, items, hot }) => (
    <div>
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-faint)",
          padding: "4px 12px",
          fontFamily: "var(--mono)",
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {items.map((i) => (
        <div
          key={i}
          style={{
            padding: "4px 14px",
            fontFamily: "var(--mono)",
            fontSize: 13,
            background: i === hot ? "var(--accent)" : "transparent",
            color: i === hot ? "#fff" : "var(--ink)",
          }}
        >
          {i}
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ position: "relative", width: 480, height: 460 }}>
      <Pane tab="Type · dropdown">
        <Section title="Primitives" items={["String", "Number", "Boolean", "Date"]} hot="String" />
        <div style={{ borderTop: "1px dashed var(--ink)" }} />
        <Section title="Formats (hoisted)" items={["UUID", "Email", "URL"]} />
        <div style={{ borderTop: "1px dashed var(--ink)" }} />
        <Section title="Complex" items={["Object →", "Array →", "Enum"]} />
        <div style={{ borderTop: "1px dashed var(--ink)" }} />
        <div style={{ padding: "6px 12px", display: "flex", gap: 6 }}>
          <Input value="" placeholder="filter…" width={120} mono />
          <span className="muted" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
            type-ahead
          </span>
        </div>
      </Pane>
      <Anno x={20} y={4} w={250} ink>
        <strong>Type picker</strong> — frequent formats are hoisted. Complex types push deeper
        config.
      </Anno>
    </div>
  );
}

// — 4. Array-of-objects expanded ——————————————————
function StateArray() {
  return (
    <div style={{ position: "relative", width: 560, height: 380 }}>
      <Pane tab="Array<Object>">
        <div className="tree" style={{ padding: 6 }}>
          <PropRow keyName="orders" type="Array<Object>" drillable expanded selected />
          <div className="nest">
            <div className="row" style={{ background: "rgba(0,0,0,0.04)" }}>
              <span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                element →
              </span>
              <TypeChip value="Object" />
              <span style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 12 }}>
                min
              </span>
              <Input value="1" width={32} mono />
              <span className="muted" style={{ fontSize: 12 }}>
                max
              </span>
              <Input value="5" width={32} mono />
            </div>
            <PropRow keyName="sku" type="String" />
            <PropRow keyName="price" type="Number" modifiers={["min 0"]} />
            <PropRow keyName="qty" type="Number" modifiers={["int", "min 1"]} />
            <div style={{ padding: "6px 8px" }}>
              <Btn>+ prop</Btn>
            </div>
          </div>
        </div>
      </Pane>
      <Anno x={20} y={6} w={300} ink>
        <strong>Array of object</strong> — element type pinned at top of the nest, with min/max
        length.
      </Anno>
      <Anno x={400} y={120} w={150}>
        Element type can itself be Array, Object, Enum — recursion all the way down.
      </Anno>
      <Arrow from={{ x: 400, y: 132 }} to={{ x: 320, y: 100 }} curve={-15} />
    </div>
  );
}

// — 5. Binding to subject + mismatch warning —————
function StateBinding() {
  return (
    <div style={{ position: "relative", width: 600, height: 420 }}>
      <Pane tab="Schema → Subject binding">
        <div style={{ padding: 12 }}>
          <div className="label-sub" style={{ fontSize: 12 }}>
            API Schema
          </div>
          <div className="label-h">UserResponseDto</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
            bound to <span className="mono">User</span>
          </div>

          <div className="row">
            <Input value="id" width={70} mono />
            <span className="muted">:</span>
            <TypeChip value="UUID" />
            <span style={{ flex: 1 }} />
            <Dropdown value="Bind →" accent />
            <Dropdown value="User.id" hatched accent />
          </div>
          <div className="row">
            <Input value="displayName" width={100} mono />
            <span className="muted">:</span>
            <TypeChip value="String" />
            <span style={{ flex: 1 }} />
            <Dropdown value="Auto" />
            <span className="muted" style={{ fontSize: 11 }}>
              (name heuristic)
            </span>
          </div>
          <div className="row" style={{ background: "rgba(201,138,26,0.08)" }}>
            <Input value="age" width={60} mono />
            <span className="muted">:</span>
            <TypeChip value="Number" />
            <span style={{ flex: 1 }} />
            <Dropdown value="Bind →" accent />
            <Dropdown value="User.email" hatched accent />
            <span style={{ color: "var(--warn)", fontSize: 16 }}>⚠</span>
          </div>
        </div>
      </Pane>
      <Anno x={20} y={6} w={280} ink>
        <strong>Three modes per field:</strong> Auto · Bind to Subject path · Fixed value.
      </Anno>
      <Anno x={20} y={250} w={260}>
        <strong>Type mismatch:</strong> Number ↔ Email. Inline ⚠ + amber row tint. Hover for "Number
        can't bind to z.string().email()".
      </Anno>
      <Arrow from={{ x: 290, y: 280 }} to={{ x: 540, y: 280 }} curve={-25} />
    </div>
  );
}

// — 6. Modifier popover ——————————————————————————
function StateModifierPopover() {
  return (
    <div style={{ position: "relative", width: 480, height: 360 }}>
      <Pane tab="Add modifier · floating menu">
        <div style={{ padding: 10 }}>
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
            margin: "4px 14px 14px",
            padding: 12,
            border: "1.5px dashed var(--accent)",
            borderRadius: 6,
            background: "#fff7f3",
          }}
        >
          <div style={{ fontFamily: "var(--hand-bold)", fontSize: 14, marginBottom: 8 }}>
            Add Number modifier
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <ModPill name=".positive()" />
            <ModPill name=".finite()" />
            <ModPill name=".safe()" />
            <ModPill name=".multipleOf" value="…" />
            <ModPill name=".nullable()" />
            <ModPill name=".default" value="…" />
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: "var(--ink-soft)",
              fontFamily: "var(--mono)",
            }}
          >
            type-ahead to filter · already-applied modifiers hidden
          </div>
        </div>
      </Pane>
      <Anno x={20} y={4} w={260} ink>
        <strong>Floating add menu</strong> — only valid Zod methods for the current type. Click to
        apply.
      </Anno>
    </div>
  );
}

function _StateModifierPopover_old() {
  return <div style={{ display: "none" }} />;
}

// — 7. Randomize seed ——————————————————————
function StateSeed() {
  return (
    <div style={{ position: "relative", width: 460, height: 220 }}>
      <Pane tab="World seed">
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              seed
            </span>
            <Input value="42" width={60} mono />
            <Btn>🎲 randomize</Btn>
            <span className="muted" style={{ fontSize: 11 }}>
              determinism check
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="muted" style={{ fontSize: 12 }}>
              items
            </span>
            <Input value="3" width={32} mono />
            <span className="muted">–</span>
            <Input value="10" width={32} mono />
          </div>
          <div className="muted" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
            Same seed + same schema = same output, byte-for-byte.
          </div>
        </div>
      </Pane>
      <Anno x={20} y={4} w={260} ink>
        <strong>World settings</strong> live above the subject builder; seed is the linchpin of
        determinism.
      </Anno>
    </div>
  );
}

Object.assign(window, {
  StateEmpty,
  StateAdding,
  StateDropdown,
  StateArray,
  StateBinding,
  StateModifierPopover,
  StateSeed,
});
