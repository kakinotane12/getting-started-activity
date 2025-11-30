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
    startBtn.disabled = true;
    startBtn.textContent = "Loading...";

    const response = await fetch('/api/game/start', {
      method: 'POST',
    });

    if (!response.ok) throw new Error('Failed to start game');

    const data = await response.json();

    puzzleText.textContent = data.puzzle;

    startScreen.style.display = 'none';
    gameScreen.style.display = 'block';
  } catch (error) {
    console.error(error);
    alert('Error starting game. Please try again.');
    startBtn.disabled = false;
    startBtn.textContent = "Start Game";
  }
});

async function askQuestion() {
  const question = questionInput.value.trim();
  if (!question) return;

  // Add user message to chat
  appendMessage(question, 'user');
  questionInput.value = '';
  questionInput.disabled = true;
  askBtn.disabled = true;

  try {
    const response = await fetch('/api/game/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) throw new Error('Failed to get answer');

    const data = await response.json();
    appendMessage(data.answer, 'ai');

  } catch (error) {
    console.error(error);
    appendMessage('Error: Could not reach the Game Master.', 'ai');
  } finally {
    questionInput.disabled = false;
    askBtn.disabled = false;
    questionInput.focus();
  }
}

askBtn.addEventListener('click', askQuestion);

questionInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    askQuestion();
  }
});

function appendMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
  messageDiv.textContent = text;
  chatHistory.appendChild(messageDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}