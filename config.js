// config.js
// Configurações do seu sistema
// Endereços do Backend

const API_BASE_URL = 'https://orca-app-dp256.ondigitalocean.app';
const WS_URL = 'https://orca-app-dp256.ondigitalocean.app';

//const API_BASE_URL = 'http://localhost:3001';
//const WS_URL = 'ws://localhost:3001';

// acre
//const API_BASE_URL = 'http://38.43.105.229:3001';
//const WS_URL = 'ws://38.43.105.229:3001';

// note p2
//const API_BASE_URL = 'http://192.168.1.147:3001';
//const WS_URL = 'ws://192.168.1.147:3001';

// Ativar Localhost para uso da câmera (Contexto Seguro)
//const API_BASE_URL = 'http://localhost:3001';
//const WS_URL = 'ws://localhost:3001'; 

// Temporizadores (em segundos)
const secundsCardsoutId = 10;
const secundsPrizeTimeoutId = 8;
const secundsPromocoesTimeout = 90;
const secundsGifPremiadoTimeout = 7;

// Som
const quadraSound = new Audio('/audio/bingo.mp3');
const linhaSound = new Audio('/audio/linha.mp3');
const faltaumSound = new Audio('/audio/bingo.mp3');
const bingoSound = new Audio('/audio/bingo.mp3');
const duplobingoSound = new Audio('/audio/bingo.mp3');
const triplobingoSound = new Audio('/audio/bingo.mp3');
const superSound = new Audio('/audio/bingo.mp3');
const acumulado = new Audio('/audio/bingo.mp3');

// Volume Audio
bingoSound.volume = 0.5;

