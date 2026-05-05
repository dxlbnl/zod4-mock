// hifi/leftrail.jsx
function LeftRail({ activeSubject = "User" }) {
  const { Icon, SUBJECTS, RELATIONSHIPS } = window;
  return (
    <aside className="rail">
      <section className="accordion-section" data-open="false">
        <div className="accordion-head">
          <span className="chev">▶</span>
          <span className="accordion-title">World</span>
          <span className="accordion-meta">seed 42</span>
        </div>
      </section>

      <section
        className="accordion-section"
        data-open="true"
        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      >
        <div className="accordion-head">
          <span className="chev">▶</span>
          <span className="accordion-title">Subjects</span>
          <span className="accordion-meta">{SUBJECTS.length}</span>
        </div>
        <div className="accordion-body" style={{ flex: 1, overflow: "auto" }}>
          <div className="subj-list">
            {SUBJECTS.map((s) => (
              <div key={s.id} className="subj" aria-selected={activeSubject === s.id}>
                <span className="grip">⋮⋮</span>
                <span className="name">{s.id}</span>
                <span className="count">{s.count}</span>
                {s.badges.map((b, i) => (
                  <span key={i} className="badge">
                    {b}
                  </span>
                ))}
              </div>
            ))}
            <div className="add-row">
              <Icon name="plus" size={11} /> add subject
            </div>
          </div>

          <div className="sub-h">
            Relationships <span className="h-count">· {RELATIONSHIPS.length}</span>
            <span className="h-add">
              <Icon name="plus" size={11} />
            </span>
          </div>
          {RELATIONSHIPS.map((r, i) => (
            <div key={i} className="rel">
              <span className="from">{r.from}</span>
              <span className="arr">─</span>
              <span className="card">{r.card}</span>
              <span className="arr">─</span>
              <span className="to">{r.to}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="accordion-section" data-open="false">
        <div className="accordion-head">
          <span className="chev">▶</span>
          <span className="accordion-title">Schemas</span>
          <span className="accordion-meta">2</span>
        </div>
      </section>
    </aside>
  );
}
window.LeftRail = LeftRail;
