import {
  acknowledgePurchase,
  getProducts,
  getProductStatus,
  onPurchaseUpdated,
  purchase,
  restorePurchases,
  PurchaseState,
  type Product,
  type Purchase,
} from "@choochmeque/tauri-plugin-iap-api";

/**
 * Must match App Store Connect non-consumable product id.
 */
export const REMOVE_ADS_PRODUCT_ID = "run4fun_remove_ads";
export const PRODUCT_TYPE = "inapp" as const;

export type PurchaseResult =
  | { ok: true; mock?: boolean; pending?: boolean }
  | { ok: false; reason: string };

const ACCOUNT_TOKEN_KEY = "run4fun_iap_account_token";

export function getIapAccountToken(): string {
  try {
    const existing = localStorage.getItem(ACCOUNT_TOKEN_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const token = crypto.randomUUID();
    localStorage.setItem(ACCOUNT_TOKEN_KEY, token);
    return token;
  } catch {
    return "00000000-0000-4000-8000-000000000001";
  }
}

function obfuscateId(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
  return `r4f_${(h >>> 0).toString(16)}_${value.replace(/-/g, "").slice(0, 24)}`.slice(0, 64);
}

async function acknowledgeIfNeeded(p: Purchase): Promise<void> {
  if (!p.purchaseToken) return;
  if (p.isAcknowledged) return;
  try {
    await acknowledgePurchase(p.purchaseToken);
  } catch {
    /* iOS no-op; Android may retry later */
  }
}

function isRemoveAdsPurchase(p: Purchase): boolean {
  return p.productId === REMOVE_ADS_PRODUCT_ID && p.purchaseState === PurchaseState.PURCHASED;
}

export async function fetchRemoveAdsProduct(): Promise<Product | null> {
  try {
    const { products } = await getProducts([REMOVE_ADS_PRODUCT_ID], PRODUCT_TYPE);
    return products.find((p) => p.productId === REMOVE_ADS_PRODUCT_ID) ?? products[0] ?? null;
  } catch {
    return null;
  }
}

export async function purchaseRemoveAds(): Promise<PurchaseResult> {
  try {
    const token = getIapAccountToken();
    const result = await purchase(REMOVE_ADS_PRODUCT_ID, PRODUCT_TYPE, {
      appAccountToken: token,
      obfuscatedAccountId: obfuscateId(token),
      obfuscatedProfileId: obfuscateId(`${token}-device`),
    });

    if (result.purchaseState === PurchaseState.PENDING) {
      return { ok: true, pending: true };
    }
    if (result.purchaseState === PurchaseState.CANCELED) {
      return { ok: false, reason: "canceled" };
    }
    if (result.productId !== REMOVE_ADS_PRODUCT_ID) {
      return { ok: false, reason: "unexpected_product" };
    }

    await acknowledgeIfNeeded(result);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel|user.?cancel|payment.?cancelled/i.test(msg)) {
      return { ok: false, reason: "canceled" };
    }
    if (/not available|unsupported|plugin|webview/i.test(msg)) {
      return { ok: false, reason: "iap_unavailable" };
    }
    return { ok: false, reason: msg || "purchase_failed" };
  }
}

export async function restoreRemoveAds(): Promise<PurchaseResult> {
  try {
    const status = await getProductStatus(REMOVE_ADS_PRODUCT_ID, PRODUCT_TYPE);
    if (status.isOwned && status.purchaseState !== PurchaseState.CANCELED) {
      if (status.purchaseToken && status.isAcknowledged === false) {
        try {
          await acknowledgePurchase(status.purchaseToken);
        } catch {
          /* ignore */
        }
      }
      return { ok: true };
    }

    const { purchases } = await restorePurchases(PRODUCT_TYPE);
    const owned = purchases.find(isRemoveAdsPurchase);
    if (!owned) return { ok: false, reason: "not_found" };
    await acknowledgeIfNeeded(owned);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not available|unsupported|plugin|webview/i.test(msg)) {
      return { ok: false, reason: "iap_unavailable" };
    }
    return { ok: false, reason: msg || "restore_failed" };
  }
}

export async function syncAdsRemovedFromStore(): Promise<boolean> {
  const res = await restoreRemoveAds();
  return res.ok === true && !("mock" in res && res.mock);
}

export async function listenForRemoveAdsPurchases(
  onPurchased: () => void | Promise<void>,
): Promise<() => void> {
  try {
    const listener = await onPurchaseUpdated(async (p) => {
      if (!isRemoveAdsPurchase(p)) return;
      await acknowledgeIfNeeded(p);
      await onPurchased();
    });
    return () => {
      void listener.unregister();
    };
  } catch {
    return () => {};
  }
}

export async function mockRemoveAds(): Promise<PurchaseResult> {
  return { ok: true, mock: true };
}

export function isDevMockAllowed(): boolean {
  return Boolean(import.meta.env.DEV);
}
