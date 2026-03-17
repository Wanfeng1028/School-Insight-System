import { useMemo, useState } from "react";
import BarChart from "./components/BarChart";
import LineChart from "./components/LineChart";
import TrajectoryCanvas from "./components/TrajectoryCanvas";
import {
  initialLogs,
  logLevels,
  logWindows,
  metricCards,
  trackSeeds,
  trendHours,
  trendValues,
  zoneDurations,
} from "./data";

const UI = {
  brandMonitor: "XX\u6821\u56ed\u667a\u80fd\u76d1\u63a7\u7cfb\u7edf",
  brandConsole: "\u8f68\u8ff9\u5206\u6790\u63a7\u5236\u53f0",
  navMonitor: "\u5b9e\u65f6\u76d1\u63a7",
  navOverview: "\u7edf\u8ba1\u6982\u89c8",
  navLogs: "\u4e8b\u4ef6\u65e5\u5fd7",
  subUpload: "\u89c6\u9891\u7ed1\u5b9a",
  subTrack: "\u8f68\u8ff9\u753b\u5e03",
  logout: "\u9000\u51fa\u767b\u5f55",
  monitorTitle: "\u5b9e\u65f6\u76d1\u63a7",
  monitorSubtitle: "2026\u5e7403\u670817\u65e5 - \u5b9e\u65f6\u89c6\u9891\u8f68\u8ff9\u5206\u6790",
  apiOnline: "API \u5728\u7ebf",
  wsConnected: "WS \u5df2\u8fde\u63a5",
  streamRunning: "\u6570\u636e\u6d41\uff1a\u8fd0\u884c\u4e2d",
  uploadWaiting: "\u5f85\u5bfc\u5165\u89c6\u9891\u6e90",
  uploadHint:
    "\u8bf7\u5c06\u56ed\u5185\u76d1\u63a7\u89c6\u9891\u62d6\u52a8\u81f3\u6b64\u5904\uff0c\u6216\u901a\u8fc7\u5de6\u4fa7\u9762\u677f\u4e0a\u4f20\u3002\u7cfb\u7edf\u5c06\u81ea\u52a8\u89e3\u6790\u89c6\u9891\u5e27\u5e76\u8fdb\u884c\u8f68\u8ff9\u70b9\u62bd\u6837\u4e0e ID \u5206\u914d\u3002",
  chooseFile: "\u70b9\u51fb\u6b64\u5904\u9009\u62e9\u89c6\u9891\u6587\u4ef6",
  fileTypes: "\u652f\u6301 MP4, AVI, MOV (\u63a8\u8350 1080P/25FPS)",
  uploadBind: "\u4e0a\u4f20\u5e76\u7ed1\u5b9a",
  selectedSuffix: " \u5df2\u9009\u62e9\uff0c\u7b49\u5f85\u7ed1\u5b9a\u5206\u6790\u6d41\u3002",
  noData: "\u6570\u636e\u6d41\uff1a\u65e0\u6570\u636e",
  trackHint: "camera_id:1 / buffer: ok / mode: realtime",
  overviewTitle: "\u7edf\u8ba1\u6982\u89c8",
  exportReport: "\u5bfc\u51fa\u62a5\u544a",
  trendTitle: "\u89e3\u6790\u70b9\u6570\u8d8b\u52bf (24h)",
  zoneTitle: "\u533a\u57df\u505c\u7559\u65f6\u957f TOP",
  logsTitle: "\u4e8b\u4ef6\u65e5\u5fd7",
  updated: "\u6700\u540e\u66f4\u65b0: 1s \u524d",
  searchPlaceholder: "\u5173\u952e\u8bcd\u641c\u7d22...",
  refresh: "\u5237\u65b0",
};

const navItems = [
  { key: "monitor", label: UI.navMonitor, icon: "M" },
  { key: "overview", label: UI.navOverview, icon: "S" },
  { key: "logs", label: UI.navLogs, icon: "L" },
];

function App() {
  const [activePage, setActivePage] = useState("monitor");
  const [monitorMode, setMonitorMode] = useState("upload");
  const [selectedFile, setSelectedFile] = useState(null);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("\u5168\u90e8\u7ea7\u522b");
  const [windowFilter] = useState("\u6700\u8fd11\u5c0f\u65f6");

  const visibleLogs = useMemo(() => {
    return initialLogs.filter((item) => {
      const matchLevel = levelFilter === "\u5168\u90e8\u7ea7\u522b" || item.level === levelFilter;
      const matchSearch = !search || item.text.toLowerCase().includes(search.toLowerCase());
      return matchLevel && matchSearch;
    });
  }, [levelFilter, search]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">SI</div>
          <div className="brand-copy">{activePage === "monitor" ? UI.brandMonitor : UI.brandConsole}</div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activePage === item.key ? "active" : ""}`}
              onClick={() => setActivePage(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="avatar">{activePage === "monitor" ? "AS" : "AD"}</div>
            <div>
              <div className="user-name">admin</div>
              <div className="user-tags">
                <span>admin</span>
                {activePage === "monitor" ? null : <span>viewer</span>}
              </div>
            </div>
          </div>
          <button className="ghost-button">{UI.logout}</button>
        </div>
      </aside>

      <main className="main-panel">
        {activePage === "monitor" && (
          <>
            <header className="topbar">
              <div>
                <h1>{UI.monitorTitle}</h1>
                <p>{UI.monitorSubtitle}</p>
              </div>
              <div className="topbar-tags">
                <span className="status-tag success">{UI.apiOnline}</span>
                <span className="status-tag success">Redis</span>
                <span className="status-tag success">{UI.wsConnected}</span>
                <span className="status-tag success">{UI.streamRunning}</span>
                <span className="status-tag info">camera_id: 1</span>
                <span className="help-dot">i</span>
              </div>
            </header>

            <section className="monitor-grid">
              <div className="subnav-row">
                <button
                  className={`subnav-button ${monitorMode === "upload" ? "active" : ""}`}
                  onClick={() => setMonitorMode("upload")}
                >
                  {UI.subUpload}
                </button>
                <button
                  className={`subnav-button ${monitorMode === "track" ? "active" : ""}`}
                  onClick={() => setMonitorMode("track")}
                >
                  {UI.subTrack}
                </button>
              </div>

              {monitorMode === "upload" ? (
                <div className="upload-card">
                  <div className="upload-placeholder">
                    <div className="upload-icon">VID</div>
                    <h2>{UI.uploadWaiting}</h2>
                    <p>{UI.uploadHint}</p>
                  </div>
                  <label className="dropzone">
                    <input
                      type="file"
                      accept=".mp4,.avi,.mov"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                    />
                    <div className="dropzone-plus">+</div>
                    <strong>{UI.chooseFile}</strong>
                    <span>{UI.fileTypes}</span>
                  </label>
                  <button className="primary-button">{UI.uploadBind}</button>
                  {selectedFile ? (
                    <div className="upload-tip success">{selectedFile.name + UI.selectedSuffix}</div>
                  ) : (
                    <div className="upload-tip error">{UI.noData}</div>
                  )}
                </div>
              ) : (
                <div className="track-card">
                  <div className="track-card-head">
                    <h2>{UI.monitorTitle}</h2>
                    <span>{UI.trackHint}</span>
                  </div>
                  <TrajectoryCanvas tracks={trackSeeds} />
                </div>
              )}
            </section>
          </>
        )}

        {activePage === "overview" && (
          <>
            <header className="topbar topbar-plain">
              <h1>{UI.overviewTitle}</h1>
              <button className="outline-blue">{UI.exportReport}</button>
            </header>

            <section className="overview-grid">
              <div className="metric-row">
                {metricCards.map((card) => (
                  <article className="metric-card" key={card.label}>
                    <span className="metric-label">{card.label}</span>
                    <div className="metric-main">
                      <strong>{card.value}</strong>
                      <em className={`metric-delta ${card.accent}`}>{card.delta}</em>
                    </div>
                  </article>
                ))}
              </div>

              <article className="panel-card">
                <h3>{UI.trendTitle}</h3>
                <LineChart hours={trendHours} values={trendValues} />
              </article>

              <article className="panel-card side-panel">
                <h3>{UI.zoneTitle}</h3>
                <BarChart data={zoneDurations} />
              </article>
            </section>
          </>
        )}

        {activePage === "logs" && (
          <>
            <header className="topbar topbar-plain">
              <h1>{UI.logsTitle}</h1>
              <div className="topbar-inline">
                <span>{UI.updated}</span>
                <span className="signal-dot" />
              </div>
            </header>

            <section className="log-shell">
              <div className="log-toolbar">
                <label className="search-box">
                  <span>S</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={UI.searchPlaceholder}
                  />
                </label>
                <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
                  {logLevels.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select value={windowFilter} onChange={() => {}}>
                  {logWindows.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <button className="refresh-button">{UI.refresh}</button>
              </div>

              <div className="log-viewer">
                <div className="log-viewer-head">
                  <span>System Log Viewer</span>
                  <span>...</span>
                </div>
                <div className="log-list">
                  {visibleLogs.map((log) => (
                    <div className="log-row" key={`${log.ts}-${log.text}`}>
                      <span className="log-time">[{log.ts}]</span>
                      <span className={`log-level ${log.level.toLowerCase()}`}>{log.level}</span>
                      <span className="log-text">{log.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
