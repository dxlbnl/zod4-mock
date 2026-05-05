// hifi/app.jsx — top-level composition.

const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/ {
  theme: "dark",
  showFloatMenu: true,
  exportOpen: false,
} /*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULS);
  const {
    TopBar,
    LeftRail,
    BuilderPane,
    OutputPane,
    StatusBar,
    ExportSheet,
    TweaksPanel,
    TweakSection,
    TweakRadio,
    TweakToggle,
  } = window;

  React.useEffect(() => {
    document.documentElement.classList.toggle("light", tweaks.theme === "light");
  }, [tweaks.theme]);

  return (
    <>
      <div className="app">
        <TopBar
          theme={tweaks.theme}
          onTheme={() => setTweak("theme", tweaks.theme === "dark" ? "light" : "dark")}
          onExport={() => setTweak("exportOpen", true)}
        />
        <div className="main">
          <LeftRail activeSubject="User" />
          <div className="workspace">
            <BuilderPane showFloatMenu={tweaks.showFloatMenu} />
            <OutputPane />
          </div>
        </div>
        <StatusBar />
      </div>

      <ExportSheet open={tweaks.exportOpen} onClose={() => setTweak("exportOpen", false)} />

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
        <TweakSection title="States">
          <TweakToggle
            label="Show + mod menu"
            value={tweaks.showFloatMenu}
            onChange={(v) => setTweak("showFloatMenu", v)}
          />
          <TweakToggle
            label="Show export sheet"
            value={tweaks.exportOpen}
            onChange={(v) => setTweak("exportOpen", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
