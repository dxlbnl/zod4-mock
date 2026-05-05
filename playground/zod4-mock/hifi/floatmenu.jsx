// hifi/floatmenu.jsx — anchored "+ mod" menu.

function FloatMenu({ anchorRect, scope = "z.number()", onClose }) {
  if (!anchorRect) return null;

  // Position: 6px below the anchor, left edge aligned to anchor's left,
  // clamped to stay inside its parent (.pane-body).
  const top = anchorRect.bottom + 8;
  const left = anchorRect.left;

  // caret horizontal offset (tip pointing at the centre of the anchor)
  const anchorCenter = anchorRect.left + anchorRect.width / 2;
  const caret = Math.max(8, anchorCenter - left - 5);

  return (
    <div
      className="float-menu"
      style={{ top, left, "--caret": caret + "px", position: "fixed" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="search">
        <input placeholder="filter…" autoFocus />
        <span className="scope">{scope}</span>
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
  );
}

window.FloatMenu = FloatMenu;
