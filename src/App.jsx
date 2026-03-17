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

const navItems = [
  { key: "monitor", label: "实时监控", icon: "?" },
  { key: "overview", label: "统计概览", icon: "?" },
  { key: "logs", label: "事件日志", icon: "?" },
];

function App() {
  const [activePage, setActivePage] = useState("monitor");
  const [selectedFile, setSelectedFile] = useState(null);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("全部级别");
  const [windowFilter] = useState("最近1小时");

  const visibleLogs = useMemo(() => {
    return initialLogs.filter((item) => {
      const matchLevel = levelFilter === "全部级别" || item.level === levelFilter;
      const matchSearch = !search || item.text.toLowerCase().includes(search.toLowerCase());
      return matchLevel && matchSearch;
    });
  }, [levelFilter, search]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">?</div>
          <div className="brand-copy">{activePage === "monitor" ? "XX校园智能监控系统" : "轨迹分析控制台"}</div>
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
          <button className="ghost-button">退出登录</button>
        </div>
      </aside>

      <main className="main-panel">
        {activePage === "monitor" && (
          <>
            <header className="topbar">
              <div>
                <h1>实时监控</h1>
                <p>2026年03月17日 - 实时视频轨迹分析</p>
              </div>
              <div className="topbar-tags">
                <span className="status-tag success">API 在线</span>
                <span className="status-tag success">Redis</span>
                <span className="status-tag success">WS 已连接</span>
                <span className="status-tag success">数据流：运行中</span>
                <span className="status-tag info">camera_id: 1</span>
                <span className="help-dot">?</span>
              </div>
            </header>

            <section className="monitor-grid">
              <div className="upload-card">
                <div className="upload-placeholder">
                  <div className="upload-icon">?</div>
                  <h2>待导入视频源</h2>
                  <p>
                    请将园内监控视频拖动至此处，或通过左侧面板上传。系统将自动解析视频帧并进行轨迹点抽样与 ID 分配。
                  </p>
                </div>
                <label className="dropzone">
                  <input
                    type="file"
                    accept=".mp4,.avi,.mov"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                  <div className="dropzone-plus">+</div>
                  <strong>点击此处选择视频文件</strong>
                  <span>支持 MP4, AVI, MOV (推荐 1080P/25FPS)</span>
                </label>
                <button className="primary-button">上传并绑定</button>
                {selectedFile ? (
                  <div className="upload-tip success">{selectedFile.name} 已选择，等待绑定分析流。</div>
                ) : (
                  <div className="upload-tip error">数据流：无数据</div>
                )}
              </div>

              <TrajectoryCanvas tracks={trackSeeds} />
            </section>
          </>
        )}

        {activePage === "overview" && (
          <>
            <header className="topbar topbar-plain">
              <h1>统计概览</h1>
              <button className="outline-blue">导出报告</button>
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
                <h3>解析点数趋势 (24h)</h3>
                <LineChart hours={trendHours} values={trendValues} />
              </article>

              <article className="panel-card side-panel">
                <h3>区域停留时长 TOP</h3>
                <BarChart data={zoneDurations} />
              </article>
            </section>
          </>
        )}

        {activePage === "logs" && (
          <>
            <header className="topbar topbar-plain">
              <h1>事件日志</h1>
              <div className="topbar-inline">
                <span>最后更新: 1s 前</span>
                <span className="signal-dot" />
              </div>
            </header>

            <section className="log-shell">
              <div className="log-toolbar">
                <label className="search-box">
                  <span>?</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="关键词搜索..."
                  />
                </label>
                <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
                  {logLevels.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select value={windowFilter} readOnly>
                  {logWindows.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <button className="refresh-button">刷新</button>
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
