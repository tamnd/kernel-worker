interface Env {
  ASSETS: Fetcher;
}

const UPSTREAM_ORIGIN = "https://www.kernel.org";
const UPSTREAM_PATH_PREFIX = "/doc/html/latest";

// Sphinx UI strings + English toctree labels → Vietnamese replacements.
// Applied only to vi_VN_mt HTML pages so the sidebar/theme text is localized.
const VI_STRINGS: [string, string][] = [
  // Sphinx theme UI strings
  [">Quick search<", ">Tìm kiếm nhanh<"],
  ["placeholder=\"Search docs\"", "placeholder=\"Tìm kiếm tài liệu\""],
  [">Contents<", ">Mục lục<"],
  [">This Page<", ">Trang này<"],
  [">Show Source<", ">Xem nguồn<"],
  [">Navigation<", ">Điều hướng<"],
  [">Table of Contents<", ">Mục lục<"],
  [">Search<", ">Tìm kiếm<"],
  [">Index<", ">Chỉ mục<"],
  [">next<", ">tiếp theo<"],
  [">previous<", ">trước đó<"],
  [">Next<", ">Tiếp theo<"],
  [">Previous<", ">Trước đó<"],
  // English root toctree labels that bleed into the global sidebar
  [">Development process<", ">Quá trình phát triển<"],
  [">Submitting patches<", ">Gửi bản vá<"],
  [">Code of conduct<", ">Quy tắc ứng xử<"],
  [">Maintainer handbook<", ">Sổ tay bảo trì<"],
  [">All development-process docs<", ">Tất cả tài liệu quá trình phát triển<"],
  [">Core API<", ">API cốt lõi<"],
  [">Driver APIs<", ">API trình điều khiển<"],
  [">Subsystems<", ">Hệ thống con<"],
  [">Locking<", ">Khóa<"],
  [">Licensing rules<", ">Quy định cấp phép<"],
  [">Writing documentation<", ">Viết tài liệu<"],
  [">Development tools<", ">Công cụ phát triển<"],
  [">Testing guide<", ">Hướng dẫn kiểm thử<"],
  [">Hacking guide<", ">Hướng dẫn hack<"],
  [">Tracing<", ">Truy vết<"],
  [">Fault injection<", ">Tiêm lỗi<"],
  [">Livepatching<", ">Vá trực tuyến<"],
  [">Administration<", ">Quản trị<"],
  [">Build system<", ">Hệ thống build<"],
  [">Reporting issues<", ">Báo cáo vấn đề<"],
  [">Userspace tools<", ">Công cụ không gian người dùng<"],
  [">Userspace API<", ">API không gian người dùng<"],
  [">Firmware<", ">Phần sụn<"],
  [">Firmware and Devicetree<", ">Phần sụn và cây thiết bị<"],
  [">CPU architectures<", ">Kiến trúc CPU<"],
  [">Unsorted documentation<", ">Tài liệu chưa phân loại<"],
  [">Translations<", ">Bản dịch<"],
];

function rewriteViStrings(body: string): string {
  for (const [from, to] of VI_STRINGS) {
    body = body.replaceAll(from, to);
  }
  return body;
}

// Paths under Documentation/ that are NOT part of the translated tree — hrefs
// pointing here via ../../X should stay unchanged.
const NON_TRANSLATABLE_HREF_PREFIXES = [
  "_static/", "_sources/", "_images/",
  "translations/",
  "genindex", "search",
];

// The Sphinx global sidebar on vi_VN_mt pages links to English root paths
// (../../../maintainer/index.html). Rewrite those hrefs so they stay inside
// /translations/vi_VN_mt/ — without touching body content like the language
// switcher and the "Original:" field, which must still reach English.
function rewriteSidebarLinks(body: string): string {
  const startMarker = '<div class="sphinxsidebar"';
  const endMarker = '<div class="documentwrapper"';
  const start = body.indexOf(startMarker);
  if (start < 0) return body;
  const end = body.indexOf(endMarker, start);
  if (end < 0) return body;

  const sidebar = body.slice(start, end);
  const rewritten = sidebar.replace(
    /href="((?:\.\.\/)+)([^"#?]+)([#?][^"]*)?"/g,
    (match, dots, path, suffix) => {
      if (NON_TRANSLATABLE_HREF_PREFIXES.some((p) => path.startsWith(p))) {
        return match;
      }
      return `href="${dots}translations/vi_VN_mt/${path}${suffix ?? ""}"`;
    }
  );
  return body.slice(0, start) + rewritten + body.slice(end);
}

function rewriteKernelOrgReferences(body: string, requestURL: URL): string {
  const targetOrigin = requestURL.origin;
  return body
      .replaceAll(`${UPSTREAM_ORIGIN}${UPSTREAM_PATH_PREFIX}/`, `${targetOrigin}/`)
      .replaceAll(`${UPSTREAM_ORIGIN}${UPSTREAM_PATH_PREFIX}`, targetOrigin)
      .replaceAll(`href="//www.kernel.org${UPSTREAM_PATH_PREFIX}`, `href="//${requestURL.host}`)
      .replaceAll(`src="//www.kernel.org${UPSTREAM_PATH_PREFIX}`, `src="//${requestURL.host}`);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return proxyToKernelOrg(request, url);
    }

    // Redirect root and English doc paths to the Vietnamese machine-translation tree.
    // Paths already under /translations/ or /_static/ are passed through directly.
    const p = url.pathname;
    if (p === "/" || p === "/index.html") {
      return Response.redirect(new URL("/translations/vi_VN_mt/", url).toString(), 302);
    }
    if (!p.startsWith("/translations/") && !p.startsWith("/_static/") && !p.startsWith("/_sources/") && !p.startsWith("/_images/") && p !== "/genindex.html" && p !== "/search.html") {
      const viPath = `/translations/vi_VN_mt${p}`;
      const viURL = new URL(url);
      viURL.pathname = viPath;
      const viResponse = await env.ASSETS.fetch(new Request(viURL, request));
      if (viResponse.status !== 404 && viResponse.status !== 307 && viResponse.status !== 308) {
        return Response.redirect(new URL(viPath, url).toString(), 302);
      }
      if (viResponse.status === 307 || viResponse.status === 308) {
        const loc = viResponse.headers.get("location");
        if (loc) {
          const locURL = new URL(loc, viURL);
          const viFollow = await env.ASSETS.fetch(new Request(locURL, request));
          if (viFollow.status !== 404) {
            return Response.redirect(locURL.toString(), 302);
          }
        }
      }
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      // Cloudflare Assets redirects .html → extensionless (307). Follow the
      // redirect internally from Assets directly so it bypasses our vi_VN_mt
      // redirect and the browser stays on the English page.
      if ((assetResponse.status === 307 || assetResponse.status === 308) && p.endsWith(".html")) {
        const loc = assetResponse.headers.get("location");
        if (loc) {
          const redirectURL = new URL(loc, url);
          const englishResponse = await env.ASSETS.fetch(new Request(redirectURL, request));
          if (englishResponse.status !== 404) {
            return englishResponse;
          }
        }
      }
      if (url.pathname.startsWith("/_sources/") && (url.pathname.endsWith(".txt") || url.pathname.endsWith(".rst"))) {
        const headers = new Headers(assetResponse.headers);
        headers.set("content-type", "text/plain; charset=utf-8");
        return new Response(assetResponse.body, { headers, status: assetResponse.status, statusText: assetResponse.statusText });
      }
      if (url.pathname.startsWith("/_static/")) {
        const headers = new Headers(assetResponse.headers);
        headers.set("cache-control", "public, max-age=86400");
        return new Response(assetResponse.body, {
          headers,
          status: assetResponse.status,
          statusText: assetResponse.statusText,
        });
      }
      // Rewrite UI strings + sidebar hrefs on vi_VN_mt HTML pages so theme
      // text and navigation both stay Vietnamese.
      const contentType = assetResponse.headers.get("content-type") ?? "";
      if (p.startsWith("/translations/vi_VN_mt/") && contentType.startsWith("text/html")) {
        const body = await assetResponse.text();
        const rewritten = rewriteSidebarLinks(rewriteViStrings(body));
        const headers = new Headers(assetResponse.headers);
        headers.delete("content-length");
        return new Response(rewritten, { headers, status: assetResponse.status, statusText: assetResponse.statusText });
      }
      return assetResponse;
    }

    // Missing under /translations/vi_VN_mt/ — fall back to the English page
    // so sidebar links that point into the Vietnamese tree don't dead-end when
    // a translation isn't built yet.
    if (p.startsWith("/translations/vi_VN_mt/")) {
      const englishPath = p.slice("/translations/vi_VN_mt".length);
      const englishURL = new URL(url);
      englishURL.pathname = englishPath;
      const englishResponse = await env.ASSETS.fetch(new Request(englishURL, request));
      if (englishResponse.status === 307 || englishResponse.status === 308) {
        const loc = englishResponse.headers.get("location");
        if (loc) {
          const follow = await env.ASSETS.fetch(new Request(new URL(loc, englishURL), request));
          if (follow.status !== 404) return follow;
        }
      } else if (englishResponse.status !== 404) {
        return englishResponse;
      }
    }

    return proxyToKernelOrg(request, url);
  },
};

async function proxyToKernelOrg(request: Request, url: URL): Promise<Response> {
  const proxyURL = new URL(url);
  proxyURL.protocol = "https:";
  proxyURL.hostname = "www.kernel.org";
  proxyURL.pathname = `${UPSTREAM_PATH_PREFIX}${url.pathname}`;
  const upstream = await fetch(new Request(proxyURL, request));

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("text/html")) {
    return upstream;
  }
  const body = await upstream.text();
  const rewritten = rewriteKernelOrgReferences(body, url);
  const headers = new Headers(upstream.headers);
  headers.delete("content-length");
  return new Response(rewritten, {
    headers,
    status: upstream.status,
    statusText: upstream.statusText,
  });
}
