// hifi/output.jsx — tabbed code/data output.
function OutputPane() {
  const [tab, setTab] = React.useState("code");
  const { Icon, CodeView, DataView, USER_CODE_LINES, USER_DATA } = window;

  return (
    <section className="output">
      <div className="output-tabs">
        <div className="output-tab" aria-selected={tab === "code"} onClick={() => setTab("code")}>
          <span className="dot" />
          Code
          <span className="filename">user.schema.ts</span>
        </div>
        <div className="output-tab" aria-selected={tab === "data"} onClick={() => setTab("data")}>
          <span className="dot" />
          Data
          <span className="filename">{USER_DATA.length} of 6</span>
        </div>
        <div className="output-tab-actions">
          <span className="kbd">⌘ 1</span>
          <span className="kbd">⌘ 2</span>
          <button className="icon-btn" title="Copy">
            <Icon name="copy" size={12} />
          </button>
          <button className="icon-btn" title="Download">
            <Icon name="download" size={13} />
          </button>
        </div>
      </div>
      <div className="output-body">
        {tab === "code" ? <CodeView lines={USER_CODE_LINES} /> : <DataView />}
      </div>
    </section>
  );
}
window.OutputPane = OutputPane;
