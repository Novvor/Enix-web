import fs from "node:fs";
import path from "node:path";

const DIST_DIR = path.resolve(process.cwd(), "dist/client");
const SITE_ORIGIN = "https://www.enix.studio";

const errors = [];
const warnings = [];
const inventory = [];

function walkHtmlFiles(dir, base = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkHtmlFiles(full, base));
    } else if (entry.name.endsWith(".html")) {
      results.push(path.relative(base, full));
    }
  }
  return results;
}

function fileToRoute(relFile) {
  if (relFile === "index.html") return "/";
  if (relFile === "404.html") return "/404";
  if (relFile.endsWith("/index.html")) return `/${relFile.slice(0, -"/index.html".length)}/`;
  return `/${relFile}`;
}

if (!fs.existsSync(DIST_DIR)) {
  console.error("ERROR: dist/client not found. Run `npm run build` first.");
  process.exit(1);
}

// 1. Check robots.txt
const robotsPath = path.join(DIST_DIR, "robots.txt");
if (!fs.existsSync(robotsPath)) {
  errors.push("Missing dist/client/robots.txt");
} else {
  const robotsTxt = fs.readFileSync(robotsPath, "utf8");
  if (!robotsTxt.includes(`Sitemap: ${SITE_ORIGIN}/sitemap-index.xml`)) {
    errors.push("robots.txt missing canonical Sitemap declaration");
  }
  if (!robotsTxt.includes("Disallow: /api/")) {
    errors.push("robots.txt should disallow /api/");
  }
  if (!robotsTxt.includes("OAI-SearchBot")) {
    warnings.push("robots.txt does not explicitly mention OAI-SearchBot");
  }
}

// 2. Check sitemap-0.xml
const sitemapPath = path.join(DIST_DIR, "sitemap-0.xml");
const sitemapUrls = new Set();
if (!fs.existsSync(sitemapPath)) {
  errors.push("Missing dist/client/sitemap-0.xml");
} else {
  const xml = fs.readFileSync(sitemapPath, "utf8");
  const locMatches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locMatches) {
    sitemapUrls.add(loc);
    if (!loc.startsWith(`${SITE_ORIGIN}/`)) {
      errors.push(`Sitemap URL has wrong origin: ${loc}`);
    }
    if (loc.includes("/create-project/") || loc.includes("/404") || loc.includes("/api/")) {
      errors.push(`Sitemap contains non-indexable URL: ${loc}`);
    }
  }
}

// 3. Audit all built HTML files
const htmlFiles = walkHtmlFiles(DIST_DIR).sort();
const existingRoutes = new Set(htmlFiles.map(fileToRoute));
const seenTitles = new Map();
const seenDescs = new Map();
const linkedRoutes = new Set(["/"]);

for (const relFile of htmlFiles) {
  const route = fileToRoute(relFile);
  const html = fs.readFileSync(path.join(DIST_DIR, relFile), "utf8");

  // Skip Astro redirect stub pages (meta http-equiv="refresh")
  if (/<meta\s+http-equiv="refresh"/i.test(html)) {
    continue;
  }

  const langMatch = html.match(/<html[^>]+lang="([^"]+)"/i);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const robotsMatch = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i);
  const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i);
  const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const jsonLdMatches = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];

  const isNoindex = Boolean(robotsMatch && /noindex/i.test(robotsMatch[1]));
  const expectedCanonical = `${SITE_ORIGIN}${route}`;

  if (!langMatch || langMatch[1] !== "es") {
    errors.push(`${route}: missing or incorrect <html lang="es">`);
  }

  const title = titleMatch?.[1]?.trim() || "";
  if (!title) {
    errors.push(`${route}: missing <title>`);
  } else if (seenTitles.has(title)) {
    errors.push(`${route}: duplicate <title> with ${seenTitles.get(title)} ("${title}")`);
  } else {
    seenTitles.set(title, route);
  }

  const desc = descMatch?.[1]?.trim() || "";
  if (!desc) {
    errors.push(`${route}: missing meta description`);
  } else if (seenDescs.has(desc)) {
    errors.push(`${route}: duplicate meta description with ${seenDescs.get(desc)}`);
  } else {
    seenDescs.set(desc, route);
  }

  if (isNoindex) {
    if (sitemapUrls.has(expectedCanonical)) {
      errors.push(`${route}: marked noindex but still present in sitemap-0.xml`);
    }
    if (canonicalMatch) {
      errors.push(`${route}: noindex page should omit canonical link`);
    }
  } else {
    if (!canonicalMatch || canonicalMatch[1] !== expectedCanonical) {
      errors.push(`${route}: canonical mismatch (got "${canonicalMatch?.[1] || "none"}", expected "${expectedCanonical}")`);
    }
    if (!sitemapUrls.has(expectedCanonical)) {
      errors.push(`${route}: indexable page missing from sitemap-0.xml`);
    }
    if (!ogImageMatch || !ogImageMatch[1].startsWith(`${SITE_ORIGIN}/`)) {
      errors.push(`${route}: missing valid absolute og:image`);
    }
    if (h1Count !== 1) {
      errors.push(`${route}: expected 1 <h1>, found ${h1Count}`);
    }
    if (jsonLdMatches.length === 0) {
      errors.push(`${route}: missing JSON-LD structured data`);
    } else {
      for (const m of jsonLdMatches) {
        try {
          const parsed = JSON.parse(m[1]);
          if (parsed["@context"] !== "https://schema.org") {
            errors.push(`${route}: invalid JSON-LD @context`);
          }
          if (JSON.stringify(parsed).includes('"FAQPage"')) {
            errors.push(`${route}: should not emit deprecated FAQPage rich-result schema`);
          }
        } catch {
          errors.push(`${route}: malformed JSON-LD script`);
        }
      }
    }
  }

  // Internal link check
  const hrefs = [...html.matchAll(/href="(\/[^"#?]*)"/gi)].map((m) => m[1]);
  for (const href of hrefs) {
    if (href.startsWith("/_astro/") || href.startsWith("/brand/") || href.startsWith("/favicon") || href.startsWith("/apple-touch") || href.startsWith("/site.webmanifest") || href.startsWith("/og-")) {
      continue;
    }
    const normalized = href === "/" || href.endsWith("/") ? href : `${href}/`;
    linkedRoutes.add(normalized);
    if (!existingRoutes.has(normalized)) {
      errors.push(`${route}: broken internal link -> ${href}`);
    }
  }

  inventory.push({
    route,
    indexable: !isNoindex,
    inSitemap: sitemapUrls.has(expectedCanonical),
    h1Count,
    jsonLdCount: jsonLdMatches.length
  });
}

// Check orphan indexable pages
for (const item of inventory) {
  if (item.indexable && !linkedRoutes.has(item.route)) {
    warnings.push(`Orphan indexable page (no internal links found): ${item.route}`);
  }
}

console.log(`SEO Audit Summary: ${inventory.length} pages audited, ${sitemapUrls.size} URLs in sitemap.`);
console.log(`Indexable: ${inventory.filter((i) => i.indexable).length} | Noindex: ${inventory.filter((i) => !i.indexable).length}`);

if (warnings.length > 0) {
  console.warn("\nWarnings:");
  for (const w of warnings) console.warn(`  - ${w}`);
}

if (errors.length > 0) {
  console.error("\nSEO Audit FAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("\nSEO Audit PASSED with 0 errors.");
