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
  [">Page source<", ">Nguồn trang<"],
  [">Navigation<", ">Điều hướng<"],
  [">Table of Contents<", ">Mục lục<"],
  [">Search<", ">Tìm kiếm<"],
  [">Index<", ">Chỉ mục<"],
  [">next<", ">tiếp theo<"],
  [">previous<", ">trước đó<"],
  [">Next<", ">Tiếp theo<"],
  [">Previous<", ">Trước đó<"],
  // Tooltip/title attributes on theme chrome (header search icon, index,
  // "link to this section" anchors). These are visible on hover.
  ["title=\"Search\"", "title=\"Tìm kiếm\""],
  ["title=\"Index\"", "title=\"Chỉ mục\""],
  ["title=\"Link to this heading\"", "title=\"Liên kết đến mục này\""],
  ["title=\"Link to this definition\"", "title=\"Liên kết đến định nghĩa này\""],
  ["title=\"Link to this table\"", "title=\"Liên kết đến bảng này\""],
  ["title=\"Link to this image\"", "title=\"Liên kết đến hình này\""],
  ["title=\"Link to this code\"", "title=\"Liên kết đến khối mã này\""],
  ["title=\"Permalink to this headline\"", "title=\"Liên kết cố định đến tiêu đề này\""],
  // Project branding: sidebar logo text, <title> suffix, and logo alt text.
  // The version number is constant per deploy so a literal match is safe.
  [">The Linux Kernel</a>", ">Nhân Linux</a>"],
  ["The Linux Kernel 7.0.0 documentation", "Tài liệu Nhân Linux 7.0.0"],
  ["alt=\"Logo of The Linux Kernel\"", "alt=\"Biểu trưng Nhân Linux\""],
  // Browser tab titles on special Sphinx pages. The body <h1> already
  // uses the >Index</>Search< patterns above; the <title> tag has no
  // angle-bracket boundary, so needs its own literal.
  ["<title>Search &#8212;", "<title>Tìm kiếm &#8212;"],
  ["<title>Index &#8212;", "<title>Chỉ mục &#8212;"],
  // Search page body copy.
  // Sphinx emits this copy split across two lines with four-space indent,
  // so the literal must match the exact whitespace between "search" and
  // "functionality.".
  [
    "Please activate JavaScript to enable the search\n    functionality.",
    "Vui lòng bật JavaScript để sử dụng chức năng tìm kiếm.",
  ],
  [
    "Searching for multiple words only shows matches that contain",
    "Tìm kiếm nhiều từ chỉ hiển thị kết quả chứa",
  ],
  ["all words.", "tất cả các từ."],
  // Footer strings shared by every page.
  ["The kernel development community", "Cộng đồng phát triển nhân Linux"],
  ["Powered by <a", "Được cung cấp bởi <a"],
  // Admonition titles (Note, Warning, Tip, …). Docutils renders these as
  // <p class="admonition-title">Note</p>; class name stays English.
  ["admonition-title\">Note<", "admonition-title\">Lưu ý<"],
  ["admonition-title\">Warning<", "admonition-title\">Cảnh báo<"],
  ["admonition-title\">Attention<", "admonition-title\">Chú ý<"],
  ["admonition-title\">Important<", "admonition-title\">Quan trọng<"],
  ["admonition-title\">Tip<", "admonition-title\">Mẹo<"],
  ["admonition-title\">Caution<", "admonition-title\">Cẩn trọng<"],
  ["admonition-title\">Hint<", "admonition-title\">Gợi ý<"],
  ["admonition-title\">Danger<", "admonition-title\">Nguy hiểm<"],
  ["admonition-title\">Error<", "admonition-title\">Lỗi<"],
  ["admonition-title\">See also<", "admonition-title\">Xem thêm<"],
  ["admonition-title\">Todo<", "admonition-title\">Việc cần làm<"],
  // Field-list labels from the :Original:/:Translator: block at the top of
  // translated files. Only the label node carries these class names, so
  // translating the inner text is safe.
  ["field-odd\">Original<", "field-odd\">Bản gốc<"],
  ["field-even\">Original<", "field-even\">Bản gốc<"],
  ["field-odd\">Translator<", "field-odd\">Người dịch<"],
  ["field-even\">Translator<", "field-even\">Người dịch<"],
  ["field-odd\">Upstream-at<", "field-odd\">Phiên bản gốc<"],
  ["field-even\">Upstream-at<", "field-even\">Phiên bản gốc<"],
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

async function applyViRewrites(response: Response): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("text/html")) return response;
  const body = await response.text();
  const rewritten = rewriteSidebarLinks(rewriteViStrings(body));
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(rewritten, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
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

    let assetResponse = await env.ASSETS.fetch(request);
    // Cloudflare Assets redirects .html → extensionless (307). Follow that
    // redirect internally and work with the final response so .html requests
    // get the same body transforms (vi-string rewrites, _sources content-type)
    // as extensionless requests.
    if ((assetResponse.status === 307 || assetResponse.status === 308) && p.endsWith(".html")) {
      const loc = assetResponse.headers.get("location");
      if (loc) {
        const follow = await env.ASSETS.fetch(new Request(new URL(loc, url), request));
        if (follow.status !== 404) {
          assetResponse = follow;
        }
      }
    }
    if (assetResponse.status !== 404) {
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
      // Rewrite UI strings + sidebar hrefs on any HTML asset we serve — this
      // site is Vietnamese-default (root /_, /search.html, /genindex.html
      // are reached only via the vi redirect), so every HTML page should get
      // vi chrome regardless of whether its URL is under /translations/vi_VN_mt/.
      return applyViRewrites(assetResponse);
    }

    // Missing under /translations/vi_VN_mt/ — fall back to the English page
    // so sidebar links that point into the Vietnamese tree don't dead-end when
    // a translation isn't built yet. Apply vi rewrites so the fallback page's
    // sidebar and UI chrome still read Vietnamese.
    if (p.startsWith("/translations/vi_VN_mt/")) {
      const englishPath = p.slice("/translations/vi_VN_mt".length);
      const englishURL = new URL(url);
      englishURL.pathname = englishPath;
      const englishResponse = await env.ASSETS.fetch(new Request(englishURL, request));
      if (englishResponse.status === 307 || englishResponse.status === 308) {
        const loc = englishResponse.headers.get("location");
        if (loc) {
          const follow = await env.ASSETS.fetch(new Request(new URL(loc, englishURL), request));
          if (follow.status !== 404) return applyViRewrites(follow);
        }
      } else if (englishResponse.status !== 404) {
        return applyViRewrites(englishResponse);
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
