const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");
const { parse } = require("csv-parse/sync");
require("dotenv").config();
const { getSystemPrompt } = require("./prompts");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

app.get("/", (req, res) => {
  res.send("Facebook AI Bot is running");
});

app.get("/facebook/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.FB_VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

async function sendMessage(senderId, text) {
  await axios.post(
    `https://graph.facebook.com/v23.0/me/messages?access_token=${process.env.FB_PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: senderId },
      message: { text },
    },
  );
}

async function getKnowledgeBase() {
  const url = `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/export?format=csv&gid=${process.env.FAQ_SHEET_GID}`;

  const response = await axios.get(url);

  const rows = parse(response.data, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return rows.filter((row) => {
    if (!row.question || !row.answer) return false;
    if (!row.status) return true;
    return row.status.toLowerCase() === "active";
  });
}

function findRelevantKnowledge(message, knowledgeBase) {
  const lowerMessage = message.toLowerCase();

  return knowledgeBase
    .map((item) => {
      const searchableText =
        `${item.category || ""} ${item.question || ""} ${item.keywords || ""}`.toLowerCase();

      let score = 0;

      for (const word of lowerMessage.split(/\s+/)) {
        if (word.length > 2 && searchableText.includes(word)) {
          score++;
        }
      }

      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

async function askDeepSeek(customerMessage) {
  const knowledgeBase = await getKnowledgeBase();
  const relevantKnowledge = findRelevantKnowledge(
    customerMessage,
    knowledgeBase,
  );

  const context = relevantKnowledge
    .map((item, index) => {
      return `${index + 1}. Nhóm: ${item.category}
Câu hỏi mẫu: ${item.question}
Câu trả lời chuẩn: ${item.answer}
Từ khóa: ${item.keywords || ""}`;
    })
    .join("\n\n");

  const completion = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: getSystemPrompt(context),
      },
      {
        role: "user",
        content: customerMessage,
      },
    ],
  });

  return completion.choices[0].message.content;
}

app.post("/facebook/webhook", async (req, res) => {
  res.status(200).send("EVENT_RECEIVED");

  const body = req.body;

  if (body.object !== "page") return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const senderId = event.sender?.id;
      const messageText = event.message?.text;

      if (!senderId || !messageText) continue;
      if (event.message?.is_echo) continue;

      console.log("Khách nhắn:", messageText);

      try {
        // await sendMessage(
        //   senderId,
        //   "Dạ em đang kiểm tra thông tin cho mình ạ...",
        // );

        const aiReply = await askDeepSeek(messageText);

        console.log("AI trả lời:", aiReply);

        await sendMessage(senderId, aiReply);
      } catch (error) {
        console.error("Lỗi:", error.response?.data || error.message);

        await sendMessage(
          senderId,
          "Dạ em đã nhận được tin nhắn ạ. Anh/chị cho em xin số điện thoại để tư vấn viên hỗ trợ chi tiết hơn nhé.",
        );
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
