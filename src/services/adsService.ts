import { invoke, isTauri } from '@tauri-apps/api/core';

/** Google sample banner unit — replace with your AdMob unit for production. */
export const HOME_BANNER_AD_UNIT_ID =
  (import.meta.env.VITE_ADMOB_BANNER_UNIT_ID as string | undefined)
  || 'ca-app-pub-3940256099942544/2934735716';

export async function showHomeAdBanner(adUnitId = HOME_BANNER_AD_UNIT_ID): Promise<void> {
  try {
    if (!(await isTauri())) return;
    await invoke('show_home_ad_banner', { adUnitId });
  } catch (err) {
    console.warn('[Ads] show_home_ad_banner failed:', err);
  }
}

export async function hideHomeAdBanner(): Promise<void> {
  try {
    if (!(await isTauri())) return;
    await invoke('hide_home_ad_banner');
  } catch (err) {
    console.warn('[Ads] hide_home_ad_banner failed:', err);
  }
}
