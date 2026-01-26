const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

/**
 * Generic AI Handler to generate content from model.
 * @param {Object} model - The AI model instance (e.g. Google Generative AI model).
 * @param {string} systemPrompt - The instruction for the AI.
 * @param {string} userContext - Context data (e.g., current tasks, subjects).
 * @param {string} userInput - The raw input from the user.
 * @param {Object} [media] - Optional media object { buffer, mimeType }.
 * @returns {Promise<Array|Object|null>} - Parsed JSON result or null on error.
 */
async function generateAIContent(model, systemPrompt, userContext, userInput, media = null) {
    if (!model) throw new Error("AI Model is not initialized.");

    const parts = [
        { text: systemPrompt },
        { text: `CONTEXT DATA:\n${userContext}` },
        { text: `USER INPUT: "${userInput}"` }
    ];

    if (media) {
        parts.push({
            inlineData: {
                data: media.buffer.toString("base64"),
                mimeType: media.mimeType
            }
        });
    }

    try {
        const result = await model.generateContent(parts);
        const text = result.response.text();

        // Attempt to extract JSON
        const jsonMatch = text.match(/\[.*?\]/s) || text.match(/\{.*?\}/s);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        } else {
            console.warn("AI output is not valid JSON:", text);
            return null;
        }
    } catch (e) {
        console.error("AI Generation Error:", e);
        throw e;
    }
}

module.exports = { generateAIContent };
