const dynamoose = require("dynamoose");

const devicePairingSchema = new dynamoose.Schema({
  deviceCode: { type: String, hashKey: true },
  status: { type: String, default: "pending" },
  userId: { type: String }
}, { timestamps: true });

module.exports = dynamoose.model(
  process.env.DEVICE_TABLE || "ai-fitness-tv-backend-device-dev",
  devicePairingSchema,
  { create: false, waitForActive: false }
);