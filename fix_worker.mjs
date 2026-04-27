
import fs from "fs";
let content = fs.readFileSync("C:\\Users\\JSH\\Downloads\\LeadMasterApp\\app\\src\\main\\java\\com\\leadmaster\\app\\CommunicationSyncWorker.kt.bak", "utf8");

content = content.replace(
  "arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION)",
  "arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION, CallLog.Calls.PHONE_ACCOUNT_ID)"
);

content = content.replace(
  "val durationIndex = it.getColumnIndex(CallLog.Calls.DURATION)",
  "val durationIndex = it.getColumnIndex(CallLog.Calls.DURATION)\n                    val accountIdIndex = it.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)"
);

content = content.replace(
  "val duration = it.getInt(durationIndex)",
  "val duration = it.getInt(durationIndex)\n                        val accountId = if (accountIdIndex >= 0) it.getString(accountIdIndex) else null\n                        val lineInfo = getLineInfoFromSim(applicationContext, accountId = accountId)"
);

content = content.replace(
  "put(\"timestamp\", isoFormat.format(java.util.Date(date)))",
  "put(\"timestamp\", isoFormat.format(java.util.Date(date)))\n                            put(\"line_info\", lineInfo)"
);

content = content.replace(
  "android.provider.Telephony.Sms.BODY\n                    )",
  "android.provider.Telephony.Sms.BODY,\n                        android.provider.Telephony.Sms.SUBSCRIPTION_ID\n                    )"
);

content = content.replace(
  "val bodyIndex = it.getColumnIndex(android.provider.Telephony.Sms.BODY)",
  "val bodyIndex = it.getColumnIndex(android.provider.Telephony.Sms.BODY)\n                        val subIdIndex = it.getColumnIndex(android.provider.Telephony.Sms.SUBSCRIPTION_ID)"
);

content = content.replace(
  "val body = it.getString(bodyIndex) ?: \"\"",
  "val body = it.getString(bodyIndex) ?: \"\"\n                            val subId = if (subIdIndex >= 0) it.getInt(subIdIndex) else -1\n                            val lineInfo = getLineInfoFromSim(applicationContext, subId = subId)"
);

content = content.replace(
  "put(\"timestamp\", isoFormat.format(java.util.Date(date)))",
  "put(\"timestamp\", isoFormat.format(java.util.Date(date)))\n                                put(\"line_info\", lineInfo)"
);

content = content.replace(
  "arrayOf(\"_id\", \"date\", \"msg_box\", \"thread_id\")",
  "arrayOf(\"_id\", \"date\", \"msg_box\", \"thread_id\", \"sub_id\")"
);

content = content.replace(
  "val threadIdIndex = it.getColumnIndex(\"thread_id\")",
  "val threadIdIndex = it.getColumnIndex(\"thread_id\")\n                        val subIdIndex = it.getColumnIndex(\"sub_id\")"
);

content = content.replace(
  "val threadId = if (threadIdIndex >= 0) it.getString(threadIdIndex) ?: \"\" else \"\"",
  "val threadId = if (threadIdIndex >= 0) it.getString(threadIdIndex) ?: \"\" else \"\"\n                            val subId = if (subIdIndex >= 0) it.getInt(subIdIndex) else -1\n                            val lineInfo = getLineInfoFromSim(applicationContext, subId = subId)"
);

content = content.replace(
  "put(\"timestamp\", isoFormat.format(java.util.Date(dateMs)))",
  "put(\"timestamp\", isoFormat.format(java.util.Date(dateMs)))\n                                put(\"line_info\", lineInfo)"
);

const helper = `
    private fun getLineInfoFromSim(context: Context, accountId: String? = null, subId: Int = -1): String {
        try {
            if (androidx.core.app.ActivityCompat.checkSelfPermission(context, android.Manifest.permission.READ_PHONE_STATE) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                return "기본"
            }
            val subManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as android.telephony.SubscriptionManager
            if (subId != -1) {
                val subInfo = subManager.getActiveSubscriptionInfo(subId)
                if (subInfo != null && subInfo.simSlotIndex > 0) return "투넘버"
            } else if (!accountId.isNullOrEmpty()) {
                val subList = subManager.activeSubscriptionInfoList
                if (subList != null) {
                    for (subInfo in subList) {
                        if (subInfo.subscriptionId.toString() == accountId || subInfo.iccId == accountId) {
                            if (subInfo.simSlotIndex > 0) return "투넘버"
                            break
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting SIM info", e)
        }
        return "기본"
    }
}
`;

content = content.replace(/}\s*$/, helper);

fs.writeFileSync("C:\\Users\\JSH\\Downloads\\LeadMasterApp\\app\\src\\main\\java\\com\\leadmaster\\app\\CommunicationSyncWorker.kt", content, "utf8");
console.log("Done");

