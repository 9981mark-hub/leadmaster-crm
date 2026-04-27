
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

// Call JSON
content = content.replace(
  /put\("timestamp", isoFormat\.format\(java\.util\.Date\(date\)\)\)/,
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

// SMS JSON
content = content.replace(
  /put\("timestamp", isoFormat\.format\(java\.util\.Date\(date\)\)\)/g,
  "put(\"timestamp\", isoFormat.format(java.util.Date(date)))\n                                put(\"line_info\", lineInfo)"
);
// Fix indentation slightly for the first replacement which was Call JSON:
content = content.replace(
  "put(\"timestamp\", isoFormat.format(java.util.Date(date)))\n                                put(\"line_info\", lineInfo)\n                        }\n                        \n                        chunkForApi.put(apiObj)\n                        if (date > maxDateInChunk) maxDateInChunk = date",
  "put(\"timestamp\", isoFormat.format(java.util.Date(date)))\n                            put(\"line_info\", lineInfo)\n                        }\n                        \n                        chunkForApi.put(apiObj)\n                        if (date > maxDateInChunk) maxDateInChunk = date"
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

// MMS JSON
content = content.replace(
  /put\("timestamp", isoFormat\.format\(java\.util\.Date\(dateMs\)\)\)/,
  "put(\"timestamp\", isoFormat.format(java.util.Date(dateMs)))\n                                put(\"line_info\", lineInfo)"
);

const helper = `
    private fun getLineInfoFromSim(context: Context, accountId: String? = null, subId: Int = -1): String {
        try {
            android.util.Log.d(TAG, "SIM Check -> AccountId: $accountId, SubId: $subId")
            
            // Heuristic for SubId
            if (subId > 1) return "\\uD22C\\uB118\\uBC84"
            
            // Heuristic for AccountId
            if (accountId != null) {
                val acc = accountId.lowercase()
                if (acc == "2" || acc.contains("sim2") || acc.contains("sub2") || acc == "1") {
                    if (acc != "1") return "\\uD22C\\uB118\\uBC84"
                } else if (acc.length > 5) {
                    // It might be an ICCID. We rely on SubscriptionManager.
                }
            }
            
            if (androidx.core.app.ActivityCompat.checkSelfPermission(context, android.Manifest.permission.READ_PHONE_STATE) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                val subManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as android.telephony.SubscriptionManager
                val subList = subManager.activeSubscriptionInfoList
                
                if (subList != null && subList.size > 1) {
                    val sortedSubs = subList.sortedWith(compareBy({ it.simSlotIndex }, { it.subscriptionId }))
                    val secondarySub = sortedSubs[1]
                    
                    if (subId != -1 && subId == secondarySub.subscriptionId) return "\\uD22C\\uB118\\uBC84"
                    if (!accountId.isNullOrEmpty() && (secondarySub.subscriptionId.toString() == accountId || secondarySub.iccId == accountId)) return "\\uD22C\\uB118\\uBC84"
                }
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error getting SIM info", e)
        }
        return "\\uAE30\\uBCF8"
    }
}
`;

content = content.replace(/}\s*$/, helper);

fs.writeFileSync("C:\\Users\\JSH\\Downloads\\LeadMasterApp\\app\\src\\main\\java\\com\\leadmaster\\app\\CommunicationSyncWorker.kt", content, "utf8");
console.log("Done");

