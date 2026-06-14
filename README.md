# FB AI BOT - IELTS Arena

git clone <repo>
cd fb-ai-bot
npm install
cp .env.example .env
mkdir -p data
echo "[]" > data/conversations.json
echo "[]" > data/leads.json
echo "[]" > data/training_data.json
node server.js

---

Bot Facebook Messenger sử dụng:

* Facebook Messenger Webhook
* DeepSeek API
* Google Sheet Knowledge Base
* JSON Local Database

---

# Tài nguyên hệ thống

## Google Sheet Knowledge Base

https://docs.google.com/spreadsheets/d/12WDh3ke4f0hkgIqO2ympsXdtuBWWd6bx/edit?gid=599747906#gid=599747906

## Facebook Developer

https://developers.facebook.com/apps/

## Meta Business

https://business.facebook.com/

## DeepSeek

https://platform.deepseek.com/

## Ngrok

https://dashboard.ngrok.com/

---

# Cấu trúc dự án

```text
fb-ai-bot/
│
├── data/
│   ├── conversations.json
│   ├── leads.json
│   ├── settings.json
│   └── training_data.json
│
├── .env
├── nodemon.json
├── prompts.js
├── README.md
├── package.json
├── package-lock.json
└── server.js
```

---

# Mục đích từng file

## conversations.json

Lưu toàn bộ lịch sử hội thoại.

Ví dụ:

```json
[
  {
    "facebookId": "123456789",
    "userMessage": "Em muốn học IELTS",
    "aiAnswer": "Dạ anh/chị đang muốn học IELTS mục tiêu bao nhiêu ạ?",
    "createdAt": "2026-06-14T10:00:00.000Z"
  }
]
```

---

## training_data.json

Lưu dữ liệu đào tạo AI.

Ví dụ:

```json
[
  {
    "question": "Em muốn học IELTS",
    "aiAnswer": "Bạn cho mình xin thông tin",
    "humanAnswer": "Dạ anh/chị đang muốn học IELTS mục tiêu bao nhiêu ạ?",
    "approved": true
  }
]
```

Nguyên tắc:

* AI trả lời → tự lưu vào file
* approved mặc định = true
* humanAnswer mặc định = aiAnswer
* Nếu câu trả lời chưa hay → sửa humanAnswer
* Nếu câu trả lời quá tệ → xóa record

Bot sẽ học dần từ humanAnswer.

---

## leads.json

Lưu thông tin khách hàng.

Ví dụ:

```json
[
  {
    "facebookId": "123456",
    "phone": "0838464737",
    "status": "NEW",
    "createdAt": "2026-06-14T10:00:00.000Z"
  }
]
```

---

## settings.json

Cấu hình hệ thống.

Ví dụ:

```json
{
  "companyName": "IELTS Arena",
  "collectLead": true,
  "conversationHistoryLimit": 10
}
```

---

# Google Sheet Knowledge Base

Nguồn dữ liệu chính thức của trung tâm.

Bot đọc trực tiếp từ Google Sheet.

Link:

https://docs.google.com/spreadsheets/d/12WDh3ke4f0hkgIqO2ympsXdtuBWWd6bx/edit?gid=599747906#gid=599747906

---

## Cấu trúc dữ liệu

| category | question | answer | keywords | priority | status |
| -------- | -------- | ------ | -------- | -------- | ------ |

Ví dụ:

| category | question          | answer                                                      | keywords                   | priority | status |
| -------- | ----------------- | ----------------------------------------------------------- | -------------------------- | -------- | ------ |
| Khóa học | Em muốn học IELTS | Dạ anh/chị muốn học IELTS mục tiêu bao nhiêu ạ?             | học ielts, đăng ký, tư vấn | 10       | active |
| Học phí  | Học phí bao nhiêu | Dạ học phí phụ thuộc trình độ đầu vào và mục tiêu đầu ra ạ. | học phí, giá, chi phí      | 10       | active |

---

## Ý nghĩa các cột

### category

Nhóm kiến thức.

Ví dụ:

```text
Khóa học
Học phí
Lịch học
Giảng viên
Ưu đãi
Test đầu vào
Cam kết đầu ra
```

---

### question

Câu hỏi mẫu.

Ví dụ:

```text
Em muốn học IELTS
Có test đầu vào không
Học phí bao nhiêu
```

---

### answer

Câu trả lời chuẩn.

---

### keywords

Danh sách từ khóa.

Ngăn cách bằng dấu phẩy.

Ví dụ:

```text
học phí,giá,chi phí,học bao nhiêu tiền
```

---

### priority

Độ ưu tiên.

```text
10 = ưu tiên cao
5 = bình thường
1 = ít dùng
```

---

### status

```text
active
inactive
```

active → Bot sử dụng

inactive → Bot bỏ qua

---

# File .env

```env
PORT=3000

FB_VERIFY_TOKEN=xxxx

FB_PAGE_ACCESS_TOKEN=xxxx

DEEPSEEK_API_KEY=xxxx

GOOGLE_SHEET_ID=xxxx

FAQ_SHEET_GID=xxxx
```

---

# Chạy local

Cài package:

```bash
npm install
```

Chạy:

```bash
node server.js
```

hoặc

```bash
nodemon server.js
```

---

# Ngrok

Chạy:

```bash
ngrok http 3000
```

Ví dụ:

```text
https://abc123.ngrok-free.dev
```

Webhook Facebook:

```text
https://abc123.ngrok-free.dev/facebook/webhook
```

---

# Chuyển sang Mac Mini công ty

## Bước 1

Copy source code.

Có thể:

```bash
git clone ...
```

hoặc copy nguyên folder.

---

## Bước 2

Cài NodeJS

```bash
node -v
npm -v
```

---

## Bước 3

Cài package

```bash
npm install
```

---

## Bước 4

Copy file .env

Bắt buộc.

---

## Bước 5

Chạy bot

```bash
node server.js
```

---

## Bước 6

Mở terminal mới

```bash
ngrok http 3000
```

---

## Bước 7

Copy URL ngrok

Ví dụ:

```text
https://abc123.ngrok-free.dev
```

---

## Bước 8

Cập nhật Webhook Facebook

Messenger API

Webhook URL:

```text
https://abc123.ngrok-free.dev/facebook/webhook
```

Verify Token:

```text
FB_VERIFY_TOKEN
```

---

# Luồng hoạt động

```text
Khách nhắn Facebook
        ↓
Facebook Webhook
        ↓
server.js
        ↓
Google Sheet
        ↓
training_data.json
        ↓
DeepSeek
        ↓
Facebook Messenger
```

---

# Backup dữ liệu

Backup thư mục:

```text
data/
```

Bao gồm:

```text
conversations.json
training_data.json
leads.json
settings.json
```

Khuyến nghị:

* Backup hàng tuần
* Đồng bộ lên Google Drive

---

# Git Ignore

Tạo file:

```gitignore
node_modules
.env
data/conversations.json
data/leads.json
```

Không commit:

* API Key
* Dữ liệu khách hàng
* Lịch sử chat

---

# Roadmap nâng cấp

Giai đoạn 1

```text
Google Sheet
+
DeepSeek
+
training_data.json
```

Giai đoạn 2

```text
Lead Detection
+
Tự động lấy số điện thoại
+
CRM Sync
```

Giai đoạn 3

```text
MongoDB
+
Vector Search
+
Fine Tuning
```

Giai đoạn 4

```text
AI Sales Agent
+
AI Chốt Sale
+
AI Follow Up
```
