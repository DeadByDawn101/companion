import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "../store.js";
import { api, type DirEntry, type CompanionEnv, type GitRepoInfo, type GitBranchInfo } from "../api.js";
import { connectSession, waitForConnection, sendToSession } from "../ws.js";
import { disconnectSession } from "../ws.js";
import { generateUniqueSessionName } from "../utils/names.js";
import { EnvManager } from "./EnvManager.js";
import { BRAND_NAME, BRAND_TAGLINE, IS_OPENCLAW_VARIANT } from "../config.js";

interface ImageAttachment {
  name: string;
  base64: string;
  mediaType: string;
}

function readFileAsBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mediaType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MODELS = [
  { value: "claude-opus-4-6", label: "Opus", icon: "\u2733" },
  { value: "claude-sonnet-4-5-20250929", label: "Sonnet", icon: "\u25D0" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku", icon: "\u26A1" },
];

const MODES = [
  { value: "bypassPermissions", label: "Agent" },
  { value: "plan", label: "Plan" },
];

const SISTERS = [
  { value: "camila", label: "Camila (default)" },
  { value: "maya", label: "Maya (trading)" },
  { value: "sheila", label: "Sheila (marketing)" },
  { value: "aria", label: "Aria (growth)" },
  { value: "nova", label: "Nova (infra)" },
  { value: "zara", label: "Zara (product)" },
  { value: "iris", label: "Iris (culture)" },
];

const RECENT_DIRS_KEY = "cc-recent-dirs";

function getRecentDirs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_DIRS_KEY) || "[]");
  } catch {
    return [];
  }
}

function addRecentDir(dir: string) {
  const dirs = getRecentDirs().filter((d) => d !== dir);
  dirs.unshift(dir);
  localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(dirs.slice(0, 8)));
}

function removeRecentDir(dir: string) {
  const dirs = getRecentDirs().filter((d) => d !== dir);
  localStorage.setItem(RECENT_DIRS_KEY, JSON.stringify(dirs));
}

function shortenPath(fullPath: string): string {
  const home = fullPath.startsWith("/Users/")
    ? `/Users/${fullPath.split("/")[2]}`
    : "";
  if (home && fullPath.startsWith(home)) {
    return "~" + fullPath.slice(home.length);
  }
  return fullPath;
}

function humanizeLaunchError(err: string): string {
  const t = (err || "").toLowerCase();
  if (t.includes("not logged in") || t.includes("/login")) {
    return "Connection needed: OpenClaw is on, but your coding engine session is not authenticated yet. Open OpenClaw Dashboard and complete device/account connect, then retry.";
  }
  if (t.includes("cannot be launched inside another claude code session") || t.includes("nested")) {
    return "Nested session blocked. Restart Companion from a normal terminal (not inside an active Claude/OpenClaw agent shell).";
  }
  if (t.includes("too many arguments for 'sessions'")) {
    return "OpenClaw bridge command mismatch detected. Please pull latest Companion and retry.";
  }
  return err;
}

let idCounter = 0;

export function HomePage() {
  const [text, setText] = useState("");
  const [model, setModel] = useState(MODELS[0].value);
  const [mode, setMode] = useState(MODES[0].value);
  const [sister, setSister] = useState("camila");
  const [cwd, setCwd] = useState(() => getRecentDirs()[0] || "");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [openclawHealth, setOpenclawHealth] = useState<{ ok: boolean; gatewayUrl: string; mode: string } | null>(null);
  const [openclawSessionCount, setOpenclawSessionCount] = useState<number | null>(null);
  const [openclawRelayUrl, setOpenclawRelayUrl] = useState<string>("");
  const [openclawSessions, setOpenclawSessions] = useState<Array<Record<string, unknown>>>([]);

  // Environment state
  const [envs, setEnvs] = useState<CompanionEnv[]>([]);
  const [selectedEnv, setSelectedEnv] = useState(() => localStorage.getItem("cc-selected-env") || "");
  const [showEnvDropdown, setShowEnvDropdown] = useState(false);
  const [showEnvManager, setShowEnvManager] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dropdown states
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showDirDropdown, setShowDirDropdown] = useState(false);
  const [browsePath, setBrowsePath] = useState("");
  const [browseDirs, setBrowseDirs] = useState<DirEntry[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [recentDirs, setRecentDirs] = useState(() => getRecentDirs());
  const [pickingFolder, setPickingFolder] = useState(false);

  // Worktree state
  const [gitRepoInfo, setGitRepoInfo] = useState<GitRepoInfo | null>(null);
  const [useWorktree, setUseWorktree] = useState(false);
  const [worktreeBranch, setWorktreeBranch] = useState("");
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branchFilter, setBranchFilter] = useState("");
  const [isNewBranch, setIsNewBranch] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const dirDropdownRef = useRef<HTMLDivElement>(null);
  const envDropdownRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  const setCurrentSession = useStore((s) => s.setCurrentSession);
  const currentSessionId = useStore((s) => s.currentSessionId);

  const refreshOpenClaw = useCallback(() => {
    api.getOpenClawHealth().then((h) => setOpenclawHealth({ ok: h.ok, gatewayUrl: h.gatewayUrl, mode: h.mode })).catch(() => setOpenclawHealth(null));
    api.getOpenClawConfig().then((cfg) => setOpenclawRelayUrl(cfg.relayUrl || "")).catch(() => {});
    api.getOpenClawSessions().then((d) => { setOpenclawSessionCount(d.count); setOpenclawSessions(d.sessions || []); }).catch(() => { setOpenclawSessionCount(null); setOpenclawSessions([]); });
  }, []);

  // Auto-focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Load server home/cwd on mount
  useEffect(() => {
    api.getHome().then(({ home, cwd: serverCwd }) => {
      if (!cwd) {
        setCwd(serverCwd || home);
      }
    }).catch(() => {});
    api.listEnvs().then(setEnvs).catch(() => {});
    if (!IS_OPENCLAW_VARIANT) return;
    refreshOpenClaw();
    const t = setInterval(refreshOpenClaw, 15000);
    return () => clearInterval(t);
  }, [refreshOpenClaw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setShowModeDropdown(false);
      }
      if (dirDropdownRef.current && !dirDropdownRef.current.contains(e.target as Node)) {
        setShowDirDropdown(false);
      }
      if (envDropdownRef.current && !envDropdownRef.current.contains(e.target as Node)) {
        setShowEnvDropdown(false);
      }
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setShowBranchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const loadDirs = useCallback(async (path?: string) => {
    setBrowseLoading(true);
    try {
      const result = await api.listDirs(path);
      setBrowsePath(result.path);
      setBrowseDirs(result.dirs);
    } catch {
      setBrowseDirs([]);
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  // Detect git repo when cwd changes
  useEffect(() => {
    if (!cwd) {
      setGitRepoInfo(null);
      return;
    }
    api.getRepoInfo(cwd).then((info) => {
      setGitRepoInfo(info);
      setUseWorktree(false);
      setWorktreeBranch(info.currentBranch);
      setIsNewBranch(false);
      api.listBranches(info.repoRoot).then(setBranches).catch(() => setBranches([]));
    }).catch(() => {
      setGitRepoInfo(null);
    });
  }, [cwd]);

  // Fetch branches when git repo changes
  useEffect(() => {
    if (gitRepoInfo) {
      api.listBranches(gitRepoInfo.repoRoot).then(setBranches).catch(() => setBranches([]));
    }
  }, [gitRepoInfo]);


  const selectedModel = MODELS.find((m) => m.value === model) || MODELS[0];
  const selectedMode = MODES.find((m) => m.value === mode) || MODES[0];
  const dirLabel = cwd ? cwd.split("/").pop() || cwd : "Select folder";

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newImages: ImageAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const { base64, mediaType } = await readFileAsBase64(file);
      newImages.push({ name: file.name, base64, mediaType });
    }
    setImages((prev) => [...prev, ...newImages]);
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const newImages: ImageAttachment[] = [];
    for (const item of Array.from(items)) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      const { base64, mediaType } = await readFileAsBase64(file);
      newImages.push({ name: `pasted-${Date.now()}.${file.type.split("/")[1]}`, base64, mediaType });
    }
    if (newImages.length > 0) {
      e.preventDefault();
      setImages((prev) => [...prev, ...newImages]);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 300) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      setMode(mode === "plan" ? "bypassPermissions" : "plan");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleSend() {
    const msg = text.trim();
    if (!msg || sending) return;

    setSending(true);
    setError("");

    // OpenClaw-first guardrail for retail onboarding flow
    if (IS_OPENCLAW_VARIANT && openclawHealth && !openclawHealth.ok) {
      setError("OpenClaw is not connected yet. Open OpenClaw app, approve this device, then press Refresh.");
      setSending(false);
      return;
    }

    try {
      // Disconnect current session if any
      if (currentSessionId) {
        disconnectSession(currentSessionId);
      }

      // Create session (with optional worktree)
      const branchName = worktreeBranch.trim() || undefined;
      const result = await api.createSession({
        model,
        permissionMode: mode,
        cwd: cwd || undefined,
        envSlug: selectedEnv || undefined,
        branch: branchName,
        createBranch: branchName && isNewBranch ? true : undefined,
        useWorktree: useWorktree || undefined,
      });
      const sessionId = result.sessionId;

      // Assign a random session name
      const existingNames = new Set(useStore.getState().sessionNames.values());
      const sessionName = generateUniqueSessionName(existingNames);
      useStore.getState().setSessionName(sessionId, sessionName);

      // Save cwd to recent dirs
      if (cwd) {
        addRecentDir(cwd);
        setRecentDirs(getRecentDirs());
      }

      // Store the permission mode for this session
      useStore.getState().setPreviousPermissionMode(sessionId, mode);
      useStore.getState().setSessionSister(sessionId, sister);

      // Switch to session
      setCurrentSession(sessionId);
      connectSession(sessionId);

      // Wait for WebSocket connection
      await waitForConnection(sessionId);

      // Send message
      sendToSession(sessionId, {
        type: "user_message",
        content: msg,
        session_id: sessionId,
        images: images.length > 0 ? images.map((img) => ({ media_type: img.mediaType, data: img.base64 })) : undefined,
      });

      // Add user message to store
      useStore.getState().appendMessage(sessionId, {
        id: `user-${Date.now()}-${++idCounter}`,
        role: "user",
        content: msg,
        images: images.length > 0 ? images.map((img) => ({ media_type: img.mediaType, data: img.base64 })) : undefined,
        timestamp: Date.now(),
      });
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      setError(humanizeLaunchError(raw));
      setSending(false);
    }
  }

  const canSend = text.trim().length > 0 && !sending;

  return (
    <div className="flex-1 h-full flex items-center justify-center px-3 sm:px-4 bg-noise">
      <div className="w-full max-w-2xl relative z-10 animate-[fadeSlideIn_0.4s_ease-out]">
        {/* Title */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-cc-fg tracking-tight mb-2" style={{ fontVariationSettings: "'SOFT' 100, 'WONK' 1" }}>
            {BRAND_NAME}
          </h1>
          <p className="text-sm text-cc-muted font-sans-ui">
            {BRAND_TAGLINE}
          </p>
        </div>


        {IS_OPENCLAW_VARIANT && openclawHealth && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${openclawHealth.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>
            <div className="font-medium">{openclawHealth.ok ? "Connected to OpenClaw" : "Connect OpenClaw"}</div>
            <div className="opacity-80">mode={openclawHealth.mode} • {openclawHealth.gatewayUrl}</div>
            <div className="opacity-80">sessions: {openclawSessionCount ?? "n/a"}</div>
            {!openclawHealth.ok && (
              <div className="mt-2 text-xs opacity-90">
                1) Start OpenClaw app/gateway  2) Approve this device  3) Refresh connection
              </div>
            )}
            <div className="mt-2 flex items-center gap-3">
              {openclawRelayUrl && (
                <a className="underline" href={`${openclawRelayUrl.replace(/\/$/,"")}/overview`} target="_blank" rel="noreferrer">Open Dashboard</a>
              )}
              <button onClick={refreshOpenClaw} className="text-xs underline opacity-90 hover:opacity-100">Refresh</button>
            </div>
            {openclawSessions.length > 0 && (
              <div className="mt-2 max-h-28 overflow-auto rounded-md border border-white/10 bg-black/10 p-2 text-xs">
                {openclawSessions.slice(0, 6).map((ses, idx) => (
                  <div key={idx} className="mb-1 truncate">
                    {(ses.label || ses.sessionKey || ses.id || "session") as string}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent project chips */}
        {recentDirs.length > 0 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-thin animate-[fadeIn_0.3s_ease-out]">
            {recentDirs.map((dir) => {
              const folderName = dir.split("/").pop() || dir;
              const shortPath = shortenPath(dir.split("/").slice(0, -1).join("/"));
              const isSelected = cwd === dir;
              return (
                <button
                  key={dir}
                  onClick={() => {
                    setCwd(dir);
                    addRecentDir(dir);
                    setRecentDirs(getRecentDirs());
                  }}
                  className={`group relative flex flex-col items-start shrink-0 px-3 py-2 rounded-xl border text-left transition-all duration-150 cursor-pointer btn-press ${
                    isSelected
                      ? "bg-cc-primary/10 border-cc-primary/30 text-cc-primary"
                      : "bg-cc-card border-cc-border text-cc-fg hover:border-cc-primary/20 hover:bg-cc-hover"
                  }`}
                >
                  <span className="text-xs font-semibold leading-tight">{folderName}</span>
                  <span className="text-[10px] text-cc-muted font-mono-code leading-tight mt-0.5">{shortPath}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecentDir(dir);
                      setRecentDirs(getRecentDirs());
                      if (cwd === dir) setCwd(getRecentDirs()[0] || "");
                    }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-cc-muted/80 text-white flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-cc-error"
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-2 h-2">
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Image thumbnails */}
        {images.length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap animate-[fadeIn_0.2s_ease-out]">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img
                  src={`data:${img.mediaType};base64,${img.base64}`}
                  alt={img.name}
                  className="w-14 h-14 rounded-xl object-cover border border-cc-border shadow-card"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-cc-error text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm btn-press"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Input card */}
        <div className="bg-cc-card border border-cc-border rounded-2xl shadow-card-lg overflow-hidden transition-shadow duration-300 hover:shadow-[0_2px_4px_rgba(0,0,0,0.03),0_12px_40px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)]">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask like Claude, build with Camila — code, plans, and execution..."
            rows={4}
            className="w-full px-5 pt-5 pb-2 text-[15px] bg-transparent resize-none focus:outline-none text-cc-fg font-sans-ui placeholder:text-cc-muted/60 leading-relaxed"
            style={{ minHeight: "110px", maxHeight: "300px" }}
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-3 pb-3">
            {/* Left: mode dropdown */}
            <div className="relative" ref={modeDropdownRef}>
              <button
                onClick={() => setShowModeDropdown(!showModeDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-cc-muted hover:text-cc-fg rounded-lg hover:bg-cc-hover transition-all duration-150 cursor-pointer btn-press"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                  <path d="M2 4h12M2 8h8M2 12h10" strokeLinecap="round" />
                </svg>
                {selectedMode.label}
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-40">
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </button>
              {showModeDropdown && (
                <div className="absolute left-0 bottom-full mb-1 w-40 bg-cc-card border border-cc-border rounded-xl shadow-dropdown z-10 py-1 overflow-hidden animate-[scaleIn_0.15s_ease-out]">
                  {MODES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => { setMode(m.value); setShowModeDropdown(false); }}
                      className={`w-full px-3 py-2 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer ${
                        m.value === mode ? "text-cc-primary font-medium" : "text-cc-fg"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: image placeholder + send */}
            <div className="flex items-center gap-1.5">
              {/* Image upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-all duration-150 cursor-pointer btn-press"
                title="Upload image"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                  <rect x="2" y="2" width="12" height="12" rx="2" />
                  <circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
                  <path d="M2 11l3-3 2 2 3-4 4 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 btn-press ${
                  canSend
                    ? "bg-cc-primary hover:bg-cc-primary-hover text-white cursor-pointer shadow-sm hover:shadow-md"
                    : "bg-cc-hover text-cc-muted cursor-not-allowed"
                }`}
                title="Send message"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M3 2l11 6-11 6V9.5l7-1.5-7-1.5V2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Below-card selectors */}
        <div className="flex items-center gap-1 sm:gap-2 mt-3 sm:mt-4 px-1 flex-wrap">
          {/* Folder selector */}
          <div className="relative" ref={dirDropdownRef}>
            <button
              onClick={() => {
                if (!showDirDropdown) {
                  setShowDirDropdown(true);
                  loadDirs(cwd || undefined);
                } else {
                  setShowDirDropdown(false);
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-cc-muted hover:text-cc-fg rounded-lg hover:bg-cc-hover transition-all duration-150 cursor-pointer btn-press"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 opacity-50">
                <path d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44l.622.621a.5.5 0 00.353.146H13.5A1.5 1.5 0 0115 4.707V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
              </svg>
              <span className="max-w-[200px] truncate font-mono-code text-[11px]">{dirLabel}</span>
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-40">
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
            {showDirDropdown && (
              <div className="absolute left-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)] max-h-[min(400px,60vh)] flex flex-col bg-cc-card border border-cc-border rounded-xl shadow-dropdown z-10 overflow-hidden animate-[scaleIn_0.15s_ease-out]">
                {/* Current path display */}
                <div className="px-3 py-2 border-b border-cc-border flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-cc-muted font-mono-code truncate flex-1">{browsePath}</span>
                </div>

                {/* Open Finder button */}
                <button
                  onClick={async () => {
                    if (pickingFolder) return;
                    setPickingFolder(true);
                    try {
                      const result = await api.pickFolder();
                      if (result.path) {
                        setCwd(result.path);
                        addRecentDir(result.path);
                        setRecentDirs(getRecentDirs());
                        setShowDirDropdown(false);
                      }
                    } catch { /* ignore */ } finally {
                      setPickingFolder(false);
                    }
                  }}
                  disabled={pickingFolder}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 text-cc-primary font-medium border-b border-cc-border disabled:opacity-50"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
                    <path d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44l.622.621a.5.5 0 00.353.146H13.5A1.5 1.5 0 0115 4.707V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
                  </svg>
                  {pickingFolder ? "Waiting for Finder..." : "Open Finder..."}
                </button>

                {/* Go up button */}
                {browsePath && browsePath !== "/" && (
                  <button
                    onClick={() => {
                      const parent = browsePath.split("/").slice(0, -1).join("/") || "/";
                      loadDirs(parent);
                    }}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 text-cc-muted"
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-60">
                      <path d="M8 12l-4-4h2.5V4h3v4H12L8 12z" transform="rotate(180 8 8)" />
                    </svg>
                    <span>..</span>
                  </button>
                )}

                {/* Select current directory */}
                <button
                  onClick={() => {
                    setCwd(browsePath);
                    addRecentDir(browsePath);
                    setRecentDirs(getRecentDirs());
                    setShowDirDropdown(false);
                  }}
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 text-cc-primary font-medium border-b border-cc-border"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
                    <path d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" />
                  </svg>
                  <span className="truncate font-mono-code">Select: {browsePath.split("/").pop() || "/"}</span>
                </button>

                {/* Subdirectories */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {browseLoading ? (
                    <div className="px-3 py-3 text-xs text-cc-muted text-center">Loading...</div>
                  ) : browseDirs.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-cc-muted text-center">No subdirectories</div>
                  ) : (
                    browseDirs.map((d) => (
                      <button
                        key={d.path}
                        onClick={() => loadDirs(d.path)}
                        onDoubleClick={() => {
                          setCwd(d.path);
                          addRecentDir(d.path);
                          setRecentDirs(getRecentDirs());
                          setShowDirDropdown(false);
                        }}
                        className="w-full px-3 py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer truncate font-mono-code flex items-center gap-2 text-cc-fg"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-40 shrink-0">
                          <path d="M1 3.5A1.5 1.5 0 012.5 2h3.379a1.5 1.5 0 011.06.44l.622.621a.5.5 0 00.353.146H13.5A1.5 1.5 0 0115 4.707V12.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z" />
                        </svg>
                        <span className="truncate">{d.name}</span>
                        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-30 shrink-0 ml-auto">
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Branch picker (always visible when cwd is a git repo) */}
          {gitRepoInfo && (
            <div className="relative" ref={branchDropdownRef}>
              <button
                onClick={() => {
                  if (!showBranchDropdown && gitRepoInfo) {
                    api.listBranches(gitRepoInfo.repoRoot).then(setBranches).catch(() => setBranches([]));
                  }
                  setShowBranchDropdown(!showBranchDropdown);
                  setBranchFilter("");
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all duration-150 cursor-pointer text-cc-muted hover:text-cc-fg hover:bg-cc-hover btn-press"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-50">
                  <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.378A2.5 2.5 0 007.5 8h1a1 1 0 010 2h-1A2.5 2.5 0 005 12.5v.128a2.25 2.25 0 101.5 0V12.5a1 1 0 011-1h1a2.5 2.5 0 000-5h-1a1 1 0 01-1-1V5.372zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5z" />
                </svg>
                <span className="max-w-[160px] truncate font-mono-code text-[11px]">
                  {worktreeBranch || gitRepoInfo.currentBranch}
                </span>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-40">
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </button>
              {showBranchDropdown && (
                <div className="absolute left-0 top-full mt-1 w-72 max-w-[calc(100vw-2rem)] bg-cc-card border border-cc-border rounded-xl shadow-dropdown z-10 overflow-hidden animate-[scaleIn_0.15s_ease-out]">
                  {/* Search/filter input */}
                  <div className="px-2 py-2 border-b border-cc-border">
                    <input
                      type="text"
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      placeholder="Filter or create branch..."
                      className="w-full px-2 py-1 text-xs bg-cc-input-bg border border-cc-border rounded-lg text-cc-fg font-mono-code placeholder:text-cc-muted focus:outline-none focus:border-cc-primary/50"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setShowBranchDropdown(false);
                        }
                      }}
                    />
                  </div>
                  {/* Branch list */}
                  <div className="max-h-[240px] overflow-y-auto py-1">
                    {(() => {
                      const filter = branchFilter.toLowerCase().trim();
                      const localBranches = branches.filter((b) => !b.isRemote && (!filter || b.name.toLowerCase().includes(filter)));
                      const remoteBranches = branches.filter((b) => b.isRemote && (!filter || b.name.toLowerCase().includes(filter)));
                      const exactMatch = branches.some((b) => b.name.toLowerCase() === filter);
                      const hasResults = localBranches.length > 0 || remoteBranches.length > 0;

                      return (
                        <>
                          {/* Local branches */}
                          {localBranches.length > 0 && (
                            <>
                              <div className="px-3 py-1 text-[10px] text-cc-muted uppercase tracking-wider font-sans-ui">Local</div>
                              {localBranches.map((b) => (
                                <button
                                  key={b.name}
                                  onClick={() => {
                                    setWorktreeBranch(b.name);
                                    setIsNewBranch(false);
                                    setShowBranchDropdown(false);
                                  }}
                                  className={`w-full px-3 py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 ${
                                    b.name === worktreeBranch ? "text-cc-primary font-medium" : "text-cc-fg"
                                  }`}
                                >
                                  <span className="truncate font-mono-code">{b.name}</span>
                                  <span className="ml-auto flex items-center gap-1.5 shrink-0">
                                    {b.isCurrent && (
                                      <span className="text-[9px] px-1 py-0.5 rounded-md bg-green-500/15 text-green-600 dark:text-green-400 font-sans-ui">current</span>
                                    )}
                                    {b.worktreePath && (
                                      <span className="text-[9px] px-1 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 font-sans-ui">wt</span>
                                    )}
                                  </span>
                                </button>
                              ))}
                            </>
                          )}
                          {/* Remote branches */}
                          {remoteBranches.length > 0 && (
                            <>
                              <div className="px-3 py-1 text-[10px] text-cc-muted uppercase tracking-wider mt-1 font-sans-ui">Remote</div>
                              {remoteBranches.map((b) => (
                                <button
                                  key={`remote-${b.name}`}
                                  onClick={() => {
                                    setWorktreeBranch(b.name);
                                    setIsNewBranch(false);
                                    setShowBranchDropdown(false);
                                  }}
                                  className={`w-full px-3 py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 ${
                                    b.name === worktreeBranch ? "text-cc-primary font-medium" : "text-cc-fg"
                                  }`}
                                >
                                  <span className="truncate font-mono-code">{b.name}</span>
                                  <span className="text-[9px] px-1 py-0.5 rounded-md bg-cc-hover text-cc-muted ml-auto shrink-0 font-sans-ui">remote</span>
                                </button>
                              ))}
                            </>
                          )}
                          {/* No results */}
                          {!hasResults && filter && (
                            <div className="px-3 py-2 text-xs text-cc-muted text-center">No matching branches</div>
                          )}
                          {/* Create new branch option */}
                          {filter && !exactMatch && (
                            <div className="border-t border-cc-border mt-1 pt-1">
                              <button
                                onClick={() => {
                                  setWorktreeBranch(branchFilter.trim());
                                  setIsNewBranch(true);
                                  setShowBranchDropdown(false);
                                }}
                                className="w-full px-3 py-1.5 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 text-cc-primary"
                              >
                                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
                                  <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
                                </svg>
                                <span>Create <span className="font-mono-code font-medium">{branchFilter.trim()}</span></span>
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Worktree toggle (only when cwd is a git repo) */}
          {gitRepoInfo && (
            <button
              onClick={() => setUseWorktree(!useWorktree)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all duration-150 cursor-pointer btn-press ${
                useWorktree
                  ? "bg-cc-primary/15 text-cc-primary font-medium"
                  : "text-cc-muted hover:text-cc-fg hover:bg-cc-hover"
              }`}
              title="Create an isolated worktree for this session"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 opacity-60">
                <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v5.256a2.25 2.25 0 101.5 0V5.372zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zm7.5-9.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V7A2.5 2.5 0 0110 9.5H6a1 1 0 000 2h4a2.5 2.5 0 012.5 2.5v.628a2.25 2.25 0 11-1.5 0V14a1 1 0 00-1-1H6a2.5 2.5 0 01-2.5-2.5V10a2.5 2.5 0 012.5-2.5h4a1 1 0 001-1V5.372a2.25 2.25 0 01-1.5-2.122z" />
              </svg>
              <span>Worktree</span>
            </button>
          )}

          {/* Environment selector */}
          <div className="relative" ref={envDropdownRef}>
            <button
              onClick={() => {
                if (!showEnvDropdown) {
                  api.listEnvs().then(setEnvs).catch(() => {});
                }
                setShowEnvDropdown(!showEnvDropdown);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-cc-muted hover:text-cc-fg rounded-lg hover:bg-cc-hover transition-all duration-150 cursor-pointer btn-press"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 opacity-50">
                <path d="M8 1a2 2 0 012 2v1h2a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h2V3a2 2 0 012-2zm0 1.5a.5.5 0 00-.5.5v1h1V3a.5.5 0 00-.5-.5zM4 5.5a.5.5 0 00-.5.5v6a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V6a.5.5 0 00-.5-.5H4z" />
              </svg>
              <span className="max-w-[120px] truncate">
                {selectedEnv ? envs.find((e) => e.slug === selectedEnv)?.name || "Env" : "No env"}
              </span>
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-40">
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
            {showEnvDropdown && (
              <div className="absolute left-0 top-full mt-1 w-56 bg-cc-card border border-cc-border rounded-xl shadow-dropdown z-10 py-1 overflow-hidden animate-[scaleIn_0.15s_ease-out]">
                <button
                  onClick={() => {
                    setSelectedEnv("");
                    localStorage.setItem("cc-selected-env", "");
                    setShowEnvDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer ${
                    !selectedEnv ? "text-cc-primary font-medium" : "text-cc-fg"
                  }`}
                >
                  No environment
                </button>
                {envs.map((env) => (
                  <button
                    key={env.slug}
                    onClick={() => {
                      setSelectedEnv(env.slug);
                      localStorage.setItem("cc-selected-env", env.slug);
                      setShowEnvDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-1 ${
                      env.slug === selectedEnv ? "text-cc-primary font-medium" : "text-cc-fg"
                    }`}
                  >
                    <span className="truncate">{env.name}</span>
                    <span className="text-cc-muted ml-auto shrink-0">
                      {Object.keys(env.variables).length} var{Object.keys(env.variables).length !== 1 ? "s" : ""}
                    </span>
                  </button>
                ))}
                <div className="border-t border-cc-border mt-1 pt-1">
                  <button
                    onClick={() => {
                      setShowEnvManager(true);
                      setShowEnvDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-xs text-left text-cc-muted hover:text-cc-fg hover:bg-cc-hover transition-colors cursor-pointer"
                  >
                    Manage environments...
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Model selector */}
          <div className="relative" ref={modelDropdownRef}>
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-cc-muted hover:text-cc-fg rounded-lg hover:bg-cc-hover transition-all duration-150 cursor-pointer btn-press"
            >
              <span>{selectedModel.icon}</span>
              <span>{selectedModel.label}</span>
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-40">
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
            {showModelDropdown && (
              <div className="absolute left-0 top-full mt-1 w-44 bg-cc-card border border-cc-border rounded-xl shadow-dropdown z-10 py-1 overflow-hidden animate-[scaleIn_0.15s_ease-out]">
                {MODELS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => { setModel(m.value); setShowModelDropdown(false); }}
                    className={`w-full px-3 py-2 text-xs text-left hover:bg-cc-hover transition-colors cursor-pointer flex items-center gap-2 ${
                      m.value === model ? "text-cc-primary font-medium" : "text-cc-fg"
                    }`}
                  >
                    <span>{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick-start suggestions */}
        {!text && (
          <div className="flex items-center gap-2 mt-4 px-1 flex-wrap">
            {[
              { label: "Fix a bug", icon: "M6 9l2 2 4-4" },
              { label: "Write tests", icon: "M3 4h10M3 8h10M3 12h6" },
              { label: "Refactor code", icon: "M4 6l4 4-4 4" },
              { label: "Review changes", icon: "M8 2a6 6 0 100 12A6 6 0 008 2zm1 3H7v4h2V5zm0 6H7v-1.5h2V11z" },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  setText(s.label);
                  textareaRef.current?.focus();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cc-muted hover:text-cc-fg rounded-lg border border-cc-border hover:border-cc-primary/30 hover:bg-cc-hover transition-all duration-150 cursor-pointer btn-press"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3 opacity-50">
                  <path d={s.icon} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-cc-border bg-cc-card px-3 py-2">
            <span className="text-[11px] text-cc-muted uppercase tracking-wide">Voice</span>
            <select value={sister} onChange={(e) => setSister(e.target.value)} className="flex-1 bg-transparent text-sm text-cc-fg focus:outline-none">
              {SISTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center rounded-lg border border-cc-border bg-cc-card px-3 py-2 text-[12px] text-cc-muted">
            Always core voice. Sister acts as advisory lens.
          </div>
        </div>

                {/* Error message */}
        {error && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cc-error/5 border border-cc-error/20 animate-[fadeSlideIn_0.2s_ease-out]">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-cc-error shrink-0">
              <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm1-3a1 1 0 11-2 0 1 1 0 012 0zM7.5 5.5a.5.5 0 011 0v3a.5.5 0 01-1 0v-3z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-cc-error">{error}</p>
          </div>
        )}
      </div>

      {/* Environment manager modal */}
      {showEnvManager && (
        <EnvManager
          onClose={() => {
            setShowEnvManager(false);
            api.listEnvs().then(setEnvs).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
