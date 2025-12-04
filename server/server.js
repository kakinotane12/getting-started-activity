import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";
// import cors from 'cors';

dotenv.config({ path: "../.env" });

// puzzles.jsonを読み込む関数
function loadPuzzles() {
  const filePath = path.join(process.cwd(), 'puzzles.json');
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

// 起動時にロード
const PUZZLES = loadPuzzles();

const app = express();
const port = 3001;

// クライアントからのJSONデータを読み取れるようにする
app.use(express.json());

// ② 道具を使って「通行許可証」を発行する
// 「origin: "*"」は「どこから来たリクエストでも通してよし！」という意味
// app.use(cors({ origin: "*" }));

// Gemini APIの初期化　(.envから取得)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 部屋の状態を管理する連想配列
// Key: instanceId (部屋のID), Value: その部屋のゲーム状態
const gameStates = new Map();

app.post("/api/token", async (req, res) => {
  // フロントエンドから送られてきた「code」を使って、Discord公式に「アクセストークン」を要求する
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

  // レスポンスからアクセストークンを取得
  const { access_token } = await response.json();

  // フロントエンドにアクセストークンを返す
  res.send({ access_token });
});


// --- ゲーム開始 API ---
app.post("/api/game/start", async (req, res) => {
  console.log("POST /api/game/start received");
  // クライアントから「部屋ID」を受け取る
  const { instanceId } = req.body;
  if (!instanceId) return res.status(400).json({ error: "Instance ID required" });

  //  すでにプレイ中なら、新しいゲームを開始せずに「既存の状態」を返す
  let currentState = gameStates.get(instanceId);
  if (currentState && currentState.status === "playing") {
    console.log(`Room ${instanceId} is already playing. Joining existing game.`);
    return res.json({
      puzzle: currentState.puzzle,
      history: currentState.history,
      isNewGame: false
    });
  }

  // 新しいゲームを作成
  const randomIndex = Math.floor(Math.random() * PUZZLES.length);
  const selectedPuzzle = PUZZLES[randomIndex];

  // 新しい部屋の状態を保存
  const newState = {
    status: "playing", // 状態を記録
    puzzle: selectedPuzzle.question,
    solution: selectedPuzzle.solution,
    history: []
  };

  gameStates.set(instanceId, newState);
  console.log(`Room ${instanceId} started new game.`);

  // レスポンス：フロントエンドに新しい部屋の状態を返す
  res.json({
    puzzle: newState.puzzle,
    isNewGame: true
  });
});

// --- 質問 API ---
app.post("/api/game/ask", async (req, res) => {
  // リクエスト(質問)と部屋IDを受け取る
  const { question, instanceId } = req.body;
  // その部屋のデータを取得
  const currentState = gameStates.get(instanceId);
  // その部屋でゲームが始まっていなければエラー
  if (!currentState || !currentState.puzzle) {
    return res.status(400).json({ error: "Game not started in this room" });
  }

  // Geminiのモデルを指定
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // Geminiのプロンプトを設定
  const prompt = `
    あなたは「ウミガメのスープ」（水平思考クイズ）のゲームマスターです。
    
    問題: ${currentState.puzzle}
    正解: ${currentState.solution}
    
    プレイヤーの質問: 「${question}」
    
    以下のいずれかで答えてください：
    - 「はい」（答えが肯定の場合）
    - 「いいえ」（答えが否定の場合）
    - 「関係ありません」（質問が正解と無関係、または前提が間違っている場合）
    - 「正解！」（プレイヤーが謎を解いた、または核心を突いた場合）
    
    正解した場合以外は、説明を加えないでください。
  `;

  try {
    // Geminiにプロンプトを送信
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text().trim();

    // ゲームの履歴を更新
    currentState.history.push({ question, answer });
    gameStates.set(instanceId, currentState);

    // レスポンスを返す
    res.json({ answer });
  } catch (error) {
    // エラーを返す
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Failed to get response from AI" });
  }
});

// ポーリング用（状態確認）API
// クライアントが定期的にアクセス
app.post("/api/game/status", (req, res) => {
  const { instanceId } = req.body;
  const state = gameStates.get(instanceId);

  if (!state) {
    return res.json({ status: "waiting", history: [] });
  }

  res.json({
    status: state.status,
    puzzle: state.puzzle,
    history: state.history
  });
});

// サーバーを起動
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});


