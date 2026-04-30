import { listRagicH05FacilityCandidates } from "../server/integrations/ragic/facility-adapter";

const result = await listRagicH05FacilityCandidates();

console.log("Ragic H05 facility candidate check");
console.log(`source: ${result.meta.source}`);
console.log(`status: ${result.meta.status}`);
if (result.meta.errorCode) console.log(`errorCode: ${result.meta.errorCode}`);
if (result.meta.fallbackReason) console.log(`fallbackReason: ${result.meta.fallbackReason}`);

const items = result.data ?? [];
for (const item of items) {
  if (item.operationType !== "OT") {
    throw new Error(`${item.displayName} is not OT`);
  }
  if (item.statusLabel === "結束") {
    throw new Error(`${item.displayName} is ended but still included`);
  }
}

console.log(`candidateCount: ${items.length}`);
console.log(`candidates: ${items.map((item) => `${item.displayName}(${item.facilityKey})`).join(", ") || "(none)"}`);
