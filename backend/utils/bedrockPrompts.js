exports.buildBaselineStep1Prompt = (goals, customGoal, height, weight, experience, fullDatabase) => {
  return `You are a strict JSON workout sequence generator. Output RAW JSON ONLY. No markdown.
CONTEXT: Create a baseline workout. Goals: ${goals.join(", ")}. Context: "${customGoal}".
User Stats: Height ${height}, Weight ${weight}, Experience: ${experience}.

RULES:
1. Pick between 3 and 6 optimal exercises (4-5 is recommended)
2. ONE exercise MUST be a common foundational movement marked with "is_reference": true.
3. If the user is Beginner/Intermediate, you MUST include a safe "test_weight" string (e.g., "15 lbs", "Bodyweight") and "test_reps" integer (e.g., 10) for the reference exercise so we can test their strength.
4. target_sets MUST be realistic (2 to 5). target_reps should be a solid baseline. DO NOT include "suggested_weight" yet.
5. Always focus on home exercises or bodyweight exercises, ESPECIALLY for the reference exercise. The reference exercise should always be a home workout, and never require equipment or weights.

VALID EXERCISES:
${JSON.stringify(fullDatabase)}

OUTPUT SCHEMA:
{
  "routine": [ 
    { "exercise_id": "String", "target_sets": Integer, "target_reps": Integer, "is_reference": Boolean, "test_weight": "String", "test_reps": Integer } 
  ]
}`;
};

exports.buildBaselineStep2Prompt = (pendingRoutine, goals, customGoal, exp, refId, refWeight, testWeight, testReps, actualReps) => {
  let weightContext = (exp === "Experienced")
    ? `The user is Experienced and stated their starting weight for exercise '${refId}' is ${refWeight}. Scale all other exercises relative to this baseline.`
    : `The user was asked to do ${testReps} reps of '${refId}' at ${testWeight}. They actually managed to complete ${actualReps} reps. Scale the starting weights and reps for the entire routine accordingly to provide a good, challenging workout without being too hard.`;

  return `You are a strict JSON workout weight calculator. Output RAW JSON ONLY. No markdown.
CONTEXT: Determine starting weights. Goals: ${goals.join(", ")}. Context: "${customGoal}".
${weightContext}

ROUTINE WITHOUT WEIGHTS:
${JSON.stringify(pendingRoutine)}

RULES:
1. Output the exact same routine but add a "suggested_weight" string to each exercise.
2. "suggested_weight" MUST be a realistic starting weight string (e.g., "20 lbs", "Bodyweight").

OUTPUT SCHEMA:
{ "routine": [ { "exercise_id": "String", "target_sets": Integer, "target_reps": Integer, "suggested_weight": "String" } ] }`;
};

exports.buildProgressionPrompt = (abstractRoutine) => {
  return `You are a strict JSON progression calculator. Output RAW JSON ONLY. No markdown.
CONTEXT: Apply progressive overload based on feedback.

RULES:
1. "Too Easy": increase reps (max 15). If reps are high, reset lower and increase weight.
2. "Too Hard": decrease reps or weight.
3. "Just Right": provide a very slight increase to reps. If over 15 reps, provide a small weight increase and lower reps.
4. ONLY bodyweight exercises can have their reps increased above 15. Any numbered weight amount has a limit of 15 reps.
5. Do NOT change the index.

CURRENT STATE & FEEDBACK:
${JSON.stringify(abstractRoutine)}

OUTPUT SCHEMA:
{ "routine": [ { "index": Integer, "new_reps": Integer, "new_weight": "String" } ] }`;
};