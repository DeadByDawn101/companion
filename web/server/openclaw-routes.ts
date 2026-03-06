import { Hono } from "hono";
import net from "node:net";
import { execFileSync } from "node:child_process";

function parseGateway(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || (u.protocol === "wss:" ? 443 : 80)),
      protocol: u.protocol,
    };
  } catch {
    return { host: "127.0.0.1", port: 18789, protocol: "ws:" };
  }
}



function listOpenClawSessions() {
  try {
    const out = execFileSync("openclaw", ["sessions", "--json"], { encoding: "utf-8", timeout: 8000 });
    const parsed = JSON.parse(out);
    if (Array.isArray(parsed)) return parsed;
    return parsed?.sessions || [];
  } catch {
    return [];
  }
}



function getPairingStatus() {
  try {
    const devicesOut = execFileSync("openclaw", ["devices", "list", "--json"], { encoding: "utf-8", timeout: 8000 });
    const devices = JSON.parse(devicesOut || "{}");
    const pendingDevices = Array.isArray(devices?.pending) ? devices.pending : [];
    const pairedDevices = Array.isArray(devices?.paired) ? devices.paired : [];

    let pendingRequests: unknown[] = [];
    try {
      const pairingOut = execFileSync("openclaw", ["pairing", "list", "--json"], { encoding: "utf-8", timeout: 8000 });
      const pairing = JSON.parse(pairingOut || "{}");
      pendingRequests = Array.isArray(pairing?.requests) ? pairing.requests : [];
    } catch {
      pendingRequests = [];
    }

    return {
      ok: true,
      pendingDevices: pendingDevices.length,
      pairedDevices: pairedDevices.length,
      pendingRequests: pendingRequests.length,
      connectReady: pairedDevices.length > 0,
    };
  } catch {
    return {
      ok: false,
      pendingDevices: 0,
      pairedDevices: 0,
      pendingRequests: 0,
      connectReady: false,
    };
  }
}

async function tcpProbe(host: string, port: number, timeoutMs = 2500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

export function createOpenClawRoutes() {
  const api = new Hono();

  api.get("/health", async (c) => {
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
    const { host, port, protocol } = parseGateway(gatewayUrl);
    const ok = await tcpProbe(host, port);
    return c.json({
      ok,
      gatewayUrl,
      host,
      port,
      protocol,
      mode: process.env.OPENCLAW_MODE || "off",
      ts: Date.now(),
    }, ok ? 200 : 503);
  });

  api.get("/sessions", (c) => {
    const sessions = listOpenClawSessions();
    return c.json({ count: sessions.length, sessions });
  });


  api.get("/pairing-status", (c) => {
    const status = getPairingStatus();
    return c.json(status, status.ok ? 200 : 503);
  });

  api.get("/config", (c) => {
    return c.json({
      mode: process.env.OPENCLAW_MODE || "off",
      gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789",
      relayUrl: process.env.OPENCLAW_RELAY_URL || null,
    });
  });

  return api;
}
