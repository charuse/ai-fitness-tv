const WorkoutLedger = require("../models/WorkoutLedger");
exports.getStats = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId;
    const ledgers = await WorkoutLedger.query("userId").eq(userId).exec();
    const sorted = ledgers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const history = sorted.map(l => ({
      date: new Date(l.createdAt).toLocaleString(),
      routine: JSON.parse(l.routineSnapshotStr || "[]")
    }));

    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ history }) };
  } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: error.message }) }; }
};