export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    return {
      format: 'module',
      shortCircuit: true,
      url: new URL('./three-shim.mjs', import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}
