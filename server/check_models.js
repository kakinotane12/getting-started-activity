import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to load .env from parent directory
const envPath = path.resolve(__dirname, "../.env");
const result = dotenv.config({ path: envPath });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("ERROR: GEMINI_API_KEY is missing.");
    process.exit(1);
}

async function listModels() {
    console.log("Fetching available models...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("Error fetching models:");
            console.error(JSON.stringify(data.error, null, 2));
            return;
        }

        if (!data.models) {
            console.log("No models found.");
            return;
        }

        console.log("\nAvailable Models:");
        data.models.forEach(model => {
            if (model.supportedGenerationMethods && model.supportedGenerationMethods.includes("generateContent")) {
                console.log(model.name.replace("models/", ""));
            }
        });

    } catch (error) {
        console.error("Network error:", error);
    }
}

listModels();
