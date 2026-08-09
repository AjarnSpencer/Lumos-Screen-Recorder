import { GoogleGenAI } from "@google/genai";

// We only use this if the user supplies a key, or if env is set.
// The app must function without this.

// Fix: Use process.env.API_KEY as per guidelines and remove apiKey parameter
export const generateSmartTitle = async (imageBase64: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "Untitled Recording";

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Using gemini-3-flash-preview for multimodal analysis as per guidelines
    const model = 'gemini-3-flash-preview';

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageBase64
                }
            },
            {
                text: "Analyze this screen capture and generate a short, professional, descriptive title for a video recording of this session. Output ONLY the title, no quotes."
            }
        ]
      }
    });

    return response.text?.trim() || "Untitled Recording";
  } catch (error) {
    console.error("Gemini Title Gen Error:", error);
    return "Untitled Recording";
  }
};