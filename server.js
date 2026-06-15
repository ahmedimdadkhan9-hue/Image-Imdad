// server.js - এটা সবচেয়ে simple server যা কাজ করবে

const http = require('http');
const url = require('url');

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Health check
  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({ 
      status: 'Adobe Stock AI Checker Proxy is running! ✅',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // API endpoint
  if (pathname === '/api/analyze' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { imageBase64, provider = 'claude', apiKey } = data;

        if (!imageBase64) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'imageBase64 প্রয়োজন' }));
          return;
        }

        if (!apiKey) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'apiKey প্রয়োজন' }));
          return;
        }

        let apiResponse;

        if (provider === 'gemini') {
          apiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    {
                      text: `আপনি Adobe Stock এর একজন বিশেষজ্ঞ reviewer। এই ইমেজটি বিশ্লেষণ করুন এবং শুধুমাত্র JSON ফরম্যাটে ফেরত দিন:
{
  "quality_score": 0-100,
  "uniqueness_score": 0-100,
  "adobe_stock_readiness": 0-100,
  "rejection_probability": 0-100,
  "quality_assessment": "বাংলা মন্তব্য",
  "uniqueness_assessment": "বাংলা মন্তব্য",
  "common_rejection_reasons": ["কারণ 1", "কারণ 2", "কারণ 3"],
  "improvement_suggestions": ["সাজেশন 1", "সাজেশন 2", "সাজেশন 3"],
  "positive_aspects": ["দিক 1", "দিক 2"]
}`
                    },
                    {
                      inlineData: {
                        mimeType: 'image/jpeg',
                        data: imageBase64
                      }
                    }
                  ]
                }]
              })
            }
          );
        } else {
          apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey
            },
            body: JSON.stringify({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 2000,
              messages: [{
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: 'image/jpeg',
                      data: imageBase64
                    }
                  },
                  {
                    type: 'text',
                    text: `আপনি Adobe Stock এর একজন বিশেষজ্ঞ reviewer। এই ইমেজটি বিশ্লেষণ করুন এবং শুধুমাত্র JSON ফরম্যাটে ফেরত দিন:
{
  "quality_score": 0-100,
  "uniqueness_score": 0-100,
  "adobe_stock_readiness": 0-100,
  "rejection_probability": 0-100,
  "quality_assessment": "বাংলা মন্তব্য",
  "uniqueness_assessment": "বাংলা মন্তব্য",
  "common_rejection_reasons": ["কারণ 1", "কারণ 2", "কারণ 3"],
  "improvement_suggestions": ["সাজেশন 1", "সাজেশন 2", "সাজেশন 3"],
  "positive_aspects": ["দিক 1", "দিক 2"]
}`
                  }
                ]
              }]
            })
          });
        }

        if (!apiResponse.ok) {
          const errorData = await apiResponse.json();
          throw new Error(`API Error: ${apiResponse.status}`);
        }

        const responseData = await apiResponse.json();
        let responseText = '';

        if (provider === 'gemini') {
          if (responseData.candidates?.[0]?.content?.parts) {
            responseText = responseData.candidates[0].content.parts
              .filter(p => p.text)
              .map(p => p.text)
              .join('');
          }
        } else {
          if (responseData.content?.length > 0) {
            responseText = responseData.content
              .filter(item => item.type === 'text')
              .map(item => item.text)
              .join('');
          }
        }

        if (!responseText) {
          throw new Error('খালি রেসপন্স');
        }

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('JSON পাওয়া যায়নি');
        }

        const analysisData = JSON.parse(jsonMatch[0]);

        res.writeHead(200);
        res.end(JSON.stringify(analysisData));

      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message || 'Error' }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
