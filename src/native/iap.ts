import { invoke } from "@tauri-apps/api/core";

/**
 * Must match App Store Connect non-consumable product id.
 * Implemented via native StoreKit bridge (not tauri-plugin-iap).
 */
export const REMOVE_ADS_PRODUCT_ID = "run4fun_remove_ads";

export type PurchaseResult =
  | { ok: true; mock?: boolean; pending?: boolean }
  | { ok: false; reason: string };

export type RemoveAdsProduct = {
  productId: string;
  title?: string;
  description?: string;
  formattedPrice?: string;
  priceCurrencyCode?: string | null;
};

export async function fetchRemoveAdsProduct(): Promise<RemoveAdsProduct | null> {
  try {
    return await invoke<RemoveAdsProduct>("fetch_remove_ads_product");
  } catch {
    return null;
  }
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

export async function purchaseRemoveAds(): Promise<PurchaseResult> {
  try {
    const status = await invoke<string>("purchase_remove_ads");
    if (status === "pending") return { ok: true, pending: true };
    return { ok: true };
  } catch (e) {
    const msg = errMsg(e);
    if (/cancel/i.test(msg)) return { ok: false, reason: "canceled" };
    if (/iap_unavailable/i.test(msg)) return { ok: false, reason: "iap_unavailable" };
    if (/not_found/i.test(msg)) return { ok: false, reason: "not_found" };
    return { ok: false, reason: msg || "purchase_failed" };
  }
}

export async function restoreRemoveAds(): Promise<PurchaseResult> {
  try {
    const status = await invoke<{ productId: string; owned: boolean }>("restore_remove_ads");
    if (status.owned) return { ok: true };
    return { ok: false, reason: "not_found" };
  } catch (e) {
    const msg = errMsg(e);
    if (/iap_unavailable/i.test(msg)) return { ok: false, reason: "iap_unavailable" };
    return { ok: false, reason: msg || "restore_failed" };
  }
}

export async function syncAdsRemovedFromStore(): Promise<boolean> {
  try {
    return await invoke<boolean>("is_remove_ads_owned");
  } catch {
    const res = await restoreRemoveAds();
    return res.ok === true && !("mock" in res && res.mock);
  }
}

export async function listenForRemoveAdsPurchases(
  _onPurchased: () => void | Promise<void>,
): Promise<() => void> {
  // StoreKit Transaction.updates would go here if we need live entitlement pushes.
  // Settings/home already re-check ownership on focus via syncAdsRemovedFromStore.
  return () => {};
}

export async function mockRemoveAds(): Promise<PurchaseResult> {
  return { ok: true, mock: true };
}

export function isDevMockAllowed(): boolean {
  return Boolean(import.meta.env.DEV);
}
