const dynamoose = require("dynamoose");

const userProfileSchema = new dynamoose.Schema({
  userId: { type: String, hashKey: true },
  passwordHash: { type: String, default: "" },
  passwordSalt: { type: String, default: "" },
  goals: { type: Array, schema: [String], default: [] },
  customGoal: { type: String, default: "" },
  height: { type: String, default: "" },
  weight: { type: String, default: "" },
  experience: { type: String, default: "Beginner" },
  autoSwap: { type: Boolean, default: true },
  cachedRoutineStr: { type: String, default: "[]" },
  pendingRoutineStr: { type: String, default: "[]" },
  step2DataStr: { type: String, default: "{}" },
  authCode: { type: String }
}, { timestamps: true });

module.exports = dynamoose.model(
  process.env.USER_TABLE || "ai-fitness-tv-backend-user-profile-dev",
  userProfileSchema,
  { create: false, waitForActive: false }
);