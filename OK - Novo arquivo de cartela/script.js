//const API_BASE_URL = 'http://localhost:3001';
//const WS_URL = 'ws://localhost:3001';

// acre
//const API_BASE_URL = 'http://192.168.0.5:3001';
//const WS_URL = 'ws://192.168.0.5:3001';

const API_BASE_URL = 'http://192.168.1.132:3001';
const WS_URL = 'ws://192.168.1.132:3001';

const backendVersionElement = document.getElementById('backend-version');
const frontendVersionElement = document.getElementById('frontend-version');
const loader = document.getElementById('loader');

const numberGrid = document.getElementById('number-grid');
const mobileNumberGrid = document.getElementById('mobile-number-grid');

const prizeInfoContainer = document.getElementById('prize-info');
const prizeValuesContainer = document.getElementById('prize-values');
const mobilePrizeInfoContainer = document.getElementById('mobile-prize-info');
const mobilePrizeValuesContainer = document.getElementById('mobile-prize-values');

const lastRoundElement = document.getElementById('last-round');
const lastOrderElement = document.getElementById('last-order');
const lastBall1 = document.getElementById('last-ball-1');
const lastBall2 = document.getElementById('last-ball-2');
const lastBall3 = document.getElementById('last-ball-3');

const prizeAlert = document.getElementById('prize-alert');
const alertPrizeName = document.getElementById('alert-prize-name');
const alertWinnerCards = document.getElementById('alert-winner-cards');

let ws;
let reconnectInterval = null;
let alertedPrizes = [];

// Funções para manipulação de elementos
function createBallElement(number) {
    const ball = document.createElement('div');
    ball.classList.add('ball');
    ball.textContent = number;
    return ball;
}

function updateNumericPanel(calledNumbers) {
    const allNumbers = document.querySelectorAll('.number-grid-number');
    allNumbers.forEach(numberElement => {
        const number = parseInt(numberElement.textContent, 10);
        if (calledNumbers.includes(number)) {
            numberElement.classList.add('called');
        } else {
            numberElement.classList.remove('called');
        }
    });
}

function displayLastThree(data) {
    lastRoundElement.textContent = data.rodada;
    lastOrderElement.textContent = data.ordem;

    const balls = data.bolas_cantadas;
    lastBall1.textContent = balls.length >= 1 ? balls[balls.length - 1] : '';
    lastBall2.textContent = balls.length >= 2 ? balls[balls.length - 2] : '';
    lastBall3.textContent = balls.length >= 3 ? balls[balls.length - 3] : '';
}

function displayPrizeInfo(prizeName, activeLines) {
    // Versão para desktop
    const desktopTitle = prizeInfoContainer.querySelector('h2');
    if (desktopTitle) {
        desktopTitle.textContent = prizeName;
    }

    // Versão para mobile
    const mobileTitle = mobilePrizeInfoContainer.querySelector('h2');
    if (mobileTitle) {
        mobileTitle.textContent = prizeName;
    } else {
        // Se não encontrar o h2 (como no seu caso), tenta encontrar um span
        const mobileSpan = mobilePrizeInfoContainer.querySelector('span');
        if (mobileSpan) {
            mobileSpan.textContent = prizeName;
        }
    }

    const lines = activeLines.split(',');
    let linesHtml = '';
    lines.forEach(line => {
        linesHtml += `<span>${line.trim()}</span>`;
    });
    prizeValuesContainer.innerHTML = linesHtml;

    // Mobile
    mobilePrizeValuesContainer.innerHTML = linesHtml;
}

function isMobileDevice() {
    return window.innerWidth <= 768;
}

// NOVO: Função para exibir o alerta de prêmio (versão melhorada)
function displayPrizeAlert(prizeName) {
    if (!isMobileDevice()) return;

    if (alertedPrizes.includes(prizeName)) {
        return;
    }

    if (alertTimeout) {
        clearTimeout(alertTimeout);
    }

    alertPrizeName.textContent = prizeName;
    alertWinnerCards.innerHTML = '';

    prizeAlert.classList.remove('hidden');
    void prizeAlert.offsetWidth;
    prizeAlert.classList.add('active');

    alertedPrizes.push(prizeName);

    alertTimeout = setTimeout(() => {
        prizeAlert.classList.remove('active');
        alertTimeout = null;
    }, 5000);
}

// Lógica de processamento de cartelas otimizada
function processCards(cards, calledBalls, prize, activeLines) {
    console.log(`LOG: Processando ${cards.length} cartelas.`);
    const processedCards = [];
    const batchSize = 1000; // Processa 1000 cartelas por vez

    function processBatch(startIndex) {
        let endIndex = startIndex + batchSize;
        if (endIndex > cards.length) {
            endIndex = cards.length;
        }

        for (let i = startIndex; i < endIndex; i++) {
            const card = cards[i];
            let matchedBalls = 0;
            const matchedRows = { 'SUP': 0, 'CEN': 0, 'INF': 0 };

            for (const column of card.em_colunas) {
                for (const number of column) {
                    if (number > 0 && calledBalls.includes(number)) {
                        matchedBalls++;
                        if (column === 0) matchedRows['SUP']++;
                        if (column === 1) matchedRows['CEN']++;
                        if (column === 2) matchedRows['INF']++;
                    }
                }
            }
            
            card.matchedBalls = matchedBalls;
            card.matchedRows = matchedRows;
            processedCards.push(card);
        }

        if (endIndex < cards.length) {
            setTimeout(() => processBatch(endIndex), 0); // Permite que a UI respire
        } else {
            console.log("LOG: Processamento de cartelas concluído.");
            // Aqui você pode chamar a função para exibir os resultados ou winners
            displayWinners(processedCards, prize, activeLines);
        }
    }

    processBatch(0);
}

// Funções para exibir os ganhadores (você precisa implementar essa lógica)
function displayWinners(cards, prize, activeLines) {
    // Sua lógica para encontrar e exibir os ganhadores vai aqui.
    // Use os dados em 'cards' que agora incluem 'matchedBalls' e 'matchedRows'
    // Exemplo:
    // const winners = cards.filter(card => card.matchedBalls >= 15);
    // console.log(`Ganhadores encontrados: ${winners.length}`);
}


// NOVO: Função principal de renderização de conteúdo
function renderMainContent(data) {
    console.log("LOG: Função renderMainContent iniciada.");
    console.log("LOG: Dados recebidos do backend:", data);

    // Esconde o loader e exibe o conteúdo
    loader.style.display = 'none';

    if (data.bolas_cantadas) {
        // Exibe as últimas 3 bolas cantadas e o painel de números
        const lastThreeBalls = data.bolas_cantadas.slice(-3);
        displayLastThree({
            bolas_cantadas: lastThreeBalls,
            rodada: data.ultimo_round,
            ordem: data.bolas_cantadas.length
        });

        // Atualiza a grade de números
        updateNumericPanel(data.bolas_cantadas);

        // Processa as cartelas de forma assíncrona
        if (data.cartelas && data.cartelas.length > 0) {
            processCards(data.cartelas, data.bolas_cantadas, data.premio_buscado, data.linhas_ativas);
        }
    }

    // Exibe a informação do prêmio
    if (data.premio_buscado && data.linhas_ativas) {
        displayPrizeInfo(data.premio_buscado, data.linhas_ativas);
    }
}


// Função para conectar ao WebSocket
function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return;
    }
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    };
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log("LOG: Dados recebidos do backend:", data);
            if (data.type === 'UPDATE') {
                renderMainContent(data);
            }
        } catch (e) {
            console.error('Falha ao processar mensagem do WebSocket:', e);
        }
    };
    ws.onclose = (event) => {
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                connectWebSocket();
            }, 3000);
        }
    };
    ws.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        ws.close();
    };
}


document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM totalmente carregado e analisado.');
    connectWebSocket();
});