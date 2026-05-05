// Direction A — extended states: World/Relationships, Custom generators,
// Modifier editor flow.

// ─── 1. World pane: subjects + relationships graph ───────────────
function StateRelationships() {
  const SubjCard = ({ x, y, w, h, name, props, accent, selected }) => (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        border:
          "1.5px " + (accent ? "solid" : "solid") + " " + (accent ? "var(--accent)" : "var(--ink)"),
        borderRadius: 6,
        background: "#fff",
        boxShadow: selected ? "0 0 0 3px rgba(210,74,42,0.18)" : "none",
      }}
    >
      <div
        style={{
          padding: "6px 10px",
          borderBottom: "1.25px dashed var(--ink)",
          background: accent ? "rgba(210,74,42,0.08)" : "#faf7ee",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontFamily: "var(--hand-bold)", fontSize: 16 }}>{name}</span>
        <span style={{ flex: 1 }} />
        <span className="badge">{props.length}</span>
      </div>
      <div style={{ padding: "4px 8px" }}>
        {props.map((p, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--mono)",
              fontSize: 11,
              padding: "2px 0",
              color: p.fk ? "var(--accent)" : "var(--ink)",
            }}
          >
            <span>
              {p.fk && "🔗 "}
              {p.k}
            </span>
            <span style={{ color: "var(--ink-soft)" }}>{p.t}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ position: "relative", width: 1200, height: 880 }}>
      {/* Builder pane — left */}
      <div style={{ position: "absolute", left: 24, top: 60, width: 540, height: 780 }}>
        <Pane tab="World · Subjects + Relationships">
          <WorldStrip />

          <div style={{ padding: "10px 12px", borderBottom: "1.25px dashed var(--ink)" }}>
            <div className="label-h" style={{ fontSize: 20 }}>
              Relationships
            </div>
            <div className="label-sub">Edges between subjects · expressed as foreign-key props</div>
          </div>

          {/* Edge list */}
          <div style={{ padding: "6px 8px" }}>
            <div className="row">
              <span
                className="pill"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  borderColor: "var(--accent)",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                }}
              >
                User
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                1 ──&lt; *
              </span>
              <span className="pill" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                Order
              </span>
              <span style={{ flex: 1 }} />
              <span className="badge">via Order.userId</span>
              <span className="muted" style={{ fontSize: 12 }}>
                ×
              </span>
            </div>
            <div className="row">
              <span className="pill" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                User
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                1 ── 1
              </span>
              <span className="pill" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                Address
              </span>
              <span style={{ flex: 1 }} />
              <span className="badge">via User.addressId</span>
              <span className="muted" style={{ fontSize: 12 }}>
                ×
              </span>
            </div>
            <div className="row">
              <span className="pill" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                Order
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                * ──&lt; *
              </span>
              <span className="pill" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                Product
              </span>
              <span style={{ flex: 1 }} />
              <span className="badge">via OrderItem (join)</span>
              <span className="muted" style={{ fontSize: 12 }}>
                ×
              </span>
            </div>
            <div style={{ padding: "8px" }}>
              <Btn primary>+ Add relationship</Btn>
            </div>
          </div>

          {/* Selected edge details */}
          <div
            style={{
              margin: "6px 12px",
              padding: 12,
              border: "1.5px dashed var(--accent)",
              borderRadius: 6,
              background: "#fff7f3",
            }}
          >
            <div style={{ fontFamily: "var(--hand-bold)", fontSize: 16 }}>
              User &nbsp;1 ──&lt; *&nbsp; Order
            </div>
            <div className="label-sub" style={{ marginBottom: 8 }}>
              Selected edge
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span className="muted" style={{ fontSize: 12 }}>
                cardinality
              </span>
              <Dropdown value="one-to-many" />
              <span className="muted" style={{ fontSize: 12 }}>
                foreign key on
              </span>
              <Dropdown value="Order.userId" hatched accent />
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span className="muted" style={{ fontSize: 12 }}>
                per User generate
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "2px 6px",
                  border: "1.25px dashed var(--ink)",
                  borderRadius: 4,
                  background: "#fff",
                }}
              >
                <Input value="orders" width={56} mono />
                <span className="muted">:</span>
                <TypeChip value="Array<Order>" />
                <ModPill name=".min" value="0" />
                <ModPill name=".max" value="8" />
                <ModPill name="cascade" value="delete" />
                <AddModChip />
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-faint)",
                fontFamily: "var(--mono)",
                marginBottom: 6,
              }}
            >
              ↑ same row UI as the schema builder — click any pill to edit inline.
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              Generates an Order's <span className="mono">userId</span> by sampling from the parent
              User pool — so the world stays referentially valid.
            </div>
          </div>
        </Pane>
      </div>

      {/* Right pane: visual graph */}
      <div style={{ position: "absolute", right: 24, top: 60, width: 600, height: 780 }}>
        <Pane tab="Subject Graph">
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <SubjCard
              x={40}
              y={70}
              w={170}
              h={140}
              name="User"
              accent
              selected
              props={[
                { k: "id", t: "UUID" },
                { k: "firstName", t: "String" },
                { k: "email", t: "Email" },
                { k: "addressId", t: "UUID", fk: true },
              ]}
            />
            <SubjCard
              x={350}
              y={50}
              w={170}
              h={140}
              name="Order"
              props={[
                { k: "id", t: "UUID" },
                { k: "userId", t: "UUID", fk: true },
                { k: "total", t: "Number" },
                { k: "createdAt", t: "Date" },
              ]}
            />
            <SubjCard
              x={350}
              y={260}
              w={170}
              h={120}
              name="Product"
              props={[
                { k: "id", t: "UUID" },
                { k: "sku", t: "String" },
                { k: "price", t: "Number" },
              ]}
            />
            <SubjCard
              x={40}
              y={320}
              w={170}
              h={120}
              name="Address"
              props={[
                { k: "id", t: "UUID" },
                { k: "street", t: "String" },
                { k: "city", t: "String" },
              ]}
            />
            <SubjCard
              x={200}
              y={500}
              w={180}
              h={120}
              name="OrderItem"
              props={[
                { k: "orderId", t: "UUID", fk: true },
                { k: "productId", t: "UUID", fk: true },
                { k: "qty", t: "Number" },
              ]}
            />

            {/* Edges */}
            <Arrow
              from={{ x: 210, y: 130 }}
              to={{ x: 350, y: 100 }}
              curve={-15}
              label="1──<*"
              color="var(--accent)"
            />
            <Arrow
              from={{ x: 130, y: 210 }}
              to={{ x: 130, y: 320 }}
              curve={20}
              label="1──1"
              color="var(--ink)"
            />
            <Arrow
              from={{ x: 435, y: 190 }}
              to={{ x: 320, y: 510 }}
              curve={-25}
              label="*──<*"
              dashed
              color="var(--ink)"
            />
            <Arrow
              from={{ x: 435, y: 310 }}
              to={{ x: 360, y: 540 }}
              curve={-15}
              dashed
              color="var(--ink)"
            />
          </div>
        </Pane>
      </div>

      {/* Annotations */}
      <Anno x={26} y={26} w={320} ink>
        <strong>World view · Relationships</strong>
        <br />
        Subjects don't live alone. Express foreign-key edges so generated data is referentially
        valid.
      </Anno>

      <Anno x={580} y={20} w={210}>
        <strong>Graph</strong> is read-only mirror of the edge list. Click a card to filter; drag to
        reposition (saved per project).
      </Anno>

      <Anno x={580} y={470} w={210} ink>
        <strong>Join tables</strong> (many-to-many) get auto-suggested when you mark both sides as{" "}
        <span className="mono">*──&lt;*</span>.
      </Anno>

      <Anno x={26} y={760} w={520}>
        <strong>How it generates:</strong> the world resolves dependencies topologically — User
        first, then Order with userId sampled from User.id pool. Cycles trigger an inline error.
      </Anno>

      <Arrow from={{ x: 580, y: 60 }} to={{ x: 540, y: 110 }} curve={-15} />
      <Arrow from={{ x: 580, y: 480 }} to={{ x: 480, y: 530 }} curve={-15} />
      <Arrow from={{ x: 350, y: 30 }} to={{ x: 280, y: 90 }} curve={-15} />
    </div>
  );
}

// ─── 2. Custom generator drawer (key-based functions) ────────────
function StateGenerator() {
  return (
    <div style={{ position: "relative", width: 1200, height: 760 }}>
      <div style={{ position: "absolute", left: 24, top: 60, width: 540, height: 660 }}>
        <Pane tab="Builder · User">
          <SubjectTabs active="User" />
          <div className="tree" style={{ padding: 6 }}>
            <PropRow keyName="id" type="UUID" />
            <PropRow keyName="firstName" type="String" modifiers={["gen: faker"]} />
            <PropRow keyName="email" type="Email" modifiers={["gen: from(firstName)"]} selected />
            <PropRow
              keyName="age"
              type="Number"
              modifiers={[
                [".min", 18],
                [".max", 99],
              ]}
            />
            <PropRow keyName="role" type="Enum" />
            <PropRow keyName="createdAt" type="Date" modifiers={["gen: heuristic"]} />
          </div>
        </Pane>
      </div>

      {/* Generator drawer for the selected row */}
      <div style={{ position: "absolute", right: 24, top: 60, width: 600, height: 660 }}>
        <Pane tab="Generator · User.email">
          <div style={{ padding: "12px 14px" }}>
            <div className="label-sub" style={{ fontSize: 12 }}>
              FIELD
            </div>
            <div className="label-h">
              User.email{" "}
              <span style={{ color: "var(--ink-faint)", fontFamily: "var(--mono)", fontSize: 14 }}>
                : z.string().email()
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: 4,
                marginTop: 14,
                marginBottom: 10,
                borderBottom: "1.25px dashed var(--ink)",
                paddingBottom: 8,
              }}
            >
              <span className="pill" style={{ fontSize: 12 }}>
                Auto
              </span>
              <span className="pill" style={{ fontSize: 12 }}>
                Faker
              </span>
              <span className="pill" style={{ fontSize: 12 }}>
                Fixed
              </span>
              <span
                className="pill"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  borderColor: "var(--accent)",
                  fontSize: 12,
                }}
              >
                Function ✓
              </span>
              <span style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
                (ctx, faker, world) =&gt; string
              </span>
            </div>

            <div
              style={{
                border: "1.5px solid var(--ink)",
                borderRadius: 6,
                background: "#1c1c1c",
                color: "#e8e8e8",
                padding: 10,
                fontFamily: "var(--mono)",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              <div>
                <span style={{ color: "#c8a464" }}>{"(ctx, faker) =>"}</span>
              </div>
              <div>
                &nbsp;&nbsp;
                <span style={{ color: "#a4d4ff" }}>
                  `${"$"}
                  {"{"}ctx.row.firstName.toLowerCase()
                </span>
                {"}."}
              </div>
              <div>
                &nbsp;&nbsp;
                <span style={{ color: "#a4d4ff" }}>
                  ${"{"}faker.helpers.arrayElement(["acme","mail"]){"}"}.com`
                </span>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-soft)" }}>
              <strong style={{ fontFamily: "var(--hand-bold)", color: "var(--ink)" }}>ctx</strong>{" "}
              exposes the row-in-progress, the parent subject, the world, and helpers.
            </div>

            {/* Available context */}
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                border: "1.25px dashed var(--ink)",
                borderRadius: 6,
                background: "var(--paper)",
              }}
            >
              <div style={{ fontFamily: "var(--hand-bold)", fontSize: 14, marginBottom: 4 }}>
                Available in ctx
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <Badge>ctx.row.firstName</Badge>
                <Badge>ctx.row.id</Badge>
                <Badge>ctx.index</Badge>
                <Badge>ctx.world.seed</Badge>
                <Badge>faker.*</Badge>
                <Badge>ref('Address')</Badge>
              </div>
            </div>

            {/* Live preview */}
            <div style={{ marginTop: 12 }}>
              <div className="label-sub" style={{ fontSize: 12 }}>
                PREVIEW · 4 samples
              </div>
              <pre
                style={{
                  margin: "4px 0 0",
                  padding: 10,
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  background: "#fbf9f1",
                  border: "1px dashed var(--ink)",
                  borderRadius: 4,
                }}
              >{`marlowe.acme.com
ana.mail.com
sven.acme.com
…`}</pre>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Btn primary>Save</Btn>
              <Btn>Reset to Auto</Btn>
              <span style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 11 }}>
                type-checked against <span className="mono">z.string().email()</span>
              </span>
            </div>
          </div>
        </Pane>
      </div>

      <Anno x={26} y={26} w={320} ink>
        <strong>Custom generators · key-based functions</strong>
        <br />
        Any property can swap "auto" for a sandboxed function with access to the row-in-progress.
      </Anno>
      <Anno x={580} y={20} w={220}>
        Tabs cycle generator strategy. <strong>Function</strong> mode opens a tiny code editor;
        saves to the schema as a property override.
      </Anno>
      <Anno x={580} y={400} w={220}>
        <strong>ctx.row</strong> only exposes fields generated <em>before</em> this one — the order
        panel (not shown) lets you reorder dependencies.
      </Anno>
      <Anno x={580} y={550} w={220} ink>
        Live preview re-runs whenever the function or seed changes — instant feedback on referential
        coherence.
      </Anno>

      <Arrow from={{ x: 580, y: 60 }} to={{ x: 530, y: 110 }} curve={-15} />
      <Arrow from={{ x: 580, y: 420 }} to={{ x: 540, y: 460 }} curve={-15} />
      <Arrow from={{ x: 580, y: 580 }} to={{ x: 530, y: 600 }} curve={-15} />
    </div>
  );
}

// — 6. Modifier flow: replace previous "popover" with the unified pill model.
function StateModifierFlow() {
  return (
    <div style={{ position: "relative", width: 1200, height: 480 }}>
      {/* Frame 1: rest */}
      <div style={{ position: "absolute", left: 24, top: 60, width: 540, height: 160 }}>
        <Pane tab="① Resting row — pills + “+ mod”">
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

      {/* Frame 2: hover a pill */}
      <div style={{ position: "absolute", left: 24, top: 250, width: 540, height: 200 }}>
        <Pane tab="② Hover — × to remove · click value to edit">
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
              No popovers. Pills are the entire control surface — they're the source of truth, the
              editor, and the remove handle in one.
            </div>
          </div>
        </Pane>
      </div>

      {/* Frame 3: floating add menu */}
      <div style={{ position: "absolute", right: 24, top: 60, width: 580, height: 390 }}>
        <Pane tab="③ + mod → floating add menu">
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
              top: 72,
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
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Input value="" placeholder="filter…" width={120} mono />
              <span style={{ fontSize: 11, color: "var(--ink-faint)", fontFamily: "var(--mono)" }}>
                z.number()
              </span>
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--ink-faint)",
                padding: "6px 4px 2px",
                fontFamily: "var(--mono)",
                letterSpacing: 1,
              }}
            >
              REFINEMENTS
            </div>
            {[".positive()", ".negative()", ".finite()", ".safe()", ".multipleOf(…)"].map((n) => (
              <div key={n} style={{ padding: "3px 6px", fontFamily: "var(--mono)", fontSize: 12 }}>
                {n}
              </div>
            ))}
            <div
              style={{
                fontSize: 10,
                color: "var(--ink-faint)",
                padding: "6px 4px 2px",
                fontFamily: "var(--mono)",
                letterSpacing: 1,
              }}
            >
              WRAPPERS
            </div>
            {[".nullable()", ".default(…)", ".describe(…)"].map((n) => (
              <div key={n} style={{ padding: "3px 6px", fontFamily: "var(--mono)", fontSize: 12 }}>
                {n}
              </div>
            ))}
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
              ↑↓ Enter Esc
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 14,
              right: 14,
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--ink-soft)",
              paddingTop: 8,
              borderTop: "1px dashed var(--ink-faint)",
            }}
          >
            z.number().int().min(18).max(99).optional()
          </div>
        </Pane>
      </div>

      <Anno x={26} y={26} w={420} ink>
        <strong>One model · pills only.</strong> No toggles. Every modifier (flag or value) is a
        pill with × and inline edit.
      </Anno>
      <Anno x={605} y={20} w={250}>
        <strong>+ mod</strong> is the only way to add. Floating menu is type-aware; already-applied
        items are hidden.
      </Anno>
    </div>
  );
}

Object.assign(window, { StateRelationships, StateGenerator, StateModifierFlow });
