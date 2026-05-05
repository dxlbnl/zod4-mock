// hifi-app.jsx — assembles two variations of the playground.

const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  showFloatMenu: true,
} /*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULS);

  React.useEffect(() => {
    document.documentElement.classList.toggle("light", tweaks.theme === "light");
  }, [tweaks.theme]);

  const { TweaksPanel, TweakSection, TweakRadio, TweakToggle } = window;

  return (
    <>
      <div className="variations">
        {/* Variation 1: classic 3-pane (builder | (code / data stacked)) */}
        <div className="variation-strip">
          <span className="vbadge">Var 1</span>
          <h2>Classic three-pane</h2>
          <span className="vsub">
            · builder dominates · code + data stack on the right · the canonical playground
          </span>
        </div>
        <div className="variation-frame">
          <div className="app">
            <TopBar
              theme={tweaks.theme}
              onTheme={() => setTweak("theme", tweaks.theme === "dark" ? "light" : "dark")}
            />
            <div className="main">
              <LeftRail activeSubject="User" />
              <div className="workspace">
                <BuilderPane showFloatMenu={tweaks.showFloatMenu} />
                <CodePane />
                <DataPane />
              </div>
            </div>
            <StatusBar />
          </div>
        </div>

        {/* Variation 2: split — builder | code↔data tabs */}
        <div className="variation-strip">
          <span className="vbadge">Var 2</span>
          <h2>Split with tabbed output</h2>
          <span className="vsub">
            · builder left · code &amp; data swap via a tab strip · gives both more room when you
            need them
          </span>
        </div>
        <div className="variation-frame v2">
          <div className="app">
            <TopBar
              theme={tweaks.theme}
              onTheme={() => setTweak("theme", tweaks.theme === "dark" ? "light" : "dark")}
            />
            <div className="main">
              <LeftRail activeSubject="User" />
              <div className="workspace">
                <BuilderPane showFloatMenu={false} />
                <V2Output />
              </div>
            </div>
            <StatusBar />
          </div>
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Theme">
          <TweakRadio
            label="Mode"
            value={tweaks.theme}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            onChange={(v) => setTweak("theme", v)}
          />
        </TweakSection>
        <TweakSection title="Demo">
          <TweakToggle
            label="Show + mod menu (Var 1)"
            value={tweaks.showFloatMenu}
            onChange={(v) => setTweak("showFloatMenu", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function V2Output() {
  const [tab, setTab] = React.useState("code");
  return (
    <section className="pane code-data" style={{ gridRow: "1 / span 2" }}>
      <div className="v2-tabs">
        <div className="v2-tab" aria-selected={tab === "code"} onClick={() => setTab("code")}>
          <span
            style={{
              width: 6,
              height: 6,
              background: tab === "code" ? "var(--accent)" : "var(--ink-3)",
              borderRadius: "50%",
            }}
          />
          Code{" "}
          <span
            style={{ color: "var(--ink-2)", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}
          >
            user.schema.ts
          </span>
        </div>
        <div className="v2-tab" aria-selected={tab === "data"} onClick={() => setTab("data")}>
          <span
            style={{
              width: 6,
              height: 6,
              background: tab === "data" ? "var(--accent)" : "var(--ink-3)",
              borderRadius: "50%",
            }}
          />
          Data{" "}
          <span
            style={{ color: "var(--ink-2)", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}
          >
            6 items
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ alignSelf: "center", display: "flex", gap: 4, paddingRight: 10 }}>
          <span className="kbd">⌘ 1</span>
          <span className="kbd">⌘ 2</span>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {tab === "code" ? <CodePaneInline /> : <DataPaneInline />}
      </div>
    </section>
  );
}

// Inline versions without the pane-head (already provided by the tab strip)
function CodePaneInline() {
  // Reuse CodePane body — render full pane but hide its head via wrapper.
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CodePaneBody />
    </div>
  );
}
function DataPaneInline() {
  return (
    <div style={{ height: "100%" }}>
      <DataPaneBody />
    </div>
  );
}
function CodePaneBody() {
  // Inline replication for V2 — kept simple and identical to CodePane body.
  const node = window.CodePane();
  // Strip the head: clone children and render only the .pane-body
  return React.cloneElement(
    node,
    { className: "pane", style: { border: 0, background: "transparent", flex: 1 } },
    node.props.children.filter((c) => c && c.props && c.props.className !== "pane-head"),
  );
}
function DataPaneBody() {
  const node = window.DataPane();
  return React.cloneElement(
    node,
    { className: "pane", style: { border: 0, background: "transparent", flex: 1 } },
    node.props.children.filter((c) => c && c.props && c.props.className !== "pane-head"),
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
