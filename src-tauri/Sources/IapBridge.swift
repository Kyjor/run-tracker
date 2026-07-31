import Foundation
import StoreKit

/// Minimal StoreKit 2 bridge for the Remove Ads non-consumable.
/// Avoids tauri-plugin-iap, which vendors a second copy of Tauri's Swift into libapp.a.

private let removeAdsProductId = "run4fun_remove_ads"

private struct ProductJSON: Codable {
    let productId: String
    let title: String
    let description: String
    let formattedPrice: String
    let priceCurrencyCode: String?
}

private struct StatusJSON: Codable {
    let productId: String
    let owned: Bool
}

private enum IapError: String {
    case unavailable = "iap_unavailable"
    case notFound = "not_found"
    case canceled = "canceled"
    case failed = "purchase_failed"
}

@available(iOS 15.0, *)
private enum IapStore {
    static func product() async throws -> Product {
        let products = try await Product.products(for: [removeAdsProductId])
        guard let product = products.first else {
            throw NSError(domain: "IapBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: IapError.notFound.rawValue])
        }
        return product
    }

    static func isOwned() async -> Bool {
        for await result in Transaction.currentEntitlements {
            guard case .verified(let tx) = result else { continue }
            if tx.productID == removeAdsProductId && tx.revocationDate == nil {
                return true
            }
        }
        return false
    }

    static func purchase() async throws -> String {
        let product = try await product()
        let result = try await product.purchase()
        switch result {
        case .success(let verification):
            let tx = try checkVerified(verification)
            await tx.finish()
            return "ok"
        case .userCancelled:
            throw NSError(domain: "IapBridge", code: 2, userInfo: [NSLocalizedDescriptionKey: IapError.canceled.rawValue])
        case .pending:
            return "pending"
        @unknown default:
            throw NSError(domain: "IapBridge", code: 3, userInfo: [NSLocalizedDescriptionKey: IapError.failed.rawValue])
        }
    }

    static func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw NSError(domain: "IapBridge", code: 4, userInfo: [NSLocalizedDescriptionKey: IapError.failed.rawValue])
        case .verified(let safe):
            return safe
        }
    }
}

private func runBlocking<T>(_ work: @escaping () async throws -> T) throws -> T {
    let sem = DispatchSemaphore(value: 0)
    var out: Result<T, Error>!
    Task { @MainActor in
        do { out = .success(try await work()) }
        catch { out = .failure(error) }
        sem.signal()
    }
    sem.wait()
    return try out.get()
}

private func writeJson<T: Encodable>(
    _ value: T,
    resultPtr: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?,
    resultLen: UnsafeMutablePointer<Int>?
) -> Int32 {
    do {
        let data = try JSONEncoder().encode(value)
        guard let str = String(data: data, encoding: .utf8) else { return -1 }
        resultPtr?.pointee = strdup(str)
        resultLen?.pointee = str.utf8.count
        return 0
    } catch {
        return -1
    }
}

private func writeError(
    _ message: String,
    resultPtr: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?,
    resultLen: UnsafeMutablePointer<Int>?
) -> Int32 {
    resultPtr?.pointee = strdup(message)
    resultLen?.pointee = message.utf8.count
    return -1
}

@_cdecl("iap_fetch_remove_ads_product")
public func iapFetchRemoveAdsProduct(
    resultPtr: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?,
    resultLen: UnsafeMutablePointer<Int>?
) -> Int32 {
    if #available(iOS 15.0, *) {
        do {
            let product = try runBlocking { try await IapStore.product() }
            let json = ProductJSON(
                productId: product.id,
                title: product.displayName,
                description: product.description,
                formattedPrice: product.displayPrice,
                priceCurrencyCode: {
                    if #available(iOS 16.0, *) {
                        return Locale.current.currency?.identifier
                    }
                    return Locale.current.currencyCode
                }()
            )
            return writeJson(json, resultPtr: resultPtr, resultLen: resultLen)
        } catch {
            let msg = (error as NSError).localizedDescription
            return writeError(msg.isEmpty ? IapError.failed.rawValue : msg, resultPtr: resultPtr, resultLen: resultLen)
        }
    }
    return writeError(IapError.unavailable.rawValue, resultPtr: resultPtr, resultLen: resultLen)
}

@_cdecl("iap_purchase_remove_ads")
public func iapPurchaseRemoveAds(
    resultPtr: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?,
    resultLen: UnsafeMutablePointer<Int>?
) -> Int32 {
    if #available(iOS 15.0, *) {
        do {
            let status = try runBlocking { try await IapStore.purchase() }
            resultPtr?.pointee = strdup(status)
            resultLen?.pointee = status.utf8.count
            return 0
        } catch {
            let msg = (error as NSError).localizedDescription
            return writeError(msg.isEmpty ? IapError.failed.rawValue : msg, resultPtr: resultPtr, resultLen: resultLen)
        }
    }
    return writeError(IapError.unavailable.rawValue, resultPtr: resultPtr, resultLen: resultLen)
}

@_cdecl("iap_restore_remove_ads")
public func iapRestoreRemoveAds(
    resultPtr: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?,
    resultLen: UnsafeMutablePointer<Int>?
) -> Int32 {
    if #available(iOS 15.0, *) {
        // Refresh entitlement state from App Store, then check local entitlements.
        do {
            try runBlocking { try await AppStore.sync() }
        } catch {
            // sync can fail offline; still check current entitlements
        }
        let owned = (try? runBlocking { await IapStore.isOwned() }) ?? false
        return writeJson(StatusJSON(productId: removeAdsProductId, owned: owned), resultPtr: resultPtr, resultLen: resultLen)
    }
    return writeError(IapError.unavailable.rawValue, resultPtr: resultPtr, resultLen: resultLen)
}

@_cdecl("iap_is_remove_ads_owned")
public func iapIsRemoveAdsOwned(
    resultPtr: UnsafeMutablePointer<UnsafeMutablePointer<CChar>?>?,
    resultLen: UnsafeMutablePointer<Int>?
) -> Int32 {
    if #available(iOS 15.0, *) {
        let owned = (try? runBlocking { await IapStore.isOwned() }) ?? false
        return writeJson(StatusJSON(productId: removeAdsProductId, owned: owned), resultPtr: resultPtr, resultLen: resultLen)
    }
    return writeError(IapError.unavailable.rawValue, resultPtr: resultPtr, resultLen: resultLen)
}
