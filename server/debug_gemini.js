import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env from parent directory
const envPath = path.resolve(__dirname, "../.env");
console.log(`Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("Error loading .env file:", result.error);
}

const apiKey = process.env.GEMINI_API_KEY;

console.log("API Key status:", apiKey ? "Present (Length: " + apiKey.length + ")" : "Missing");

if (!apiKey) {
    console.error("ERROR: GEMINI_API_KEY is missing. Please check your .env file.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName) {
    console.log(`\nTesting model: ${modelName}...`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = "Hello";
        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log(`SUCCESS with ${modelName}! Response: ${response.text()}`);
    } catch (error) {
        console.error(`FAILED with ${modelName}.`);
        console.error("Error message:", error.message);
    }
}

async function runTests() {
    await testModel("gemini-2.0-flash");
    await testModel("gemini-2.5-flash");
    await testModel("gemini-2.0-flash-exp");
}

runTests();
