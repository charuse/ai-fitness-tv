const crypto = require("crypto");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const DevicePairing = require("../models/DevicePairing");
const UserProfile = require("../models/UserProfile");
const { buildBaselineStep1Prompt } = require("../utils/bedrockPrompts");
const fullDatabase = require("../utils/free-exercise-db/dist/exercises.json");

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

const hashPassword = (password, salt) => {
  return crypto.scryptSync(password, salt, 64).toString("hex");
};

exports.generateCode = async () => {
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  await DevicePairing.create({ deviceCode: code, status: "pending" });
  return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ code }) };
};

exports.checkStatus = async (event) => {
  const code = event.queryStringParameters?.code;
  const record = await DevicePairing.get(code);
  return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(record || { status: "not_found" }) };
};

exports.mobileLogin = async (event) => {
  try {
    const { code, userId, password } = JSON.parse(event.body || "{}");
    if (!userId || !password) {
      return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Username and password required." }) };
    }

    const profile = await UserProfile.get(userId);
    if (!profile || !profile.passwordHash || !profile.passwordSalt) {
      return { statusCode: 401, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Invalid username or password." }) };
    }

    const verifyHash = hashPassword(password, profile.passwordSalt);
    const isMatch = crypto.timingSafeEqual(Buffer.from(profile.passwordHash, "hex"), Buffer.from(verifyHash, "hex"));

    if (!isMatch) {
      return { statusCode: 401, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Invalid username or password." }) };
    }

    await DevicePairing.update({ deviceCode: code }, { status: "linked", userId });
    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: err.message }) };
  }
};

exports.mobileSignupStep1 = async (event) => {
  try {
    const { userId, password, goals, customGoal, height, weight, experience } = JSON.parse(event.body || "{}");
    if (!userId || !password) {
      return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Username and password are required." }) };
    }

    const existing = await UserProfile.get(userId);
    if (existing && existing.passwordHash) {
      return { statusCode: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "Username already exists. Please Log In instead." }) };
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);

    const tokenEfficientDb = fullDatabase.slice(0, 50).map(ex => ({ id: ex.id, name: ex.name }));
    const prompt = buildBaselineStep1Prompt(goals || ["general_fitness"], customGoal || "", height || "", weight || "", experience || "Beginner", tokenEfficientDb);

    const payload = { anthropic_version: "bedrock-2023-05-31", max_tokens: 800, system: prompt, messages: [{ role: "user", content: "Generate JSON." }], temperature: 0.2 };
    const command = new InvokeModelCommand({ modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0", contentType: "application/json", accept: "application/json", body: JSON.stringify(payload) });
    const response = await bedrockClient.send(command);
    const routineJson = JSON.parse(JSON.parse(new TextDecoder().decode(response.body)).content[0].text.replace(/```json|```/g, "").trim());

    const profileData = {
      userId,
      passwordHash,
      passwordSalt: salt,
      goals: goals || ["general_fitness"],
      customGoal: customGoal || "",
      height: height || "",
      weight: weight || "",
      experience: experience || "Beginner",
      cachedRoutineStr: "[]",
      pendingRoutineStr: JSON.stringify(routineJson.routine),
      step2DataStr: "{}"
    };

    if (!existing) {
      await UserProfile.create(profileData);
    } else {
      Object.assign(existing, profileData);
      await existing.save();
    }

    const referenceEx = routineJson.routine.find(ex => ex.is_reference) || routineJson.routine[0];
    const match = fullDatabase.find(ex => ex.id === referenceEx.exercise_id) || fullDatabase[0];

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        experience: profileData.experience,
        referenceExercise: {
          exercise_id: match.id,
          name: match.name,
          image_url: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${match.images[0]}`,
          test_weight: referenceEx.test_weight || "15 lbs",
          test_reps: referenceEx.test_reps || 10
        }
      })
    };
  } catch (err) {
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: err.message }) };
  }
};

exports.mobileSignupStep2 = async (event) => {
  try {
    const { code, userId, referenceExerciseId, referenceWeight, testWeight, testReps, actualReps } = JSON.parse(event.body || "{}");
    const profile = await UserProfile.get(userId);
    if (!profile) {
      return { statusCode: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: "User not found." }) };
    }

    profile.step2DataStr = JSON.stringify({ referenceExerciseId, referenceWeight, testWeight, testReps, actualReps });
    await profile.save();

    await DevicePairing.update({ deviceCode: code }, { status: "linked", userId });

    return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: err.message }) };
  }
};

exports.updateSettings = async (event) => {
  const data = JSON.parse(event.body);
  let profile = await UserProfile.get(data.userId);
  if (profile) { profile.autoSwap = data.autoSwap; await profile.save(); }
  return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ success: true }) };
};

exports.mobileSetupPage = async (event) => {
  const code = event.queryStringParameters?.code || "";
  const mode = event.queryStringParameters?.mode || "signup";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>AI Fitness TV</title>
      <style>
        body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; text-align: center; margin: 0; }
        .box { background: #1e293b; padding: 24px; border-radius: 14px; max-width: 420px; margin: 15px auto; border: 2px solid #334155; }
        input, select { padding: 14px; margin: 8px 0; width: 90%; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: white; font-size: 16px; box-sizing: border-box; }
        button { background: #3b82f6; color: white; padding: 15px; border: none; border-radius: 8px; font-size: 18px; width: 90%; font-weight: bold; cursor: pointer; margin-top: 14px; }
        .goal-btn { background: #334155; margin-top: 8px; font-size: 15px; padding: 12px; }
        .goal-btn.active { background: #166534; border: 2px solid #22c55e; }
        img { width: 100%; max-width: 280px; border-radius: 10px; margin: 12px 0; }
        .hidden { display: none; }
        #status { margin-top: 15px; font-weight: bold; color: #fbbf24; }
      </style>
    </head>
    <body>
      <h2>AI Fitness TV</h2>
      <p>TV Code: <b style="color: #3b82f6; font-size: 22px;">${code}</b></p>

      <!-- LOGIN VIEW -->
      <div id="loginView" class="box ${mode === 'login' ? '' : 'hidden'}">
        <h3>Log In</h3>
        <input type="text" id="loginUser" placeholder="Username" />
        <input type="password" id="loginPass" placeholder="Password" />
        <button onclick="submitLogin()">Log In & Link TV</button>
      </div>

      <!-- SIGNUP STEP 1: ACCOUNT & GOALS -->
      <div id="signupStep1" class="box ${mode === 'signup' ? '' : 'hidden'}">
        <h3>Create Account & Goals</h3>
        <input type="text" id="regUser" placeholder="Choose Username" />
        <input type="password" id="regPass" placeholder="Choose Password" />

        <p style="margin: 12px 0 4px;">Select Fitness Goals:</p>
        <button type="button" class="goal-btn" onclick="toggleGoal(this, 'hypertrophy')">Build Muscle</button>
        <button type="button" class="goal-btn" onclick="toggleGoal(this, 'stamina')">Increase Stamina</button>
        <button type="button" class="goal-btn" onclick="toggleGoal(this, 'weight_loss')">Lose Weight</button>

        <input type="text" id="customGoal" placeholder="Specific goals? (e.g. Rehab Knee)" style="margin-top:14px;" />
        <input type="text" id="height" placeholder="Height (e.g. 5'10)" />
        <input type="text" id="weight" placeholder="Weight (e.g. 180 lbs)" />

        <p style="margin: 12px 0 4px;">Experience Level:</p>
        <select id="experience">
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Experienced">Experienced</option>
        </select>

        <button onclick="submitSignupStep1()">Next: Strength Calibration</button>
      </div>

      <!-- SIGNUP STEP 2: CALIBRATION EXERCISE -->
      <div id="signupStep2" class="box hidden">
        <h3 id="step2Title">Strength Calibration</h3>
        <p id="step2Desc"></p>
        <img id="refImg" src="" />
        <h4 id="refName"></h4>
        <input type="text" id="step2Input" placeholder="" />
        <button onclick="submitSignupStep2()">Complete Setup & Start on TV</button>
      </div>

      <p id="status"></p>

      <script>
        const basePath = window.location.origin + window.location.pathname.replace('/mobile/setup', '');
        let selectedGoals = [];
        let refExercise = null;
        let userExp = 'Beginner';

        function toggleGoal(btn, goal) {
          if (selectedGoals.includes(goal)) {
            selectedGoals = selectedGoals.filter(g => g !== goal);
            btn.classList.remove('active');
          } else {
            selectedGoals.push(goal);
            btn.classList.add('active');
          }
        }

        async function submitLogin() {
          const userId = document.getElementById('loginUser').value.trim();
          const password = document.getElementById('loginPass').value;
          const status = document.getElementById('status');
          if (!userId || !password) return alert('Enter username and password');
          status.innerText = 'Verifying credentials...';

          const res = await fetch(basePath + '/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: '${code}', userId, password })
          });
          const data = await res.json();
          if (res.ok) {
            document.getElementById('loginView').classList.add('hidden');
            status.style.color = '#22c55e';
            status.innerText = 'Logged in! Look at your TV.';
          } else {
            status.style.color = '#ef4444';
            status.innerText = data.error || 'Login failed.';
          }
        }

        async function submitSignupStep1() {
          const userId = document.getElementById('regUser').value.trim();
          const password = document.getElementById('regPass').value;
          const customGoal = document.getElementById('customGoal').value;
          const height = document.getElementById('height').value;
          const weight = document.getElementById('weight').value;
          userExp = document.getElementById('experience').value;
          const status = document.getElementById('status');

          if (!userId || !password || !height || !weight || selectedGoals.length === 0) {
            return alert('Please fill out username, password, height, weight, and at least one goal.');
          }

          status.style.color = '#fbbf24';
          status.innerText = 'Selecting your calibration exercise...';

          const res = await fetch(basePath + '/auth/signup-step1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, password, goals: selectedGoals, customGoal, height, weight, experience: userExp })
          });
          const data = await res.json();
          if (!res.ok) {
            status.style.color = '#ef4444';
            status.innerText = data.error || 'Signup failed.';
            return;
          }

          status.innerText = '';
          refExercise = data.referenceExercise;
          document.getElementById('signupStep1').classList.add('hidden');
          document.getElementById('signupStep2').classList.remove('hidden');

          document.getElementById('refImg').src = refExercise.image_url;
          document.getElementById('refName').innerText = refExercise.name;

          const input = document.getElementById('step2Input');
          if (userExp === 'Experienced') {
            document.getElementById('step2Title').innerText = 'Enter Starting Weight';
            document.getElementById('step2Desc').innerText = 'What is a good starting weight for this exercise?';
            input.placeholder = 'e.g., 40 lbs';
          } else {
            document.getElementById('step2Title').innerText = 'Strength Test';
            document.getElementById('step2Desc').innerText = 'Try doing ' + refExercise.test_reps + ' reps at ' + refExercise.test_weight + '. How many reps did you actually complete?';
            input.placeholder = 'e.g., 6';
          }
        }

        async function submitSignupStep2() {
          const val = document.getElementById('step2Input').value.trim();
          const userId = document.getElementById('regUser').value.trim();
          const status = document.getElementById('status');
          if (!val) return alert('Please enter a value to continue.');

          status.style.color = '#fbbf24';
          status.innerText = 'Linking to TV...';

          const payload = {
            code: '${code}',
            userId,
            referenceExerciseId: refExercise.exercise_id,
            referenceWeight: userExp === 'Experienced' ? val : '',
            testWeight: refExercise.test_weight,
            testReps: refExercise.test_reps,
            actualReps: userExp === 'Experienced' ? '' : val
          };

          const res = await fetch(basePath + '/auth/signup-step2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            document.getElementById('signupStep2').classList.add('hidden');
            status.style.color = '#22c55e';
            status.innerText = 'Setup Complete! Look at your TV, the AI is deciding your workout.';
          } else {
            status.style.color = '#ef4444';
            status.innerText = 'Failed to complete setup.';
          }
        }
      </script>
    </body>
    </html>
  `;
  return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: html };
};