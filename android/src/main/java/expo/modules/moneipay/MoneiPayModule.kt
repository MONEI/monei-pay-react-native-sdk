package expo.modules.moneipay

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import org.json.JSONArray
import org.json.JSONObject
import java.util.Base64
import java.util.Locale
import java.util.UUID

class MoneiPayModule : Module() {

  companion object {
    private const val REQUEST_CODE_MONEI_PAY = 10001
    private const val REQUEST_CODE_DIRECT = 10002
    private const val MONEI_PAY_ACTION = "com.monei.pay.ACCEPT_PAYMENT"
    private const val CLOUD_COMMERCE_PACKAGE = "com.mastercard.cpos"
    private const val SDK_VERSION = "0.2.0"
  }

  private var pendingPromise: Promise? = null
  private var pendingAmount: Int = 0

  override fun definition() = ModuleDefinition {
    Name("MoneiPay")

    AsyncFunction("acceptPayment") { params: Map<String, Any?>, promise: Promise ->
      val activity = appContext.currentActivity ?: run {
        promise.reject("NO_ACTIVITY", "No activity available", null)
        return@AsyncFunction
      }

      if (pendingPromise != null) {
        promise.reject("PAYMENT_IN_PROGRESS", "A payment is already in progress", null)
        return@AsyncFunction
      }

      val token = params["token"] as? String
      if (token.isNullOrEmpty()) {
        promise.reject("INVALID_PARAMS", "token is required", null)
        return@AsyncFunction
      }

      val amount = (params["amount"] as? Number)?.toInt() ?: 0
      if (amount <= 0) {
        promise.reject("INVALID_PARAMS", "amount must be positive", null)
        return@AsyncFunction
      }

      val mode = params["mode"] as? String ?: "direct"
      val description = params["description"] as? String
      val customerName = params["customerName"] as? String
      val customerEmail = params["customerEmail"] as? String
      val customerPhone = params["customerPhone"] as? String

      pendingPromise = promise
      pendingAmount = amount

      when (mode) {
        "via-monei-pay" -> launchMoneiPay(
          activity, token, amount, description, customerName, customerEmail, customerPhone
        )
        else -> launchDirect(
          activity, token, amount, description, customerName, customerEmail, customerPhone
        )
      }
    }

    Function("handleCallback") { urlString: String ->
      // iOS-only — no-op on Android, returns false
      false
    }

    Function("cancelPendingPayment") {
      rejectPending("CANCELLED", "Payment was cancelled")
    }

    OnActivityResult { _, payload ->
      when (payload.requestCode) {
        REQUEST_CODE_MONEI_PAY -> handleMoneiPayResult(payload.resultCode, payload.data)
        REQUEST_CODE_DIRECT -> handleDirectResult(payload.data)
      }
    }
  }

  private fun launchMoneiPay(
    activity: Activity,
    token: String,
    amount: Int,
    description: String?,
    customerName: String?,
    customerEmail: String?,
    customerPhone: String?
  ) {
    val intent = Intent(MONEI_PAY_ACTION).apply {
      putExtra("amount_cents", amount)
      putExtra("auth_token", token)
      if (!description.isNullOrEmpty()) putExtra("description", description)
      if (!customerName.isNullOrEmpty()) putExtra("customer_name", customerName)
      if (!customerEmail.isNullOrEmpty()) putExtra("customer_email", customerEmail)
      if (!customerPhone.isNullOrEmpty()) putExtra("customer_phone", customerPhone)
    }

    if (!isActivityResolvable(activity, intent)) {
      rejectPending("NOT_INSTALLED", "MONEI Pay is not installed")
      return
    }

    @Suppress("DEPRECATION")
    activity.startActivityForResult(intent, REQUEST_CODE_MONEI_PAY)
  }

  private fun launchDirect(
    activity: Activity,
    token: String,
    amount: Int,
    description: String?,
    customerName: String?,
    customerEmail: String?,
    customerPhone: String?
  ) {
    // Decode JWT for merchant metadata
    val claims = decodeJwt(token)
    if (claims == null) {
      rejectPending("INVALID_TOKEN", "Could not decode JWT")
      return
    }

    val accountId = claims.optString("account_id", "")
    if (accountId.isEmpty()) {
      rejectPending("INVALID_TOKEN", "Missing account_id claim")
      return
    }

    // Check expiry — reject tokens with missing or expired exp claim
    val exp = claims.optLong("exp", 0)
    if (exp == 0L) {
      rejectPending("INVALID_TOKEN", "Token missing exp claim")
      return
    }
    if (exp < (System.currentTimeMillis() / 1000) + 300) {
      rejectPending("INVALID_TOKEN", "Token expired")
      return
    }

    val companyName = claims.optString("company_name", "MONEI Pay")
    val mcc = claims.optString("mcc", "5999")
    val orderId = UUID.randomUUID().toString().replace("-", "").take(12).uppercase()
    val locale = Locale.getDefault().let {
      val lang = it.language
      val country = it.country
      if (country.isNotEmpty()) "${lang}_${country}" else "en_US"
    }
    val bearerToken = if (token.startsWith("Bearer ")) token else "Bearer $token"

    val customData = JSONObject().apply {
      put("accountId", accountId)
      put("orderId", orderId)
      put("lang", locale.split("_").firstOrNull()?.lowercase() ?: "en")
      put("deviceType", "mobile")
      put("deviceModel", Build.MODEL)
      put("os", "Android")
      put("osVersion", Build.VERSION.RELEASE)
      put("source", "monei-pay-sdk")
      put("sourceVersion", SDK_VERSION)
      if (!description.isNullOrEmpty()) put("description", description)
      if (!customerName.isNullOrEmpty()) put("customerName", customerName)
      if (!customerEmail.isNullOrEmpty()) put("customerEmail", customerEmail)
      if (!customerPhone.isNullOrEmpty()) put("customerPhone", customerPhone)
    }

    val payload = JSONObject().apply {
      put("authToken", bearerToken)
      put("amountAuthorizedNumeric", amount.toString().padStart(12, '0'))
      put("orderId", orderId)
      put("merchantCustomData", customData)
      put("transactionCurrencyCode", "0978")
      put("transactionType", "00")
      put("merchantCountryCode", "724")
      put("merchantCurrencyCode", "978")
      put("merchantCategoryCode", mcc)
      put("merchantDisplayName", companyName)
      put("isFlowAuto", "true")
      put("colorPrimary", "#171717")
      put("fullAccess", "false")
      put("locale", locale)
    }

    val payloadBase64 = Base64.getEncoder().encodeToString(
      payload.toString().toByteArray(Charsets.UTF_8)
    )

    val intent = Intent(Intent.ACTION_VIEW).apply {
      data = Uri.parse("cloud_payment://cloudcommerce/json:$payloadBase64")
      setPackage(CLOUD_COMMERCE_PACKAGE)
    }

    if (!isActivityResolvable(activity, intent)) {
      rejectPending("NOT_INSTALLED", "CloudCommerce app is not installed")
      return
    }

    @Suppress("DEPRECATION")
    activity.startActivityForResult(intent, REQUEST_CODE_DIRECT)
  }

  private fun handleMoneiPayResult(resultCode: Int, data: Intent?) {
    val promise = pendingPromise ?: return
    pendingPromise = null

    if (data == null) {
      promise.reject("CANCELLED", "Payment was cancelled", null)
      return
    }

    val errorCode = data.getStringExtra("error_code")
    if (!errorCode.isNullOrEmpty()) {
      val errorMessage = data.getStringExtra("error_message") ?: errorCode
      val code = when (errorCode) {
        "USER_DENIED", "CANCELLED", "USER_CANCELLED" -> "CANCELLED"
        "TOKEN_EXPIRED", "NOT_AUTHENTICATED", "INVALID_TOKEN" -> "INVALID_TOKEN"
        else -> "PAYMENT_FAILED"
      }
      promise.reject(code, errorMessage, null)
      return
    }

    if (resultCode != Activity.RESULT_OK) {
      promise.reject("CANCELLED", "Payment was cancelled", null)
      return
    }

    val result = mapOf(
      "transactionId" to (data.getStringExtra("transaction_id") ?: ""),
      "success" to data.getBooleanExtra("success", false),
      "amount" to data.getIntExtra("amount", 0),
      "cardBrand" to (data.getStringExtra("card_brand") ?: ""),
      "maskedCardNumber" to (data.getStringExtra("masked_card_number") ?: "")
    )
    promise.resolve(result)
  }

  private fun handleDirectResult(data: Intent?) {
    val promise = pendingPromise ?: return
    pendingPromise = null

    val response = data?.getStringExtra("response")
    if (response.isNullOrEmpty()) {
      promise.reject("PAYMENT_FAILED", "No response from CloudCommerce", null)
      return
    }

    try {
      val decoded = String(Base64.getDecoder().decode(response), Charsets.UTF_8)
      val parsed = try {
        JSONObject(decoded)
      } catch (_: Exception) {
        val arr = JSONArray(decoded)
        if (arr.length() > 0) {
          val errorObj = arr.getJSONObject(0)
          val reasonCode = errorObj.optString("ReasonCode", "UNKNOWN")
          val errorDesc = errorObj.optString("Description", "Payment failed")
          promise.reject("PAYMENT_FAILED", "$reasonCode: $errorDesc", null)
          return
        }
        promise.reject("PAYMENT_FAILED", "Empty error response", null)
        return
      }

      val error = parsed.optJSONObject("error")
      val success = parsed.optBoolean("success", false)
      val transactionId = parsed.optString("transactionId", "")

      if (!success && transactionId.isEmpty() && error != null) {
        val reasonCode = error.optString("ReasonCode", "UNKNOWN")
        val errorDesc = error.optString("Description", "Payment failed")
        promise.reject("PAYMENT_FAILED", "$reasonCode: $errorDesc", null)
        return
      }

      if (transactionId.isEmpty()) {
        promise.reject("PAYMENT_FAILED", "No transaction ID in response", null)
        return
      }

      val result = mapOf(
        "transactionId" to transactionId,
        "success" to success,
        "amount" to pendingAmount,
        "cardBrand" to parsed.optString("cardBrandName", ""),
        "maskedCardNumber" to parsed.optString("maskedCardNumber", "")
      )
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("PAYMENT_FAILED", "Failed to parse response: ${e.message}", null)
    }
  }

  private fun decodeJwt(token: String): JSONObject? {
    val jwt = token.removePrefix("Bearer ")
    val parts = jwt.split(".")
    if (parts.size < 3) return null
    return try {
      val decoded = Base64.getUrlDecoder().decode(parts[1])
      JSONObject(String(decoded, Charsets.UTF_8))
    } catch (_: Exception) {
      null
    }
  }

  private fun isActivityResolvable(activity: Activity, intent: Intent): Boolean {
    return if (Build.VERSION.SDK_INT >= 33) {
      activity.packageManager.resolveActivity(
        intent,
        PackageManager.ResolveInfoFlags.of(0)
      ) != null
    } else {
      @Suppress("DEPRECATION")
      activity.packageManager.resolveActivity(intent, 0) != null
    }
  }

  private fun rejectPending(code: String, message: String) {
    pendingPromise?.reject(code, message, null)
    pendingPromise = null
  }
}
