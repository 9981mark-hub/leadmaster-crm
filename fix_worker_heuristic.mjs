
import fs from "fs";
let content = fs.readFileSync("C:\\Users\\JSH\\Downloads\\LeadMasterApp\\app\\src\\main\\java\\com\\leadmaster\\app\\CommunicationSyncWorker.kt", "utf8");

const newHelper = `
    private fun getLineInfoFromSim(context: Context, accountId: String? = null, subId: Int = -1): String {
        try {
            android.util.Log.d(TAG, "SIM Check -> AccountId: $accountId, SubId: $subId")
            
            // Heuristic for SubId
            if (subId > 1) return "투넘버"
            
            // Heuristic for AccountId
            if (accountId != null) {
                val acc = accountId.toLowerCase()
                if (acc == "2" || acc.contains("sim2") || acc.contains("sub2") || acc == "1") {
                    if (acc != "1") return "투넘버"
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
                    
                    if (subId != -1 && subId == secondarySub.subscriptionId) return "투넘버"
                    if (!accountId.isNullOrEmpty() && (secondarySub.subscriptionId.toString() == accountId || secondarySub.iccId == accountId)) return "투넘버"
                }
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error getting SIM info", e)
        }
        return "기본"
    }
}
`;

content = content.replace(/private fun getLineInfoFromSim[\s\S]*?}\s*$/, newHelper.trim());

fs.writeFileSync("C:\\Users\\JSH\\Downloads\\LeadMasterApp\\app\\src\\main\\java\\com\\leadmaster\\app\\CommunicationSyncWorker.kt", content, "utf8");
console.log("Done");

