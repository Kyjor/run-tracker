# iOS Notification Setup

According to the [Tauri notification plugin docs](https://v2.tauri.app/plugin/notification/), iOS local notifications should work out of the box **without any additional configuration**.

## For Local Notifications (What We're Using)

**You do NOT need:**
- ❌ Push Notifications capability
- ❌ `aps-environment` in entitlements  
- ❌ `remote-notification` in UIBackgroundModes

**You only need:**
- ✅ The Tauri notification plugin installed and initialized
- ✅ Call `requestPermission()` when the user enables the reminder
- ✅ The notification option will appear in iOS Settings **after the first permission request**

## How It Works

The Tauri plugin uses `UNUserNotificationCenter.requestAuthorization()` under the hood, which is the standard iOS API for local notifications. No special capabilities or entitlements are required.

## Testing

1. Enable "Daily training reminder" in app Settings
2. Click "Request Permission Now" button
3. The iOS permission prompt should appear
4. After granting, check iOS Settings > Run With Friends > Notifications

## Important Notes

- **The notification option won't appear in iOS Settings until the app requests permission at least once**
- The Tauri plugin handles the permission request automatically via `UNUserNotificationCenter`
- If permission was previously denied, iOS won't show the prompt again - user must enable in Settings manually

## Debugging

Check the console logs for `[Notifications]` messages to see:
- If the Tauri plugin is available
- What permission status is returned
- If the request is actually being called

If you see errors about the plugin not being available, verify:
1. The plugin is in `Cargo.toml`: `tauri-plugin-notification = "2"`
2. The plugin is initialized in `lib.rs`: `.plugin(tauri_plugin_notification::init())`
3. The npm package is installed: `@tauri-apps/plugin-notification`

