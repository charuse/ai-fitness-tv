export const API_BASE_URL = "https://s2eew8832l.execute-api.us-east-1.amazonaws.com";

export const fetchNextWorkout = async (userId) => (await fetch(`${API_BASE_URL}/workout/next?userId=${userId}`)).json();
export const submitLedger = async (payload) => (await fetch(`${API_BASE_URL}/workout/ledger`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })).json();
export const getDeviceCode = async () => (await fetch(`${API_BASE_URL}/auth/code`)).json();
export const checkDeviceStatus = async (code) => (await fetch(`${API_BASE_URL}/auth/status?code=${code}`)).json();

export const updateUserGoals = async (userId, goals, customGoal, height, weight, experience) => (await fetch(`${API_BASE_URL}/user/goals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, goals, customGoal, height, weight, experience }) })).json();
export const updateUserSettings = async (userId, autoSwap) => (await fetch(`${API_BASE_URL}/user/settings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, autoSwap }) })).json();
export const getUserStats = async (userId) => (await fetch(`${API_BASE_URL}/user/stats?userId=${userId}`)).json();

export const fetchBaselineStep1 = async (userId) => (await fetch(`${API_BASE_URL}/workout/baseline/step1?userId=${userId}`)).json();
export const fetchBaselineStep2 = async (userId, referenceExerciseId, referenceWeight, testWeight, testReps, actualReps) => (await fetch(`${API_BASE_URL}/workout/baseline/step2`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, referenceExerciseId, referenceWeight, testWeight, testReps, actualReps }) })).json();