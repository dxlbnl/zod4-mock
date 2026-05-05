// hifi/mod.jsx — modifier pill, add-mod pill, type chip.
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

const AddMod = React.forwardRef(function AddMod({ active, onClick }, ref) {
  return (
    <span ref={ref} className="add-mod" data-active={active || undefined} onClick={onClick}>
      + mod
    </span>
  );
});

function TypeChip({ value, active }) {
  return (
    <span className="type-chip" data-active={active || undefined}>
      {value} <span className="chev">▾</span>
    </span>
  );
}

window.Mod = Mod;
window.AddMod = AddMod;
window.TypeChip = TypeChip;
