import { GoogleGenerativeAI } from '@google/generative-ai';
const formidable = require('formidable');
const fs = require('fs');

// 1. 設定視覺導演指令 (System Prompt)
const SYSTEM_PROMPT = `你是一位享譽國際的超現實主義電影導演與視覺特效總監。
你的任務是接收用戶的「原始夢境文字」，並嚴格輸出 JSON 格式的資料，結構如下，不得包含任何額外的解釋文字或 Markdown 標籤：
{
  "videoPrompt": "這裡填寫生成的英文視頻指令",
  "tags": ["標籤1", "標籤2", "標籤3"]
}
工作原則：
1. videoPrompt 必須完全使用英文，強調超現實主義、電影級光影、動態鏡頭，適合 Luma AI。
2. tags 提取 3-5 個情緒與核心視覺元素，統一使用繁體中文。`;

// 讓 Vercel 知道我們要自己處理包裹 (Body)
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 請求喔！' });
  }

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: "包裹拆解失敗" });
    }

    try {
      // A. 取得前端傳來的錄音檔路徑
      const audioFile = files.file[0] || files.file; 
      const buffer = fs.readFileSync(audioFile.filepath);

      // B. 傳送至 OpenAI Whisper (語音轉文字)
      const whisperFormData = new FormData();
      whisperFormData.append('file', new Blob([buffer], { type: 'audio/webm' }), 'audio.webm');
      whisperFormData.append('model', 'whisper-1');
      whisperFormData.append('language', 'zh');

      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: whisperFormData
      });

      const whisperResult = await whisperResponse.json();
      const rawText = whisperResult.text; 

      // C. 呼叫 Gemini 1.5 Pro 進行視覺編導
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

      const result = await model.generateContent(`${SYSTEM_PROMPT}\n\n用戶原始夢境："${rawText}"`);
      const response = await result.response;
      const aiText = response.text().replace(/```json|```/g, ''); // 去除可能出現的 Markdown 標籤
      const structuredData = JSON.parse(aiText);

      // D. 回傳整齊的結果
      return res.status(200).json({
        success: true,
        rawTranscript: rawText,
        videoPrompt: structuredData.videoPrompt,
        tags: structuredData.tags
      });

    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });
}
