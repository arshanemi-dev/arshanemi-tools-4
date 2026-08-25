// Node ESM resolver hook — appends .js to an extensionless relative import that fails to
// resolve as-is. Next.js's own bundler resolves those (that's the whole app's import style), but
// plain `node` doesn't, which is otherwise the only thing stopping a one-off script like
// migrate_optional_to_brand_details.mjs from importing lib/listingTemplates.js directly. Script-
// tooling only — never loaded by the app itself.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-zA-Z0-9]+$/.test(specifier)) {
      return nextResolve(`${specifier}.js`, context)
    }
    throw err
  }
}
