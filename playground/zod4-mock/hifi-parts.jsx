// hifi-parts.jsx — building blocks for the hi-fi playground.

const Icon = ({ name, size = 14 }) => {
  const paths = {
    chev: <polyline points="9 6 15 12 9 18" />,
    chevDown: <polyline points="6 9 12 15 18 9" />,
    plus: (
      <>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </>
    ),
    x: (
      <>
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="6" y1="18" x2="18" y2="6" />
      </>
    ),
    grip: (
      <>
        <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    play: <polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none" />,
    refresh: (
      <>
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        <path d="M3 21v-5h5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.7-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.7 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.7.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.7V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
      </>
    ),
    expand: (
      <>
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </>
    ),
    warn: (
      <>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>
    ),
    dice: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
        <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
};

// ── TopBar ────────────────────────────────────────────────────────
function TopBar({ active = "Builder", onTheme, theme }) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-logo">z</div>
        <div>
          <div className="brand-name">zod4-mock</div>
        </div>
        <div className="brand-sub">v0.4.2</div>
      </div>
      <div className="tab-strip">
        {["Builder", "Schemas", "Generators"].map((t) => (
          <div key={t} className="tab" aria-selected={t === active}>
            <span className="dot" />
            {t}
          </div>
        ))}
      </div>
      <div className="top-actions">
        <div className="seg">
          <button aria-pressed={true}>auto-run</button>
          <button>manual</button>
        </div>
        <button className="btn ghost" title="Regenerate">
          <Icon name="refresh" size={13} />
        </button>
        <button className="btn">
          <Icon name="play" size={11} /> Run
        </button>
        <button className="btn ghost" onClick={onTheme} title="Toggle theme">
          <Icon name="sun" size={13} />
        </button>
        <span className="kbd">⌘ K</span>
      </div>
    </div>
  );
}

// ── Left rail ─────────────────────────────────────────────────────
function LeftRail({ activeSubject = "User" }) {
  return (
    <aside className="rail">
      {/* World — collapsed-ish but shown for hi-fi */}
      <section className="accordion-section" data-open="false">
        <div className="accordion-head">
          <span className="chev">▶</span>
          <span className="accordion-title">World</span>
          <span className="accordion-meta">seed 42</span>
        </div>
      </section>

      {/* Subjects — open, primary */}
      <section
        className="accordion-section"
        data-open="true"
        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        <div className="accordion-head">
          <span className="chev">▶</span>
          <span className="accordion-title">Subjects</span>
          <span className="accordion-meta">3</span>
        </div>
        <div className="accordion-body" style={{ flex: 1, overflow: "auto" }}>
          <div className="subj-list">
            <div className="subj" aria-selected={activeSubject === "User"}>
              <span className="grip">⋮⋮</span>
              <span className="name">User</span>
              <span className="count">6</span>
            </div>
            <div className="subj" aria-selected={activeSubject === "Order"}>
              <span className="grip">⋮⋮</span>
              <span className="name">Order</span>
              <span className="count">4</span>
              <span className="badge">FK→User</span>
            </div>
            <div className="subj" aria-selected={activeSubject === "Product"}>
              <span className="grip">⋮⋮</span>
              <span className="name">Product</span>
              <span className="count">5</span>
            </div>
            <div className="add-row">
              <Icon name="plus" size={11} /> add subject
            </div>
          </div>

          <div className="sub-h">
            Relationships <span className="h-count">· 2</span>
            <span className="h-add">
              <Icon name="plus" size={11} />
            </span>
          </div>
          <div className="rel">
            <span className="from">User</span>
            <span className="arr">─</span>
            <span className="card">1:*</span>
            <span className="arr">─</span>
            <span className="to">Order</span>
          </div>
          <div className="rel">
            <span className="from">Order</span>
            <span className="arr">─</span>
            <span className="card">*:*</span>
            <span className="arr">─</span>
            <span className="to">Product</span>
          </div>
        </div>
      </section>

      {/* Schemas */}
      <section className="accordion-section" data-open="false">
        <div className="accordion-head">
          <span className="chev">▶</span>
          <span className="accordion-title">Schemas</span>
          <span className="accordion-meta">2</span>
        </div>
      </section>
    </aside>
  );
}

// ── Modifier primitives ───────────────────────────────────────────
function Mod({ name, value, warn, removable }) {
  return (
    <span className="mod" data-warn={warn || undefined}>
      <span>{name}</span>
      {value !== undefined && (
        <>
          <span className="eq">=</span>
          <span className="val">{value}</span>
        </>
      )}
      {removable && <span className="x">×</span>}
    </span>
  );
}
function AddMod({ active, onClick }) {
  return (
    <span className="add-mod" data-active={active || undefined} onClick={onClick}>
      + mod
    </span>
  );
}
function TypeChip({ value, active }) {
  return (
    <span className="type-chip" data-active={active || undefined}>
      {value} <span className="chev">▾</span>
    </span>
  );
}

// ── Builder row ───────────────────────────────────────────────────
function Row({ keyName, type, mods = [], indent = 0, selected, warn, addMenuOpen }) {
  return (
    <div
      className="row"
      data-selected={selected || undefined}
      data-warn={warn || undefined}
      style={{ "--ind": 12 + indent * 18 + "px" }}
    >
      <span className="grip">⋮⋮</span>
      <input className="key mono" defaultValue={keyName} />
      <span className="colon">:</span>
      <TypeChip value={type} active={selected} />
      {mods.map((m, i) =>
        Array.isArray(m) ? (
          <Mod
            key={i}
            name={m[0]}
            value={m[1]}
            warn={m[2] === "warn"}
            removable={selected && i === 0}
          />
        ) : (
          <Mod key={i} name={m} warn={m === "⚠ unbound"} />
        ),
      )}
      <AddMod active={addMenuOpen} />
      <span className="spacer" />
      {warn && (
        <span style={{ color: "var(--warn)" }}>
          <Icon name="warn" size={13} />
        </span>
      )}
    </div>
  );
}

function GroupHead({ name, type, indent = 0 }) {
  return (
    <div className="group-head" style={{ paddingLeft: 12 + indent * 18 }}>
      <span className="chev">▾</span>
      <span className="gname">{name}</span>
      <span className="colon">:</span>
      <TypeChip value={type} />
    </div>
  );
}

// ── Builder pane ──────────────────────────────────────────────────
function BuilderPane({ showFloatMenu }) {
  return (
    <section className="pane builder">
      <div className="pane-head">
        <span className="pane-title">
          Builder · <span className="accent">User</span>
        </span>
        <span className="pane-sub">z.object()</span>
        <div className="pane-actions">
          <button className="icon-btn" title="Settings">
            <Icon name="settings" size={13} />
          </button>
          <button className="icon-btn" title="Expand">
            <Icon name="expand" size={13} />
          </button>
        </div>
      </div>
      <div className="pane-body" style={{ position: "relative" }}>
        <div className="tree">
          <Row keyName="id" type="UUID" mods={[".uuid()"]} />
          <Row
            keyName="firstName"
            type="String"
            mods={[
              [".min", 1],
              [".max", 40],
            ]}
          />
          <Row keyName="email" type="Email" mods={[".email()"]} />
          <Row
            keyName="age"
            type="Number"
            selected
            addMenuOpen={showFloatMenu}
            mods={[".int()", [".min", 18], [".max", 99], ".optional()"]}
          />

          <GroupHead name="address" type="Object" />
          <Row indent={1} keyName="street" type="String" mods={[[".min", 2]]} />
          <Row indent={1} keyName="city" type="String" />
          <Row indent={1} keyName="zip" type="String" mods={[[".regex", "/^…$/"]]} />
          <Row indent={1} keyName="country" type="Enum" mods={["US", "CA", "UK"]} warn />

          <GroupHead name="orders" type="Array<Order>" />
          <div
            className="row"
            style={{
              paddingLeft: 30,
              color: "var(--ink-2)",
              fontFamily: "JetBrains Mono",
              fontSize: 11,
            }}
          >
            <span>cardinality:</span>
            <Mod name=".min" value="0" />
            <Mod name=".max" value="8" />
            <AddMod />
          </div>

          <Row keyName="role" type="Enum" mods={["admin", "user", "guest", '.default("user")']} />
          <Row keyName="createdAt" type="Date" mods={[".heuristic()"]} />

          <div className="add-prop">
            <Icon name="plus" size={11} /> add property &nbsp;<span className="kbd">⌘ ⏎</span>
          </div>
        </div>

        {showFloatMenu && (
          <div className="float-menu" style={{ left: 540, top: 132 }}>
            <div className="search">
              <input placeholder="filter…" />
              <span className="scope">z.number()</span>
            </div>
            <div className="grp">Refinements</div>
            <div className="item" data-active>
              <span>.positive()</span>
              <span className="desc">&gt; 0</span>
            </div>
            <div className="item">
              <span>.negative()</span>
              <span className="desc">&lt; 0</span>
            </div>
            <div className="item">
              <span>.finite()</span>
              <span className="desc">no Infinity</span>
            </div>
            <div className="item">
              <span>.safe()</span>
              <span className="desc">SAFE_INTEGER</span>
            </div>
            <div className="item">
              <span>.multipleOf(…)</span>
              <span className="desc">step</span>
            </div>
            <div className="grp">Wrappers</div>
            <div className="item">
              <span>.nullable()</span>
              <span className="desc">allow null</span>
            </div>
            <div className="item">
              <span>.default(…)</span>
              <span className="desc">fallback</span>
            </div>
            <div className="item">
              <span>.describe(…)</span>
              <span className="desc">metadata</span>
            </div>
            <div className="foot">
              <span>↑↓ nav</span>
              <span>⏎ add</span>
              <span>esc close</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Code pane (TS-ish syntax) ─────────────────────────────────────
function CodePane() {
  // Each line: array of [class, text]
  const L = [
    [["comment", "// User subject — auto-generated by zod4-mock"]],
    [
      ["keyword", "const"],
      ["", " "],
      ["fn", "User"],
      ["", " "],
      ["punct", "="],
      ["", " "],
      ["fn", "defineSubjectType"],
      ["punct", "("],
      ["string", '"User"'],
      ["punct", ","],
    ],
    [
      ["", "  "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "object"],
      ["punct", "({"],
    ],
    [
      ["", "    "],
      ["prop", "id"],
      ["punct", ":"],
      ["", " "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "uuid"],
      ["punct", "(),"],
    ],
    [
      ["", "    "],
      ["prop", "firstName"],
      ["punct", ":"],
      ["", " "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "string"],
      ["punct", "()."],
      ["fn", "min"],
      ["punct", "("],
      ["number", "1"],
      ["punct", ")."],
      ["fn", "max"],
      ["punct", "("],
      ["number", "40"],
      ["punct", "),"],
    ],
    [
      ["", "    "],
      ["prop", "email"],
      ["punct", ":"],
      ["", " "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "string"],
      ["punct", "()."],
      ["fn", "email"],
      ["punct", "(),"],
    ],
    [
      ["", "    "],
      ["prop", "age"],
      ["punct", ":"],
      ["", " "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "number"],
      ["punct", "()."],
      ["fn", "int"],
      ["punct", "()."],
      ["fn", "min"],
      ["punct", "("],
      ["number", "18"],
      ["punct", ")."],
      ["fn", "max"],
      ["punct", "("],
      ["number", "99"],
      ["punct", ")."],
      ["fn", "optional"],
      ["punct", "(),"],
      { active: true },
    ],
    [
      ["", "    "],
      ["prop", "address"],
      ["punct", ":"],
      ["", " "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "object"],
      ["punct", "({"],
    ],
    [
      ["", "      "],
      ["prop", "street"],
      ["punct", ":"],
      ["", " "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "string"],
      ["punct", "()."],
      ["fn", "min"],
      ["punct", "("],
      ["number", "2"],
      ["punct", "),"],
    ],
    [
      ["", "      "],
      ["prop", "city"],
      ["punct", ":"],
      ["", " "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "string"],
      ["punct", "(),"],
    ],
    [
      ["", "      "],
      ["prop", "zip"],
      ["punct", ":"],
      ["", " "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "string"],
      ["punct", "()."],
      ["fn", "regex"],
      ["punct", "("],
      ["string", "/^[0-9]{5}$/"],
      ["punct", "),"],
    ],
    [
      ["", "      "],
      ["prop", "country"],
      ["punct", ":"],
      ["", " "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "enum"],
      ["punct", "(["],
      ["string", '"US"'],
      ["punct", ","],
      ["", " "],
      ["string", '"CA"'],
      ["punct", ","],
      ["", " "],
      ["string", '"UK"'],
      ["punct", "]),"],
    ],
    [
      ["", "    "],
      ["punct", "}),"],
    ],
    [
      ["", "    "],
      ["prop", "orders"],
      ["punct", ":"],
      ["", " "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "array"],
      ["punct", "("],
      ["type", "Order"],
      ["punct", ")."],
      ["fn", "min"],
      ["punct", "("],
      ["number", "0"],
      ["punct", ")."],
      ["fn", "max"],
      ["punct", "("],
      ["number", "8"],
      ["punct", "),"],
    ],
    [
      ["", "    "],
      ["prop", "role"],
      ["punct", ":"],
      ["", " "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "enum"],
      ["punct", "(["],
      ["string", '"admin"'],
      ["punct", ","],
      ["", " "],
      ["string", '"user"'],
      ["punct", ","],
      ["", " "],
      ["string", '"guest"'],
      ["punct", "])."],
      ["fn", "default"],
      ["punct", "("],
      ["string", '"user"'],
      ["punct", "),"],
    ],
    [
      ["", "    "],
      ["prop", "createdAt"],
      ["punct", ":"],
      ["", " "],
      ["fn", "z"],
      ["punct", "."],
      ["fn", "date"],
      ["punct", "(),"],
    ],
    [
      ["", "  "],
      ["punct", "})"],
    ],
    [["punct", ");"]],
  ];
  return (
    <section className="pane">
      <div className="pane-head">
        <span className="pane-title">Code</span>
        <span className="pane-sub">user.schema.ts</span>
        <div className="pane-actions">
          <button className="icon-btn" title="Copy" style={{ fontSize: 11 }}>
            copy
          </button>
          <button className="icon-btn">
            <Icon name="expand" size={13} />
          </button>
        </div>
      </div>
      <div className="pane-body code">
        {L.map((line, i) => {
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
    </section>
  );
}

// ── Data pane (JSON tree) ─────────────────────────────────────────
function DataPane() {
  return (
    <section className="pane">
      <div className="pane-head">
        <span className="pane-title">Data</span>
        <span className="pane-sub">
          world.generate({"{"}seed:42{"}"}) · 6 items
        </span>
        <div className="pane-actions">
          <div className="seg">
            <button aria-pressed={true} style={{ fontSize: 10 }}>
              JSON
            </button>
            <button style={{ fontSize: 10 }}>Table</button>
            <button style={{ fontSize: 10 }}>Tree</button>
          </div>
        </div>
      </div>
      <div className="pane-body json">
        <span className="punct">[</span>
        {[
          {
            id: "9f2e7c3a",
            firstName: "Marcia",
            email: "marcia@hex.io",
            age: 34,
            country: "US",
            orders: 3,
            role: "user",
          },
          {
            id: "4b81d0fe",
            firstName: "Theodore",
            email: "t.veck@hex.io",
            age: 52,
            country: "CA",
            orders: 0,
            role: "admin",
          },
          {
            id: "7c10aa42",
            firstName: "Yuki",
            email: "yuki@hex.io",
            age: 27,
            country: "UK",
            orders: 6,
            role: "user",
          },
        ].map((u, i) => (
          <div key={i}>
            <div>
              <span className="punct"> {"{"}</span>
            </div>
            <div className="indent-2">
              <span className="key">"id"</span>
              <span className="punct">:</span> <span className="str">"{u.id}"</span>
              <span className="punct">,</span>
            </div>
            <div className="indent-2">
              <span className="key">"firstName"</span>
              <span className="punct">:</span> <span className="str">"{u.firstName}"</span>
              <span className="punct">,</span>
            </div>
            <div className="indent-2">
              <span className="key">"email"</span>
              <span className="punct">:</span> <span className="str">"{u.email}"</span>
              <span className="punct">,</span>
            </div>
            <div
              className="indent-2"
              style={
                u.firstName === "Theodore"
                  ? { background: "var(--accent-soft)", boxShadow: "inset 2px 0 0 var(--accent)" }
                  : null
              }
            >
              <span className="key">"age"</span>
              <span className="punct">:</span> <span className="num">{u.age}</span>
              <span className="punct">,</span>
            </div>
            <div className="indent-2">
              <span className="key">"country"</span>
              <span className="punct">:</span> <span className="str">"{u.country}"</span>
              <span className="punct">,</span>
            </div>
            <div className="indent-2">
              <span className="key">"orders"</span>
              <span className="punct">:</span> <span className="num">{u.orders}</span>{" "}
              <span className="comment">
                // {u.orders === 0 ? "∅" : `→ ${u.orders} Order rows`}
              </span>
            </div>
            <div className="indent-2">
              <span className="key">"role"</span>
              <span className="punct">:</span> <span className="str">"{u.role}"</span>
            </div>
            <div>
              <span className="punct">
                {" "}
                {"}"}
                {i < 2 ? "," : ""}
              </span>
            </div>
          </div>
        ))}
        <div>
          <span className="comment"> // …3 more</span>
        </div>
        <div>
          <span className="punct">]</span>
        </div>
      </div>
    </section>
  );
}

// ── Status bar ────────────────────────────────────────────────────
function StatusBar() {
  return (
    <div className="statusbar">
      <span className="ok">● valid</span>
      <span className="seg-mark">│</span>
      <span>3 subjects</span>
      <span className="seg-mark">│</span>
      <span>2 relationships</span>
      <span className="seg-mark">│</span>
      <span>seed 42</span>
      <span className="grow" />
      <span>regenerated 240ms ago</span>
      <span className="seg-mark">│</span>
      <span>z@4.0.1</span>
    </div>
  );
}

Object.assign(window, {
  Icon,
  TopBar,
  LeftRail,
  BuilderPane,
  CodePane,
  DataPane,
  StatusBar,
  Mod,
  AddMod,
  TypeChip,
  Row,
  GroupHead,
});
