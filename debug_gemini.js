
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);

    if (match) {
        const apiKey = match[1].trim();
        console.log("API Key found (starts with):", apiKey.substring(0, 5) + "...");

        const genAI = new GoogleGenerativeAI(apiKey);

        async function listModels() {
            try {
                // For listModels, we use the model manager? No, standard exposed method via getGenerativeModel usually doesn't list.
                // Note: The Client SDK (@google/generative-ai) might not expose listModels directly in the main class in older versions, 
                // but let's try accessing it via the 'modelManager' or similar if available, or just standard API call if needed.
                // Wait, checking docs... GoogleGenerativeAI usually just gets a model.
                // To list models, typically we need the Server SDK (@google/genai) or make a direct REST call.
                // But let's try to assume we can just allow the user to see the error for now if I can't list.

                // Constructing a manual REST call is safer to verify the key and endpoint.
                const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
                // Try with GitHub Pages referer from git remote
                const response = await fetch(url, {
                    headers: {
                        'Referer': 'https://9981mark-hub.github.io/leadmaster-crm/'
                    }
                });
                const data = await response.json();

                if (data.models) {
                    console.log("\n✅ Available Models for this Key:");
                    data.models.forEach(m => {
                        if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                            console.log(`- ${m.name}`);
                        }
                    });
                } else {
                    console.error("❌ Failed to list models:", JSON.stringify(data, null, 2));
                }

            } catch (error) {
                console.error("Error listing models:", error);
            }
        }

        listModels();

    } else {
        console.error("Could not find VITE_GEMINI_API_KEY in .env");
    }
} catch (e) {
    console.error("Error reading .env:", e);
}
