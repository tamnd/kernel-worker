import { createReadStream, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const DIST_DIR = path.resolve("./dist");

const UPSTREAM_HOST = "www.kernel.org";
const UPSTREAM_PATH_PREFIX = "/doc/html/latest";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${HOST}:${PORT}`}`);

    if (req.method !== "GET" && req.method !== "HEAD") {
      await proxyRequest(req, res, url);
      return;
    }

    const filePath = await resolveAssetPath(url.pathname);
    if (!filePath) {
      await proxyRequest(req, res, url);
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES.get(ext) ?? "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    if (ext === ".html") {
      const body = await readFile(filePath, "utf8");
      res.end(rewriteHtml(body, url));
      return;
    }

    createReadStream(filePath).pipe(res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(String(error));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`preview ready at http://${HOST}:${PORT}`);
});

async function resolveAssetPath(pathname) {
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const candidates = [];
  if (normalized.endsWith("/")) {
    candidates.push(path.join(DIST_DIR, normalized, "index.html"));
  } else {
    candidates.push(path.join(DIST_DIR, normalized));
    candidates.push(path.join(DIST_DIR, normalized, "index.html"));
    candidates.push(path.join(DIST_DIR, `${normalized}.html`));
  }

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(DIST_DIR)) {
      continue;
    }
    if (existsSync(resolved) && (await stat(resolved)).isFile()) {
      return resolved;
    }
  }
  return null;
}

function rewriteHtml(body, requestURL) {
  const targetOrigin = requestURL.origin;
  return body
      .replaceAll(`https://${UPSTREAM_HOST}${UPSTREAM_PATH_PREFIX}/`, `${targetOrigin}/`)
      .replaceAll(`https://${UPSTREAM_HOST}${UPSTREAM_PATH_PREFIX}`, targetOrigin)
      .replaceAll(`href="//${UPSTREAM_HOST}${UPSTREAM_PATH_PREFIX}`, `href="//${requestURL.host}`)
      .replaceAll(`src="//${UPSTREAM_HOST}${UPSTREAM_PATH_PREFIX}`, `src="//${requestURL.host}`);
}

async function proxyRequest(req, res, url) {
  const upstreamURL = new URL(url);
  upstreamURL.protocol = "https:";
  upstreamURL.hostname = UPSTREAM_HOST;
  upstreamURL.pathname = `${UPSTREAM_PATH_PREFIX}${url.pathname}`;
  upstreamURL.port = "";
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (["host", "connection", "content-length", "transfer-encoding"].includes(lower)) {
      continue;
    }
    if (lower.startsWith("cf-")) {
      continue;
    }
    if (value !== undefined) {
      headers[key] = Array.isArray(value) ? value.join(", ") : value;
    }
  }
  headers.host = upstreamURL.host;
  headers["accept-encoding"] = "identity";

  await new Promise((resolve, reject) => {
    const upstreamReq = https.request(
        upstreamURL,
        {
          method: req.method,
          headers,
        },
        async (upstreamRes) => {
          res.statusCode = upstreamRes.statusCode ?? 500;
          for (const [key, value] of Object.entries(upstreamRes.headers)) {
            if (value === undefined) continue;
            if (key.toLowerCase() === "content-length") continue;
            res.setHeader(key, value);
          }

          const contentType = String(upstreamRes.headers["content-type"] ?? "");
          if (contentType.startsWith("text/html")) {
            const chunks = [];
            upstreamRes.on("data", (chunk) => chunks.push(chunk));
            upstreamRes.on("end", () => {
              const text = Buffer.concat(chunks).toString("utf8");
              res.end(rewriteHtml(text, url));
              resolve();
            });
            upstreamRes.on("error", reject);
            return;
          }

          upstreamRes.on("error", reject);
          upstreamRes.pipe(res);
          upstreamRes.on("end", resolve);
        },
    );
    upstreamReq.on("error", reject);
    if (req.method === "GET" || req.method === "HEAD") {
      upstreamReq.end();
      return;
    }
    req.pipe(upstreamReq);
  });
}
