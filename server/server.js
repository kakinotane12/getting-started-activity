import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
dotenv.config({ path: "../.env" });

const app = express();
const port = 3001;

// Allow express to parse JSON bodies
// Allow express to parse JSON bodies
app.use(express.json());

// Initialize Gemini API
import { GoogleGenerativeAI } from "@google/generative-ai";

// Access your API key as an environment variable (see "Set up your API key" above)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// In-memory game state (simple version for demonstration)
// In a real app, you'd use a database or at least a map keyed by session/user ID.
let gameState = {
  puzzle: null,
  solution: null,
  history: []
};

const PUZZLES = [
  {
    question: "ある男がバーに入り、水を一杯くださいと言った。バーテンダーは銃を取り出し、男に向けた。男は「ありがとう」と言って出て行った。なぜ？",
    solution: "男はしゃっくりをしていた。バーテンダーが驚かせて止めてくれた。"
  },
  {
    question: "ある男が部屋で首を吊って死んでいた。その下には水たまりがあった。椅子やテーブルはなかった。どうやって死んだ？",
    solution: "彼は氷のブロックの上に立って首を吊り、氷が溶けた。"
  },
  {
    question: "ある女性が夫を撃った。そして彼を5分以上水に沈めた。最後に彼を吊るした。しかし5分後、2人は一緒に外出し、素晴らしいディナーを楽しんだ。どういうこと？",
    solution: "女性は写真家だった。夫の写真を撮影（shoot）し、現像し、乾かすために吊るした（hang）。"
  }
];

app.post("/api/token", async (req, res) => {
  // Exchange the code for an access_token
  const response = await fetch(`https://discord.com/api/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.VITE_DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: req.body.code,
    }),
  });

  // Retrieve the access_token from the response
  const { access_token } = await response.json();

  // Return the access_token to our client as { access_token: "..."}
  res.send({ access_token });
});

app.post("/api/game/start", async (req, res) => {
  // Select a random puzzle
  const randomIndex = Math.floor(Math.random() * PUZZLES.length);
  const selectedPuzzle = PUZZLES[randomIndex];

  gameState = {
    puzzle: selectedPuzzle.question,
    solution: selectedPuzzle.solution,
    history: []
  };

  res.json({ puzzle: gameState.puzzle });
});

app.post("/api/game/ask", async (req, res) => {
  const { question } = req.body;

  if (!gameState.puzzle) {
    return res.status(400).json({ error: "Game not started" });
  }

  // Use Gemini to judge the question
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
    あなたは「ウミガメのスープ」（水平思考クイズ）のゲームマスターです。
    
    問題: ${gameState.puzzle}
    正解: ${gameState.solution}
    
    プレイヤーの質問: 「${question}」
    
    以下のいずれかで答えてください：
    - 「はい」（答えが肯定の場合）
    - 「いいえ」（答えが否定の場合）
    - 「関係ありません」（質問が正解と無関係、または前提が間違っている場合）
    - 「正解！」（プレイヤーが謎を解いた、または核心を突いた場合）
    
    正解した場合以外は、説明を加えないでください。
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text().trim();

    gameState.history.push({ question, answer });
    res.json({ answer });
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Failed to get response from AI" });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
