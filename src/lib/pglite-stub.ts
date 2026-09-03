/** Bundled on Netlify instead of `@electric-sql/pglite` so the function never opens pglite.data. */

export class PGlite {
  constructor() {
    throw new Error("PGLite is not used on Netlify.");
  }
}
