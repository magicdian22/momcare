export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const gasUrl =
    process.env.GAS_WEBAPP_URL ||
    req.query?.gasUrl ||
    req.body?.gasUrl;

  if (!gasUrl || !gasUrl.startsWith('https://script.google.com/')) {
    return res.status(400).json({
      status: 'error',
      message: '尚未在 Vercel 設定 GAS_WEBAPP_URL 環境變數或未傳入有效的 Apps Script 網址'
    });
  }

  try {
    // GET：從 Google 試算表載入所有歷史代墊帳目
    if (req.method === 'GET') {
      const response = await fetch(gasUrl, {
        method: 'GET',
        redirect: 'follow'
      });
      const text = await response.text();
      try {
        return res.status(200).json(JSON.parse(text));
      } catch {
        return res.status(200).json({ status: 'ok', raw: text });
      }
    }

    // POST：將加蓋防偽浮水印的收據照片與明細寫入 Google 雲端硬碟與試算表
    if (req.method === 'POST') {
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(req.body),
        redirect: 'follow'
      });
      const text = await response.text();
      try {
        return res.status(200).json(JSON.parse(text));
      } catch {
        return res.status(200).json({ status: 'ok', raw: text });
      }
    }
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
