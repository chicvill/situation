
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { PhysiognomyResult } from "../types";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const checkModelAvailability = async (): Promise<boolean> => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey.trim() === '') {
    console.group("❌ Gemini API Key Missing Error");
    console.error("API 키가 감지되지 않았습니다.");
    console.info("해결 방법:");
    console.info("플랫폼 설정에서 GEMINI_API_KEY가 올바르게 설정되어 있는지 확인해주세요.");
    console.groupEnd();
    return false;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "health check",
      config: { 
        maxOutputTokens: 10,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    
    if (response) {
      console.log("✅ Gemini API 연결 성공!");
      return true;
    }
    return false;
  } catch (error: any) {
    console.group("❌ Gemini API 연결 오류");
    console.error("에러 메시지:", error.message);
    console.groupEnd();
    return false;
  }
};

export const analyzeFace = async (base64Image: string): Promise<PhysiognomyResult> => {
  const cleanBase64 = base64Image.split(',')[1] || base64Image;

  const makeRequest = async (retryCount = 0): Promise<PhysiognomyResult> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64
              }
            },
            {
              text: `
                [Context: This is a professional-toned physiognomy analysis for ENTERTAINMENT.]
                당신은 사람들에게 희망과 용기를 주는 따뜻하고 지혜로운 한국 최고의 전통 관상가입니다. 
                사진 속 인물의 고유한 생김새 특징(눈의 모양, 코의 높이와 끝, 입술의 두께, 눈썹의 짙음, 얼굴형, 이마의 넓이 등)을 아주 세밀하게 관찰하고, 이를 바탕으로 그 사람만이 가진 독보적인 '물형(동물상)'과 운세를 분석하십시오.

                지침:
                1. **다양성 확보 (중요)**: '학상'이나 '호랑이상' 같은 특정 결과에만 치우치지 마십시오. 용, 봉황, 거북이, 사슴, 백조, 여우, 고양이, 강아지, 토끼, 원숭이, 코끼리, 독수리 등 매우 다양한 동물상을 고려하여 사진과 가장 일치하는 것을 선택하십시오.
                2. **구체적 특징 연계**: 단순히 "성격이 좋다"는 식의 일반적인 표현이 아니라, "눈매가 가늘고 길어 통찰력이 뛰어나며...", "콧방울이 도톰하여 재물이 모이는 기운이..."와 같이 실제 관찰된 특징을 운세와 직접 연결하십시오.
                3. **운세의 차별화**: 재물운, 애정운, 직업운이 모두 비슷하게 나오지 않도록 하십시오. 각 운세 항목마다 해당 부위의 관상을 근거로 들어 서로 다른 깊이 있는 분석을 제공하십시오.
                4. **희망의 메시지**: 모든 분석의 끝은 긍정적이어야 합니다. 현재의 특징을 장점으로 승화시켜 밝은 미래를 꿈꿀 수 있게 하십시오.
                5. 말투는 정중하고 고전적이면서도, 현대적인 감각을 잃지 않는 다정한 관상가의 어조를 유지하십시오.

                항목:
                - animalType: 닮은 동물 (특징을 잘 나타내는 수식어 포함. 예: '영민한 기운을 품은 붉은 여우상', '강인한 의지를 가진 숲속의 사자상' 등)
                - animalDescription: 사진에서 발견한 구체적인 신체적 특징(눈, 코, 입 등)이 왜 이 동물상과 일치하는지, 그리고 그 기운이 어떠한지 상세히 설명
                - overallScore: 관상 총운 점수 (80~100 사이, 긍정적인 에너지 전달)
                - personality: 이목구비에서 드러나는 고유한 기질과 인간적인 매력
                - wealthLuck: 코와 입의 형태를 중심으로 분석한 재물 복록 (희망적인 미래 전망 포함)
                - careerLuck: 이마와 눈썹, 눈의 기운을 바탕으로 본 성공과 명예운
                - loveLuck: 눈매와 입꼬리, 전체적인 인상을 통해 본 인연과 대인관계운
                - advice: 분석 결과를 종합하여 오늘을 살아갈 힘이 되는 지혜로운 한마디
              `
            }
          ]
        },
        config: {
          temperature: 0.9,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              animalType: { type: Type.STRING },
              animalDescription: { type: Type.STRING },
              overallScore: { type: Type.NUMBER },
              personality: { type: Type.STRING },
              wealthLuck: { type: Type.STRING },
              careerLuck: { type: Type.STRING },
              loveLuck: { type: Type.STRING },
              advice: { type: Type.STRING },
            },
            required: ["animalType", "animalDescription", "overallScore", "personality", "wealthLuck", "careerLuck", "loveLuck", "advice"]
          },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          ]
        }
      });

      const text = response.text;
      if (!text) throw new Error("AI 응답을 받지 못했습니다.");
      
      return JSON.parse(text.trim()) as PhysiognomyResult;

    } catch (error: any) {
      console.error("Analysis Error:", error);
      if ((error.status === 429 || error.status === 503) && retryCount < 3) {
        await wait(2000 * (retryCount + 1));
        return makeRequest(retryCount + 1);
      }
      throw error;
    }
  };

  return makeRequest();
};
