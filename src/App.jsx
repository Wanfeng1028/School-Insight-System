import { useEffect, useMemo, useState } from "react";
import BarChart from "./components/BarChart";
import LineChart from "./components/LineChart";
import TrajectoryCanvas from "./components/TrajectoryCanvas";
import {
  initialLogs,
  logLevels,
  logWindows,
  metricCards as fallbackMetricCards,
  trackSeeds,
  trendHours as fallbackTrendHours,
  trendValues as fallbackTrendValues,
  zoneDurations as fallbackZoneDurations,
} from "./data";
import { downloadReport, fetchHealth, fetchLogs, fetchOverview, uploadVideo } from "./hooks/api";
import { connectTrackStream } from "./hooks/realtime";

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
  apiFallback: "API \u79bb\u7ebf",
  redisOnline: "Redis",
  redisOffline: "Redis \u79bb\u7ebf",
  wsConnected: "WS \u5df2\u8fde\u63a5",
  wsFallback: "WS \u6a21\u62df\u6a21\u5f0f",
  streamRunning: "\u6570\u636e\u6d41\uff1a\u8fd0\u884c\u4e2d",
  streamIdle: "\u6570\u636e\u6d41\uff1a\u5f85\u547d",
  uploadWaiting: "\u5f85\u5bfc\u5165\u89c6\u9891\u6e90",
  uploadHint:
    "\u8bf7\u5c06\u56ed\u5185\u76d1\u63a7\u89c6\u9891\u62d6\u52a8\u81f3\u6b64\u5904\uff0c\u6216\u901a\u8fc7\u5de6\u4fa7\u9762\u677f\u4e0a\u4f20\u3002\u7cfb\u7edf\u5c06\u81ea\u52a8\u89e3\u6790\u89c6\u9891\u5e27\u5e76\u8fdb\u884c\u8f68\u8ff9\u70b9\u62bd\u6837\u4e0e ID \u5206\u914d\u3002",
  chooseFile: "\u70b9\u51fb\u6b64\u5904\u9009\u62e9\u89c6\u9891\u6587\u4ef6",
  dragFile: "\u6216\u5c06\u6587\u4ef6\u62d6\u62fd\u5230\u8fd9\u91cc",
  fileTypes: "\u652f\u6301 MP4, AVI, MOV (\u63a8\u8350 1080P/25FPS, \u5355\u6587\u4ef6 <= 300MB)",
  uploadBind: "\u4e0a\u4f20\u5e76\u7ed1\u5b9a",
  uploading: "\u4e0a\u4f20\u4e2d...",
  uploadDone: "\u4e0a\u4f20\u6210\u529f\uff0c\u5df2\u5207\u5165\u8f68\u8ff9\u76d1\u63a7\u3002",
  selectedSuffix: " \u5df2\u9009\u62e9\uff0c\u7b49\u5f85\u7ed1\u5b9a\u5206\u6790\u6d41\u3002",
  uploadFailed: "\u4e0a\u4f20\u5931\u8d25\uff0c\u8bf7\u5148\u542f\u52a8 FastAPI \u670d\u52a1\u3002",
  pickFileFirst: "\u8bf7\u5148\u9009\u62e9\u8981\u4e0a\u4f20\u7684\u89c6\u9891\u6587\u4ef6\u3002",
  badType: "\u4ec5\u652f\u6301 MP4 / AVI / MOV \u683c\u5f0f\u6587\u4ef6\u3002",
  tooLarge: "\u6587\u4ef6\u4f53\u79ef\u8d85\u8fc7 300MB\uff0c\u8bf7\u66f4\u6362\u89c6\u9891\u3002",
  noData: "\u6570\u636e\u6d41\uff1a\u65e0\u6570\u636e",
  trackHint: "camera_id:1 / buffer: ok / mode: realtime",
  overviewTitle: "\u7edf\u8ba1\u6982\u89c8",
  exportReport: "\u5bfc\u51fa\u62a5\u544a",
  exporting: "\u5bfc\u51fa\u4e2d...",
  exportDone: "\u62a5\u544a\u5df2\u5f00\u59cb\u4e0b\u8f7d\u3002",
  exportFail: "\u62a5\u544a\u5bfc\u51fa\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u540e\u7aef\u670d\u52a1\u3002",
  trendTitle: "\u89e3\u6790\u70b9\u6570\u8d8b\u52bf (24h)",
  zoneTitle: "\u533a\u57df\u505c\u7559\u65f6\u957f TOP",
  logsTitle: "\u4e8b\u4ef6\u65e5\u5fd7",
  updatedPrefix: "\u6700\u540e\u66f4\u65b0",
  justNow: "\u521a\u521a",
  searchPlaceholder: "\u5173\u952e\u8bcd\u641c\u7d22...",
  refresh: "\u5237\u65b0",
};

const navItems = [
  { key: "monitor", label: UI.navMonitor, icon: "M" },
  { key: "overview", label: UI.navOverview, icon: "S" },
  { key: "logs", label: UI.navLogs, icon: "L" },
];

const ALLOWED_SUFFIXES = [".mp4", ".avi", ".mov"];
const MAX_UPLOAD_SIZE = 300 * 1024 * 1024;

function formatLogTime(value) {
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return value;
  const pad = (n) => String(n).padStart(2, "0");
  return `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())} ${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`;
}

function validateFile(file) {
  if (!file) return { ok: false, message: UI.pickFileFirst };
  const lower = file.name.toLowerCase();
  const matched = ALLOWED_SUFFIXES.some((suffix) => lower.endsWith(suffix));
  if (!matched) return { ok: false, message: UI.badType };
  if (file.size > MAX_UPLOAD_SIZE) return { ok: false, message: UI.tooLarge };
  return { ok: true, message: file.name + UI.selectedSuffix };
}

function App() {
  const [activePage, setActivePage] = useState("monitor");
  const [monitorMode, setMonitorMode] = useState("upload");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadState, setUploadState] = useState("idle");
  const [uploadMessage, setUploadMessage] = useState(UI.noData);
  const [dragActive, setDragActive] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tracks, setTracks] = useState(trackSeeds);
  const [wsLive, setWsLive] = useState(false);
  const [health, setHealth] = useState({ api: false, redis: false, ws: false, stream_active: false, camera_id: "camera_id: 1", current_file: null });
  const [overview, setOverview] = useState({
    metricCards: fallbackMetricCards,
    trendHours: fallbackTrendHours,
    trendValues: fallbackTrendValues,
    zoneDurations: fallbackZoneDurations,
  });
  const [logs, setLogs] = useState(initialLogs);
  const [lastUpdated, setLastUpdated] = useState(UI.justNow);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("\u5168\u90e8\u7ea7\u522b");
  const [windowFilter] = useState("\u6700\u8fd11\u5c0f\u65f6");

  const loadHealth = () => {
    return fetchHealth()
      .then((data) => {
        setHealth({
          api: !!data.api,
          redis: !!data.redis,
          ws: !!data.ws,
          stream_active: !!data.stream_active,
          camera_id: data.camera_id || "camera_id: 1",
          current_file: data.current_file || null,
        });
      })
      .catch(() => {
        setHealth({ api: false, redis: false, ws: false, stream_active: false, camera_id: "camera_id: 1", current_file: null });
      });
  };

  const loadOverview = () => {
    return fetchOverview()
      .then((data) => {
        setOverview({
          metricCards: data.metric_cards,
          trendHours: data.trend_hours,
          trendValues: data.trend_values,
          zoneDurations: data.zone_durations,
        });
      })
      .catch(() => {
        setOverview({
          metricCards: fallbackMetricCards,
          trendHours: fallbackTrendHours,
          trendValues: fallbackTrendValues,
          zoneDurations: fallbackZoneDurations,
        });
      });
  };

  const loadLogs = (nextLevel = levelFilter) => {
    const backendLevel = nextLevel === "\u5168\u90e8\u7ea7\u522b" ? "ALL" : nextLevel;
    return fetchLogs(backendLevel)
      .then((items) => {
        setLogs(items.map((item) => ({ ...item, ts: formatLogTime(item.ts) })));
        setLastUpdated(UI.justNow);
      })
      .catch(() => {
        setLogs(initialLogs);
      });
  };

  useEffect(() => {
    loadHealth();
    loadOverview();
    loadLogs();

    const healthTimer = window.setInterval(() => {
      loadHealth();
    }, 5000);
    const overviewTimer = window.setInterval(() => {
      loadOverview();
    }, 12000);
    const logsTimer = window.setInterval(() => {
      loadLogs(levelFilter);
    }, 8000);

    return () => {
      window.clearInterval(healthTimer);
      window.clearInterval(overviewTimer);
      window.clearInterval(logsTimer);
    };
  }, []);

  useEffect(() => {
    loadLogs(levelFilter);
  }, [levelFilter]);

  useEffect(() => {
    if (activePage !== "monitor" || monitorMode !== "track") {
      return undefined;
    }

    let closed = false;
    const socket = connectTrackStream({
      onMessage: (nextTracks) => {
        if (closed) return;
        setTracks(nextTracks);
        setWsLive(true);
      },
      onError: () => {
        if (closed) return;
        setWsLive(false);
        setTracks(trackSeeds);
      },
    });

    socket.onclose = () => {
      if (closed) return;
      setWsLive(false);
      setTracks(trackSeeds);
    };

    return () => {
      closed = true;
      socket.close();
    };
  }, [activePage, monitorMode]);

  const visibleLogs = useMemo(() => {
    return logs.filter((item) => {
      const matchSearch = !search || item.text.toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [logs, search]);

  const refreshLogs = () => {
    loadLogs(levelFilter);
  };

  const applyFile = (file) => {
    const result = validateFile(file);
    if (!result.ok) {
      setSelectedFile(null);
      setUploadState("error");
      setUploadMessage(result.message);
      return;
    }
    setSelectedFile(file);
    setUploadState("idle");
    setUploadMessage(result.message);
  };

  const handleUpload = async () => {
    const result = validateFile(selectedFile);
    if (!result.ok) {
      setUploadState("error");
      setUploadMessage(result.message);
      return;
    }

    try {
      setUploadState("uploading");
      setUploadMessage(UI.uploading);
      await uploadVideo(selectedFile);
      setUploadState("success");
      setUploadMessage(UI.uploadDone);
      await Promise.all([loadHealth(), loadOverview(), loadLogs(levelFilter)]);
      setMonitorMode("track");
    } catch (error) {
      const text = String(error?.message || "");
      if (text.includes("unsupported_file_type")) {
        setUploadMessage(UI.badType);
      } else if (text.includes("file_too_large")) {
        setUploadMessage(UI.tooLarge);
      } else {
        setUploadMessage(UI.uploadFailed);
      }
      setUploadState("error");
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await downloadReport();
      setLastUpdated(UI.exportDone);
    } catch {
      setLastUpdated(UI.exportFail);
    } finally {
      setExporting(false);
    }
  };

  const uploadTipClass = uploadState === "success" ? "success" : uploadState === "error" ? "error" : selectedFile ? "success" : "error";

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
                <span className={`status-tag ${health.api ? "success" : "info"}`}>{health.api ? UI.apiOnline : UI.apiFallback}</span>
                <span className={`status-tag ${health.redis ? "success" : "info"}`}>{health.redis ? UI.redisOnline : UI.redisOffline}</span>
                <span className={`status-tag ${wsLive ? "success" : "info"}`}>{wsLive ? UI.wsConnected : UI.wsFallback}</span>
                <span className={`status-tag ${health.stream_active ? "success" : "info"}`}>{health.stream_active ? UI.streamRunning : UI.streamIdle}</span>
                <span className="status-tag info">{health.camera_id}</span>
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
                  <label
                    className={`dropzone ${dragActive ? "drag-active" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                      const file = event.dataTransfer.files?.[0] ?? null;
                      applyFile(file);
                    }}
                  >
                    <input
                      type="file"
                      accept=".mp4,.avi,.mov"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        applyFile(file);
                      }}
                    />
                    <div className="dropzone-plus">+</div>
                    <strong>{UI.chooseFile}</strong>
                    <em>{UI.dragFile}</em>
                    <span>{UI.fileTypes}</span>
                  </label>
                  <button className="primary-button" onClick={handleUpload} disabled={uploadState === "uploading"}>
                    {uploadState === "uploading" ? UI.uploading : UI.uploadBind}
                  </button>
                  <div className={`upload-tip ${uploadTipClass}`}>{uploadMessage}</div>
                </div>
              ) : (
                <div className="track-card">
                  <div className="track-card-head">
                    <h2>{UI.monitorTitle}</h2>
                    <span>{health.current_file ? `${health.camera_id} / ${health.current_file}` : UI.trackHint}</span>
                  </div>
                  <TrajectoryCanvas tracks={tracks} />
                </div>
              )}
            </section>
          </>
        )}

        {activePage === "overview" && (
          <>
            <header className="topbar topbar-plain">
              <h1>{UI.overviewTitle}</h1>
              <button className="outline-blue" onClick={handleExport} disabled={exporting}>
                {exporting ? UI.exporting : UI.exportReport}
              </button>
            </header>

            <section className="overview-grid">
              <div className="metric-row">
                {overview.metricCards.map((card) => (
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
                <LineChart hours={overview.trendHours} values={overview.trendValues} />
              </article>

              <article className="panel-card side-panel">
                <h3>{UI.zoneTitle}</h3>
                <BarChart data={overview.zoneDurations} />
              </article>
            </section>
          </>
        )}

        {activePage === "logs" && (
          <>
            <header className="topbar topbar-plain">
              <h1>{UI.logsTitle}</h1>
              <div className="topbar-inline">
                <span>{`${UI.updatedPrefix}: ${lastUpdated}`}</span>
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
                <button className="refresh-button" onClick={refreshLogs}>{UI.refresh}</button>
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
