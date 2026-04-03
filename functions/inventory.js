/* eslint-disable */
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const db = admin.firestore();

// ─── ENTERPRISE INVENTORY MANAGEMENT SYSTEM (E-IMS) ─────────────────────────

exports.onInventoryRestocked = functions.firestore
  .document("inventory/{skuId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // If stock increased heavily
    if (after.quantityInStock > before.quantityInStock) {
      console.log(`Stock Replenished for ${after.sku}: +${after.quantityInStock - before.quantityInStock}`);
      
      await db.collection("logistics_events").add({
        sku: after.sku,
        event: "RESTOCK",
        quantityAdded: after.quantityInStock - before.quantityInStock,
        totalValue: (after.quantityInStock - before.quantityInStock) * after.costPerUnit,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Low stock Alert
    if (after.quantityInStock <= after.reorderThreshold && before.quantityInStock > after.reorderThreshold) {
      const payload = {
        notification: {
          title: `URGENT: Low Stock Alert [${after.category}]`,
          body: `${after.name} has fallen below the safety threshold. Only ${after.quantityInStock} units remaining.`
        }
      };

      const supervisors = await db.collection("users").where("role", "==", "manager").get();
      const tokens = [];
      supervisors.forEach(s => { if (s.data().fcmToken) tokens.push(s.data().fcmToken) });
      
      if (tokens.length > 0) {
        await admin.messaging().sendEachForMulticast({ tokens, notification: payload.notification });
        console.log("Low stock push alerts fired perfectly.");
      }
    }
  });

// ─── FORECASTING ENGINE ───────────────────────────────────────────────────

exports.forecastMaterialShortages = functions.pubsub.schedule("0 6 * * *")
  .timeZone("Asia/Kuala_Lumpur")
  .onRun(async () => {
    console.log("Triggering Daily Materials Forecast...");

    const tasksSnap = await db.collection("tasks").where("status", "in", ["todo", "inprogress"]).get();
    let predictedMaterialLoad = {
      Concrete: 0,
      Steel: 0,
      Wood: 0
    };

    tasksSnap.forEach(t => {
      const title = t.data().title.toLowerCase();
      if (title.includes("concrete") || title.includes("pour")) predictedMaterialLoad.Concrete += 500;
      if (title.includes("rebar") || title.includes("steel")) predictedMaterialLoad.Steel += 200;
      if (title.includes("framing")) predictedMaterialLoad.Wood += 150;
    });

    const inventory = await db.collection("inventory").get();
    const batch = db.batch();

    inventory.forEach(doc => {
      const item = doc.data();
      const load = predictedMaterialLoad[item.category] || 0;
      
      if (load > 0 && (item.quantityInStock - load) < item.reorderThreshold) {
        console.warn(`Forecasted Shortage for ${item.name} if ${load} units are consumed dynamically.`);
        const reqRef = db.collection("purchase_requests").doc();
        batch.set(reqRef, {
          skuRef: doc.id,
          itemName: item.name,
          urgency: "HIGH",
          reason: "Predictive Forecast Triggered",
          requestedQuantity: load * 2, 
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    await batch.commit();
  });
