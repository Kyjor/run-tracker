import Foundation
import UIKit

#if canImport(GoogleMobileAds)
import GoogleMobileAds
#endif

/// Home-screen banner only. Shown/hidden from JS when Dashboard mounts.
private final class HomeBannerController: NSObject {
  static let shared = HomeBannerController()

  #if canImport(GoogleMobileAds)
  private var bannerView: BannerView?
  #endif
  private var container: UIView?
  private var started = false

  func show(adUnitId: String) {
    DispatchQueue.main.async {
      self.showOnMain(adUnitId: adUnitId)
    }
  }

  func hide() {
    DispatchQueue.main.async {
      self.hideOnMain()
    }
  }

  private func showOnMain(adUnitId: String) {
    #if canImport(GoogleMobileAds)
    if !started {
      MobileAds.shared.start(completionHandler: nil)
      started = true
    }

    guard let host = Self.keyWindowRootView() else { return }

    if bannerView == nil {
      let banner = BannerView(adSize: AdSizeBanner)
      banner.adUnitID = adUnitId
      banner.rootViewController = host
      banner.translatesAutoresizingMaskIntoConstraints = false

      let wrap = UIView()
      wrap.translatesAutoresizingMaskIntoConstraints = false
      wrap.backgroundColor = .clear
      host.view.addSubview(wrap)
      wrap.addSubview(banner)

      let guide = host.view.safeAreaLayoutGuide
      // Sit above the in-app tab bar (~56pt)
      NSLayoutConstraint.activate([
        wrap.leadingAnchor.constraint(equalTo: host.view.leadingAnchor),
        wrap.trailingAnchor.constraint(equalTo: host.view.trailingAnchor),
        wrap.bottomAnchor.constraint(equalTo: guide.bottomAnchor, constant: -56),
        wrap.heightAnchor.constraint(equalToConstant: 50),
        banner.centerXAnchor.constraint(equalTo: wrap.centerXAnchor),
        banner.centerYAnchor.constraint(equalTo: wrap.centerYAnchor),
      ])

      container = wrap
      bannerView = banner
      banner.load(Request())
    } else {
      container?.isHidden = false
      bannerView?.isHidden = false
    }
    #else
    _ = adUnitId
    print("[AdBanner] GoogleMobileAds not linked — home banner skipped")
    #endif
  }

  private func hideOnMain() {
    #if canImport(GoogleMobileAds)
    container?.isHidden = true
    bannerView?.isHidden = true
    #endif
  }

  private static func keyWindowRootView() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    for scene in scenes {
      if let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController {
        return root
      }
    }
    return scenes.first?.windows.first?.rootViewController
  }
}

@_cdecl("admob_show_home_banner")
public func admobShowHomeBanner(adUnitId: UnsafePointer<CChar>) -> Int32 {
  let unit = String(cString: adUnitId)
  guard !unit.isEmpty else { return -1 }
  HomeBannerController.shared.show(adUnitId: unit)
  return 0
}

@_cdecl("admob_hide_home_banner")
public func admobHideHomeBanner() -> Int32 {
  HomeBannerController.shared.hide()
  return 0
}
