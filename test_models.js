require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const candidates = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-001",
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-1.0-pro",
    "gemini-pro"
];

async function checkModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    console.log("Checking models...");

    for (const modelName of candidates) {
        try {
            process.stdout.write(`Testing ${modelName} ... `);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Test connection");
            console.log("✅ SUCCESS");
            console.log("Response:", result.response.text());
            return; // Stop on first success
        } catch (e) {
            console.log("❌ FAILED");
            // console.log(e.message); // Uncomment to see error
        }
    }
    console.log("😭 ALL MODELS FAILED.");
}

checkModels();
