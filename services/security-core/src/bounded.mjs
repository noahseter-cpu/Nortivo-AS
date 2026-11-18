// Bounds caller waiting time. Adapters must ALSO cancel their actual upstream I/O.
export async function bounded(operation, timeoutMs = 5000) {
  if (typeof operation !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new TypeError('Use a dependency timeout between 1 and 10000 ms.');
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Dependency deadline exceeded.')), timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
}
