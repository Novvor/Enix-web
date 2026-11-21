import { siteConfig } from "@/content/site";

export const ORG_ID = `${siteConfig.siteUrl}/#organization`;
export const WEBSITE_ID = `${siteConfig.siteUrl}/#website`;

export interface BreadcrumbEntry {
  name: string;
  path: string;
}

export function normalizeCanonicalUrl(pathname: string): string {
  const cleanPath = pathname.split("?")[0].split("#")[0];
  const withLeading = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  const withTrailing = withLeading === "/" || withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
  return new URL(withTrailing, siteConfig.siteUrl).toString();
}

export function buildOrganizationSchema() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: siteConfig.brandName,
    url: `${siteConfig.siteUrl}/`,
    logo: {
      "@type": "ImageObject",
      url: `${siteConfig.siteUrl}/brand/enix-logo.png`,
      width: 1578,
      height: 447
    },
    email: siteConfig.contactEmail,
    parentOrganization: {
      "@type": "Organization",
      name: siteConfig.legalParent
    },
    areaServed: ["CL", "Latin America"],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: siteConfig.contactEmail,
        availableLanguage: ["es"]
      }
    ]
  };
}

export function buildWebSiteSchema() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${siteConfig.siteUrl}/`,
    name: siteConfig.brandName,
    inLanguage: "es",
    publisher: {
      "@id": ORG_ID
    }
  };
}

export function buildBreadcrumbSchema(items: BreadcrumbEntry[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: normalizeCanonicalUrl(item.path)
    }))
  };
}

export function buildServiceSchema(params: {
  name: string;
  description: string;
  path: string;
  serviceType: string;
}) {
  const url = normalizeCanonicalUrl(params.path);
  return {
    "@type": "Service",
    "@id": `${url}#service`,
    name: params.name,
    description: params.description,
    serviceType: params.serviceType,
    url,
    provider: {
      "@id": ORG_ID
    },
    areaServed: ["CL", "Latin America"]
  };
}

export function buildJsonLdGraph(nodes: Record<string, unknown>[]) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes
  };
}
