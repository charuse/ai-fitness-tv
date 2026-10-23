const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const UserProfile = require("../models/UserProfile");
const WorkoutLedger = require("../models/WorkoutLedger");
const { buildBaselineStep1Prompt, buildBaselineStep2Prompt, buildProgressionPrompt } = require("../utils/bedrockPrompts");
const fullDatabase = require("../utils/free-exercise-db/dist/exercises.json");
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

exports.handler = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId;
    if (!userId) throw new Error("Missing userId");
    let profile = await UserProfile.get(userId);
    if (!profile) return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };

    let cachedRoutine = JSON.parse(profile.cachedRoutineStr || "[]");

    if (!cachedRoutine || cachedRoutine.length === 0) {
      const pendingRoutine = JSON.parse(profile.pendingRoutineStr || "[]");
      const step2Data = JSON.parse(profile.step2DataStr || "{}");

      if (!pendingRoutine || pendingRoutine.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ error: "Onboarding incomplete" }) };
      }

      const prompt = buildBaselineStep2Prompt(
        pendingRoutine,
        profile.goals,
        profile.customGoal,
        profile.experience,
        step2Data.referenceExerciseId,
        step2Data.referenceWeight,
        step2Data.testWeight,
        step2Data.testReps,
        step2Data.actualReps
      );

      const payload = { anthropic_version: "bedrock-2023-05-31", max_tokens: 800, system: prompt, messages: [{ role: "user", content: "Generate JSON." }], temperature: 0.1 };
      const command = new InvokeModelCommand({ modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0", contentType: "application/json", accept: "application/json", body: JSON.stringify(payload) });
      const response = await bedrockClient.send(command);
      const routineJson = JSON.parse(JSON.parse(new TextDecoder().decode(response.body)).content[0].text.replace(/```json|```/g, "").trim());

      const finalRoutineToSave = routineJson.routine.map(item => {
        const match = fullDatabase.find(ex => ex.id === item.exercise_id) || fullDatabase[0];
        return { ...item, name: match.name, image_url: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${match.images[0]}` };
      });

      profile.cachedRoutineStr = JSON.stringify(finalRoutineToSave);
      profile.pendingRoutineStr = "[]";
      await profile.save();

      return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ routine: finalRoutineToSave, autoSwap: profile.autoSwap }) };
    }

    const recentLedgers = await WorkoutLedger.query("userId").eq(userId).exec();
    const sortedLedgers = recentLedgers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const lastFeedback = sortedLedgers.length > 0 ? sortedLedgers[0].ratings : [];

    const abstractRoutine = cachedRoutine.map((ex, index) => {
      const fb = lastFeedback.find(f => f.exercise_id === ex.exercise_id);
      return { index, reps: ex.target_reps, weight: ex.suggested_weight, feedback: fb ? fb.rating : "Just Right" };
    });

    const prompt = buildProgressionPrompt(abstractRoutine);
    const payload = { anthropic_version: "bedrock-2023-05-31", max_tokens: 800, system: prompt, messages: [{ role: "user", content: "Generate JSON." }], temperature: 0.1 };
    const command = new InvokeModelCommand({ modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0", contentType: "application/json", accept: "application/json", body: JSON.stringify(payload) });
    const response = await bedrockClient.send(command);
    const routineJson = JSON.parse(JSON.parse(new TextDecoder().decode(response.body)).content[0].text.replace(/```json|```/g, "").trim());

    const finalRoutineToSave = cachedRoutine.map((ex, index) => {
      const update = (routineJson.routine || []).find(u => u.index === index);
      if (update) return { ...ex, target_reps: update.new_reps || ex.target_reps, suggested_weight: update.new_weight || ex.suggested_weight };
      return ex;
    });

    profile.cachedRoutineStr = JSON.stringify(finalRoutineToSave);
    await profile.save();

    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ routine: finalRoutineToSave, autoSwap: profile.autoSwap }) };
  } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: error.message }) }; }
};

exports.baselineStep1 = async (event) => {
  try {
    const userId = event.queryStringParameters?.userId;
    const profile = await UserProfile.get(userId);

    const tokenEfficientDb = fullDatabase.slice(0, 50).map(ex => ({ id: ex.id, name: ex.name }));
    const prompt = buildBaselineStep1Prompt(profile.goals, profile.customGoal, profile.height, profile.weight, profile.experience, tokenEfficientDb);

    const payload = { anthropic_version: "bedrock-2023-05-31", max_tokens: 800, system: prompt, messages: [{ role: "user", content: "Generate JSON." }], temperature: 0.2 };
    const command = new InvokeModelCommand({ modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0", contentType: "application/json", accept: "application/json", body: JSON.stringify(payload) });
    const response = await bedrockClient.send(command);
    const routineJson = JSON.parse(JSON.parse(new TextDecoder().decode(response.body)).content[0].text.replace(/```json|```/g, "").trim());

    profile.pendingRoutineStr = JSON.stringify(routineJson.routine);
    await profile.save();

    let referenceEx = routineJson.routine.find(ex => ex.is_reference) || routineJson.routine[0];
    const match = fullDatabase.find(ex => ex.id === referenceEx.exercise_id) || fullDatabase[0];

    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ experience: profile.experience, referenceExercise: { exercise_id: match.id, name: match.name, image_url: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${match.images[0]}`, test_weight: referenceEx.test_weight, test_reps: referenceEx.test_reps } }) };
  } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: error.message }) }; }
};

exports.baselineStep2 = async (event) => {
  try {
    const { userId, referenceExerciseId, referenceWeight, testWeight, testReps, actualReps } = JSON.parse(event.body);
    const profile = await UserProfile.get(userId);

    const pendingRoutine = JSON.parse(profile.pendingRoutineStr || "[]");
    const prompt = buildBaselineStep2Prompt(pendingRoutine, profile.goals, profile.customGoal, profile.experience, referenceExerciseId, referenceWeight, testWeight, testReps, actualReps);

    const payload = { anthropic_version: "bedrock-2023-05-31", max_tokens: 800, system: prompt, messages: [{ role: "user", content: "Generate JSON." }], temperature: 0.1 };
    const command = new InvokeModelCommand({ modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0", contentType: "application/json", accept: "application/json", body: JSON.stringify(payload) });
    const response = await bedrockClient.send(command);
    const routineJson = JSON.parse(JSON.parse(new TextDecoder().decode(response.body)).content[0].text.replace(/```json|```/g, "").trim());

    const finalRoutineToSave = routineJson.routine.map(item => {
      const match = fullDatabase.find(ex => ex.id === item.exercise_id) || fullDatabase[0];
      return { ...item, name: match.name, image_url: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${match.images[0]}` };
    });

    profile.cachedRoutineStr = JSON.stringify(finalRoutineToSave);
    profile.pendingRoutineStr = "[]"; 
    await profile.save();

    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ routine: finalRoutineToSave, autoSwap: profile.autoSwap }) };
  } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: error.message }) }; }
};