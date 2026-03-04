import { useMemo } from "react";
import { useStore } from "../store.js";
import { api } from "../api.js";
import { MessageFeed } from "./MessageFeed.js";
import { Composer } from "./Composer.js";
import { PermissionBanner } from "./PermissionBanner.js";
import { BRAND_NAME } from "../config.js";

export function ChatView({ sessionId }: { sessionId: string }) {
  const sessionPerms = useStore((s) => s.pendingPermissions.get(sessionId));
  const connStatus = useStore(
    (s) => s.connectionStatus.get(sessionId) ?? "disconnected"
  );
  const cliConnected = useStore((s) => s.cliConnected.get(sessionId) ?? false);
  const session = useStore((s) => s.sessions.get(sessionId));
  const sister = useStore((s) => s.sessionSister.get(sessionId) || "camila");
  const contextPercent = (session as { context_used_percent?: number } | undefined)?.context_used_percent ?? 0;

  const perms = useMemo(
    () => (sessionPerms ? Array.from(sessionPerms.values()) : []),
    [sessionPerms]
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* CLI disconnected banner */}
      {connStatus === "connected" && !cliConnected && (
        <div className="px-4 py-2 bg-cc-warning/10 border-b border-cc-warning/20 text-center flex items-center justify-center gap-3">
          <span className="text-xs text-cc-warning font-medium">
            CLI disconnected
          </span>
          <button
            onClick={() => api.relaunchSession(sessionId).catch(console.error)}
            className="text-xs font-medium px-3 py-1 rounded-md bg-cc-warning/20 hover:bg-cc-warning/30 text-cc-warning transition-colors cursor-pointer"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* WebSocket disconnected banner */}
      {connStatus === "disconnected" && (
        <div className="px-4 py-2 bg-cc-warning/10 border-b border-cc-warning/20 text-center">
          <span className="text-xs text-cc-warning font-medium">
            Reconnecting to session...
          </span>
        </div>
      )}

      {/* Context window warning */}
      {contextPercent >= 95 && (
        <div className="px-4 py-2 bg-cc-error/10 border-b border-cc-error/20 text-center">
          <span className="text-xs text-cc-error font-medium">
            Context is nearly full ({contextPercent}%). Start a new session to avoid losing context.
          </span>
        </div>
      )}
      {contextPercent >= 80 && contextPercent < 95 && (
        <div className="px-4 py-2 bg-cc-warning/10 border-b border-cc-warning/20 text-center">
          <span className="text-xs text-cc-warning font-medium">
            Context is getting full ({contextPercent}%). Consider starting a new session.
          </span>
        </div>
      )}

      <div className="px-4 py-1.5 border-b border-cc-border/60 bg-cc-card/50">
        <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md bg-cc-primary/10 text-cc-primary">
          {BRAND_NAME} core {sister !== "camila" ? `· ${sister} advisory` : "· direct"}
        </span>
      </div>

      {/* Message feed */}
      <MessageFeed sessionId={sessionId} />

      {/* Permission banners */}
      {perms.length > 0 && (
        <div className="shrink-0 max-h-[60vh] overflow-y-auto border-t border-cc-border bg-cc-card">
          {perms.map((p, i) => (
            <PermissionBanner key={p.request_id} permission={p} sessionId={sessionId} isFirst={i === 0} />
          ))}
        </div>
      )}

      {/* Composer */}
      <Composer sessionId={sessionId} />
    </div>
  );
}
