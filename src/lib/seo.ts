import { useEffect } from 'react';

export interface SeoConfig {
  title: string;
  description: string;
  canonicalPath?: string;
  type?: 'website' | 'article';
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const SITE_ORIGIN = 'https://yugalofficial.github.io/Compus-Connect';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function getCanonicalUrl(path?: string): string {
  if (typeof window !== 'undefined' && window.location.origin.includes('github.io')) {
    const clean = (path || '').replace(/^\/+/, '');
    return clean ? `${SITE_ORIGIN}/${clean}` : `${SITE_ORIGIN}/`;
  }
  if (typeof window !== 'undefined') {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    const clean = (path || '').replace(/^\/+/, '');
    return clean ? `${window.location.origin}${base}/${clean}` : `${window.location.origin}${base}/`;
  }
  return `${SITE_ORIGIN}/`;
}

export function useDocumentSeo(config: SeoConfig) {
  useEffect(() => {
    document.title = config.title;
    upsertMeta('name', 'description', config.description);
    upsertMeta('property', 'og:title', config.title);
    upsertMeta('property', 'og:description', config.description);
    upsertMeta('property', 'og:type', config.type || 'website');
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', config.title);
    upsertMeta('name', 'twitter:description', config.description);

    const canonical = getCanonicalUrl(config.canonicalPath);
    upsertMeta('property', 'og:url', canonical);
    upsertLink('canonical', canonical);

    const scriptId = 'cc-dynamic-jsonld';
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (config.structuredData) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = scriptId;
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(config.structuredData);
    } else if (scriptEl) {
      scriptEl.remove();
    }

    return () => {
      const existing = document.getElementById(scriptId);
      if (existing) existing.remove();
    };
  }, [config.title, config.description, config.canonicalPath, config.type, JSON.stringify(config.structuredData)]);
}
