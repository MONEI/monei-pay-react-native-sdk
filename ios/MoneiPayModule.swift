import ExpoModulesCore
import UIKit

public class MoneiPayModule: Module {
  private static let moneiPayScheme = "monei-pay"

  private var pendingPromise: Promise?

  public func definition() -> ModuleDefinition {
    Name("MoneiPay")

    AsyncFunction("acceptPayment") { (params: [String: Any], promise: Promise) in
      guard let token = params["token"] as? String, !token.isEmpty else {
        promise.reject("INVALID_PARAMS", "token is required")
        return
      }
      guard let amount = params["amount"] as? Int, amount > 0 else {
        promise.reject("INVALID_PARAMS", "amount must be positive")
        return
      }
      guard let completeScheme = params["completeScheme"] as? String, !completeScheme.isEmpty else {
        promise.reject("INVALID_PARAMS", "completeScheme is required on iOS")
        return
      }

      // Client-side sanity check: must mirror lib/deep-link-utils.ts isValidCallbackUrl
      // (keep in sync). Server-side zod (mcc-service) is the real boundary; skip private-IP check here.
      var callbackUrl: String?
      if let raw = params["callbackUrl"] as? String, !raw.isEmpty {
        if !Self.isValidCallbackUrl(raw) {
          promise.reject("INVALID_CALLBACK_URL", "callbackUrl must be https and ≤ 2048 chars")
          return
        }
        callbackUrl = raw
      }

      if self.pendingPromise != nil {
        promise.reject("PAYMENT_IN_PROGRESS", "A payment is already in progress")
        return
      }

      // Build MONEI Pay URL
      var components = URLComponents()
      components.scheme = Self.moneiPayScheme
      components.host = "accept-payment"

      var queryItems = [
        URLQueryItem(name: "amount", value: String(amount)),
        URLQueryItem(name: "auth_token", value: token),
        URLQueryItem(name: "complete_url", value: "\(completeScheme)://payment-result")
      ]

      if let cb = callbackUrl {
        queryItems.append(URLQueryItem(name: "callback_url", value: cb))
      }
      if let desc = params["description"] as? String, !desc.isEmpty {
        queryItems.append(URLQueryItem(name: "description", value: desc))
      }
      if let name = params["customerName"] as? String, !name.isEmpty {
        queryItems.append(URLQueryItem(name: "customer_name", value: name))
      }
      if let email = params["customerEmail"] as? String, !email.isEmpty {
        queryItems.append(URLQueryItem(name: "customer_email", value: email))
      }
      if let phone = params["customerPhone"] as? String, !phone.isEmpty {
        queryItems.append(URLQueryItem(name: "customer_phone", value: phone))
      }

      components.queryItems = queryItems

      guard let url = components.url else {
        promise.reject("INVALID_PARAMS", "Failed to build payment URL")
        return
      }

      DispatchQueue.main.async {
        // Check MONEI Pay installed
        guard let testUrl = URL(string: "\(Self.moneiPayScheme)://"),
              UIApplication.shared.canOpenURL(testUrl) else {
          promise.reject("NOT_INSTALLED", "MONEI Pay is not installed")
          return
        }

        self.pendingPromise = promise

        UIApplication.shared.open(url) { success in
          if !success {
            self.rejectPending(code: "FAILED_TO_OPEN", message: "Failed to open MONEI Pay")
          }
        }
      }
    }

    Function("handleCompleteRedirect") { (urlString: String) -> Bool in
      guard self.pendingPromise != nil else { return false }

      guard let url = URL(string: urlString),
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
        return false
      }

      let params = components.queryItems?.reduce(into: [String: String]()) { result, item in
        if let value = item.value {
          result[item.name] = value
        }
      } ?? [:]

      // Handle error redirect
      if params["success"] == "false" {
        let error = params["error"] ?? "PAYMENT_FAILED"
        self.rejectPending(code: Self.mapErrorCode(error), message: error)
        return true
      }

      // Parse success
      guard params["success"] == "true",
            let transactionId = params["transaction_id"], !transactionId.isEmpty else {
        self.rejectPending(code: "PAYMENT_FAILED", message: "Invalid redirect parameters")
        return true
      }

      let result: [String: Any] = [
        "transactionId": transactionId,
        "success": true,
        "amount": Int(params["amount"] ?? "") ?? 0,
        "cardBrand": params["card_brand"] ?? "",
        "maskedCardNumber": params["masked_card_number"] ?? ""
      ]

      self.pendingPromise?.resolve(result)
      self.pendingPromise = nil
      return true
    }

    Function("cancelPendingPayment") {
      self.rejectPending(code: "CANCELLED", message: "Payment was cancelled")
    }
  }

  private func rejectPending(code: String, message: String) {
    pendingPromise?.reject(code, message)
    pendingPromise = nil
  }

  // Maps the full set of error codes emitted by monei-pay app's complete_url onto SDK error codes.
  internal static func mapErrorCode(_ raw: String) -> String {
    switch raw {
    case "CANCELLED", "USER_CANCELLED":
      return "CANCELLED"
    case "TOKEN_EXPIRED":
      return "TOKEN_EXPIRED"
    case "INVALID_TOKEN":
      return "INVALID_TOKEN"
    case "INVALID_AMOUNT":
      return "INVALID_AMOUNT"
    case "INVALID_CALLBACK_URL":
      return "INVALID_CALLBACK_URL"
    case "INVALID_COMPLETE_URL":
      return "INVALID_COMPLETE_URL"
    case "NOT_AUTHENTICATED":
      return "NOT_AUTHENTICATED"
    case "ACCOUNT_NOT_CONFIGURED":
      return "ACCOUNT_NOT_CONFIGURED"
    default:
      return "PAYMENT_FAILED"
    }
  }

  // Must mirror lib/deep-link-utils.ts isValidCallbackUrl (keep in sync).
  internal static func isValidCallbackUrl(_ url: String) -> Bool {
    return url.hasPrefix("https://") && url.count <= 2048
  }
}
