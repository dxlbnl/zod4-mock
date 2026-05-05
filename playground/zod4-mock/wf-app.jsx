// App: assembles the design canvas with three direction artboards + sub-states.
// Tweaks: toggle annotations, cycle directions to focus, dark/light vibe.

const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/ {
  annotations: true,
  vibe: "paper",
} /*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULS);

  React.useEffect(() => {
    document.body.classList.toggle("no-annos", !tweaks.annotations);
    if (tweaks.vibe === "cool") {
      document.documentElement.style.setProperty("--paper", "#eef0f3");
      document.documentElement.style.setProperty("--paper-2", "#dde1e8");
      document.documentElement.style.setProperty("--accent", "#2a6cd2");
      document.documentElement.style.setProperty("--accent-soft", "#bcd3f0");
    } else if (tweaks.vibe === "graphite") {
      document.documentElement.style.setProperty("--paper", "#1c1c1c");
      document.documentElement.style.setProperty("--paper-2", "#2a2a2a");
      document.documentElement.style.setProperty("--ink", "#e8e8e8");
      document.documentElement.style.setProperty("--ink-soft", "#bbb");
      document.documentElement.style.setProperty("--ink-faint", "#888");
      document.documentElement.style.setProperty("--accent", "#ff7a5c");
      document.documentElement.style.setProperty("--accent-soft", "#3a2a26");
    } else {
      document.documentElement.style.setProperty("--paper", "#f6f3ec");
      document.documentElement.style.setProperty("--paper-2", "#ecead9");
      document.documentElement.style.setProperty("--ink", "#1a1a1a");
      document.documentElement.style.setProperty("--ink-soft", "#444");
      document.documentElement.style.setProperty("--ink-faint", "#888");
      document.documentElement.style.setProperty("--accent", "#d24a2a");
      document.documentElement.style.setProperty("--accent-soft", "#f3c2b2");
    }
  }, [tweaks]);

  const { TweaksPanel, TweakSection, TweakToggle, TweakSelect } = window;
  const { DesignCanvas, DCSection, DCArtboard, DCPostIt } = window;

  return (
    <>
      <DesignCanvas>
        <DCSection
          id="overview"
          title="Global overview · the whole playground"
          subtitle="Where World, Subjects and Schemas live · how they relate to the workspace"
        >
          <DCArtboard
            id="ov-app"
            label="Full app · accordion left, workspace right"
            width={1320}
            height={880}
          >
            <GlobalOverview />
          </DCArtboard>

          <DCArtboard
            id="ov-accordion"
            label="Accordion sections · all three expanded"
            width={1100}
            height={720}
          >
            <AccordionZoom />
          </DCArtboard>

          <DCPostIt x={1130} y={20} w={210}>
            Single accordion on the left = one mental model for global state. Builder/Code/Data on
            the right react to whatever's selected.
          </DCPostIt>
        </DCSection>

        <DCSection
          id="header"
          title="zod4-mock · Subject / Property Builder"
          subtitle="Three directions · Wireframes · Black + accent"
        >
          <DCArtboard id="readme" label="Read me first" width={520} height={620}>
            <div style={{ padding: 28, fontFamily: "var(--hand)" }}>
              <div className="stamp">WIREFRAME</div>
              <h1
                style={{
                  fontFamily: "var(--hand-bold)",
                  fontSize: 36,
                  lineHeight: 1.05,
                  margin: "14px 0 8px",
                }}
              >
                Subject &amp; Property Builder
              </h1>
              <p
                style={{
                  fontFamily: "var(--hand)",
                  fontSize: 16,
                  color: "var(--ink-soft)",
                  lineHeight: 1.45,
                }}
              >
                The Builder is the trickiest pane in the playground — it has to handle
                <em> arbitrary depth</em>, <em>recursion</em>, modifiers per type, and the binding
                contract with API Schemas. Below are 3 distinct approaches, each with annotations
                and a few sub-states.
              </p>

              <ol
                style={{
                  fontFamily: "var(--hand)",
                  fontSize: 17,
                  lineHeight: 1.5,
                  paddingLeft: 18,
                }}
              >
                <li>
                  <strong style={{ fontFamily: "var(--hand-bold)" }}>A · Indented Tree</strong> —
                  everything visible, tree guides for nesting.
                </li>
                <li>
                  <strong style={{ fontFamily: "var(--hand-bold)" }}>
                    B · Breadcrumb Drill-Down
                  </strong>{" "}
                  — one level at a time, minimap for context.
                </li>
                <li>
                  <strong style={{ fontFamily: "var(--hand-bold)" }}>C · Miller Columns</strong> —
                  side-by-side levels, leaf-detail editor.
                </li>
              </ol>

              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  border: "1.5px dashed var(--ink)",
                  borderRadius: 6,
                  background: "var(--paper)",
                }}
              >
                <div style={{ fontFamily: "var(--hand-bold)", fontSize: 16 }}>
                  How to read these
                </div>
                <ul style={{ fontSize: 14, lineHeight: 1.45, paddingLeft: 16, margin: "6px 0 0" }}>
                  <li>Hatched fill = active / selected.</li>
                  <li>Accent text = annotation pointing at a UI choice.</li>
                  <li>Dashed borders = control surfaces; solid = container chrome.</li>
                  <li>
                    Toggle the <span style={{ color: "var(--accent)" }}>annotations</span> tweak to
                    see the bare layout.
                  </li>
                </ul>
              </div>

              <div
                style={{
                  marginTop: 16,
                  fontFamily: "var(--hand)",
                  fontSize: 14,
                  color: "var(--ink-soft)",
                }}
              >
                Each artboard can be <strong>focused</strong> (click ⤢ in the upper-right) for
                fullscreen viewing.
              </div>
            </div>
          </DCArtboard>

          <DCArtboard id="dirA" label="A · Indented Tree (chosen ✓)" width={1200} height={880}>
            <DirectionA />
          </DCArtboard>

          <DCArtboard id="dirA-rel" label="A · World + Relationships" width={1200} height={880}>
            <StateRelationships />
          </DCArtboard>

          <DCArtboard
            id="dirA-gen"
            label="A · Custom generators (key-based fns)"
            width={1200}
            height={760}
          >
            <StateGenerator />
          </DCArtboard>

          <DCArtboard
            id="dirA-mod"
            label="A · Modifier flow (min / max / etc)"
            width={1200}
            height={600}
          >
            <StateModifierFlow />
          </DCArtboard>

          <DCArtboard id="dirA-mod-add" label="A · Modifier add / remove" width={1200} height={540}>
            <StateModifierAddRemove />
          </DCArtboard>

          <DCArtboard id="dirB" label="B · Breadcrumb Drill-Down" width={1200} height={880}>
            <DirectionB />
          </DCArtboard>

          <DCArtboard id="dirC" label="C · Miller Columns" width={1200} height={880}>
            <DirectionC />
          </DCArtboard>

          <DCPostIt x={1230} y={20} w={210}>
            Pick one — or mix: A for shallow schemas, B for mobile/deep, C for power users on big
            screens.
          </DCPostIt>
        </DCSection>

        <DCSection
          id="states"
          title="Sub-states & micro-flows"
          subtitle="Specific moments worth pinning down"
        >
          <DCArtboard id="empty" label="① Empty state" width={520} height={380}>
            <StateEmpty />
          </DCArtboard>
          <DCArtboard id="adding" label="② Adding first prop · keyboard" width={560} height={360}>
            <StateAdding />
          </DCArtboard>
          <DCArtboard id="dropdown" label="③ Type dropdown" width={480} height={460}>
            <StateDropdown />
          </DCArtboard>
          <DCArtboard id="array" label="④ Array<Object>" width={560} height={380}>
            <StateArray />
          </DCArtboard>
          <DCArtboard id="binding" label="⑤ Binding & mismatch" width={600} height={420}>
            <StateBinding />
          </DCArtboard>
          <DCArtboard id="modpop" label="⑥ Modifier popover" width={480} height={360}>
            <StateModifierPopover />
          </DCArtboard>
          <DCArtboard id="seed" label="⑦ World seed strip" width={460} height={220}>
            <StateSeed />
          </DCArtboard>

          <DCPostIt x={1230} y={20} w={220}>
            States are direction-agnostic — they slot into A, B, or C with minor adjustment.
          </DCPostIt>
        </DCSection>

        <DCSection
          id="responsive"
          title="Responsive collapse"
          subtitle="Desktop primary; how each direction behaves narrower"
        >
          <DCArtboard id="resp" label="Breakpoints" width={1100} height={520}>
            <ResponsiveSketch />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Display">
          <TweakToggle
            label="Annotations"
            value={tweaks.annotations}
            onChange={(v) => setTweak("annotations", v)}
          />
          <TweakSelect
            label="Vibe"
            value={tweaks.vibe}
            options={[
              { value: "paper", label: "Paper (default)" },
              { value: "cool", label: "Cool blue" },
              { value: "graphite", label: "Graphite (dark)" },
            ]}
            onChange={(v) => setTweak("vibe", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// Responsive sketch — three mini frames showing each direction at narrower widths.
function ResponsiveSketch() {
  const Frame = ({ w, h, label, children, x, y }) => (
    <div style={{ position: "absolute", left: x, top: y }}>
      <div
        style={{
          width: w,
          height: h,
          border: "1.5px solid var(--ink)",
          borderRadius: 6,
          background: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          marginTop: 6,
          color: "var(--ink-soft)",
          textAlign: "center",
          width: w,
        }}
      >
        {label}
      </div>
    </div>
  );
  const Bar = ({ x, y, w, h, dashed, accent }) => (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        border:
          "1px " + (dashed ? "dashed" : "solid") + " " + (accent ? "var(--accent)" : "var(--ink)"),
        borderRadius: 3,
        background: accent ? "rgba(210,74,42,0.1)" : "transparent",
      }}
    />
  );

  return (
    <div style={{ position: "relative", width: 1100, height: 520 }}>
      <Anno x={20} y={6} w={400} ink>
        <strong>Responsive plan.</strong> All three directions degrade gracefully — code/data move
        into a tab strip, then a bottom drawer, then a modal sheet on phones.
      </Anno>

      {/* Direction A */}
      <Frame x={20} y={50} w={300} h={200} label="A · 1280px (desktop)">
        <Bar x={6} y={6} w={170} h={188} />
        <Bar x={184} y={6} w={108} h={90} />
        <Bar x={184} y={102} w={108} h={92} />
      </Frame>
      <Frame x={20} y={300} w={300} h={170} label="A · 768px (tablet)">
        <Bar x={6} y={6} w={288} h={92} />
        <Bar x={6} y={104} w={140} h={60} dashed />
        <Bar x={152} y={104} w={142} h={60} dashed />
      </Frame>

      {/* Direction B */}
      <Frame x={400} y={50} w={300} h={200} label="B · 1280px">
        <Bar x={6} y={6} w={170} h={188} />
        <Bar x={184} y={6} w={108} h={188} />
      </Frame>
      <Frame x={400} y={300} w={180} h={170} label="B · phone">
        <Bar x={6} y={6} w={168} h={120} />
        <Bar x={6} y={130} w={168} h={36} dashed accent />
      </Frame>
      <Anno x={600} y={310} w={150}>
        Sibling chips become a sticky bottom drawer.
      </Anno>
      <Arrow from={{ x: 595, y: 332 }} to={{ x: 555, y: 360 }} curve={-15} />

      {/* Direction C */}
      <Frame x={780} y={50} w={300} h={200} label="C · 1440px+">
        <Bar x={6} y={6} w={66} h={188} />
        <Bar x={76} y={6} w={66} h={188} />
        <Bar x={146} y={6} w={66} h={188} accent />
        <Bar x={216} y={6} w={76} h={188} dashed />
      </Frame>
      <Frame x={780} y={300} w={300} h={170} label="C · 1100–1440 (collapse to B)">
        <Bar x={6} y={6} w={170} h={158} />
        <Bar x={184} y={6} w={108} h={158} />
        <div
          style={{
            position: "absolute",
            left: 86,
            top: 70,
            fontFamily: "var(--hand)",
            fontSize: 12,
            color: "var(--accent)",
            background: "#fff",
            padding: "0 4px",
          }}
        >
          → falls back to B
        </div>
      </Frame>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
