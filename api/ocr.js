export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const { imageBase64, mimeType, apiKey: clientKey } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY || clientKey;

    if (!apiKey) {
      return res.status(400).json({
        status: 'error',
        message: '尚未在 Vercel 設定 GEMINI_API_KEY 環境變數'
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ status: 'error', message: '未收到單據影像資料' });
    }

    const base64Clean = imageBase64.includes('base64,')
      ? imageBase64.split('base64,')[1]
      : imageBase64;

    const prompt = `你是一位專精台灣醫療收據、長照機構繳費單、統一發票、超市明細與免用統一發票手寫收據的專業會計AI。
請仔細辨識這張單據影像中的所有文字與數字，並嚴格只回傳 JSON 格式（不要包含 markdown 標記）：
{
  "date": "YYYY-MM-DD (若單據上為民國年如113年、114年、115年，請自動加1911轉為西元年；若無年份請填今日日期)",
  "category": "請從以下8選1：01_醫療門診與住院 / 02_長照與看護自付 / 03_傷口敷料與耗材 / 04_洗腎營養品與奶粉 / 05_超市與市場膳食 / 06_交通接送與停車 / 07_居家設備與輔具 / 08_其他照護雜支",
  "merchant": "醫院、診所或商家名稱（請依單據上印章、抬頭或店名誠實填寫）",
  "invoiceNo": "發票號碼（如AB-12345678）或收據編號/統一編號（若無則填：實物存證）",
  "items": "完整消費品項明細、數量與單價（格式範例：1. 品項A $100 / 2. 品項B $200）",
  "amount": 實付總金額純數字(整數，請核對小寫總計或新台幣大寫金額，切勿將電話號碼或統編誤判為金額),
  "candidateAmounts": [單據上出現的所有合理金額數字陣列，由最可能之總額排到小項金額]
}`;

    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError = 'Gemini API 呼叫失敗';

    for (const modelName of models) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType || 'image/jpeg',
                      data: base64Clean
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      const result = await geminiRes.json();
      if (geminiRes.ok) {
        const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const cleaned = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return res.status(200).json({ status: 'ok', model: modelName, data: parsed });
      } else {
        lastError = result.error?.message || lastError;
      }
    }

    return res.status(500).json({ status: 'error', message: lastError });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
