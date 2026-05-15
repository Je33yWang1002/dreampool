const { GoogleGenAI } = require('@google/generative-ai');

// 1. 設定帶有嚴格格式的導演 System Prompt
const SYSTEM_PROMPT = `你是一位享譽國際的超現實主義電影導演與視覺特效總監。
你的任務是接收用戶的「原始夢境文字」，並嚴格輸出 JSON 格式的資料，結構如下，不得包含任何額外的解釋文字或 Markdown 標籤：
{
  "videoPrompt": "這裡填寫生成的英文視頻指令",
  "tags": ["標籤1", "標籤2", "標籤3"]
}
工作原則：
1. videoPrompt 必須完全使用英文，強調超現實主義、電影級光影、動態鏡頭，適合 Luma AI。
2. tags 提取 3-5 個情緒與核心視覺元素，統一使用繁體中文。`;

export default async function handler(req, res) {
  // 只接受 POST 請求（前端傳送資料過來）
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 請求喔！' });
  }

  try {
    // A. 這裡會收到前端傳過來的「二進位錄音檔檔案」
    const blob = req.body; 

    // B. 包裝成包裹送給 OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', new Blob([blob], { type: 'audio/webm' }), 'audio.webm');
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'zh');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: whisperFormData
    });

    const whisperResult = await whisperResponse.json();
    const rawText = whisperResult.text; // 順利拿到中文夢話！

    // C. 把中文夢話拿給 Gemini 1.5 Pro 加工
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n用戶原始夢境："${rawText}"` }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const aiResult = await aiResponse.json();
    const aiText = aiResult.candidates[0].content.parts[0].text;
    const structuredData = JSON.parse(aiText);

    // D. 成功！把結果整整齊齊地回傳給網頁前端
    return res.status(200).json({
      success: true,
      rawTranscript: rawText,
      videoPrompt: structuredData.videoPrompt,
      tags: structuredData.tags
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}