const dynamoose = require("dynamoose");

const workoutLedgerSchema = new dynamoose.Schema({
  workoutId: { type: String, hashKey: true },
  userId: { type: String, index: { name: "userIdGlobalIndex" } },
  ratings: { type: Array }, 
  routineSnapshotStr: { type: String, default: "[]" }
}, { timestamps: true });

module.exports = dynamoose.model(process.env.LEDGER_TABLE || "ai-fitness-tv-backend-workout-ledger-dev", workoutLedgerSchema, { create: false, waitForActive: false });