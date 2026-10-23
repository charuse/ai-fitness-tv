const WorkoutLedger = require("../models/WorkoutLedger");
exports.handler = async (event) => {
  try {
    const data = JSON.parse(event.body || "{}");
    const record = new WorkoutLedger({
      workoutId: data.workoutId || Date.now().toString(),
      userId: data.userId || "demo-user",
      ratings: data.ratings || [],
      routineSnapshotStr: JSON.stringify(data.routineSnapshot || [])
    });
    await record.save();
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ message: "Saved" }) };
  } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: error.message }) }; }
};