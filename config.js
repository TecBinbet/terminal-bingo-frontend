//const API_BASE_URL = 'https://orca-app-dp256.ondigitalocean.app';
//const WS_URL = 'https://orca-app-dp256.ondigitalocean.app';

// note 
//const API_BASE_URL = 'http://192.168.1.147:3001';
//const WS_URL = 'ws://192.168.1.147:3001';

// Ativar Localhost para uso da câmera (Contexto Seguro)
//const API_BASE_URL = window.location.origin; // 'http://localhost:3001';
//const WS_URL =  window.location.origin; //  'ws://localhost:3001'; 


// 1. Pega o endereço atual do navegador (ex: https://orca-app... ou http://192.168...)
    const API_BASE_URL = window.location.origin; 

    // 2. Define o protocolo do WebSocket (se o site é HTTPS, usa WSS. Se é HTTP, usa WS)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // 3. Monta a URL do WebSocket automaticamente
    const WS_URL = `${protocol}//${window.location.host}`;


// Temporizadores (em segundos)
const secundsCardsoutId = 8;
const secundsPrizeTimeoutId = 8;
const secundsPromocoesTimeout = 90;
const secundsGifPremiadoTimeout = 6;
const WINNERS_DISPLAY_TIME = 20;    // tempo de apresentação dos Ganhadores

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

