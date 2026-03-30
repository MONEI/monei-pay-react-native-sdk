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
      guard let callbackScheme = params["callbackScheme"] as? String, !callbackScheme.isEmpty else {
        promise.reject("INVALID_PARAMS", "callbackScheme is required on iOS")
        return
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
        URLQueryItem(name: "callback", value: "\(callbackScheme)://payment-result")
      ]

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

    Function("handleCallback") { (urlString: String) -> Bool in
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

      // Handle error callback
      if params["success"] == "false" {
        let error = params["error"]
        if error == "CANCELLED" || error == "USER_CANCELLED" {
          self.rejectPending(code: "CANCELLED", message: "Payment was cancelled")
        } else {
          self.rejectPending(code: "PAYMENT_FAILED", message: error ?? "Payment failed")
        }
        return true
      }

      // Parse success
      guard params["success"] == "true",
            let transactionId = params["transaction_id"], !transactionId.isEmpty else {
        self.rejectPending(code: "PAYMENT_FAILED", message: "Invalid callback parameters")
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
}
