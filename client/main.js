import './style.css';
import { DiscordSDK } from "@discord/embedded-app-sdk";

const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const startBtn = document.getElementById('start-btn');
const puzzleText = document.getElementById('puzzle-text');
const chatHistory = document.getElementById('chat-history');
const questionInput = document.getElementById('question-input');
const askBtn = document.getElementById('ask-btn');

// DiscordのアクティビティのインスタンスのIDを起動時に取得しておく
let instanceId = "";
let discordSdk;

// --- 共通関数: 画面切り替え ---
function switchToGameScreen(puzzleTextContent) {
  puzzleText.textContent = puzzleTextContent;
  startScreen.style.display = 'none';
  gameScreen.style.display = 'block';
}

// --- 共通関数: 履歴の描画 ---
// サーバーから受け取った履歴データでチャット欄を書き直す
function renderHistory(history) {
  // 一旦クリア（簡易実装のため毎回書き直します）
  chatHistory.innerHTML = '';

  history.forEach(log => {
    appendMessage(log.question, 'user');
    appendMessage(log.answer, 'ai');
  });
}

async function setupDiscord() {
  try {
    console.log("Setting up Discord SDK...");
    console.log("Client ID:", import.meta.env.VITE_DISCORD_CLIENT_ID);

    // Discord SDKの初期化
    discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
    console.log("Waiting for discordSdk.ready()...");
    await discordSdk.ready();
    console.log("discordSdk.ready() completed");

    // DiscordのアクティビティのインスタンスIDを取得
    instanceId = discordSdk.instanceId;
    console.log("Discord Instance ID from SDK:", instanceId);

    // Discordの個人認証コードを取得
    const { code } = await discordSdk.commands.authorize({
      client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
      response_type: "code",
      state: "",
      prompt: "none",
      scope: ["identify", "guilds"], // 名前とサーバー情報を知りたい
    });
    console.log("Auth Code:", code);

  } catch (e) {
    console.log("Discord SDK setup failed (running locally?)");
    console.error(e);
  }

  // ローカル開発用: instanceIdが取れなかったらランダム生成
  if (!instanceId) {
    instanceId = "local-test-" + Math.random().toString(36).substring(7);
    console.log("Generated local instanceId:", instanceId);
  }
}

// ポーリング処理
function startPolling() {
  // 2秒ごとにサーバーの状態を確認
  setInterval(async () => {
    if (!instanceId) return;

    try {
      const res = await fetch('/api/game/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId })
      });
      const data = await res.json();

      // 1. もし「プレイ中」なのに、自分が「スタート画面」にいたら強制参加
      if (data.status === 'playing' && startScreen.style.display !== 'none') {
        console.log("他のプレイヤーが開始したゲームに参加します");
        switchToGameScreen(data.puzzle);
      }

      // 2. プレイ中なら履歴を同期
      if (data.status === 'playing') {
        renderHistory(data.history);
      }

    } catch (e) {
      console.error("Polling error:", e);
    }
  }, 2000); // 2秒間隔
}

// 初期化中はボタンを無効化
startBtn.disabled = true;
startBtn.textContent = "Initializing...";

setupDiscord().then(async () => {
  console.log("Setup complete, enabling start button");
  startPolling();
  // 初期化時にサーバーの状態を確認
  try {
    const res = await fetch('/api/game/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId })
    });
    const data = await res.json();

    if (data.stataus == 'playing') {
      // ゲームが始まっている場合
      startBtn.textContent = "Join Game";
      switchToGameScreen(data.puzzle);
      renderHistory(data.history);
    } else {
      // ゲームが始まっていない場合
      startBtn.disabled = false;
      startBtn.textContent = "Start Game";
    }
  } catch (e) {
    console.error("Setup failed:", e);
    startBtn.disabled = false;
    startBtn.textContent = "Start Game (Setup Failed)";
  }
}).catch((err) => {
  console.error("Setup failed:", err);
  startBtn.disabled = false;
  startBtn.textContent = "Start Game (Setup Failed)";
});

// スタートボタンの処理
startBtn.addEventListener('click', async () => {
  try {
    // 1. 連打防止　ローディング表示
    startBtn.disabled = true;
    startBtn.textContent = "Loading...";

    console.log("Sending start request with instanceId:", instanceId);

    // 2. ゲーム開始 APIリクエスト
    const response = await fetch('/api/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId: instanceId })
    });

    if (!response.ok) throw new Error('Failed to start game');

    // 3. APIレスポンスを受け取る
    const data = await response.json();

    // 4. 画面を更新
    switchToGameScreen(data.puzzle);
    if (!data.isNewGame && data.history) {
      renderHistory(data.history);
    }

  } catch (error) {
    // 5. エラー処理
    console.error(error);
    // alert('Error starting game. Please try again.'); // Discord内ではalertがブロックされるためコメントアウト
    console.error('Error starting game. Please try again.');
    startBtn.disabled = false;
    startBtn.textContent = "Start Game (Retry)";
  }
});

// 質問送信
async function askQuestion() {
  const question = questionInput.value.trim(); //空白削除
  if (!question) return;

  // 1. ユーザーのメッセージをチャットに追加
  appendMessage(question, 'user');

  // 2. 入力欄をリセット
  // 通信中は操作できないようロック
  questionInput.value = '';
  questionInput.disabled = true;
  askBtn.disabled = true;

  try {
    // 3. サーバーに質問を送信 APIリクエスト
    const response = await fetch('/api/game/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question, instanceId: instanceId })
    });

    if (!response.ok) throw new Error('Failed to get answer');

    // 4. サーバーからAIの回答を受け取る
    const data = await response.json();
    // appendMessage(data.answer, 'ai');

  } catch (error) {
    console.error(error);
    appendMessage('Error: Could not reach the Game Master.', 'ai');
  } finally {
    // 5. 入力欄を復元
    questionInput.disabled = false;
    askBtn.disabled = false;
    questionInput.focus();
  }
}

// 6. イベントリスナー
// 送信ボタンをクリックしたらサーバーに質問を送信
askBtn.addEventListener('click', askQuestion);

// Enterキーを押しても送信
questionInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    askQuestion();
  }
});

// 7. 入力欄にメッセージを追加する
function appendMessage(text, sender) {
  const messageDiv = document.createElement('div');
  // メッセージの送信者によってクラスを変更
  messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
  messageDiv.textContent = text;
  chatHistory.appendChild(messageDiv);
  // スクロールを一番下に
  chatHistory.scrollTop = chatHistory.scrollHeight;
}