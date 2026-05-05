// Direction A — Indented tree with vertical guide lines (classic).
// The whole subject tree is visible at once; nesting is shown by
// indentation + dashed L-shape guides; deep nesting handled by
// recursive PropRows. Binding: inline "← bind" dropdown next to property.

function DirectionA() {
  // Annotations are positioned absolutely against the artboard wrapper.
  return (
    <div style={{ position: "relative", width: 1200, height: 880 }}>
      {/* ───── Builder pane ───── */}
      <div
        style={{
          position: "absolute",
          left: 24,
          top: 60,
          width: 720,
          height: 780,
        }}
      >
        <Pane tab="Builder">
          <SubjectTabs active="User" />

          {/* Subject header */}
          <div
            style={{
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderBottom: "1.5px solid var(--ink)",
              background: "#fff",
            }}
          >
            <span className="label-h">Subject</span>
            <Input value="User" width={130} mono />
            <span className="muted" style={{ fontSize: 12 }}>
              defineSubjectType()
            </span>
            <span style={{ flex: 1 }} />
            <span className="badge soft">7 props</span>
          </div>

          {/* Tree of properties */}
          <div className="tree" style={{ padding: "6px 6px 0 6px" }}>
            <PropRow keyName="id" type="UUID" />
            <PropRow
              keyName="firstName"
              type="String"
              modifiers={[
                [".min", 1],
                [".max", 40],
              ]}
            />
            <PropRow keyName="email" type="Email" />
            <PropRow
              keyName="age"
              type="Number"
              modifiers={[".int()", [".min", 18], [".max", 99], ".optional()"]}
            />

            {/* Nested object: address */}
            <PropRow keyName="address" type="Object" selected drillable expanded />
            <div className="nest">
              <PropRow keyName="street" type="String" />
              <PropRow keyName="city" type="String" />
              <PropRow keyName="zip" type="String" modifiers={[[".regex", "/^…$/"]]} />
              <PropRow keyName="geo" type="Object" drillable expanded />
              <div className="nest">
                <PropRow keyName="lat" type="Number" />
                <PropRow keyName="lng" type="Number" />
              </div>
              <div style={{ padding: "4px 8px 8px" }}>
                <Btn>+ Add property</Btn>
              </div>
            </div>

            {/* Array of objects: tags */}
            <PropRow keyName="orders" type="Array<Object>" drillable expanded />
            <div className="nest">
              <div className="row" style={{ background: "rgba(0,0,0,0.03)" }}>
                <span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                  element →
                </span>
                <TypeChip value="Object" />
                <span className="muted" style={{ fontSize: 12 }}>
                  min 1, max 5
                </span>
              </div>
              <PropRow keyName="sku" type="String" />
              <PropRow keyName="price" type="Number" />
              <PropRow keyName="qty" type="Number" modifiers={[".int()", [".min", 1]]} />
              <div style={{ padding: "4px 8px 8px" }}>
                <Btn>+ Add property</Btn>
              </div>
            </div>

            <PropRow keyName="role" type="Enum<admin | user>" />

            <div style={{ padding: "8px 8px 14px" }}>
              <Btn primary>+ Add property</Btn>
            </div>
          </div>
        </Pane>
      </div>

      {/* ───── Code pane ───── */}
      <div
        style={{
          position: "absolute",
          right: 24,
          top: 60,
          width: 420,
          height: 380,
        }}
      >
        <Pane tab="Code">
          <CodeMock
            lines={[
              "const User = defineSubjectType('User',",
              "  z.object({",
              "    id: z.string().uuid(),",
              "    firstName: z.string().min(1).max(40),",
              "    email: z.string().email(),",
              "    age: z.number().int().min(18).max(99)",
              "         .optional(),",
              "    address: z.object({",
              "      street: z.string(),",
              "      city: z.string(),",
              "      zip: z.string().regex(...),",
              "      geo: z.object({",
              "        lat: z.number(),",
              "        lng: z.number(),",
              "      }),",
              "    }),",
              "    orders: z.array(z.object({",
              "      sku: z.string(),",
              "      price: z.number(),",
              "      qty: z.number().int().min(1),",
              "    })).min(1).max(5),",
              "    role: z.enum(['admin','user']),",
              "  }),",
              ");",
            ]}
          />
        </Pane>
      </div>

      {/* ───── Data pane ───── */}
      <div
        style={{
          position: "absolute",
          right: 24,
          top: 460,
          width: 420,
          height: 380,
        }}
      >
        <Pane tab="Data">
          <JsonMock
            lines={[
              "[",
              "  {",
              "    id: '7c1f…-a09b',",
              "    firstName: 'Marlowe',",
              "    email: 'marlowe@…',",
              "    age: 34,",
              "    address: {",
              "      street: '441 Pine St',",
              "      city: 'Boise',",
              "      zip: '83702',",
              "      geo: { lat: 43.61, lng: -116.20 }",
              "    },",
              "    orders: [",
              "      { sku:'A-1', price: 19, qty: 2 },",
              "      { sku:'A-9', price:  4, qty: 1 },",
              "    ],",
              "    role: 'user'",
              "  },",
              "  …",
              "]",
            ]}
          />
        </Pane>
      </div>

      {/* ───── Annotations ───── */}
      <Anno x={770} y={20} w={200}>
        <strong>Whole tree visible.</strong> No drilling, no hiding — best for shallow schemas,
        scanning, and copy/paste edits.
      </Anno>

      <Anno x={300} y={6} w={210}>
        <strong>Subject tabs</strong> — switch between schemas; <em>+ Subject</em> creates a new
        one.
      </Anno>

      <Anno x={740} y={300} w={170} ink>
        Selected row hatched in <span style={{ color: "var(--accent)" }}>accent</span>; type chip
        echoes color.
      </Anno>

      <Anno x={740} y={420} w={170}>
        <strong>Dashed L-guides</strong> link parent to children — readable up to ~5 deep.
      </Anno>

      <Anno x={740} y={560} w={170} ink>
        <strong>Array of Object</strong> — first row is a fixed
        <span className="mono"> element →</span> meta-row; below are the element's own props.
      </Anno>

      <Anno x={740} y={730} w={170}>
        Modifiers as inline pills. Click to edit; long press for popover with full options.
      </Anno>

      <Anno x={26} y={26} w={260} ink>
        <strong>Direction A · Indented Tree</strong>
        <br />
        Best when schemas are read top-to-bottom and depth is moderate (≤4).
      </Anno>

      {/* arrows */}
      <Arrow from={{ x: 770, y: 60 }} to={{ x: 730, y: 110 }} curve={-30} />
      <Arrow from={{ x: 510, y: 26 }} to={{ x: 470, y: 64 }} curve={20} />
      <Arrow from={{ x: 740, y: 320 }} to={{ x: 690, y: 328 }} curve={-10} />
      <Arrow from={{ x: 740, y: 440 }} to={{ x: 660, y: 450 }} curve={-10} />
      <Arrow from={{ x: 740, y: 580 }} to={{ x: 660, y: 600 }} curve={-10} />
      <Arrow from={{ x: 740, y: 750 }} to={{ x: 670, y: 720 }} curve={-15} />
    </div>
  );
}

window.DirectionA = DirectionA;
