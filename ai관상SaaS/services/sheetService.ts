
import { PhysiognomyResult } from "../types";

/**
 * [UPDATE] 구글 Apps Script를 통해 스프레드시트에 데이터를 로그로 남깁니다.
 */
export const logToSheet = async (scriptUrl: string, result: PhysiognomyResult) => {
  if (!scriptUrl) {
    console.warn("구글 시트 URL이 설정되지 않아 로그를 건너뜁니다.");
    return;
  }

  // [UPDATE] 시트에 기록될 데이터 구조
  const payload = {
    timestamp: new Date().toLocaleString('ko-KR'),
    animalType: result.animalType,
    score: result.overallScore,
    wealth: result.wealthLuck,
    advice: result.advice,
    source: "AI_GWANSANG_WEB_APP"
  };

  try {
    // GAS 웹앱은 보통 CORS 이슈가 있으므로 mode: 'no-cors'를 사용합니다.
    // 이 경우 응답 내용을 읽을 수는 없지만 서버로 데이터 전송은 정상적으로 수행됩니다.
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    console.log("구글 시트로 데이터 전송 완료");
  } catch (error) {
    console.error("구글 시트 저장 실패:", error);
  }
};
