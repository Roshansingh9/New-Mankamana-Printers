import {
  listActiveProductsService,
  getActiveProductByIdService,
  listActiveVariantsByProductService,
  listVariantOptionsService,
} from "../services/catalog/catalog-pricing.service";

/**
 * preWarmCatalogCache
 *
 * Called once on server startup. Fetches every active product, variant, and
 * variant-options record so that the first real user request always hits
 * the in-memory cache instead of Supabase.
 *
 * Runs fire-and-forget — errors are logged but never crash the server.
 */
export const preWarmCatalogCache = async (): Promise<void> => {
  try {
    const products = await listActiveProductsService();
    console.log(`[CacheWarmup] Warming cache for ${products.length} product(s)…`);

    await Promise.all(
      products.map(async (product) => {
        try {
          // Cache product detail + variant list in parallel
          const [, variantsData] = await Promise.all([
            getActiveProductByIdService(product.id),
            listActiveVariantsByProductService(product.id),
          ]);

          // Cache options (and embedded pricing rows) for every variant in parallel
          await Promise.all(
            (variantsData.data ?? []).map((v) =>
              listVariantOptionsService(v.id).catch((err) =>
                console.warn(`[CacheWarmup] Skipping variant ${v.id}: ${err?.message}`)
              )
            )
          );
        } catch (err: any) {
          console.warn(`[CacheWarmup] Skipping product ${product.id}: ${err?.message}`);
        }
      })
    );

    console.log("[CacheWarmup] Catalog cache warm-up complete.");
  } catch (err: any) {
    console.warn("[CacheWarmup] Warm-up failed (non-fatal):", err?.message);
  }
};
