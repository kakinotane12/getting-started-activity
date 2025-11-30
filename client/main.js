import './style.css';
import { DiscordSDK } from "@discord/embedded-app-sdk";

// Will eventually need to set up the Discord SDK
// const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const startBtn = document.getElementById('start-btn');
const puzzleText = document.getElementById('puzzle-text');
const chatHistory = document.getElementById('chat-history');
const questionInput = document.getElementById('question-input');
const askBtn = document.getElementById('ask-btn');

startBtn.addEventListener('click', async () => {
  try {
    // 1. 連打防止　ローディング表示
    startBtn.disabled = true;
    startBtn.textContent = "Loading...";

    // 2. ゲーム開始 APIリクエスト
    const response = await fetch('/api/game/start', {
      method: 'POST',
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
    alert('Error starting game. Please try again.');
    startBtn.disabled = false;
    startBtn.textContent = "Start Game";
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
      body: JSON.stringify({ question }),
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