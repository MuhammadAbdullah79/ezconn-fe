// Host classification for the multi-tenant subdomain model.
//
//   agentawk.com / www.agentawk.com  → marketing site (a SEPARATE deployment)
//   app.agentawk.com                 → central host: register + "find my account"
//   <tenant>.agentawk.com            → a specific agency/workspace: login + the app
//   localhost / *.localhost / *.laglobal.local → dev (everything allowed)
//
// The root domain is configurable (VITE_ROOT_DOMAIN) so staging domains work too.
// Backend tenancy is resolved from the request's Origin header (see app.service.ts
// `ignite`) — this file only decides which auth screen a given host may show.

export const ROOT_DOMAIN =
  (import.meta as any).env?.VITE_ROOT_DOMAIN || 'agentawk.com';

const APP_SUBDOMAIN = 'app';

export function currentHost(): string {
  return typeof window !== 'undefined' ? window.location.hostname : '';
}

/** localhost and local dev domains — every auth screen stays open here. */
export function isDevHost(host: string = currentHost()): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.laglobal.local')
  );
}

/** The central app host (app.agentawk.com) — register + find-account live here. */
export function isAppHost(host: string = currentHost()): boolean {
  return host === `${APP_SUBDOMAIN}.${ROOT_DOMAIN}`;
}

/** The public marketing site (apex + www) — served by a separate deployment. */
export function isMarketingHost(host: string = currentHost()): boolean {
  return host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`;
}

/** Any *.agentawk.com subdomain that is NOT the app or marketing host. */
export function isTenantHost(host: string = currentHost()): boolean {
  if (isDevHost(host) || isAppHost(host) || isMarketingHost(host)) return false;
  return host.endsWith(`.${ROOT_DOMAIN}`);
}

/** Absolute URL to the central app host — used for cross-subdomain redirects. */
export function appHostUrl(path: string = '/'): string {
  const proto =
    typeof window !== 'undefined' ? window.location.protocol : 'https:';
  return `${proto}//${APP_SUBDOMAIN}.${ROOT_DOMAIN}${path}`;
}
