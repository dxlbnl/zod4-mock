// Direction B — Breadcrumb drill-down (one level visible at a time).
// Like a finder column collapsed to a single column. Top: breadcrumb path
// User → address → geo. Below: just THAT level's properties. Tapping a
// drillable row pushes a new level and slides the view. A persistent
// "minimap" on the right keeps spatial context.

function DirectionB() {
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

          {/* Breadcrumb header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderBottom: "1.5px solid var(--ink)",
              background: "#fff",
            }}
          >
            <span className="btn" style={{ fontSize: 12, padding: "1px 6px" }}>
              ‹ back
            </span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 13,
                display: "flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              <span className="pill" style={{ background: "#fff", fontSize: 12 }}>
                User
              </span>
              <span className="muted">›</span>
              <span className="pill" style={{ background: "#fff", fontSize: 12 }}>
                address
              </span>
              <span className="muted">›</span>
              <span
                className="pill"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  borderColor: "var(--accent)",
                  fontSize: 12,
                }}
              >
                geo
              </span>
            </span>
            <span style={{ flex: 1 }} />
            <span className="badge">Object</span>
          </div>

          {/* Current-level header strip — what we're editing */}
          <div
            style={{
              padding: "14px 16px",
              background: "#faf7ee",
              borderBottom: "1.25px dashed var(--ink)",
            }}
          >
            <div className="label-h" style={{ fontSize: 26 }}>
              address.geo
            </div>
            <div className="label-sub">2 props · z.object · required</div>
          </div>

          {/* Just this level's rows */}
          <div style={{ padding: "8px 6px" }}>
            <PropRow keyName="lat" type="Number" modifiers={["min -90", "max 90"]} />
            <PropRow keyName="lng" type="Number" modifiers={["min -180", "max 180"]} />
            <div style={{ padding: "8px 8px 14px" }}>
              <Btn primary>+ Add property</Btn>
            </div>
          </div>

          {/* Footer "siblings" — peek at what's adjacent at parent level */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              borderTop: "1.25px dashed var(--ink)",
              padding: "10px 14px",
              background: "#fbf9f1",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>
              SIBLINGS in <span className="mono">address</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="pill" style={{ fontSize: 12 }}>
                street : String
              </span>
              <span className="pill" style={{ fontSize: 12 }}>
                city : String
              </span>
              <span className="pill" style={{ fontSize: 12 }}>
                zip : String
              </span>
              <span className="pill hatched" style={{ fontSize: 12, borderColor: "var(--accent)" }}>
                geo : Object ◄ here
              </span>
            </div>
          </div>
        </Pane>
      </div>

      {/* ───── Right column: minimap + code/data tabs ───── */}
      <div
        style={{
          position: "absolute",
          right: 24,
          top: 60,
          width: 420,
          height: 360,
        }}
      >
        <Pane tab="Minimap">
          <div
            style={{
              padding: "12px 14px",
              fontFamily: "var(--mono)",
              fontSize: 12,
              lineHeight: 1.7,
            }}
          >
            <div>User</div>
            <div style={{ paddingLeft: 14 }}>├ id : UUID</div>
            <div style={{ paddingLeft: 14 }}>├ firstName : String</div>
            <div style={{ paddingLeft: 14 }}>├ email : Email</div>
            <div style={{ paddingLeft: 14 }}>├ age : Number?</div>
            <div style={{ paddingLeft: 14 }}>├ address : Object</div>
            <div style={{ paddingLeft: 32 }}>│ ├ street</div>
            <div style={{ paddingLeft: 32 }}>│ ├ city</div>
            <div style={{ paddingLeft: 32 }}>│ ├ zip</div>
            <div
              style={{
                paddingLeft: 32,
                color: "var(--accent)",
                background: "rgba(210,74,42,0.08)",
              }}
            >
              │ └ <strong>geo : Object</strong> ◄ you are here
            </div>
            <div style={{ paddingLeft: 48, color: "var(--accent)" }}>│ ├ lat</div>
            <div style={{ paddingLeft: 48, color: "var(--accent)" }}>│ └ lng</div>
            <div style={{ paddingLeft: 14 }}>├ orders : Array</div>
            <div style={{ paddingLeft: 14 }}>└ role : Enum</div>
          </div>
        </Pane>
      </div>

      <div
        style={{
          position: "absolute",
          right: 24,
          top: 440,
          width: 420,
          height: 400,
        }}
      >
        <Pane tab="Code / Data">
          <div
            style={{
              display: "flex",
              gap: 4,
              borderBottom: "1.25px dashed var(--ink)",
              padding: "6px 8px",
              background: "#faf7ee",
            }}
          >
            <span
              className="pill"
              style={{
                background: "var(--accent)",
                color: "#fff",
                borderColor: "var(--accent)",
                fontSize: 12,
              }}
            >
              Code
            </span>
            <span className="pill" style={{ fontSize: 12 }}>
              Data
            </span>
            <span style={{ flex: 1 }} />
            <span className="muted" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
              scrolled to address.geo
            </span>
          </div>
          <CodeMock
            lines={[
              "address: z.object({",
              "  street: z.string(),",
              "  city:   z.string(),",
              "  zip:    z.string().regex(...),",
              "▸ geo:    z.object({",
              "    lat: z.number().min(-90).max(90),",
              "    lng: z.number().min(-180).max(180),",
              "  }),",
              "}),",
            ]}
          />
        </Pane>
      </div>

      {/* ───── Annotations ───── */}
      <Anno x={26} y={26} w={300} ink>
        <strong>Direction B · Breadcrumb Drill-Down</strong>
        <br />
        One level at a time. Best for deep / wide schemas where indentation gets unwieldy.
      </Anno>

      <Anno x={770} y={20} w={210}>
        <strong>Minimap</strong> always shows the full tree. Click any node to teleport.
      </Anno>

      <Anno x={300} y={88} w={220}>
        <strong>Breadcrumb path</strong> is the spine — every segment is clickable to jump up. Last
        is the active level.
      </Anno>

      <Anno x={740} y={170} w={180} ink>
        Big level title makes context unmistakable when you've drilled deep.
      </Anno>

      <Anno x={740} y={310} w={180}>
        <strong>Drillable types</strong> (Object, Array&lt;Object&gt;) push a new level — slide
        animation hints at hierarchy.
      </Anno>

      <Anno x={26} y={770} w={420} ink>
        <strong>Sibling chips</strong> at the bottom let you hop laterally without going up + down.{" "}
        <em>Optional but high-value.</em>
      </Anno>

      <Anno x={770} y={400} w={210}>
        Code view auto-scrolls and highlights the active subtree as you navigate.
      </Anno>

      {/* arrows */}
      <Arrow from={{ x: 770, y: 60 }} to={{ x: 730, y: 100 }} curve={-30} />
      <Arrow from={{ x: 380, y: 122 }} to={{ x: 320, y: 100 }} curve={-10} />
      <Arrow from={{ x: 740, y: 190 }} to={{ x: 670, y: 200 }} curve={-10} />
      <Arrow from={{ x: 740, y: 332 }} to={{ x: 660, y: 320 }} curve={-15} />
      <Arrow from={{ x: 446, y: 800 }} to={{ x: 460, y: 745 }} curve={20} />
      <Arrow from={{ x: 770, y: 440 }} to={{ x: 720, y: 470 }} curve={-15} />

      {/* Ring callout: "you are here" in minimap */}
      <Ring x={780} y={216} w={160} h={66} />
    </div>
  );
}

window.DirectionB = DirectionB;
