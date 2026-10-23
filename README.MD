# AI Fitness TV

**AI Fitness TV** is an intelligent, progressive-overload workout application built for **Amazon Fire TV (Vega OS)** and powered by a serverless **AWS** backend using **Amazon Bedrock (Claude Haiku 4.5)**. 

AI Fitness TV acts as a personal strength coach: it onboards users via their smartphone, calibrates their starting weights through a foundational strength test, caches a personalized exercise routine tailored to their goals or injuries, and uses a token-optimized AI progression engine to scale reps and weights over time based on per-exercise feedback.

## Key Features

* **Mobile QR Code Onboarding:** TV text entry is eliminated. Users scan a dynamic QR code on the TV to sign up or log in on their phone.
* **Experience-Based Strength Calibration:** 
  * *Experienced Users:* Prompted on their phone to enter their known starting weight for a foundational reference movement.
  * *Beginner / Intermediate Users:* Given a guided strength test (target weight and reps based on BMI) and asked how many reps they completed so the AI can safely scale their entire routine.
* **Token-Optimized AI Progressive Overload:** Exercises and set counts are locked in after initial calibration. Daily AI calls strip out exercise names, descriptions, and database context—passing only abstract indices, reps, weights, and difficulty ratings to **Claude Haiku 4.5** to calculate the next session's progression, while reducing LLM token costs.
* **Fire TV D-Pad Carousel & Auto-Swapping Visuals:** Built for the 10-foot TV experience with strict directional focus traps, and a toggleable timer that automatically swaps starting and ending exercise form photos.
* **Granular Post-Workout Ratings & Progression Stats:** Users rate each individual exercise (*Too Easy*, *Just Right*, *Too Hard*) upon completion and can view timestamped historical snapshots of their weight and rep progression from the in-app Settings menu.

## AWS Architecture & Tech Stack
### Fire TV App Frontend (`aifitnesstvapp/`) 
* **Vega OS / React Native for Vega (`@amazon-devices/react-native-kepler`):** Powers the TV UI, remote event handling (`TVEventHandler`), persistent local session storage (`AsyncStorageWithKeyScope`), and D-pad focus management.
* **Vega Studio, Vega CLI & Vega Virtual Device (VVD):** Used for building, bundling via Metro, and deploying to the VVD.

### AWS Backend (`backend/`)
* **Amazon Bedrock:** Invokes Anthropic’s **Claude Haiku 4.5** for two-step baseline calibration and daily progressive overload calculations.
* **AWS Lambda:** Runs Node.js serverless functions handling authentication, mobile onboarding HTML delivery, database hydration, and Bedrock orchestration.
* **Amazon API Gateway (HTTP API):** Exposes CORS-enabled REST endpoints connecting the Fire TV client and the mobile setup webpage to Lambda.
* **Amazon DynamoDB & Dynamoose:** Persists data across three tables: `UserProfileTable` (credentials, settings, and cached routines), `WorkoutLedgerTable` (per-exercise ratings and timestamped workout snapshots indexed on `userId`), and `DevicePairingTable` (TV-to-mobile pairing codes).
* **AWS IAM & CloudFormation:** Provisions all serverless resources and secures them with least-privilege permissions via the Serverless Framework.

## How to Run the App on the Vega Virtual Device (VVD)

### Prerequisites
* **VS Code** with the **Vega Studio** extension installed
* **Vega SDK / CLI** and **Vega Virtual Device (VVD)** configured
* **Node.js** (v18+ / v22+) and **npm**

### Step 1: Clone the Repository (Including Submodules)
Because the exercise database (`free-exercise-db`) is linked as a Git submodule, clone the repository using `--recurse-submodules`:

```bash
git clone --recurse-submodules https://github.com/charuse/ai-fitness-tv
cd ai-fitness-tv
```

### Step 2: Install Frontend Dependencies
Navigate into the Fire TV app folder and install the required NPM packages:

```bash
cd aifitnesstvapp
npm install
```

### Step 3: Launch on the Vega Virtual Device (VVD)
The frontend is pre-configured in `aifitnesstvapp/src/components/awsClient.js` to communicate with our live AWS API Gateway endpoint so you can test immediately:

1. Open the `aifitnesstvapp` folder in **VS Code**.
2. Click the **Vega Studio** icon in the left Activity Bar.
3. Under the **Devices** panel, locate `VirtualDevice:Tv` and click the **Start (Play)** icon to boot the Vega Virtual Device. Wait until its status shows as ready.
4. Under the **Projects** panel, click the **Play (Deploy)** icon next to `aifitnesstvapp`.
5. Metro will bundle the application and launch it automatically inside the VVD window.

### Step 4: Testing the App on VVD
1. **Sign Up / Log In:** On the Welcome screen, select **Sign Up** (or **Log In**) using the VVD remote or your keyboard's **Arrow Keys** and **Enter**.
2. **Mobile Onboarding:** Scan the on-screen **QR Code** with your smartphone to create an account, select your fitness goals, and complete the strength calibration step.
3. **AI Workout Generation:** As soon as mobile setup is submitted, the VVD automatically transitions to loading your personalized routine.
4. **Navigation & Settings:**
   * Press **Left / Right** to cycle exercises in the carousel.
   * Press **Down** to highlight **Complete Workout** and rate each exercise to trigger progressive overload for the next session.
   * Press the remote **Menu (☰)** button (or highlight the top-right **⚙️** icon) to open **Settings**, toggle the auto-swap image switch, view **Progression Stats**, or **Log Out / Exit**.

### (Optional) Deploying Your Own AWS Backend

If you wish to deploy your own instance of the backend to AWS:

1. Configure your AWS credentials locally and ensure **Anthropic Claude Haiku 4.5** model access is enabled in **Amazon Bedrock**.

2. Deploy the stack:
   ```bash
   npx serverless deploy
   ```
3. Replace the endpoint URL in `aifitnesstvapp/src/components/awsClient.js` with your own.

## Repository Structure

```text
ai-fitness-tv/
├── aifitnesstvapp/               # Fire TV Frontend (Vega OS / Kepler Project)
│   ├── src/
│   │   ├── components/
│   │   │   ├── awsClient.js      # AWS API Gateway client
│   │   │   ├── FocusableButton.tsx
│   │   │   └── FocusableToggle.tsx
│   │   └── App.tsx               # Main TV application & state machine
│   ├── manifest.toml
│   └── package.json
├── backend/                      # AWS Serverless Backend
│   ├── functions/                # Lambda handlers (auth, workout generation, ledger, stats)
│   ├── models/                   # Dynamoose schemas (UserProfile, WorkoutLedger, DevicePairing)
│   ├── utils/
│   │   ├── free-exercise-db/     # Git submodule containing exercise dataset
│   │   └── bedrockPrompts.js     # Baseline & token-efficient progression prompts
│   ├── serverless.yml            # AWS CloudFormation & HTTP API definition
│   └── package.json
└── README.md
```