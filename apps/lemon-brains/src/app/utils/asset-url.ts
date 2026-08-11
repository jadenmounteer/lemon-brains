/** Resolve an app asset path against `<base href>` (required for GitHub Pages nested deploy). */
export function assetUrl(path: string): string {
  const clean = path.replace(/^\//, '');
  return new URL(clean, document.baseURI).toString();
}
