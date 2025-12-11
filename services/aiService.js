const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.isAvailable = false;
    }

    /**
     * Initialize Gemini AI service
     */
    initialize(apiKey) {
        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            console.warn('⚠️  Gemini API key not configured - AI features disabled');
            this.isAvailable = false;
            return;
        }

        try {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
            this.isAvailable = true;
            console.log('✅ Gemini AI initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Gemini AI:', error.message);
            this.isAvailable = false;
        }
    }

    /**
     * Generate metadata for audio/video project
     */
    async generateMetadata(projectData) {
        if (!this.isAvailable) {
            throw new Error('AI service not available - please configure GEMINI_API_KEY');
        }

        const { audioPreset, duration, videoType, customInstructions } = projectData;

        const durationHours = Math.floor(duration / 3600);
        const durationMinutes = Math.floor((duration % 3600) / 60);
        const durationText = durationHours > 0
            ? `${durationHours} hour${durationHours > 1 ? 's' : ''}${durationMinutes > 0 ? ` ${durationMinutes} minutes` : ''}`
            : `${durationMinutes} minute${durationMinutes > 1 ? 's' : ''}`;

        const prompt = `
You are an expert YouTube content optimizer specializing in ambient audio and relaxation videos.

Generate SEO-optimized YouTube metadata for the following content:

**Audio Type**: ${audioPreset || 'Ambient Audio'}
**Duration**: ${durationText}
**Video Type**: ${videoType || 'Static/Looping Visuals'}
${customInstructions ? `**Additional Requirements**: ${customInstructions}` : ''}

Please generate:

1. **Title** (max 60 characters):
   - Engaging and descriptive
   - Include keywords for searchability
   - Mention duration prominently
   - Appeal to target audience (sleep, study, relaxation, etc.)

2. **Description** (500-800 words):
   - Compelling opening paragraph
   - Benefits of the audio/video
   - Detailed description of sounds/visuals
   - Include timestamps every 10 minutes (if duration > 30 min)
   - Call to action (like, subscribe, comment)
   - Credit section (if applicable)
   - Disclaimer (if needed)

3. **Tags** (20-30 keywords):
   - Mix of broad and specific keywords
   - Include duration-related tags
   - Include mood/purpose tags (sleep, study, meditation, etc.)
   - Include sound type tags

Format your response as valid JSON:
{
  "title": "...",
  "description": "...",
  "tags": ["tag1", "tag2", ...]
}

Important: Ensure the response is ONLY the JSON object, no additional text before or after.
`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();

            // Extract JSON from response (sometimes AI adds markdown code blocks)
            let jsonText = response.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '');
            }

            const metadata = JSON.parse(jsonText);

            // Validate response
            if (!metadata.title || !metadata.description || !metadata.tags) {
                throw new Error('Invalid AI response format');
            }

            // Trim title if too long
            if (metadata.title.length > 100) {
                metadata.title = metadata.title.substring(0, 97) + '...';
            }

            console.log('✅ AI metadata generated successfully');
            return metadata;

        } catch (error) {
            console.error('❌ AI metadata generation failed:', error);
            throw new Error(`Failed to generate metadata: ${error.message}`);
        }
    }

    /**
     * Generate title only
     */
    async generateTitle(projectData) {
        const metadata = await this.generateMetadata(projectData);
        return metadata.title;
    }

    /**
     * Generate description only
     */
    async generateDescription(projectData) {
        const metadata = await this.generateMetadata(projectData);
        return metadata.description;
    }

    /**
     * Generate tags only
     */
    async generateTags(projectData) {
        const metadata = await this.generateMetadata(projectData);
        return metadata.tags;
    }

    /**
     * Enhance existing metadata
     */
    async enhanceMetadata(existingMetadata, projectData) {
        if (!this.isAvailable) {
            throw new Error('AI service not available');
        }

        const prompt = `
Improve the following YouTube metadata to be more SEO-optimized and engaging:

**Current Title**: ${existingMetadata.title}
**Current Description**: ${existingMetadata.description}
**Current Tags**: ${existingMetadata.tags?.join(', ')}

**Content Type**: ${projectData.audioPreset || 'Ambient Audio'}
**Duration**: ${Math.floor(projectData.duration / 60)} minutes

Please enhance this metadata while:
- Keeping the core message
- Improving SEO keywords
- Making it more engaging
- Following YouTube best practices

Return as JSON:
{
  "title": "...",
  "description": "...",
  "tags": [...]
}
`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();

            let jsonText = response.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '');
            }

            const enhanced = JSON.parse(jsonText);
            console.log('✅ Metadata enhanced successfully');
            return enhanced;

        } catch (error) {
            console.error('❌ Metadata enhancement failed:', error);
            throw new Error(`Failed to enhance metadata: ${error.message}`);
        }
    }

    /**
     * Check if AI service is available
     */
    isReady() {
        return this.isAvailable;
    }
}

// Singleton instance
const aiService = new AIService();

module.exports = aiService;
