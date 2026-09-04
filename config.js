// =================================================================
// 📖 DICIONÁRIO DE TERMOS GLOBAL (WHITE-LABEL / JURÍDICO)
// Compartilhado entre: Cliente, Locutor e Telão
// =================================================================
const DICIONARIO = {
    "LINHA": "KINA",
    "BINGO": "KENO",
    "DUPLO BINGO": "2º KENO",
    "TRIPLO BINGO": "3º KENO",
    "SUPER BINGO": "SUPER KENO",
    "ACUMULADO": "KENO ACUMULADO",
    "3 LINHAS": "3 KINAS",
    "CARTELA": "BILHETE"
};

function t(texto) {
    if (!texto) return "";
    let txt = texto.toString();
    let upper = txt.toUpperCase();
    
    // 1. Tradução Exata
    if (DICIONARIO[upper]) return DICIONARIO[upper];

    // 2. Tradução de Frases Compostas
    let traduzido = txt;
    const chaves = Object.keys(DICIONARIO).sort((a, b) => b.length - a.length);
    
    for (const chave of chaves) {
        const regex = new RegExp(`\\b${chave}\\b`, 'gi');
        traduzido = traduzido.replace(regex, DICIONARIO[chave]);
    }
    return traduzido;
}

// =================================================================
// ⏱️ TEMPORIZADORES E ÁUDIOS ORIGINAIS
// =================================================================
// Temporizadores (em segundos)
const secundsCardsoutId = 8;
const secundsPrizeTimeoutId = 8;
const secundsPromocoesTimeout = 90;
const secundsGifPremiadoTimeout = 6;
const WINNERS_DISPLAY_TIME = 20;    // tempo de apresentação dos Ganhadores

// Som
//const quadraSound = new Audio('/audio/bingo.mp3');
//const linhaSound = new Audio('/audio/linha.mp3');
//const faltaumSound = new Audio('/audio/bingo.mp3');
//const bingoSound = new Audio('/audio/bingo.mp3');
//const duplobingoSound = new Audio('/audio/bingo.mp3');
//const triplobingoSound = new Audio('/audio/bingo.mp3');
//const superSound = new Audio('/audio/bingo.mp3');
//const acumulado = new Audio('/audio/bingo.mp3');

// Volume Audio
//bingoSound.volume = 0.5;