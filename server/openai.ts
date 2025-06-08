import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

interface ThemeAnalysis {
  title: string;
  description: string;
  confidence: number;
}

interface JournalAnalysisResult {
  themes: ThemeAnalysis[];
  tags: string[];
  reflectionQuestions: string[];
  emotionalTone: string;
}

interface SentimentResult {
  positive: number;
  neutral: number;
  concern: number;
  overall: string;
}

export async function analyzeJournalEntry(transcribedText: string): Promise<JournalAnalysisResult> {
  try {
    const prompt = `
Please analyze the following journal entry and provide insights in JSON format. Focus on identifying:
1. Key themes and their descriptions with confidence scores (0-100)
2. Relevant tags for categorization (faith, career, relationships, gratitude, reflection, personal-growth, family, decisions, mindfulness, etc.)
3. Thoughtful reflection questions based on the content
4. Overall emotional tone

Journal Entry:
"${transcribedText}"

Please respond with JSON in this exact format:
{
  "themes": [
    {
      "title": "Theme Title",
      "description": "Detailed description of the theme",
      "confidence": 85
    }
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "reflectionQuestions": [
    "Thoughtful question 1?",
    "Thoughtful question 2?",
    "Thoughtful question 3?"
  ],
  "emotionalTone": "positive/neutral/reflective/concerned"
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert journal analyst who helps people gain insights from their personal reflections. Analyze journal entries with empathy and wisdom, identifying meaningful themes and providing thoughtful reflection questions. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Validate and sanitize the result
    return {
      themes: Array.isArray(result.themes) ? result.themes.map((theme: any) => ({
        title: String(theme.title || "Unnamed Theme"),
        description: String(theme.description || ""),
        confidence: Math.max(0, Math.min(100, Number(theme.confidence) || 75))
      })) : [],
      tags: Array.isArray(result.tags) ? result.tags.map((tag: any) => String(tag).toLowerCase()) : [],
      reflectionQuestions: Array.isArray(result.reflectionQuestions) ? result.reflectionQuestions.map((q: any) => String(q)) : [],
      emotionalTone: String(result.emotionalTone || "neutral")
    };
  } catch (error) {
    console.error("Journal analysis error:", error);
    throw new Error("Failed to analyze journal entry: " + (error as Error).message);
  }
}

export async function analyzeSentiment(transcribedText: string): Promise<SentimentResult> {
  try {
    const prompt = `
Analyze the sentiment of the following journal entry and provide a breakdown of emotional tones as percentages that add up to 100.

Journal Entry:
"${transcribedText}"

Please respond with JSON in this exact format:
{
  "positive": 65,
  "neutral": 25,
  "concern": 10,
  "overall": "positive"
}

Where:
- positive: percentage of positive emotions (joy, gratitude, hope, excitement, etc.)
- neutral: percentage of neutral/objective content
- concern: percentage of concerning/negative emotions (worry, sadness, uncertainty, etc.)
- overall: dominant sentiment category ("positive", "neutral", or "negative")

Ensure the three percentages add up to 100.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a sentiment analysis expert specializing in personal journal entries. Provide accurate emotional breakdowns while being sensitive to the personal nature of the content. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Validate and normalize percentages
    let positive = Math.max(0, Math.min(100, Number(result.positive) || 0));
    let neutral = Math.max(0, Math.min(100, Number(result.neutral) || 0));
    let concern = Math.max(0, Math.min(100, Number(result.concern) || 0));

    // Ensure they add up to 100
    const total = positive + neutral + concern;
    if (total > 0) {
      positive = Math.round((positive / total) * 100);
      neutral = Math.round((neutral / total) * 100);
      concern = 100 - positive - neutral; // Ensure exact sum of 100
    } else {
      // Default if all values are 0
      positive = 50;
      neutral = 40;
      concern = 10;
    }

    // Determine overall sentiment
    let overall = "neutral";
    if (positive > neutral && positive > concern) {
      overall = "positive";
    } else if (concern > positive && concern > neutral) {
      overall = "negative";
    }

    return {
      positive,
      neutral,
      concern,
      overall
    };
  } catch (error) {
    console.error("Sentiment analysis error:", error);
    throw new Error("Failed to analyze sentiment: " + (error as Error).message);
  }
}

export async function generateReflectionQuestions(themes: ThemeAnalysis[]): Promise<string[]> {
  try {
    const themeTitles = themes.map(theme => theme.title).join(", ");
    
    const prompt = `
Based on the following journal entry themes: ${themeTitles}

Generate 3-5 thoughtful, open-ended reflection questions that would help someone explore these themes more deeply. The questions should:
1. Encourage self-discovery and personal growth
2. Be specific enough to be actionable
3. Promote deeper thinking about the themes
4. Be appropriate for personal journaling and reflection

Please respond with JSON in this format:
{
  "questions": [
    "Question 1?",
    "Question 2?",
    "Question 3?"
  ]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a thoughtful coach who helps people reflect on their personal experiences through meaningful questions. Generate questions that promote self-awareness and growth."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 400
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return Array.isArray(result.questions) ? result.questions.map((q: any) => String(q)) : [];
  } catch (error) {
    console.error("Reflection questions generation error:", error);
    // Return default questions if AI fails
    return [
      "What insights from this experience can guide your future decisions?",
      "How do these thoughts connect to your values and goals?",
      "What would you like to explore further about this topic?"
    ];
  }
}

export async function extractTextFromImage(imagePath: string): Promise<{ text: string; confidence: number }> {
  try {
    // Read the image file and convert to base64
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Determine the image format from the file extension
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 
                    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                    'image/jpeg'; // fallback

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please extract all handwritten and printed text from this image. Focus on accuracy and preserve the original formatting as much as possible. If the handwriting is difficult to read, provide your best interpretation. Return only the extracted text, no commentary."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
    });

    const extractedText = response.choices[0].message.content?.trim() || "";
    
    // GPT-4o typically has high confidence for text extraction
    const confidence = extractedText.length > 0 ? 95 : 0;
    
    return {
      text: extractedText,
      confidence: confidence
    };
  } catch (error) {
    console.error('OpenAI vision OCR error:', error);
    throw new Error('Failed to extract text using OpenAI vision');
  }
}
