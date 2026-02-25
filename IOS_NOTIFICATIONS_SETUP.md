# iOS Notification Setup

According to the [Tauri notification plugin docs](https://v2.tauri.app/plugin/notification/), iOS notifications should work out of the box. However, if the notification permission option isn't appearing in iOS Settings, you may need to configure Xcode.

## Steps

1. **Open the Xcode project**:
   ```bash
   open src-tauri/gen/apple/run-with-friends_iOS.xcodeproj
   ```

2. **Add Push Notifications Capability** (even for local notifications):
   - Select your app target in Xcode
   - Go to "Signing & Capabilities" tab
   - Click "+ Capability"
   - Add "Push Notifications"
   - This will automatically add the required entitlements

3. **Verify Info.plist**:
   - You've already added `UIBackgroundModes` with `remote-notification` ✓
   - This should be sufficient

4. **Test the permission request**:
   - In the app Settings, enable "Daily training reminder"
   - Click "Request Permission Now" button (if permission isn't granted)
   - The iOS permission prompt should appear
   - After granting, check iOS Settings > Run With Friends > Notifications

## Important Notes

- **The notification option won't appear in iOS Settings until the app requests permission at least once**
- The Tauri plugin handles the permission request automatically
- If permission was previously denied, iOS won't show the prompt again - user must enable in Settings manually
- The `remote-notification` background mode you added is correct for notifications

## Debugging

Check the console logs for `[Notifications]` messages to see:
- If the Tauri plugin is available
- What permission status is returned
- If the request is actually being called

If you see errors about the plugin not being available, verify:
1. The plugin is in `Cargo.toml`: `tauri-plugin-notification = "2"`
2. The plugin is initialized in `lib.rs`: `.plugin(tauri_plugin_notification::init())`
3. The npm package is installed: `@tauri-apps/plugin-notification`

