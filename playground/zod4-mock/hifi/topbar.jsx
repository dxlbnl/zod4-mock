// hifi/topbar.jsx
function TopBar({ theme, onTheme, onExport }) {
  const { Icon } = window;
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-logo">z</div>
        <div className="brand-name">zod4-mock</div>
        <div className="brand-sub">v0.4.2</div>
      </div>
      <div className="workspace-name">
        <span>workspace</span>
        <span className="sep">/</span>
        <span className="name">user-service</span>
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
        <button className="btn primary" onClick={onExport}>
          <Icon name="package" size={12} /> Export all
        </button>
        <button
          className="btn ghost"
          onClick={onTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"}`}
        >
          <Icon name="sun" size={13} />
        </button>
        <span className="kbd">⌘ K</span>
      </div>
    </div>
  );
}
window.TopBar = TopBar;
