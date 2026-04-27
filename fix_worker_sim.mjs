
import fs from "fs";
let content = fs.readFileSync("C:\\Users\\JSH\\Downloads\\LeadMasterApp\\app\\src\\main\\java\\com\\leadmaster\\app\\CommunicationSyncWorker.kt", "utf8");

const newHelper = `
    private fun getLineInfoFromSim(context: Context, accountId: String? = null, subId: Int = -1): String {
        try {
            if (androidx.core.app.ActivityCompat.checkSelfPermission(context, android.Manifest.permission.READ_PHONE_STATE) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                return "기본"
            }
            val subManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as android.telephony.SubscriptionManager
            val subList = subManager.activeSubscriptionInfoList
            
            if (subList != null && subList.size > 1) {
                // Determine primary and secondary by sorting.
                // Usually the physical SIM has a lower subscriptionId or slot index.
                val sortedSubs = subList.sortedWith(compareBy({ it.simSlotIndex }, { it.subscriptionId }))
                val primarySub = sortedSubs[0]
                val secondarySub = sortedSubs[1]
                
                android.util.Log.d(TAG, "SIM Check -> AccountId: $accountId, SubId: $subId")
                android.util.Log.d(TAG, "SIM Primary: \${primarySub.subscriptionId} (slot \${primarySub.simSlotIndex})")
                android.util.Log.d(TAG, "SIM Secondary: \${secondarySub.subscriptionId} (slot \${secondarySub.simSlotIndex})")

                if (subId != -1) {
                    if (subId == secondarySub.subscriptionId) return "투넘버"
                    if (subId == primarySub.subscriptionId) return "기본"
                } else if (!accountId.isNullOrEmpty()) {
                    // Check if accountId matches subscriptionId or iccId of secondary
                    if (secondarySub.subscriptionId.toString() == accountId || secondarySub.iccId == accountId) return "투넘버"
                    if (primarySub.subscriptionId.toString() == accountId || primarySub.iccId == accountId) return "기본"
                    
                    // Fallback for some Samsung devices where PHONE_ACCOUNT_ID ends with the subId or slot
                    if (accountId.contains(secondarySub.subscriptionId.toString())) return "투넘버"
                }
            } else {
                 android.util.Log.d(TAG, "Only 1 or 0 SIMs detected: \${subList?.size}")
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

