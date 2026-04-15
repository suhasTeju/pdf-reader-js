import type { EmbeddingProvider } from './embedding-fallback';

let loaded: Promise<EmbeddingProvider> | null = null;

/**
 * Lazily load a local MiniLM model (only on first call). The dynamic import
 * keeps `@xenova/transformers` out of the main bundle unless used.
 */
export function getLocalMiniLM(): Promise<EmbeddingProvider> {
  if (loaded) return loaded;
  loaded = (async (): Promise<EmbeddingProvider> => {
    const mod = await import(/* webpackIgnore: true */ '@xenova/transformers');
    const { pipeline } = mod;
    const extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
    );
    return {
      async embed(texts: string[]) {
        const out: Float32Array[] = [];
        for (const t of texts) {
          const result = await extractor(t, {
            pooling: 'mean',
            normalize: true,
          });
          out.push(new Float32Array((result.data as Float32Array).slice()));
        }
        return out;
      },
    };
  })();
  return loaded;
}
