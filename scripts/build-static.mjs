import { cp, mkdir, readFile, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DOCS_REPO = path.resolve(process.env.DOCS_REPO ?? path.join(ROOT, "..", "kernel-docs-vi"));
const UPSTREAM_DIR = path.join(ROOT, "_upstream", "linux");
const BUILD_DIR = path.join(ROOT, "_build", "html");
const DIST_DIR = path.join(ROOT, "dist");
const VENV_DIR = path.join(ROOT, "_build", "venv");

const UPSTREAM_URL = "https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git";
const SPARSE_PATHS = ["Documentation", "tools", "scripts", "include", "COPYING", "LICENSES", "Makefile"];

const SKIP_SPHINX = process.env.SKIP_SPHINX === "1";

await ensureDocsRepo();
const sha = await readUpstreamSha();
const kernelVersion = await readKernelVersion();

if (SKIP_SPHINX) {
  console.log("SKIP_SPHINX=1 set. Writing minimal landing page to dist/.");
  await writeFallbackLanding(sha);
  console.log(`dist/ ready at ${DIST_DIR}`);
  process.exit(0);
}

await ensureSparseClone(sha);
await overlayVietnameseTranslations();
await pruneBrokenTranslatedIncludes();
await ensureSphinxVenv();
await runSphinxBuild(kernelVersion);
await copyBuildToDist();

console.log(`Copied ${BUILD_DIR} to ${DIST_DIR}`);

async function ensureDocsRepo() {
  try {
    await stat(DOCS_REPO);
  } catch {
    throw new Error(
        `kernel-docs-vi checkout not found at ${DOCS_REPO}. ` +
        `Clone it next to this repo or set DOCS_REPO=/path/to/kernel-docs-vi.`,
    );
  }
}

async function readUpstreamSha() {
  const upstreamFile = path.join(DOCS_REPO, "UPSTREAM");
  const content = await readFile(upstreamFile, "utf8");
  const match = content.match(/^commit:\s*([0-9a-f]+)/m);
  if (!match) {
    throw new Error(`No commit line found in ${upstreamFile}`);
  }
  return match[1];
}

async function readKernelVersion() {
  // Read VERSION and PATCHLEVEL from the sparse-cloned kernel Makefile.
  try {
    const makefile = await readFile(path.join(UPSTREAM_DIR, "Makefile"), "utf8");
    const ver = makefile.match(/^VERSION\s*=\s*(\d+)/m)?.[1];
    const pl = makefile.match(/^PATCHLEVEL\s*=\s*(\d+)/m)?.[1];
    if (ver && pl) return `${ver}.${pl}`;
  } catch {}
  return "unknown";
}

async function ensureSparseClone(sha) {
  try {
    await stat(path.join(UPSTREAM_DIR, "Documentation", "conf.py"));
    const currentSha = await run("git", ["-C", UPSTREAM_DIR, "rev-parse", "HEAD"], { capture: true });
    if (currentSha.trim().startsWith(sha.slice(0, 12))) {
      console.log(`Reusing sparse clone at ${UPSTREAM_DIR} (${sha.slice(0, 12)})`);
      return;
    }
    console.log(`Sparse clone at wrong SHA. Refreshing.`);
    await rm(UPSTREAM_DIR, { recursive: true, force: true });
  } catch {}

  console.log(`Sparse-cloning kernel at ${sha.slice(0, 12)} ...`);
  await mkdir(path.dirname(UPSTREAM_DIR), { recursive: true });
  await run("git", [
    "clone",
    "--filter=blob:none",
    "--no-checkout",
    "--depth=1",
    "--single-branch",
    UPSTREAM_URL,
    UPSTREAM_DIR,
  ]);
  await run("git", ["-C", UPSTREAM_DIR, "sparse-checkout", "init", "--cone"]);
  await run("git", ["-C", UPSTREAM_DIR, "sparse-checkout", "set", ...SPARSE_PATHS]);

  try {
    await run("git", ["-C", UPSTREAM_DIR, "fetch", "--depth=1", "origin", sha]);
    await run("git", ["-C", UPSTREAM_DIR, "checkout", sha]);
  } catch {
    console.log(`Could not fetch exact SHA ${sha}. Falling back to HEAD of default branch.`);
    await run("git", ["-C", UPSTREAM_DIR, "checkout", "FETCH_HEAD"]).catch(() =>
        run("git", ["-C", UPSTREAM_DIR, "checkout", "master"]),
    );
  }
}

async function overlayVietnameseTranslations() {
  const entries = ["vi_VN", "vi_VN_mt", "disclaimer-vi.rst"];
  for (const entry of entries) {
    const src = path.join(DOCS_REPO, "Documentation", "translations", entry);
    const dst = path.join(UPSTREAM_DIR, "Documentation", "translations", entry);
    try {
      await stat(src);
    } catch {
      console.log(`No ${entry} in kernel-docs-vi. Skipping.`);
      continue;
    }
    console.log(`Overlaying ${src} -> ${dst}`);
    await mkdir(path.dirname(dst), { recursive: true });
    await cp(src, dst, { recursive: true, force: true });
  }
  await patchTranslationsExtension();
}

async function pruneBrokenTranslatedIncludes() {
  const translationsRoot = path.join(UPSTREAM_DIR, "Documentation", "translations");
  const docRoot = path.join(UPSTREAM_DIR, "Documentation");
  for (const sub of ["vi_VN_mt", "vi_VN"]) {
    const dir = path.join(translationsRoot, sub);
    try {
      await stat(dir);
    } catch {
      continue;
    }
    const { pruned, rewritten } = await pruneTreeFor(dir, path.join(translationsRoot, sub), docRoot);
    if (rewritten) {
      console.log(`Rewrote broken relative includes in ${rewritten} translated file(s) under ${sub}/ to reach upstream sources`);
    }
    if (pruned) {
      console.log(`Pruned ${pruned} translated file(s) with unresolved includes from ${sub}/`);
    }
  }
}

async function pruneTreeFor(dir, transRoot, docRoot) {
  let pruned = 0;
  let rewritten = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await pruneTreeFor(full, transRoot, docRoot);
      pruned += sub.pruned;
      rewritten += sub.rewritten;
      continue;
    }
    if (!entry.name.endsWith(".rst")) {
      continue;
    }
    const content = await readFile(full, "utf8");
    // Match `.. include::`, csv-table `:file:`, and kernel-doc `:exception-file:` refs
    const includeRe = /^(\s*\.\.\s+include::\s*)(\S+)/gm;
    const fileOptRe = /^(\s+:(?:file|exception-file):\s*)(\S+)/gm;
    const matches = [
      ...content.matchAll(includeRe),
      ...content.matchAll(fileOptRe),
    ].sort((a, b) => a.index - b.index);

    const fileDir = path.dirname(full);
    const checks = await Promise.all(matches.map((m) => classifyInclude(m[2], fileDir, transRoot, docRoot)));

    if (checks.some((c) => c.action === "broken")) {
      await unlink(full);
      pruned += 1;
      continue;
    }

    const rewriteOps = matches
      .map((m, i) => ({ match: m, ...checks[i] }))
      .filter((x) => x.action === "rewrite");

    if (rewriteOps.length === 0) {
      continue;
    }

    let out = content;
    // Apply in reverse so earlier match indices remain valid.
    for (const op of [...rewriteOps].reverse()) {
      const { match, newTarget } = op;
      const replacement = match[1] + newTarget;
      out = out.slice(0, match.index) + replacement + out.slice(match.index + match[0].length);
    }
    await writeFile(full, out, "utf8");
    rewritten += 1;
  }
  return { pruned, rewritten };
}

// For a relative include target on a translated page, decide whether it is
// already fine, needs rewriting to point at the upstream English source, or
// is truly broken (file exists nowhere we can reach).
async function classifyInclude(target, fileDir, transRoot, docRoot) {
  // `.. include:: <isonum.txt>` resolves against docutils' own
  // standard-includes dir, not the filesystem.
  if (target.startsWith("<") && target.endsWith(">")) return { action: "ok" };
  // Absolute paths are Sphinx-rooted, not filesystem-rooted; leave as-is.
  if (target.startsWith("/")) return { action: "ok" };
  // The translated-disclaimer include is always valid after overlay.
  if (target.includes("disclaimer-")) return { action: "ok" };

  const resolved = path.resolve(fileDir, target);
  try {
    await stat(resolved);
    return { action: "ok" };
  } catch {}

  // Machine translation copied the include path from the English file
  // verbatim, but the Vietnamese file lives two directories deeper inside
  // translations/vi_VN_mt/. If the resolved path sits inside the translation
  // root, the same relative offset applied to Documentation/ reaches the
  // English source. Rewrite the include to point there — the included
  // content (typically a plain .txt or CSV data file) is the same text the
  // English build consumes.
  const relFromTrans = path.relative(transRoot, resolved);
  if (relFromTrans.startsWith("..") || path.isAbsolute(relFromTrans)) {
    return { action: "broken" };
  }
  const upstreamPath = path.resolve(docRoot, relFromTrans);
  try {
    await stat(upstreamPath);
    return {
      action: "rewrite",
      newTarget: path.relative(fileDir, upstreamPath),
    };
  } catch {
    return { action: "broken" };
  }
}

async function patchTranslationsExtension() {
  const translationsPy = path.join(
      UPSTREAM_DIR, "Documentation", "sphinx", "translations.py",
  );
  const source = await readFile(translationsPy, "utf8");
  const needle = "'zh_CN': 'Chinese (Simplified)',";
  if (!source.includes(needle)) {
    console.log("translations.py missing expected anchor. Skipping patch.");
    return;
  }
  if (source.includes("'vi_VN'")) {
    return;
  }
  const patched = source.replace(
      needle,
      `${needle}\n    'vi_VN': 'Vietnamese',\n    'vi_VN_mt': 'Vietnamese (machine translation)',`,
  );
  await writeFile(translationsPy, patched, "utf8");
  console.log("Patched translations.py to register vi_VN and vi_VN_mt");
}

async function ensureSphinxVenv() {
  try {
    await stat(path.join(VENV_DIR, "bin", "sphinx-build"));
    console.log(`Reusing venv at ${VENV_DIR}`);
    return;
  } catch {}

  console.log(`Creating venv at ${VENV_DIR} ...`);
  await run("python3", ["-m", "venv", VENV_DIR]);
  const pip = path.join(VENV_DIR, "bin", "pip");
  const requirements = path.join(UPSTREAM_DIR, "Documentation", "sphinx", "requirements.txt");
  await run(pip, ["install", "--upgrade", "pip"]);
  try {
    await stat(requirements);
    await run(pip, ["install", "-r", requirements]);
  } catch {
    console.log("No kernel sphinx/requirements.txt. Installing bare Sphinx.");
    await run(pip, ["install", "Sphinx", "alabaster", "pyyaml"]);
  }
}

async function runSphinxBuild(kernelVersion = "unknown") {
  const sphinxBuild = path.join(VENV_DIR, "bin", "sphinx-build");
  const source = path.join(UPSTREAM_DIR, "Documentation");
  await rm(BUILD_DIR, { recursive: true, force: true });
  await mkdir(BUILD_DIR, { recursive: true });
  console.log(`Running sphinx-build on ${source} (kernel ${kernelVersion}) ...`);
  await run(sphinxBuild, [
    "-b", "html", "-j", "auto", "--keep-going",
    "-D", `version=${kernelVersion}`,
    "-D", `release=${kernelVersion}`,
    source, BUILD_DIR,
  ], {
    env: {
      srctree: UPSTREAM_DIR,
      SRCTREE: UPSTREAM_DIR,
      KERNELVERSION: kernelVersion,
      PYTHONDONTWRITEBYTECODE: "1",
    },
  });
}

async function copyBuildToDist() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });
  await cp(BUILD_DIR, DIST_DIR, { recursive: true });
  await rm(path.join(DIST_DIR, ".doctrees"), { recursive: true, force: true });
  await rm(path.join(DIST_DIR, ".buildinfo"), { force: true });
}

async function writeFallbackLanding(sha) {
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Linux kernel documentation (Vietnamese)</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body { font-family: system-ui, sans-serif; max-width: 48rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.6; color: #222; }
h1 { font-weight: 600; }
code { background: #f4f4f4; padding: 0.1rem 0.3rem; border-radius: 3px; }
a { color: #0a58ca; }
</style>
</head>
<body>
<h1>Linux kernel documentation (Vietnamese)</h1>
<p>Ban dich tieng Viet cua tai lieu Linux kernel, theo doi upstream tai
<a href="https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git">torvalds/linux</a>.</p>
<p>Upstream commit: <code>${sha.slice(0, 12)}</code></p>
<p>Source repository:
<a href="https://github.com/tamnd/kernel-docs-vi">github.com/tamnd/kernel-docs-vi</a></p>
<p>Full HTML build coming soon. Any path not available here will be proxied
to <a href="https://www.kernel.org/doc/html/latest/">kernel.org/doc/html/latest</a>.</p>
</body>
</html>
`;
  await writeFile(path.join(DIST_DIR, "index.html"), html, "utf8");
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: options.cwd ?? ROOT,
      stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
      env: { ...process.env, ...(options.env ?? {}) },
    });
    let out = "";
    if (options.capture) {
      proc.stdout.on("data", (chunk) => {
        out += chunk.toString("utf8");
      });
    }
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve(out);
      } else {
        reject(new Error(`${cmd} ${args.join(" ")} exited with status ${code}`));
      }
    });
    proc.on("error", reject);
  });
}
