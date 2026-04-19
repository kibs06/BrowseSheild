export const PROTECTION_STATE_KEY = 'browseShieldEnabled';
export const DEFAULT_PROTECTION_ENABLED = true;

export async function getProtectionEnabled() {
  const stored = await chrome.storage.local.get([PROTECTION_STATE_KEY]);
  const value = stored?.[PROTECTION_STATE_KEY];
  return typeof value === 'boolean' ? value : DEFAULT_PROTECTION_ENABLED;
}

export async function setProtectionEnabled(enabled) {
  await chrome.storage.local.set({
    [PROTECTION_STATE_KEY]: Boolean(enabled),
  });

  return Boolean(enabled);
}

export async function shouldRunProtection() {
  return getProtectionEnabled();
}

export async function initializeProtectionState() {
  const stored = await chrome.storage.local.get([PROTECTION_STATE_KEY]);
  if (typeof stored?.[PROTECTION_STATE_KEY] === 'boolean') {
    return stored[PROTECTION_STATE_KEY];
  }

  await chrome.storage.local.set({
    [PROTECTION_STATE_KEY]: DEFAULT_PROTECTION_ENABLED,
  });

  return DEFAULT_PROTECTION_ENABLED;
}
