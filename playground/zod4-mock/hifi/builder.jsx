// hifi/builder.jsx — pulls Row/GroupHead/CardinalityRow + FloatMenu together.

function BuilderPane({ showFloatMenu }) {
  const { Icon, Row, GroupHead, CardinalityRow, FloatMenu, BUILDER_ROWS } = window;
  const addModRef = React.useRef(null);
  const [anchorRect, setAnchorRect] = React.useState(null);

  React.useLayoutEffect(() => {
    if (showFloatMenu && addModRef.current) {
      setAnchorRect(addModRef.current.getBoundingClientRect());
    } else {
      setAnchorRect(null);
    }
  }, [showFloatMenu]);

  return (
    <section className="pane" style={{ minWidth: 0 }}>
      <div className="pane-head">
        <span className="pane-title">
          Builder · <span className="accent">User</span>
        </span>
        <span className="pane-sub">z.object()</span>
        <div className="pane-actions">
          <button className="icon-btn" title="Settings">
            <Icon name="settings" size={13} />
          </button>
        </div>
      </div>
      <div className="pane-body" style={{ position: "relative" }}>
        <div className="tree">
          {BUILDER_ROWS.map((r, i) => {
            if (r.kind === "group")
              return <GroupHead key={i} name={r.name} type={r.type} indent={r.indent || 0} />;
            if (r.kind === "cardinality")
              return <CardinalityRow key={i} indent={r.indent} mods={r.mods} />;
            return (
              <Row
                key={i}
                keyName={r.key}
                type={r.type}
                mods={r.mods}
                indent={r.indent || 0}
                selected={r.selected}
                warn={r.warn}
                addMenuOpen={r.selected && showFloatMenu}
                addMenuRef={addModRef}
              />
            );
          })}
          <div className="add-prop">
            <Icon name="plus" size={11} /> add property &nbsp;<span className="kbd">⌘ ⏎</span>
          </div>
        </div>

        {showFloatMenu && anchorRect && <FloatMenu anchorRect={anchorRect} scope="z.number()" />}
      </div>
    </section>
  );
}

window.BuilderPane = BuilderPane;
