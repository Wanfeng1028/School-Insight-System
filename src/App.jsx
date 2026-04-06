import { useEffect, useMemo, useState } from "react";
import AuthBackground from "./components/AuthBackground";
import BarChart from "./components/BarChart";
import LineChart from "./components/LineChart";
import TrajectoryCanvas from "./components/TrajectoryCanvas";
import VideoTrackingPlayer from "./components/VideoTrackingPlayer";
import {
  logLevels,
  logSources,
  logWindows,
  metricCards as fallbackMetricCards,
  trackSeeds,
  trendHours as fallbackTrendHours,
  trendValues as fallbackTrendValues,
  zoneDurations as fallbackZoneDurations,
} from "./data";
import {
  downloadReport,
  fetchCameras,
  fetchHealth,
  fetchLogs,
  fetchMe,
  fetchOverview,
  forgotPassword,
  login,
  logout,
  register,
  resetPassword,
  runTrackingAnalysis,
  uploadBatch,
} from "./hooks/api";
import { API_BASE } from "./hooks/api";
import { connectTrackStream } from "./hooks/realtime";

const UI = {
  brandMonitor: "XX校园智能监控系统",
  brandConsole: "轨迹分析控制台",
  navMonitor: "实时监控",
  navOverview: "统计概览",
  navLogs: "事件日志",
  subUpload: "视频绑定",
  subTrack: "轨迹画布",
  subAnalyze: "视频追踪",
  logout: "退出登录",
  monitorTitle: "实时监控",
  monitorSubtitle: "2026年03月18日 - 实时视频轨迹分析",
  apiOnline: "API 在线",
  apiFallback: "API 离线",
  redisOnline: "Redis",
  redisOffline: "Redis 离线",
  wsConnected: "WS 已连接",
  wsFallback: "WS 模拟模式",
  streamRunning: "数据流：运行中",
  streamIdle: "数据流：待命",
  uploadWaiting: "待导入视频源",
  uploadHint: "支持一次选择多个视频文件，并分别绑定到不同摄像头。上传完成后系统会自动进入实时轨迹分析。",
  chooseFile: "点击选择多个视频文件",
  dragFile: "或将多个文件拖拽到这里",
  fileTypes: "支持 MP4 / AVI / MOV，单文件 <= 300MB，可批量绑定摄像头",
  uploadBind: "批量上传并绑定",
  uploading: "上传中...",
  uploadDone: "批量上传成功，已切入轨迹监控。",
  uploadFailed: "批量上传失败，请检查后端服务。",
  pickFileFirst: "请先选择至少一个视频文件。",
  badType: "仅支持 MP4 / AVI / MOV 格式文件。",
  tooLarge: "存在超过 300MB 的文件，请移除后重试。",
  noData: "数据流：无数据",
  trackHint: "camera_id: 1 / buffer: ok / mode: realtime",
  trackingStart: "开始分析",
  trackingRunning: "追踪分析中...",
  trackingDone: "人物追踪分析完成，已同步到视频叠加画面。",
  trackingNeedVideo: "请先上传并绑定视频，再执行人物追踪分析。",
  trackingPanelTitle: "视频追踪画面",
  trackingPanelHint: "显示原画视频与人物追踪框叠加。",
  overviewTitle: "统计概览",
  exportReport: "导出报告",
  exporting: "导出中...",
  exportDone: "报告已开始下载。",
  exportFail: "报告导出失败，请检查后端服务。",
  trendTitle: "解析点数趋势 (24h)",
  zoneTitle: "区域停留时长 TOP",
  logsTitle: "事件日志",
  updatedPrefix: "最后更新",
  justNow: "刚刚",
  logsUnavailable: "日志服务暂时不可用，仅显示当前已加载内容。",
  logsEmpty: "当前筛选条件下暂无日志。",
  logsSource: "来源",
  logsContext: "上下文",
  logsPageSize: "每页条数",
  logsPageInfo: "第 {current} / {total} 页，共 {count} 条",
  logsPrev: "上一页",
  logsNext: "下一页",
  searchPlaceholder: "关键词搜索...",
  refresh: "刷新",
  collapseSidebar: "收起侧栏",
  expandSidebar: "展开侧栏",
  authTitle: "轨迹分析控制台",
  authSubtitle: "校园智能监控与实时轨迹分析中台",
  authLead: "面向园区安防与行为分析场景的统一控制台，覆盖视频接入、目标绑定、轨迹回放、日志审计与概览统计。",
  login: "登录",
  register: "注册",
  forgotPassword: "忘记密码",
  resetPassword: "重置密码",
  email: "邮箱",
  password: "密码",
  confirmPassword: "确认密码",
  displayName: "姓名",
  loginAction: "进入系统",
  registerAction: "创建账号",
  forgotAction: "发送验证码",
  resetAction: "更新密码",
  backToLogin: "返回登录",
  authHint: "演示默认管理员：admin@school.local / Admin12345",
  codeLabel: "验证码",
  batchTitle: "批量视频队列",
  batchEmpty: "当前未选择文件，请先拖入或点击选择视频文件。",
  bindingHeader: "绑定摄像头",
  batchCount: "批量数量",
  defaultCamera: "选择摄像头",
};

const navItems = [
  { key: "monitor", label: UI.navMonitor, icon: "M" },
  { key: "overview", label: UI.navOverview, icon: "S" },
  { key: "logs", label: UI.navLogs, icon: "L" },
];

const authHighlights = [
  { value: "24h", label: "持续监控", detail: "视频接入、轨迹抽样与事件审计集中管理" },
  { value: "6+", label: "区域模型", detail: "跑道、教学楼、沙池、游乐区等场景统一绑定" },
  { value: "WS", label: "实时轨迹", detail: "接入 WebSocket 推流与动态 Canvas 绘制链路" },
];

const authFeatures = [
  "登录、注册、忘记密码、重置密码一体化入口",
  "支持批量视频绑定摄像头并进入实时轨迹监控",
  "接入统计看板、事件日志与导出报告流程",
];

const ALLOWED_SUFFIXES = [".mp4", ".avi", ".mov"];
const MAX_UPLOAD_SIZE = 300 * 1024 * 1024;
const TOKEN_KEY = "school-insight-token";
const SIDEBAR_COLLAPSED_KEY = "school-insight-sidebar-collapsed";
const LOG_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const LOG_WINDOW_TO_HOURS = {
  最近1小时: 1,
  最近6小时: 6,
  最近24小时: 24,
};

function checkPasswordStrength(password) {
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score, valid: score === 4 };
}

function formatLogTime(value) {
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return value;
  const pad = (n) => String(n).padStart(2, "0");
  return `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())} ${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`;
}

function formatLogContext(context = {}) {
  const entries = Object.entries(context || {}).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (!entries.length) return "";
  return entries
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : value}`)
    .join(" · ");
}

function makeQueueItem(file, cameraId, index) {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
    file,
    cameraId,
    status: "pending",
    message: "等待上传",
  };
}

function validateFiles(files) {
  if (!files.length) return { ok: false, message: UI.pickFileFirst };
  for (const file of files) {
    const lower = file.name.toLowerCase();
    const matched = ALLOWED_SUFFIXES.some((suffix) => lower.endsWith(suffix));
    if (!matched) return { ok: false, message: `${file.name}：${UI.badType}` };
    if (file.size > MAX_UPLOAD_SIZE) return { ok: false, message: `${file.name}：${UI.tooLarge}` };
  }
  return { ok: true, message: `已载入 ${files.length} 个文件，等待批量绑定。` };
}

function parseApiError(error) {
  const text = String(error?.message || "");
  if (text.includes("invalid_credentials")) return "邮箱或密码错误。";
  if (text.includes("email_exists")) return "该邮箱已注册。";
  if (text.includes("missing_name")) return "请输入姓名。";
  if (text.includes("invalid_email")) return "请输入正确的邮箱地址。";
  if (text.includes("password_too_short")) return "密码至少 8 位。";
  if (text.includes("password_need_uppercase")) return "密码需包含大写字母。";
  if (text.includes("password_need_lowercase")) return "密码需包含小写字母。";
  if (text.includes("password_need_digit")) return "密码需包含数字。";
  if (text.includes("token_expired")) return "登录已过期，请重新登录。";
  if (text.includes("missing_token") || text.includes("invalid_token")) return "登录状态已失效，请重新登录。";
  if (text.includes("invalid_reset_code") || text.includes("invalid_reset_token")) return "验证码不正确。";
  if (text.includes("reset_code_expired") || text.includes("reset_token_expired")) return "验证码已过期。";
  if (text.includes("invalid_reset_request")) return "重置请求无效，请重新获取验证码。";
  if (text.includes("unsupported_file_type")) return UI.badType;
  if (text.includes("file_too_large")) return UI.tooLarge;
  if (text.includes("camera_ids_length_mismatch")) return "批量绑定数据不完整，请重新选择文件。";
  if (text.includes("no_uploaded_videos")) return UI.trackingNeedVideo;
  if (text.includes("video_not_found")) return "未找到可分析的视频。";
  if (text.includes("yolo_unavailable")) return "后端 YOLO 推理不可用：请确认已安装 ultralytics/opencv，并且存在 backend/yolov8n.pt 模型文件。";
  if (text.includes("network_error")) return "后端服务未启动、地址配置错误，或当前端口不可访问。";
  return "请求失败，请稍后重试。";
}

function resolveMediaUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const prefix = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${prefix}${path}`;
}

function App() {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY) || "");
  const [booting, setBooting] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState(UI.authHint);
  const [authError, setAuthError] = useState(false);
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "admin@school.local",
    password: "Admin12345",
    confirmPassword: "",
    resetCode: "",
  });
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("monitor");
  const [monitorMode, setMonitorMode] = useState("upload");
  const [videoUrl, setVideoUrl] = useState("");
  const [analysisDetections, setAnalysisDetections] = useState([]);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("上传并绑定视频后，点击开始分析。");
  const [queue, setQueue] = useState([]);
  const [uploadState, setUploadState] = useState("idle");
  const [uploadMessage, setUploadMessage] = useState(UI.noData);
  const [dragActive, setDragActive] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tracks, setTracks] = useState(trackSeeds);
  const [wsLive, setWsLive] = useState(false);
  const [health, setHealth] = useState({ api: false, redis: false, ws: false, stream_active: false, camera_id: "camera_id: 1", current_file: null, current_video_url: "", analysis_model: "待命" });
  const [overview, setOverview] = useState({
    metricCards: fallbackMetricCards,
    trendHours: fallbackTrendHours,
    trendValues: fallbackTrendValues,
    zoneDurations: fallbackZoneDurations,
  });
  const [logs, setLogs] = useState([]);
  const [logsError, setLogsError] = useState("");
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(20);
  const [cameras, setCameras] = useState([{ id: "camera_id: 1", name: "默认摄像头" }]);
  const [lastUpdated, setLastUpdated] = useState(UI.justNow);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("全部级别");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [windowFilter, setWindowFilter] = useState("最近1小时");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const authView = {
    login: { title: UI.login, action: UI.loginAction, desc: "使用已有账号进入监控控制台。" },
    register: { title: UI.register, action: UI.registerAction, desc: "创建新账号并自动进入系统。" },
    forgot: { title: UI.forgotPassword, action: UI.forgotAction, desc: "通过邮箱生成短时验证码。" },
    reset: { title: UI.resetPassword, action: UI.resetAction, desc: "输入验证码后设置新的登录密码。" },
  };

  const setSession = (nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    window.localStorage.setItem(TOKEN_KEY, nextToken);
  };

  const clearSession = () => {
    setToken("");
    setUser(null);
    setWsLive(false);
    window.localStorage.removeItem(TOKEN_KEY);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => !current);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      // ignore storage write failures
    }
  }, [sidebarCollapsed]);

  const loadHealth = () => {
    return fetchHealth(token)
      .then((data) => {
        setHealth({
          api: !!data.api,
          redis: !!data.redis,
          ws: !!data.ws,
          stream_active: !!data.stream_active,
          camera_id: data.camera_id || "camera_id: 1",
          current_file: data.current_file || null,
          current_video_url: data.current_video_url || "",
          analysis_model: data.analysis_model || "待命",
        });
        if (data.user) {
          setUser(data.user);
        }
        setVideoUrl(resolveMediaUrl(data.current_video_url || ""));
      })
      .catch((error) => {
        if (String(error?.message || "").includes("invalid_token")) {
          clearSession();
        }
        setHealth({ api: false, redis: false, ws: false, stream_active: false, camera_id: "camera_id: 1", current_file: null, current_video_url: "", analysis_model: "待命" });
        setVideoUrl("");
      });
  };

  const loadOverview = () => {
    return fetchOverview(token)
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

  const loadLogs = (
    nextLevel = levelFilter,
    nextWindow = windowFilter,
    nextSearch = search,
    nextSource = sourceFilter,
    nextPage = logPage,
    nextPageSize = logPageSize,
  ) => {
    const backendLevel = nextLevel === "全部级别" ? "ALL" : nextLevel;
    return fetchLogs(token, {
      level: backendLevel,
      search: nextSearch.trim(),
      source: nextSource,
      sinceHours: LOG_WINDOW_TO_HOURS[nextWindow] || 1,
      limit: nextPageSize,
      offset: (Math.max(nextPage, 1) - 1) * nextPageSize,
    })
      .then((data) => {
        const items = Array.isArray(data?.items) ? data.items : [];
        setLogs(items.map((item) => ({ ...item, ts: formatLogTime(item.ts) })));
        setLogTotal(Number(data?.total || 0));
        setLogsError("");
        setLastUpdated(UI.justNow);
      })
      .catch((error) => {
        if (String(error?.message || "").includes("invalid_token")) {
          clearSession();
        }
        setLogs([]);
        setLogTotal(0);
        setLogsError(UI.logsUnavailable);
        setLastUpdated("日志服务异常");
      });
  };

  const loadCameras = () => {
    return fetchCameras(token)
      .then((items) => {
        if (Array.isArray(items) && items.length) {
          setCameras(items);
          setQueue((current) => current.map((entry) => ({ ...entry, cameraId: entry.cameraId || items[0].id })));
        }
      })
      .catch(() => {
        setCameras([{ id: "camera_id: 1", name: "默认摄像头" }]);
      });
  };

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }
    fetchMe(token)
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (!token || !user) return undefined;

    loadHealth();
    loadOverview();
    loadLogs(levelFilter, windowFilter, search, sourceFilter, logPage, logPageSize);
    loadCameras();

    const healthTimer = window.setInterval(() => {
      loadHealth();
    }, 5000);
    const overviewTimer = window.setInterval(() => {
      loadOverview();
    }, 12000);
    const logsTimer = window.setInterval(() => {
      loadLogs(levelFilter, windowFilter, search, sourceFilter, logPage, logPageSize);
    }, 8000);

    return () => {
      window.clearInterval(healthTimer);
      window.clearInterval(overviewTimer);
      window.clearInterval(logsTimer);
    };
  }, [token, user, levelFilter, windowFilter, search, sourceFilter, logPage, logPageSize]);

  useEffect(() => {
    setLogPage(1);
  }, [levelFilter, windowFilter, search, sourceFilter, logPageSize]);

  // 实时更新时间
  useEffect(() => {
    const timeTimer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => window.clearInterval(timeTimer);
  }, []);

  // 格式化当前时间
  const formattedDateTime = useMemo(() => {
    const pad = (n) => String(n).padStart(2, "0");
    const year = currentTime.getFullYear();
    const month = pad(currentTime.getMonth() + 1);
    const day = pad(currentTime.getDate());
    const hours = pad(currentTime.getHours());
    const minutes = pad(currentTime.getMinutes());
    const seconds = pad(currentTime.getSeconds());
    return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
  }, [currentTime]);

  useEffect(() => {
    if (!token || activePage !== "monitor" || monitorMode !== "track") {
      return undefined;
    }

    let closed = false;
    const socket = connectTrackStream({
      token,
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
  }, [token, activePage, monitorMode]);

  const visibleLogs = useMemo(() => logs, [logs]);
  const totalLogPages = useMemo(() => Math.max(1, Math.ceil(logTotal / logPageSize)), [logTotal, logPageSize]);
  const logPageInfo = useMemo(
    () => UI.logsPageInfo.replace("{current}", String(Math.min(logPage, totalLogPages))).replace("{total}", String(totalLogPages)).replace("{count}", String(logTotal)),
    [logPage, totalLogPages, logTotal],
  );

  const refreshLogs = () => {
    loadLogs(levelFilter, windowFilter, search, sourceFilter, logPage, logPageSize);
  };

  const applyFiles = (files) => {
    const fileList = Array.from(files || []);
    const result = validateFiles(fileList);
    if (!result.ok) {
      setQueue([]);
      setUploadState("error");
      setUploadMessage(result.message);
      return;
    }
    const defaultCamera = cameras[0]?.id || "camera_id: 1";
    setQueue(fileList.map((file, index) => makeQueueItem(file, defaultCamera, index)));
    setUploadState("idle");
    setUploadMessage(result.message);
  };

  const updateQueueCamera = (id, cameraId) => {
    setQueue((current) => current.map((entry) => (entry.id === id ? { ...entry, cameraId } : entry)));
  };

  const removeQueueItem = (id) => {
    setQueue((current) => current.filter((entry) => entry.id !== id));
  };

  const handleBatchUpload = async () => {
    const result = validateFiles(queue.map((entry) => entry.file));
    if (!result.ok) {
      setUploadState("error");
      setUploadMessage(result.message);
      return;
    }

    try {
      setUploadState("uploading");
      setUploadMessage(UI.uploading);
      setQueue((current) => current.map((entry) => ({ ...entry, status: "uploading", message: "上传中" })));
      const data = await uploadBatch(queue, token);
      const statusMap = new Map(data.items.map((item) => [item.filename, item]));
      setQueue((current) =>
        current.map((entry) => {
          const matched = statusMap.get(entry.file.name);
          if (!matched) return { ...entry, status: "done", message: "已上传" };
          return { ...entry, status: "done", message: `${matched.camera_id} / 已绑定` };
        }),
      );
      setUploadState("success");
      setUploadMessage(`${UI.uploadDone} 共 ${data.count} 个文件。`);
      setAnalysisMessage("视频已绑定完成，可以开始人物追踪分析。");
      await Promise.all([loadHealth(), loadOverview(), loadLogs(levelFilter, windowFilter, search, sourceFilter, logPage, logPageSize)]);
      setMonitorMode("track");
    } catch (error) {
      setUploadState("error");
      setUploadMessage(parseApiError(error) || UI.uploadFailed);
      setQueue((current) => current.map((entry) => ({ ...entry, status: "error", message: "上传失败" })));
    }
  };



  const handleTrackingAnalysis = async () => {
    try {
      setAnalysisBusy(true);
      setAnalysisMessage(UI.trackingRunning);
      const data = await runTrackingAnalysis(token, health.current_file || null);
      setTracks(data.tracks || trackSeeds);
      setAnalysisDetections(data.detections || []);
      setVideoUrl(resolveMediaUrl(data.video_url || health.current_video_url || ""));
      setMonitorMode("video");
      setAnalysisMessage(UI.trackingDone + " 模型：" + (data.mode === "yolo" ? "YOLOv8" : "模拟"));
      await Promise.all([loadHealth(), loadOverview(), loadLogs(levelFilter, windowFilter, search, sourceFilter, logPage, logPageSize)]);
    } catch (error) {
      setAnalysisMessage(parseApiError(error));
    } finally {
      setAnalysisBusy(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await downloadReport(token);
      setLastUpdated(UI.exportDone);
    } catch {
      setLastUpdated(UI.exportFail);
    } finally {
      setExporting(false);
    }
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(false);

    try {
      if (authMode === "login") {
        const data = await login({ email: authForm.email, password: authForm.password });
        setSession(data.token, data.user);
        setAuthMessage("登录成功。正在进入控制台。");
      } else if (authMode === "register") {
        if (authForm.password !== authForm.confirmPassword) {
          throw new Error("confirm_mismatch");
        }
        const data = await register({ name: authForm.name, email: authForm.email, password: authForm.password });
        setSession(data.token, data.user);
        setAuthMessage("注册成功，已自动登录。");
      } else if (authMode === "forgot") {
        const data = await forgotPassword({ email: authForm.email });
        setAuthForm((current) => ({ ...current, resetCode: data.verification_code || current.resetCode }));
        setAuthMessage(data.verification_code ? `验证码：${data.verification_code}，15 分钟内有效。` : "如果账号存在，验证码已生成。");
        setAuthMode("reset");
      } else {
        if (authForm.password !== authForm.confirmPassword) {
          throw new Error("confirm_mismatch");
        }
        const data = await resetPassword({ email: authForm.email, code: authForm.resetCode, password: authForm.password });
        setAuthMessage(data.message);
        setAuthMode("login");
      }
    } catch (error) {
      const text = String(error?.message || "");
      setAuthError(true);
      setAuthMessage(text.includes("confirm_mismatch") ? "两次输入的密码不一致。" : parseApiError(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout(token);
    } catch {
      // ignore logout errors during local cleanup
    }
    clearSession();
    setAuthMode("login");
    setAuthMessage(UI.authHint);
  };

  const uploadTipClass = uploadState === "success" ? "success" : uploadState === "error" ? "error" : queue.length ? "success" : "error";

  if (booting) {
    return <div className="auth-shell"><AuthBackground /><div className="auth-card compact"><h1>正在校验会话...</h1></div></div>;
  }

  if (!token || !user) {
    return (
      <div className="auth-shell">
        <AuthBackground />
        <div className="auth-card auth-card-wide">
          <section className="auth-showcase">
            <div className="auth-brand auth-brand-large">
              <div>
                <h1>{UI.authTitle}</h1>
                <p>{UI.authSubtitle}</p>
              </div>
            </div>

            <p className="auth-lead">{UI.authLead}</p>

            <div className="auth-highlight-grid">
              {authHighlights.map((item) => (
                <article className="auth-highlight-card" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>

            <div className="auth-feature-block">
              <span className="auth-feature-eyebrow">核心能力</span>
              <ul className="auth-feature-list">
                {authFeatures.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="auth-demo-card">
              <span>演示账号</span>
              <strong>admin@school.local</strong>
              <em>Admin12345</em>
            </div>
          </section>

          <section className="auth-panel">
            <div className="auth-panel-top">
              <div>
                <h2>{authView[authMode].title}</h2>
                <p>{authView[authMode].desc}</p>
              </div>
            </div>

            <div className="auth-tabs auth-tabs-compact">
              {["login", "register", "forgot", "reset"].map((key) => (
                <button
                  key={key}
                  className={`auth-tab ${authMode === key ? "active" : ""}`}
                  onClick={() => {
                    setAuthMode(key);
                    setAuthError(false);
                    setAuthMessage(key === "login" ? UI.authHint : "请填写表单后继续。");
                  }}
                  type="button"
                >
                  {authView[key].title}
                </button>
              ))}
            </div>

            <form className="auth-form auth-form-stack" onSubmit={handleAuthSubmit}>
              {authMode === "register" && (
                <label>
                  <span>{UI.displayName}</span>
                  <input value={authForm.name} onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))} />
                </label>
              )}

              <label>
                <span>{UI.email}</span>
                <input type="email" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} />
              </label>

              {authMode === "reset" && (
                <label>
                  <span>{UI.codeLabel}</span>
                  <input value={authForm.resetCode} onChange={(event) => setAuthForm((current) => ({ ...current, resetCode: event.target.value }))} />
                </label>
              )}

              {authMode !== "forgot" && (
                <label>
                  <span>{UI.password}</span>
                  <input type="password" value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} />
                  {(authMode === "register" || authMode === "reset") && authForm.password && (
                    <div className="password-strength-hint" style={{ fontSize: "12px", marginTop: "4px", color: "#888" }}>
                      {(() => {
                        const { checks, score, valid } = checkPasswordStrength(authForm.password);
                        const items = [
                          checks.length ? "✓" : "✗",
                          checks.upper ? "✓" : "✗",
                          checks.lower ? "✓" : "✗",
                          checks.digit ? "✓" : "✗",
                        ];
                        const labels = ["8位以上", "大写字母", "小写字母", "数字"];
                        const color = valid ? "#22c55e" : score >= 2 ? "#f59e0b" : "#ef4444";
                        return (
                          <span style={{ color }}>
                            密码强度: {items.map((icon, i) => `${labels[i]}${icon}`).join(" ")}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </label>
              )}

              {(authMode === "register" || authMode === "reset") && (
                <label>
                  <span>{UI.confirmPassword}</span>
                  <input type="password" value={authForm.confirmPassword} onChange={(event) => setAuthForm((current) => ({ ...current, confirmPassword: event.target.value }))} />
                </label>
              )}

              <button className="primary-button auth-submit" disabled={authBusy} type="submit">
                {authBusy ? "处理中..." : authView[authMode].action}
              </button>
            </form>

            <div className={`auth-message ${authError ? "error" : "success"}`}>{authMessage}</div>

            <div className="auth-links">
              <button type="button" onClick={() => setAuthMode("login")}>{UI.backToLogin}</button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-title">
            <div className="brand-copy">{UI.brandMonitor}</div>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={toggleSidebar}
            aria-label={UI.collapseSidebar}
            title={UI.collapseSidebar}
          >
            ←
          </button>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${activePage === item.key ? "active" : ""}`}
              onClick={() => setActivePage(item.key)}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="avatar">{(user.name || "U").slice(0, 2).toUpperCase()}</div>
            <div>
              <div className="user-name">{user.name}</div>
              <div className="user-tags">
                <span>{user.role}</span>
                <span>{user.email}</span>
              </div>
            </div>
          </div>
          <button className="ghost-button" onClick={handleLogout}>{UI.logout}</button>
        </div>
      </aside>

      {sidebarCollapsed ? (
        <button
          className="sidebar-reveal"
          type="button"
          onClick={toggleSidebar}
          aria-label={UI.expandSidebar}
          title={UI.expandSidebar}
        >
          ☰
        </button>
      ) : null}

      <main className="main-panel">
        {activePage === "monitor" && (
          <>
            <header className="topbar">
              <div>
                <h1>{UI.monitorTitle}</h1>
                <p>{formattedDateTime} - 实时视频轨迹分析</p>
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
                <div className="subnav-tabs">
                  <button className={`subnav-button ${monitorMode === "upload" ? "active" : ""}`} onClick={() => setMonitorMode("upload")}>{UI.subUpload}</button>
                  <button className={`subnav-button ${monitorMode === "track" ? "active" : ""}`} onClick={() => setMonitorMode("track")}>{UI.subTrack}</button>
                  <button className={`subnav-button ${monitorMode === "video" ? "active" : ""}`} onClick={() => setMonitorMode("video")}>{UI.subAnalyze}</button>
                </div>
              </div>

              <div className={`analysis-banner ${analysisBusy ? "busy" : ""}`}>
                <div>
                  <strong>人物追踪分析</strong>
                  <span>{analysisMessage}</span>
                </div>
                <button className="analysis-trigger" onClick={handleTrackingAnalysis} disabled={analysisBusy}>
                  {analysisBusy ? UI.trackingRunning : UI.trackingStart}
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
                      applyFiles(event.dataTransfer.files);
                    }}
                  >
                    <input
                      type="file"
                      multiple
                      accept=".mp4,.avi,.mov"
                      onChange={(event) => applyFiles(event.target.files)}
                    />
                    <div className="dropzone-plus">+</div>
                    <strong>{UI.chooseFile}</strong>
                    <em>{UI.dragFile}</em>
                    <span>{UI.fileTypes}</span>
                  </label>

                  <div className="batch-board">
                    <div className="batch-board-head">
                      <h3>{UI.batchTitle}</h3>
                      <span>{UI.batchCount}：{queue.length}</span>
                    </div>
                    {queue.length ? (
                      <div className="batch-list">
                        {queue.map((entry, index) => (
                          <div className="batch-row" key={entry.id}>
                            <div className="batch-file">
                              <strong>{index + 1}. {entry.file.name}</strong>
                              <span>{(entry.file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                            <select value={entry.cameraId} onChange={(event) => updateQueueCamera(entry.id, event.target.value)}>
                              {cameras.map((camera) => (
                                <option key={camera.id} value={camera.id}>{camera.id} / {camera.name}</option>
                              ))}
                            </select>
                            <span className={`queue-badge ${entry.status}`}>{entry.message}</span>
                            <button className="queue-remove" type="button" onClick={() => removeQueueItem(entry.id)}>移除</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="batch-empty">{UI.batchEmpty}</div>
                    )}
                  </div>

                  <button className="primary-button" onClick={handleBatchUpload} disabled={uploadState === "uploading"}>
                    {uploadState === "uploading" ? UI.uploading : UI.uploadBind}
                  </button>
                  <div className={`upload-tip ${uploadTipClass}`}>{uploadMessage}</div>
                </div>
              ) : monitorMode === "track" ? (
                <div className="track-card">
                  <div className="track-card-head">
                    <h2>轨迹画布</h2>
                    <span>{UI.trackHint}</span>
                  </div>
                  <div className="trajectory-stage">
                    <TrajectoryCanvas tracks={tracks} />
                    <div className="stage-overlay">
                      <div className={`stage-status ${wsLive ? "online" : "muted"}`}>
                        <div className="stage-led" />
                        <span>{wsLive ? UI.wsConnected : UI.wsFallback}</span>
                      </div>
                    </div>
                    <div className="stage-controls">
                      <span>实时轨迹</span>
                      <div className="stage-timeline" />
                      <button className="stage-button">LIVE</button>
                    </div>
                  </div>
                </div>
              ) : (
                <VideoTrackingPlayer
                  videoUrl={videoUrl}
                  tracks={tracks}
                  detections={analysisDetections}
                  title={UI.trackingPanelTitle}
                  meta={UI.trackingPanelHint}
                  analysisBusy={analysisBusy}
                />
              )}
            </section>
          </>
        )}

        {activePage === "overview" && (
          <>
            <header className="topbar">
              <div>
                <h1>{UI.overviewTitle}</h1>
                <p className="topbar-inline">
                  <span>{UI.updatedPrefix}：{lastUpdated}</span>
                </p>
              </div>
              <div className="topbar-tags">
                <button className="outline-blue" onClick={handleExport} disabled={exporting}>
                  {exporting ? UI.exporting : UI.exportReport}
                </button>
              </div>
            </header>

            <section className="overview-grid">
              <div className="overview-hero">
                <div className="overview-hero-main">
                  <span className="overview-kicker">校园智能监控</span>
                  <h2>实时轨迹分析</h2>
                  <strong>多摄像头接入 · 人物追踪 · 行为分析</strong>
                  <p>基于 YOLOv8 深度学习模型的实时人物检测与轨迹追踪系统，支持多场景视频接入、目标绑定、轨迹回放与统计分析。</p>
                </div>
                <div className="overview-hero-pills">
                  <div className="hero-pill positive">
                    <div>
                      <strong>实时监控</strong>
                      <div>24小时在线</div>
                    </div>
                  </div>
                  <div className="hero-pill warning">
                    <div>
                      <strong>智能分析</strong>
                      <div>AI驱动检测</div>
                    </div>
                  </div>
                  <div className="hero-pill info">
                    <div>
                      <strong>轨迹追踪</strong>
                      <div>精准定位</div>
                    </div>
                  </div>
                  <div className="hero-pill info">
                    <div>
                      <strong>数据统计</strong>
                      <div>可视化报告</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="metric-row">
                {overview.metricCards.map((card, index) => (
                  <div className="metric-card" key={index}>
                    <div className="metric-label">{card.label}</div>
                    <div className="metric-main">
                      <strong>{card.value}</strong>
                      <em className={`metric-delta ${card.accent}`}>{card.delta}</em>
                    </div>
                  </div>
                ))}
              </div>

              <div className="panel-card">
                <h3>{UI.trendTitle}</h3>
                <div className="chart-host">
                  <LineChart hours={overview.trendHours} values={overview.trendValues} />
                </div>
              </div>

              <div className="panel-card side-panel">
                <h3>{UI.zoneTitle}</h3>
                <div className="chart-host compact">
                  <BarChart data={overview.zoneDurations} />
                </div>
              </div>
            </section>
          </>
        )}

        {activePage === "logs" && (
          <section className="log-shell">
            <header className="topbar topbar-plain">
              <div>
                <h1>{UI.logsTitle}</h1>
                <p className="topbar-inline">
                  <span>{UI.updatedPrefix}：{lastUpdated}</span>
                </p>
              </div>
            </header>

            <div className="log-toolbar">
              <div className="search-box">
                <span>🔍</span>
                <input
                  type="text"
                  placeholder={UI.searchPlaceholder}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
                {logLevels.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
              <select value={windowFilter} onChange={(event) => setWindowFilter(event.target.value)}>
                {logWindows.map((window) => (
                  <option key={window} value={window}>{window}</option>
                ))}
              </select>
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                {logSources.map((source) => (
                  <option key={source.value} value={source.value}>{source.label}</option>
                ))}
              </select>
              <select value={logPageSize} onChange={(event) => setLogPageSize(Number(event.target.value))}>
                {LOG_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{UI.logsPageSize}：{size}</option>
                ))}
              </select>
              <button className="refresh-button" onClick={refreshLogs}>{UI.refresh}</button>
            </div>

            {logsError ? <div className="upload-tip error">{logsError}</div> : null}
            {!logsError && !visibleLogs.length ? <div className="upload-tip">{UI.logsEmpty}</div> : null}

            <div className="log-viewer">
              <div className="log-viewer-head">
                <span>时间戳</span>
                <span>级别</span>
                <span>{UI.logsSource}</span>
                <span>事件描述</span>
              </div>
              <div className="log-list">
                {visibleLogs.map((entry, index) => (
                  <div className="log-row" key={index}>
                    <div className="log-time">{entry.ts}</div>
                    <div className={`log-level ${entry.level.toLowerCase()}`}>{entry.level}</div>
                    <div className={`log-source source-${(entry.source || "app").toLowerCase()}`}>{entry.source || "app"}</div>
                    <div className="log-text-block">
                      <div className="log-text">{entry.text}</div>
                      {entry.context ? <div className="log-context">{formatLogContext(entry.context)}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="log-pagination">
              <span className="log-pagination-info">{logPageInfo}</span>
              <div className="log-pagination-actions">
                <button className="outline-blue" disabled={logPage <= 1} onClick={() => setLogPage((current) => Math.max(1, current - 1))}>{UI.logsPrev}</button>
                <button className="outline-blue" disabled={logPage >= totalLogPages || !visibleLogs.length} onClick={() => setLogPage((current) => Math.min(totalLogPages, current + 1))}>{UI.logsNext}</button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;


