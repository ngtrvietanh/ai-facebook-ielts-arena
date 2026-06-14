const express = require("express");
const axios = require("axios");
const OpenAI = require("openai");
const { parse } = require("csv-parse/sync");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { getSystemPrompt } = require("./prompts");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");
const TRAINING_FILE = path.join(DATA_DIR, "training_data.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }

  const files = [CONVERSATIONS_FILE, TRAINING_FILE, LEADS_FILE];

  for (const file of files) {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, "[]");
    }
  }

  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(
        {
          companyName: "IELTS Arena",
          collectLead: true,
          conversationHistoryLimit: 10,
        },
        null,
        2,
      ),
    );
  }
}

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw || "[]");
  } catch (error) {
    console.error("Lỗi đọc JSON:", error.message);
    return [];
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function saveConversation({ facebookId, userMessage, aiAnswer }) {
  const conversations = readJson(CONVERSATIONS_FILE);

  conversations.push({
    id: `conv_${Date.now()}`,
    facebookId,
    userMessage,
    aiAnswer,
    createdAt: new Date().toISOString(),
  });

  writeJson(CONVERSATIONS_FILE, conversations);
}

function saveTrainingData({ question, aiAnswer }) {
  const trainingData = readJson(TRAINING_FILE);

  trainingData.push({
    id: `train_${Date.now()}`,
    question,
    aiAnswer,
    humanAnswer: aiAnswer,
    approved: true,
    createdAt: new Date().toISOString(),
  });

  writeJson(TRAINING_FILE, trainingData);
}

function getRecentTrainingData(customerMessage) {
  const trainingData = readJson(TRAINING_FILE);
  const lowerMessage = customerMessage.toLowerCase();

  return trainingData
    .filter(
      (item) => item.approved === true && item.question && item.humanAnswer,
    )
    .map((item) => {
      let score = 0;
      const searchableText =
        `${item.question} ${item.humanAnswer}`.toLowerCase();

      for (const word of lowerMessage.split(/\s+/)) {
        if (word.length > 2 && searchableText.includes(word)) {
          score++;
        }
      }

      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

ensureDataFiles();

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
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v23.0/me/messages`,
      {
        recipient: { id: senderId },
        message: { text },
      },
      {
        params: {
          access_token: process.env.FB_PAGE_ACCESS_TOKEN,
        },
      },
    );

    console.log("Đã gửi Facebook:", response.data);
  } catch (error) {
    console.error(
      "Lỗi gửi Facebook:",
      JSON.stringify(error.response?.data || error.message, null, 2),
    );
  }
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

  const faqContext = relevantKnowledge
    .map((item, index) => {
      return `${index + 1}. Nhóm: ${item.category}
Câu hỏi mẫu: ${item.question}
Câu trả lời chuẩn: ${item.answer}
Từ khóa: ${item.keywords || ""}`;
    })
    .join("\n\n");

  const trainingExamples = getRecentTrainingData(customerMessage);

  const trainingContext = trainingExamples
    .map((item, index) => {
      return `${index + 1}. Câu hỏi khách: ${item.question}
Câu AI từng trả lời: ${item.aiAnswer || ""}
Câu trả lời đã được chỉnh/sử dụng: ${item.humanAnswer}`;
    })
    .join("\n\n");

  const finalContext = `
DỮ LIỆU FAQ TỪ GOOGLE SHEET:
${faqContext || "Không tìm thấy FAQ phù hợp."}

DỮ LIỆU TRAINING ĐÃ LƯU:
${trainingContext || "Chưa có dữ liệu training phù hợp."}
`;

  const completion = await deepseek.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: getSystemPrompt(finalContext),
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
        const aiReply = await askDeepSeek(messageText);

        await sendMessage(senderId, aiReply);

        saveConversation({
          facebookId: senderId,
          userMessage: messageText,
          aiAnswer: aiReply,
        });

        saveTrainingData({
          question: messageText,
          aiAnswer: aiReply,
        });

        console.log("AI trả lời:", aiReply);
      } catch (error) {
        console.error("Lỗi:", error.response?.data || error.message);

        const fallbackMessage =
          "Dạ em đã nhận được tin nhắn ạ. Anh/chị cho em xin số điện thoại để tư vấn viên hỗ trợ chi tiết hơn nhé.";

        saveConversation({
          facebookId: senderId,
          userMessage: messageText,
          aiAnswer: fallbackMessage,
        });

        saveTrainingData({
          question: messageText,
          aiAnswer: fallbackMessage,
        });

        await sendMessage(senderId, fallbackMessage);
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
