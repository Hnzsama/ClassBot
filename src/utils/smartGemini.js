const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Wrapper class for Gemini Model to handle API Key fallback.
 * Automatically switches to backup key if rate limit (429) is encountered.
 */
class SmartGeminiModel {
    /**
     * @param {string[]} keys - Array of API Keys [primary, backup]
     * @param {object} config - Configuration object for getGenerativeModel
     */
    constructor(keys, config) {
        // Filter out empty keys
        this.keys = keys.filter(k => k && k.trim() !== "");
        this.config = config;
        this.currentKeyIndex = 0;
        this.instances = {}; // Cache for model instances: key -> model
    }

    /**
     * Get or create model instance for the given key index
     * @param {number} index 
     * @returns {object|null} GenerativeModel instance
     */
    _getModel(index) {
        if (index < 0 || index >= this.keys.length) return null;

        const key = this.keys[index];
        if (!this.instances[key]) {
            const genAI = new GoogleGenerativeAI(key);
            this.instances[key] = genAI.getGenerativeModel(this.config);
        }
        return this.instances[key];
    }

    /**
     * Mimics the generateContent method of GenerativeModel
     * @param {...any} args - Arguments passed to generateContent
     * @returns {Promise<any>} Response from Gemini
     */
    async generateContent(...args) {
        let model = this._getModel(this.currentKeyIndex);
        if (!model) throw new Error("No valid Gemini API Key available.");

        try {
            return await model.generateContent(...args);
        } catch (error) {
            // Detect Rate Limit (429) or Quota Exceeded
            // GoogleGenerativeAI errors might have status or include message
            const isRateLimit =
                error.status === 429 ||
                (error.message && (error.message.includes("429") || error.message.includes("Too Many Requests") || error.message.includes("Quota exceeded")));

            if (isRateLimit && this.keys.length > 1) {
                // Determine next key index
                const nextIndex = (this.currentKeyIndex + 1) % this.keys.length;

                // Ensure we haven't looped back to the same failing key immediately in a way that causes infinite recursion
                // (Though here we just try one fallback per call or persistently switch)

                // We will persistently switch to the backup key
                if (nextIndex !== this.currentKeyIndex) {
                    console.warn(`⚠️ Gemini Rate Limit hit on key ${this.currentKeyIndex}. Switching to key index ${nextIndex} (Backup)...`);

                    this.currentKeyIndex = nextIndex;
                    model = this._getModel(this.currentKeyIndex);

                    if (model) {
                        console.log("♻️ Retrying with backup key...");
                        return await model.generateContent(...args);
                    }
                }
            }

            // If not rate limit or no backup available, throw original error
            throw error;
        }
    }
}

module.exports = SmartGeminiModel;
