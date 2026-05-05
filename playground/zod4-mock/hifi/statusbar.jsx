// hifi/statusbar.jsx
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
window.StatusBar = StatusBar;
