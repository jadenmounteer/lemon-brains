const isProd = import.meta.env.PROD;

export const config = {
  hostUrl: import.meta.env.VITE_HOST_URL ?? (isProd ? '/lemon-brains/' : 'http://localhost:4300/'),
  baseUrl: import.meta.env.BASE_URL,
};

/** Resolve a path under the app base (for future sprite assets). */
export function assetUrl(path: string): string {
  const clean = path.replace(/^\//, '');
  const base = config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`;
  return `${base}${clean}`;
}
