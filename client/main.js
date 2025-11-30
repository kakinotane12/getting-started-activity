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

// 初期化中はボタンを無効化
startBtn.disabled = true;
startBtn.textContent = "Initializing...";

setupDiscord().then(() => {
  console.log("Setup complete, enabling start button");
  startBtn.disabled = false;
  startBtn.textContent = "Start Game";
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
    puzzleText.textContent = data.puzzle;
    startScreen.style.display = 'none'; //スタート画面を隠す
    gameScreen.style.display = 'block'; //ゲーム画面を表示

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
    appendMessage(data.answer, 'ai');

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