interface Env {
  ASSETS: Fetcher;
}

const UPSTREAM_ORIGIN = "https://www.kernel.org";
const UPSTREAM_PATH_PREFIX = "/doc/html/latest";

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

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      const contentType = assetResponse.headers.get("content-type") ?? "";
      if (!contentType.startsWith("text/html")) {
        return assetResponse;
      }
      const body = await assetResponse.text();
      const rewritten = rewriteKernelOrgReferences(body, url);
      const headers = new Headers(assetResponse.headers);
      headers.delete("content-length");
      return new Response(rewritten, {
        headers,
        status: assetResponse.status,
        statusText: assetResponse.statusText,
      });
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
