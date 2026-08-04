import { Router, Request, Response } from "express";
import { createGeoapifyAddressProvider } from "../geoapify-service";

const router = Router();
const addressProvider = createGeoapifyAddressProvider();

/**
 * Search UK addresses using Geoapify.
 * POST /api/search-addresses
 * Body: { query: string }
 */
router.post("/search-addresses", async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || query.length < 2) {
      return res.json({
        success: false,
        error: "Query must be at least 2 characters",
      });
    }

    const addresses = await addressProvider.autocomplete(query);

    return res.json({
      success: true,
      addresses,
    });
  } catch (err) {
    console.error("[AddressSearch] Error:", err);
    return res.json({
      success: false,
      error:
        err instanceof Error && err.message.includes("not configured")
          ? "Address search is not configured"
          : "Failed to search addresses",
    });
  }
});

export default router;
