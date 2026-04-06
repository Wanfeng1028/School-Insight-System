import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCamera,
  deleteCamera,
  fetchCameras,
  getCameraMjpegUrl,
  startCamera,
  stopCamera,
  updateCamera,
} from "../hooks/api";
import { connectCameraInferenceStream } from "../hooks/realtime";

const EMPTY_FORM = {
  name: "",
  source_type: "mock",
  source_url: "",
  enabled: true,
  fps_limit: 6,
};

function parseMonitorError(error) {
  const text = String(error?.message || "");
  if (text.includes("missing_token") || text.includes("invalid_token") || text.includes("token_expired")) return "登录状态已失效，请重新登录。";
  if (text.includes("forbidden")) return "仅管理员可管理摄像头。";
  if (text.includes("camera_not_found")) return "摄像头不存在或已被删除。";
  if (text.includes("missing_camera_name")) return "请填写摄像头名称。";
  if (text.includes("network_error")) return "后端服务暂不可用，请确认接口已启动。";
  return "操作失败，请稍后重试。";
}

function getStatusMeta(runtime = {}) {
  if (runtime.last_error) {
    return { label: "异常", tone: "error" };
  }
  if (runtime.online) {
    return { label: "在线", tone: "success" };
  }
  if (runtime.status === "starting") {
    return { label: "启动中", tone: "info" };
  }
  if (runtime.status === "stopped") {
    return { label: "已停止", tone: "muted" };
  }
  return { label: "待机", tone: "muted" };
}

function bboxToStyle([x1, y1, x2, y2]) {
  return {
    left: `${x1 * 100}%`,
    top: `${y1 * 100}%`,
    width: `${Math.max((x2 - x1) * 100, 3)}%`,
    height: `${Math.max((y2 - y1) * 100, 5)}%`,
  };
}

export default function MonitorDashboard({ token }) {
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [isCreatingCamera, setIsCreatingCamera] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [fullscreenCameraId, setFullscreenCameraId] = useState("");
  const [draft, setDraft] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("info");
  const [streams, setStreams] = useState({});
  const formPanelRef = useRef(null);

  const loadCameras = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const items = await fetchCameras(token);
      setCameras(Array.isArray(items) ? items : []);
    } catch (error) {
      setMessage(parseMonitorError(error));
      setMessageTone("error");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadCameras();
    const timer = window.setInterval(() => {
      loadCameras({ silent: true });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [token]);

  useEffect(() => {
    if (!selectedCameraId && cameras.length && !isCreatingCamera) {
      setSelectedCameraId(cameras[0].id);
      return;
    }
    if (selectedCameraId && !cameras.some((camera) => camera.id === selectedCameraId)) {
      setSelectedCameraId(cameras[0]?.id || "");
    }
  }, [cameras, isCreatingCamera, selectedCameraId]);

  const selectedCamera = useMemo(
    () => cameras.find((camera) => camera.id === selectedCameraId) || null,
    [cameras, selectedCameraId],
  );

  useEffect(() => {
    if (!selectedCamera) {
      setDraft(EMPTY_FORM);
      return;
    }
    setDraft({
      name: selectedCamera.name || "",
      source_type: selectedCamera.source_type || "mock",
      source_url: selectedCamera.source_url || "",
      enabled: !!selectedCamera.enabled,
      fps_limit: selectedCamera.fps_limit || 6,
    });
  }, [selectedCamera]);

  const activeCameras = useMemo(
    () => cameras.filter((camera) => camera.enabled).slice(0, 9),
    [cameras],
  );

  useEffect(() => {
    const sockets = new Map();
    activeCameras.forEach((camera) => {
      const socket = connectCameraInferenceStream({
        cameraId: camera.id,
        token,
        onMessage: (payload) => {
          setStreams((current) => ({ ...current, [camera.id]: payload }));
        },
        onError: () => {
          setStreams((current) => ({ ...current, [camera.id]: { camera_id: camera.id, boxes: [], tracks: [], stats: { online: false, last_error: "连接异常" } } }));
        },
      });
      sockets.set(camera.id, socket);
    });

    return () => {
      sockets.forEach((socket) => socket.close());
    };
  }, [activeCameras, token]);

  const liveTargets = useMemo(
    () => activeCameras.flatMap((camera) => {
      const payload = streams[camera.id];
      const boxes = Array.isArray(payload?.boxes) ? payload.boxes : [];
      return boxes.map((box) => ({
        cameraId: camera.id,
        cameraName: camera.name,
        trackId: box.track_id,
        label: box.label,
        conf: box.conf,
        color: box.color,
      }));
    }),
    [activeCameras, streams],
  );

  const fullscreenCamera = useMemo(
    () => activeCameras.find((camera) => camera.id === fullscreenCameraId) || null,
    [activeCameras, fullscreenCameraId],
  );

  useEffect(() => {
    if (!fullscreenCameraId) {
      return undefined;
    }

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        setFullscreenCameraId("");
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [fullscreenCameraId]);

  const handleCreateNew = () => {
    setIsCreatingCamera(true);
    setSelectedCameraId("");
    setDraft({ ...EMPTY_FORM });
    setMessage("");
    setIsDeleteConfirmOpen(false);
    setIsEditorOpen(true);
  };

  const handleEditCamera = (cameraId) => {
    setIsCreatingCamera(false);
    setSelectedCameraId(cameraId);
    setIsDeleteConfirmOpen(false);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsDeleteConfirmOpen(false);
    setIsEditorOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedCamera) {
        await updateCamera(token, selectedCamera.id, draft);
        setMessage("摄像头配置已更新。");
        setIsCreatingCamera(false);
      } else {
        const created = await createCamera(token, draft);
        setIsCreatingCamera(false);
        setSelectedCameraId(created.id);
        setMessage("摄像头已创建。");
      }
      setMessageTone("success");
      await loadCameras({ silent: true });
      setIsDeleteConfirmOpen(false);
      setIsEditorOpen(false);
    } catch (error) {
      setMessage(parseMonitorError(error));
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCamera) return;
    setSaving(true);
    try {
      await deleteCamera(token, selectedCamera.id);
      setMessage("摄像头已删除。");
      setMessageTone("success");
      setSelectedCameraId("");
      setIsCreatingCamera(false);
      await loadCameras({ silent: true });
      setIsDeleteConfirmOpen(false);
      setIsEditorOpen(false);
    } catch (error) {
      setMessage(parseMonitorError(error));
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (camera) => {
    setSaving(true);
    try {
      if (camera.enabled) {
        await stopCamera(token, camera.id);
        setMessage(`已停止 ${camera.name}`);
      } else {
        await startCamera(token, camera.id);
        setMessage(`已启动 ${camera.name}`);
      }
      setMessageTone("success");
      await loadCameras({ silent: true });
    } catch (error) {
      setMessage(parseMonitorError(error));
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  };

  const openFullscreen = (cameraId) => {
    setFullscreenCameraId(cameraId);
  };

  const closeFullscreen = () => {
    setFullscreenCameraId("");
  };

  return (
    <section className="monitor-dashboard">
      <header className="monitor-dashboard-head">
        <div>
          <h1>实时监控大屏</h1>
          <p>多路摄像头实时预览、目标框叠加、状态诊断与活跃目标联动。</p>
        </div>
        <div className="monitor-dashboard-actions">
          <button className="outline-blue" data-testid="camera-create-trigger" type="button" onClick={handleCreateNew}>新建摄像头</button>
          <span className="monitor-dashboard-count">启用中 {activeCameras.length} / 总数 {cameras.length}</span>
        </div>
      </header>

      {message && messageTone === "error" ? <div className={`monitor-feedback ${messageTone}`}>{message}</div> : null}

      <div className="monitor-layout">
        <div className="camera-grid" data-testid="camera-grid">
          {loading ? <div className="camera-empty">正在加载监控流...</div> : null}
          {!loading && !activeCameras.length ? <div className="camera-empty">暂无已启用摄像头，请在右侧创建或启用摄像头。</div> : null}
          {activeCameras.map((camera) => {
            const payload = streams[camera.id] || { boxes: [], tracks: [], stats: camera.runtime || {} };
            const runtime = camera.runtime || {};
            const status = getStatusMeta(runtime);
            return (
              <article className="camera-tile" data-testid="camera-tile" key={camera.id}>
                <div className="camera-tile-head">
                  <div>
                    <strong>{camera.name}</strong>
                    <span>{camera.id}</span>
                  </div>
                  <span className={`camera-status ${status.tone}`}>{status.label}</span>
                </div>
                <div className="camera-canvas">
                  <img src={getCameraMjpegUrl(camera.id, token)} alt={camera.name} />
                  <div className="camera-overlay">
                    {(payload.boxes || []).map((box) => (
                      <div className="camera-bbox" data-testid="camera-bbox" key={`${camera.id}-${box.track_id}`} style={bboxToStyle(box.bbox)}>
                        <span>{box.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="camera-tile-meta">
                  <span>模型：{runtime.model || "mock"}</span>
                  <span>FPS：{runtime.fps || 0}</span>
                  <span>目标：{runtime.active_targets || payload.boxes?.length || 0}</span>
                </div>
                <div className="camera-tile-actions">
                  <button className="camera-fullscreen-button" data-testid="camera-fullscreen-trigger" type="button" onClick={() => openFullscreen(camera.id)}>进入全屏</button>
                </div>
                {runtime.last_error ? <div className="camera-error">{runtime.last_error}</div> : null}
              </article>
            );
          })}
        </div>

        <aside className="monitor-sidebar">
          <section className="monitor-panel">
            <div className="monitor-panel-head">
              <h2>摄像头列表</h2>
              <span>{cameras.length} 路</span>
            </div>
            <div className="camera-list">
              {cameras.map((camera) => {
                const status = getStatusMeta(camera.runtime || {});
                const isEditing = !isCreatingCamera && selectedCameraId === camera.id;
                return (
                  <div
                    className={`camera-list-item ${isEditing ? "active editing" : ""}`}
                    data-testid="camera-list-item"
                    key={camera.id}
                  >
                    <div className="camera-list-main">
                      <strong>{camera.name}</strong>
                      <span>{camera.source_type} / {camera.id}</span>
                    </div>
                    <div className="camera-list-actions">
                      <button
                        className={`camera-edit-button ${isEditing ? "active" : ""}`}
                        data-testid="camera-edit-trigger"
                        type="button"
                        aria-label={`编辑摄像头 ${camera.name}`}
                        title={`编辑摄像头 ${camera.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEditCamera(camera.id);
                        }}
                      >
                        ✎
                      </button>
                      <span className={`camera-status ${status.tone}`}>{status.label}</span>
                      <button className="camera-inline-action" type="button" onClick={(event) => { event.stopPropagation(); handleToggle(camera); }}>{camera.enabled ? "停止" : "启动"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="monitor-panel">
            <div className="monitor-panel-head">
              <h2>活跃目标</h2>
              <span>{liveTargets.length} 个</span>
            </div>
            {!liveTargets.length ? <div className="camera-empty compact">当前暂无活跃目标，启动 mock 摄像头后会自动生成演示框。</div> : null}
            <div className="live-target-list">
              {liveTargets.map((target) => (
                <button className="live-target-item" type="button" key={`${target.cameraId}-${target.trackId}`} onClick={() => setSelectedCameraId(target.cameraId)}>
                  <span className="live-target-dot" style={{ background: target.color || "#2f6df6" }} />
                  <div>
                    <strong>{target.label}</strong>
                    <span>{target.cameraName} · 置信度 {Math.round((target.conf || 0) * 100)}%</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {isEditorOpen ? (
        <div className="camera-editor-modal-backdrop" data-testid="camera-editor-modal" onClick={handleCloseEditor}>
          <section
            className="camera-editor-modal"
            aria-labelledby="camera-editor-title"
            aria-modal="true"
            ref={formPanelRef}
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="camera-editor-modal-head">
              <div>
                <h2 id="camera-editor-title">{selectedCamera && !isCreatingCamera ? "编辑摄像头" : "新建摄像头"}</h2>
                <p>{selectedCamera && !isCreatingCamera ? selectedCamera.name : "填写摄像头配置后即可创建并纳入监控列表。"}</p>
              </div>
              <button aria-label="关闭编辑窗口" className="camera-modal-close" type="button" onClick={handleCloseEditor}>×</button>
            </div>
            <div className="camera-form">
              <label>
                <span>摄像头名称</span>
                <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="例如：东侧操场入口" />
              </label>
              <label>
                <span>视频源类型</span>
                <select value={draft.source_type} onChange={(event) => setDraft((current) => ({ ...current, source_type: event.target.value }))}>
                  <option value="mock">mock</option>
                  <option value="file">file</option>
                  <option value="rtsp">rtsp</option>
                </select>
              </label>
              <label>
                <span>源地址 / 文件路径</span>
                <input value={draft.source_url} onChange={(event) => setDraft((current) => ({ ...current, source_url: event.target.value }))} placeholder="MVP mock 模式可留空" />
              </label>
              <label>
                <span>FPS 限制</span>
                <input type="number" min="1" max="12" value={draft.fps_limit} onChange={(event) => setDraft((current) => ({ ...current, fps_limit: Number(event.target.value || 6) }))} />
              </label>
              <label className="camera-switch-row">
                <span>保存后自动启用</span>
                <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />
              </label>
            </div>
            <div className="camera-form-actions">
              <button className="primary-button" type="button" disabled={saving} onClick={handleSave}>{saving ? "保存中..." : selectedCamera && !isCreatingCamera ? "保存修改" : "创建摄像头"}</button>
              {selectedCamera && !isCreatingCamera ? (
                <div className="camera-delete-wrap">
                  <button
                    className="outline-blue danger"
                    type="button"
                    disabled={saving}
                    onClick={() => setIsDeleteConfirmOpen((current) => !current)}
                  >
                    删除
                  </button>
                  {isDeleteConfirmOpen ? (
                    <div className="camera-delete-confirm" data-testid="camera-delete-confirm">
                      <strong>确认删除该摄像头？</strong>
                      <span>删除后将从监控配置列表中移除，且无法恢复。</span>
                      <div className="camera-delete-confirm-actions">
                        <button type="button" onClick={() => setIsDeleteConfirmOpen(false)}>取消</button>
                        <button className="danger-solid" type="button" disabled={saving} onClick={handleDelete}>确认删除</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {fullscreenCamera ? (
        <div className="camera-fullscreen-backdrop" data-testid="camera-fullscreen" onClick={closeFullscreen}>
          <section className="camera-fullscreen-panel" onClick={(event) => event.stopPropagation()}>
            <div className="camera-fullscreen-head">
              <div>
                <span className="camera-fullscreen-kicker">实时单路查看</span>
                <h2>{fullscreenCamera.name}</h2>
                <p>{fullscreenCamera.id}</p>
              </div>
              <div className="camera-fullscreen-head-actions">
                <span className={`camera-status ${getStatusMeta(fullscreenCamera.runtime || {}).tone}`}>{getStatusMeta(fullscreenCamera.runtime || {}).label}</span>
                <button className="camera-fullscreen-close" type="button" aria-label="退出全屏" onClick={closeFullscreen}>退出全屏</button>
              </div>
            </div>

            <div className="camera-fullscreen-stage">
              <img src={getCameraMjpegUrl(fullscreenCamera.id, token)} alt={fullscreenCamera.name} />
              <div className="camera-overlay">
                {((streams[fullscreenCamera.id]?.boxes) || []).map((box) => (
                  <div className="camera-bbox" key={`fullscreen-${fullscreenCamera.id}-${box.track_id}`} style={bboxToStyle(box.bbox)}>
                    <span>{box.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="camera-fullscreen-meta">
              <span>模型：{fullscreenCamera.runtime?.model || "mock"}</span>
              <span>FPS：{fullscreenCamera.runtime?.fps || 0}</span>
              <span>目标：{fullscreenCamera.runtime?.active_targets || streams[fullscreenCamera.id]?.boxes?.length || 0}</span>
              <span>状态：{getStatusMeta(fullscreenCamera.runtime || {}).label}</span>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
