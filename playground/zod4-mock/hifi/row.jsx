// hifi/row.jsx — single property row + group header.
function Row({
  keyName,
  type,
  mods = [],
  indent = 0,
  selected,
  warn,
  addMenuOpen,
  addMenuRef,
  onAddMod,
}) {
  const { Mod, AddMod, TypeChip, Icon } = window;
  return (
    <div
      className="row"
      data-selected={selected || undefined}
      data-warn={warn || undefined}
      style={{ "--ind": 12 + indent * 18 + "px" }}
    >
      <span className="grip">⋮⋮</span>
      <input className="key mono" defaultValue={keyName} size={Math.max(keyName.length, 4)} />
      <span className="colon">:</span>
      <TypeChip value={type} active={selected} />
      {mods.map(([name, value, warnFlag], i) => (
        <Mod
          key={i}
          name={name}
          value={value}
          warn={warnFlag === "warn"}
          removable={selected && i === 0}
        />
      ))}
      <AddMod ref={addMenuOpen ? addMenuRef : null} active={addMenuOpen} onClick={onAddMod} />
      <span className="spacer" />
      {warn && (
        <span className="row-warn">
          <Icon name="warn" size={13} />
        </span>
      )}
    </div>
  );
}

function GroupHead({ name, type, indent = 0 }) {
  const { TypeChip } = window;
  return (
    <div className="group-head" style={{ paddingLeft: 12 + indent * 18 }}>
      <span className="chev">▾</span>
      <span className="gname">{name}</span>
      <span className="colon">:</span>
      <TypeChip value={type} />
    </div>
  );
}

function CardinalityRow({ indent = 1, mods = [] }) {
  const { Mod, AddMod } = window;
  return (
    <div
      className="row"
      style={{
        paddingLeft: 12 + indent * 18,
        color: "var(--ink-2)",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
      }}
    >
      <span>cardinality:</span>
      {mods.map(([name, value], i) => (
        <Mod key={i} name={name} value={value} />
      ))}
      <AddMod />
    </div>
  );
}

window.Row = Row;
window.GroupHead = GroupHead;
window.CardinalityRow = CardinalityRow;
