import { invoke, isTauri } from '@tauri-apps/api/core';

export async function startHrmScan(): Promise<boolean> {
  try {
    if (!(await isTauri())) return false;
    await invoke('hrm_start_scan');
    return true;
  } catch {
    return false;
  }
}

export async function stopHrmScan(): Promise<void> {
  try {
    if (!(await isTauri())) return;
    await invoke('hrm_stop_scan');
  } catch {
    // ignore
  }
}

export async function isHrmConnected(): Promise<boolean> {
  try {
    if (!(await isTauri())) return false;
    return await invoke<boolean>('hrm_is_connected');
  } catch {
    return false;
  }
}
