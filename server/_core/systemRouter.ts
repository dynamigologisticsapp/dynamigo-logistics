import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { createGeoapifyAddressProvider } from "../geoapify-service";

const addressProvider = createGeoapifyAddressProvider();

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      }),
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  searchAddresses: publicProcedure
    .input(
      z.object({
        query: z.string().min(1, "query is required"),
      }),
    )
    .query(async ({ input }) => {
      try {
        const addresses = await addressProvider.autocomplete(input.query);
        return {
          predictions: addresses.map((address) => ({
            description: address.formatted,
            place_id: address.placeId ?? address.formatted,
            postcode: address.postcode,
            town: address.town,
            latitude: address.latitude,
            longitude: address.longitude,
          })),
        };
      } catch (error) {
        console.error("[Geoapify] Address search error:", error);
        return {
          predictions: [],
          error: error instanceof Error ? error.message : "Address search failed",
        };
      }
    }),

  getAddressDetails: publicProcedure
    .input(
      z.object({
        placeId: z.string().min(1, "placeId is required"),
      }),
    )
    .query(async ({ input }) => {
      try {
        const result = await addressProvider.geocode(input.placeId);
        return {
          address: result?.formatted ?? "",
          postcode: result?.postcode ?? "",
          latitude: result?.latitude,
          longitude: result?.longitude,
        };
      } catch (error) {
        console.error("[Geoapify] Address details error:", error);
        return { address: "", postcode: "" };
      }
    }),

  searchPostcodeAddresses: publicProcedure
    .input(
      z.object({
        postcode: z.string().min(1, "postcode is required"),
      }),
    )
    .query(async ({ input }) => {
      // Mock data for testing - replace with real API when ready
      const mockData: Record<string, { houseNumbers: string[]; addresses: any[] }> = {
        "G67 3BY": {
          houseNumbers: ["147 Rowan Road", "148 Rowan Road", "149 Rowan Road", "150 Rowan Road", "151 Rowan Road", "152 Rowan Road"],
          addresses: [
            { address: "147 Rowan Road, Cumbernauld, Glasgow G67 3BY", postcode: "G67 3BY", latitude: 55.9465, longitude: -3.9471 },
            { address: "148 Rowan Road, Cumbernauld, Glasgow G67 3BY", postcode: "G67 3BY", latitude: 55.9465, longitude: -3.9471 },
            { address: "149 Rowan Road, Cumbernauld, Glasgow G67 3BY", postcode: "G67 3BY", latitude: 55.9465, longitude: -3.9471 },
            { address: "150 Rowan Road, Cumbernauld, Glasgow G67 3BY", postcode: "G67 3BY", latitude: 55.9465, longitude: -3.9471 },
            { address: "151 Rowan Road, Cumbernauld, Glasgow G67 3BY", postcode: "G67 3BY", latitude: 55.9465, longitude: -3.9471 },
            { address: "152 Rowan Road, Cumbernauld, Glasgow G67 3BY", postcode: "G67 3BY", latitude: 55.9465, longitude: -3.9471 },
          ],
        },
        "EH8 8DX": {
          houseNumbers: ["10 Leith Street", "12 Leith Street", "14 Leith Street", "16 Leith Street", "18 Leith Street"],
          addresses: [
            { address: "10 Leith Street, Edinburgh EH8 8DX", postcode: "EH8 8DX", latitude: 55.9575, longitude: -3.1738 },
            { address: "12 Leith Street, Edinburgh EH8 8DX", postcode: "EH8 8DX", latitude: 55.9575, longitude: -3.1738 },
            { address: "14 Leith Street, Edinburgh EH8 8DX", postcode: "EH8 8DX", latitude: 55.9575, longitude: -3.1738 },
            { address: "16 Leith Street, Edinburgh EH8 8DX", postcode: "EH8 8DX", latitude: 55.9575, longitude: -3.1738 },
            { address: "18 Leith Street, Edinburgh EH8 8DX", postcode: "EH8 8DX", latitude: 55.9575, longitude: -3.1738 },
          ],
        },
      };

      const normalizedPostcode = input.postcode.toUpperCase().trim();
      const data = mockData[normalizedPostcode];

      if (data) {
        return { addresses: data.addresses, houseNumbers: data.houseNumbers };
      }

      // Fallback to Geoapify if postcode is not in the local fixtures.
      try {
        const addresses = (await addressProvider.autocomplete(input.postcode, 30)).map(
          (result) => ({
            address: result.formatted,
            postcode: result.postcode,
            latitude: result.latitude,
            longitude: result.longitude,
            placeId: result.placeId,
          }),
        );

        // Extract house numbers from addresses (first part before comma)
        const houseNumbers = addresses
          .map((addr: any) => {
            const parts = addr.address.split(',');
            return parts[0]?.trim() || addr.address;
          })
          .filter((num: string, index: number, self: string[]) => self.indexOf(num) === index); // Remove duplicates

        return { addresses, houseNumbers };
      } catch (error) {
        console.error("[Geoapify] Postcode search error:", error);
        return { addresses: [], houseNumbers: [] };
      }
    }),
});
