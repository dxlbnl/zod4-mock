// hifi/datapane.jsx — JSON tree.
function DataView() {
  const { USER_DATA } = window;
  return (
    <div className="json">
      <span className="punct">[</span>
      {USER_DATA.map((u, i) => (
        <div key={i}>
          <div>
            <span className="punct"> {"{"}</span>
          </div>
          <div className="indent-2">
            <span className="key">"id"</span>
            <span className="punct">:</span> <span className="str">"{u.id}"</span>
            <span className="punct">,</span>
          </div>
          <div className="indent-2">
            <span className="key">"firstName"</span>
            <span className="punct">:</span> <span className="str">"{u.firstName}"</span>
            <span className="punct">,</span>
          </div>
          <div className="indent-2">
            <span className="key">"email"</span>
            <span className="punct">:</span> <span className="str">"{u.email}"</span>
            <span className="punct">,</span>
          </div>
          <div className={u.focusAge ? "focus-line" : "indent-2"} style={u.focusAge ? null : null}>
            {!u.focusAge && null}
            <span className="key">"age"</span>
            <span className="punct">:</span> <span className="num">{u.age}</span>
            <span className="punct">,</span>
          </div>
          <div className="indent-2">
            <span className="key">"country"</span>
            <span className="punct">:</span> <span className="str">"{u.country}"</span>
            <span className="punct">,</span>
          </div>
          <div className="indent-2">
            <span className="key">"orders"</span>
            <span className="punct">:</span> <span className="num">{u.orders}</span>{" "}
            <span className="comment">// {u.orders === 0 ? "∅" : `→ ${u.orders} Order rows`}</span>
          </div>
          <div className="indent-2">
            <span className="key">"role"</span>
            <span className="punct">:</span> <span className="str">"{u.role}"</span>
          </div>
          <div>
            <span className="punct">
              {" "}
              {"}"}
              {i < USER_DATA.length - 1 ? "," : ""}
            </span>
          </div>
        </div>
      ))}
      <div>
        <span className="comment"> // …3 more</span>
      </div>
      <div>
        <span className="punct">]</span>
      </div>
    </div>
  );
}
window.DataView = DataView;
