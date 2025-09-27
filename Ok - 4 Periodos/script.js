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

const mobileLastRoundElement = document.getElementById('mobile-last-round');
const mobileLastOrderElement = document.getElementById('mobile-last-order');
const mobileLastBall1 = document.getElementById('mobile-last-ball-1');
const mobileLastBall2 = document.getElementById('mobile-last-ball-2');
const mobileLastBall3 = document.getElementById('mobile-last-ball-3');

const conferencePanelContainer = document.getElementById('conference-panel-container');
const cardNumberElement = document.getElementById('card-number');
const winnerNameElement = document.getElementById('winner-name');
const cardGridElement = document.getElementById('card-grid');

const cartelaInicialInput = document.getElementById('cartela-inicial-input');
const cartelaFinalInput = document.getElementById('cartela-final-input');
const resultadoSomaSpan = document.getElementById('resultado-soma');
const adicionarCartelasBtn = document.getElementById('adicionar-cartelas');
const faixasAdicionadasDiv = document.getElementById('faixas-adicionadas');
const totalCartelasSpan = document.getElementById('total-cartelas');
const validationMessage = document.getElementById('validation-message');

const mobileCartelaInicialInput = document.getElementById('mobile-cartela-inicial-input');
const mobileCartelaFinalInput = document.getElementById('mobile-cartela-final-input');
const mobileResultadoSomaSpan = document.getElementById('mobile-resultado-soma');
const mobileAdicionarCartelasBtn = document.getElementById('mobile-adicionar-cartelas');
const mobileFaixasAdicionadasDiv = document.getElementById('mobile-faixas-adicionadas');
const mobileTotalCartelasSpan = document.getElementById('mobile-total-cartelas');
const mobileValidationMessage = document.getElementById('mobile-validation-message');

const toggleCartelasButton = document.getElementById('toggle-cartelas-button');
const mobileCartelasContent = document.getElementById('mobile-cartelas-content');

const loadedCardsList = document.getElementById('loaded-cards-list');
const mobileLoadedCardsList = document.getElementById('mobile-loaded-cards-list');

const togglePrizesButton = document.getElementById('toggle-prizes-button');
const mobilePrizesContent = document.getElementById('mobile-prizes-content');
const cardRangesDisplay = document.getElementById('card-ranges-display');

// som
const bingoSound = new Audio('bingo.mp3'); 
// Oculta um problema comum em navegadores.
bingoSound.volume = 0.5;

// Variável global para armazenar o ID do temporizador.
let timeoutId = null;
let secundsCardsoutId = 6;   // segundos
// Nova variável para o temporizador do painel de prêmios.
let prizeTimeoutId = null;
let secundsPrizeTimeoutId = 8;   //segundos 

let ws = null;

let reconnectInterval = null;
let cartelaRanges = [];
let loadedCards = [];
let isFetchingCards = false;
let bingoWinners = new Set();

let inputInicial;
let inputFinal;
let resultadoSpan;
let adicionarBtn;
let cardRangeValidation;

let minCartelas = 0;
let maxCartelas = 0;
let cardRanges = [];
let buscando_o_premio = '';
let buscando_a_linha = '';

let ultimaBolaCantada = null;

let wakeLock = null;
const requestWakeLock = async () => {
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('LOG: Bloqueio de ecrã ativado.');

        // Reativa o bloqueio se a página voltar a ficar visível
        wakeLock.addEventListener('release', () => {
            console.log('LOG: Bloqueio de ecrã liberado.');
        });
        document.addEventListener('visibilitychange', handleVisibilityChange);
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
};

const handleVisibilityChange = () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
    }
};

// A função que vai remover o bloqueio
const releaseWakeLock = () => {
    if (wakeLock !== null) {
        wakeLock.release();
        wakeLock = null;
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
};

function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Função para tocar o som
function playBingoSound() {
    // Toca o som do início
    bingoSound.currentTime = 0; 
    bingoSound.play().catch(e => {
        console.error('Erro ao tentar tocar o som:', e);
        // Este erro geralmente acontece porque o navegador bloqueia a reprodução automática.
        // Para resolver, a função play() precisa ser chamada a partir de uma interação do usuário.
        // Ex: um clique num botão.
    });
}

// NOVA FUNÇÃO: Exibe os períodos de cartelas
function displayCardRanges(ranges) {
    if (!cardRangesDisplay) {
        console.error("LOG: Elemento para exibir períodos de cartelas não encontrado.");
        return;
    }

    cardRangesDisplay.innerHTML = '';
    if (ranges && ranges.length > 0) {
        ranges.forEach(range => {
            //  Adiciona a verificação para garantir que ambos os valores são maiores que 0
            if (range.inicial > 0 && range.final > 0) {
                const rangeElement = document.createElement('div');
                rangeElement.className = 'bg-gray-900 text-blue-600 rounded-lg px-3 py-1 text-sm font-medium border border-green-900'
                rangeElement.textContent = `Período em Jogo de ${range.inicial} a ${range.final}`;
                cardRangesDisplay.appendChild(rangeElement);
            }
        });
    }
}

// Função para verificar o tipo de dispositivo e definir a classe no <body>
function checkDeviceType() {
    const isMobile = isMobileDevice();
    if (isMobile) {
        document.body.setAttribute('data-device', 'mobile');
    } else {
        document.body.setAttribute('data-device', 'desktop');
    }
}

// Função para ativar o modo de tela cheia
function goFullscreen() {
    const element = document.documentElement; // Seleciona o elemento <html> para a tela cheia

    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.mozRequestFullScreen) { // Firefox
        element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) { // Chrome, Safari e Opera
        element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) { // IE/Edge
        element.msRequestFullscreen();
    }
}

// Oculta ou exibe o botão com base no modo de tela cheia
function handleFullscreenChange() {
    const fullscreenButton = document.getElementById('fullscreen-button');
    if (document.fullscreenElement) {
        // Se o sistema está em tela cheia, esconde o botão
        fullscreenButton.classList.add('hidden');
    } else {
        // Se o sistema saiu da tela cheia, mostra o botão novamente
        fullscreenButton.classList.remove('hidden');
    }
}
// Adiciona um listener ao botão
const fullscreenButton = document.getElementById('fullscreen-button');
if (fullscreenButton) {
    fullscreenButton.addEventListener('click', goFullscreen);
}
// Adiciona um listener ao documento para o evento de mudança de tela cheia
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('msfullscreenchange', handleFullscreenChange);

function setupCartelasEmJogo(maxCardNumber) {
    const isMobile = isMobileDevice();
    const inputInicial = isMobile ? mobileCartelaInicialInput : cartelaInicialInput;
    const inputFinal = isMobile ? mobileCartelaFinalInput : cartelaFinalInput;
    const resultadoSpan = isMobile ? mobileResultadoSomaSpan : resultadoSomaSpan;
    const adicionarBtn = isMobile ? mobileAdicionarCartelasBtn : adicionarCartelasBtn;

    function validarECalcular() {
        const valorInicial = parseInt(inputInicial.value, 10);
        const valorFinal = parseInt(inputFinal.value, 10);
        if (valorInicial > 0 && valorFinal >= valorInicial) {
           let hasActiveRanges = false;
           if (cardRanges && cardRanges.length > 0) {
              for (const range of cardRanges) {
                   if (range.inicial > 0 && range.final > 0) {
                      hasActiveRanges = true;
                      break;
                   }
              }
           }
    
    // 3. Se houverem períodos de jogo ativos, valida a entrada do usuário contra eles
           let isInputRangeValid = true;
           if (hasActiveRanges) {
              isInputRangeValid = false;
                 for (const range of cardRanges) {
                       if (valorInicial >= range.inicial && valorFinal <= range.final) {
                          isInputRangeValid = true;
                          break;
                       }
                 }
            }

            if (!isInputRangeValid) {
                resultadoSpan.textContent = '0';
                adicionarBtn.classList.add('hidden');
                cardRangesDisplay.classList.add('blink-animation');
                setTimeout(() => {
                    cardRangesDisplay.classList.remove('blink-animation');
                }, 4000); // 4000 milissegundos = 4 segundos
                return;
             }
            console.error("validade 3 : ", isInputRangeValid);
            const resultado = (valorFinal - valorInicial) + 1;
            resultadoSpan.textContent = resultado;
            adicionarBtn.classList.remove('hidden');
        } else {
            resultadoSpan.textContent = '0';
            adicionarBtn.classList.add('hidden');
           }
        }

        const corrigirValor = (event) => {
        let value = parseInt(event.target.value, 10);
        if (value > maxCardNumber) {
            event.target.value = maxCardNumber;
        }
        validarECalcular();
    };

    inputInicial.addEventListener('input', corrigirValor);
    inputFinal.addEventListener('input', corrigirValor);
    
    inputInicial.addEventListener('input', validarECalcular);
    inputFinal.addEventListener('input', validarECalcular);

    inputInicial.addEventListener('input', startHideTimer);
    inputFinal.addEventListener('input', startHideTimer);
    adicionarBtn.addEventListener('click', () => {
        const valorInicial = parseInt(inputInicial.value, 10);
        const valorFinal = parseInt(inputFinal.value, 10);
        const novaFaixa = { inicial: valorInicial, final: valorFinal };

        const sobreposicao = cartelaRanges.some(faixa =>
            (valorInicial >= faixa.inicial && valorInicial <= faixa.final) ||
            (valorFinal >= faixa.inicial && valorFinal <= faixa.final) ||
            (faixa.inicial >= valorInicial && faixa.inicial <= valorFinal)
        );

        if (sobreposicao) {
            alert('Erro: Esta faixa de cartelas se sobrepõe a uma faixa já adicionada.');
            return;
        }

        const totalCartelasSpanCurrent = isMobile ? mobileTotalCartelasSpan : totalCartelasSpan;
        const novaSoma = parseInt(totalCartelasSpanCurrent.textContent) + ((valorFinal - valorInicial) + 1);


        cartelaRanges.push(novaFaixa);
        displayCartelaRanges();
        fetchAndProcessCards();
        inputInicial.value = '';
        inputFinal.value = '';
        validarECalcular();
    // Inicia/reinicia o temporizador após a interação
        startHideTimer();
    });
}

function displayCartelaRanges() {
    const isMobile = isMobileDevice();
    const faixasDiv = isMobile ? mobileFaixasAdicionadasDiv : faixasAdicionadasDiv;
    const totalSpan = isMobile ? mobileTotalCartelasSpan : totalCartelasSpan;

    faixasDiv.innerHTML = '';
    let total = 0;

    cartelaRanges.forEach((faixa, index) => {
        const numCartelas = (faixa.final - faixa.inicial) + 1;
        total += numCartelas;

        const div = document.createElement('div');
        div.className = 'flex items-center justify-between w-full p-2 bg-gray-800 rounded-lg text-2xl text-gray-400 font-normal';
        div.innerHTML = `
            <span>P${index + 1}: ${faixa.inicial} - ${faixa.final}</span>
            <button class="remover-faixa px-2 py-1 bg-red-800 rounded-md text-xl text-gray-300 font-normal " data-index="${index}">Remover</button>
        `;
        faixasDiv.appendChild(div);
    });

    totalSpan.textContent = total;
    checkTotalCards();

    document.querySelectorAll('.remover-faixa').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);

            const numCartelasRemovidas = (cartelaRanges[index].final - cartelaRanges[index].inicial) + 1;
            const novoTotal = parseInt(totalSpan.textContent) - numCartelasRemovidas;

            if (cartelaRanges.length > 0 && novoTotal < minCartelas) {
                const confirmacao = confirm(`Remover a última faixa de cartelas (${numCartelasRemovidas}) fará com que o total fique abaixo do mínimo exigido de ${minCartelas}. Deseja continuar?`);
                if (!confirmacao) {
                    return;
                }
            }

            cartelaRanges.splice(index, 1);
            displayCartelaRanges();
            fetchAndProcessCards();
        });
    });
}

function checkTotalCards(total) {
    const isMobile = isMobileDevice();
    const validationMessageCurrent = isMobile ? mobileValidationMessage : validationMessage;

    // Reseta a mensagem de validação
    validationMessageCurrent.textContent = '';
    validationMessageCurrent.classList.add('hidden');

    // 1. Verifica se o valor é um número válido e maior que zero
    if (isNaN(total) || total <= 0) {
//        validationMessageCurrent.textContent = "A quantidade de cartelas deve ser um número válido e maior que 0.";
//        validationMessageCurrent.classList.remove('hidden');
        return; // Para a execução da função aqui
    }

    // 2. Verifica se o total está abaixo do mínimo exigido
    if (total < minCartelas) {
        validationMessageCurrent.textContent = `Atenção: A quantidade de cartelas (${total}) está abaixo do mínimo exigido (${minCartelas}).`;
        validationMessageCurrent.classList.remove('hidden');
        return; // Para a execução da função aqui
    }

    // 3. Verifica se o total está acima do máximo exigido
    if (total > maxCartelas) {
        validationMessageCurrent.textContent = `Atenção: A quantidade de cartelas (${total}) excede o máximo permitido (${maxCartelas}).`;
        validationMessageCurrent.classList.remove('hidden');
        return; // Para a execução da função aqui
    }
}

async function fetchAndProcessCards() {
    if (isFetchingCards) return;
    isFetchingCards = true;
    const isMobile = isMobileDevice();
    const totalSpan = isMobile ? mobileTotalCartelasSpan : totalCartelasSpan;
    const validationMessageCurrent = isMobile ? mobileValidationMessage : validationMessage;

    const total = parseInt(totalSpan.textContent);

    if (total < minCartelas || total > maxCartelas) {
        if (cartelaRanges.length > 0) {
            validationMessageCurrent.textContent = `Erro: O total de cartelas (${total}) está fora do intervalo permitido (${minCartelas} - ${maxCartelas}). O processamento foi interrompido.`;
            validationMessageCurrent.classList.remove('hidden');
        }
        loadedCards = [];
        displayLoadedCards([]);
        isFetchingCards = false;
        return;
    } else {
        validationMessageCurrent.classList.add('hidden');
    }

    if (cartelaRanges.length === 0) {
        loadedCards = [];
        displayLoadedCards([]);
        isFetchingCards = false;
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/cartelas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ranges: cartelaRanges })
        });

        if (!response.ok) {
            throw new Error(`Falha ao buscar as cartelas. Status: ${response.status}`);
        }

        const cards = await response.json();

        if (cards.length === 0) {
            validationMessageCurrent.textContent = 'Nenhuma cartela encontrada na faixa selecionada. Por favor, verifique os números e tente novamente.';
            validationMessageCurrent.classList.remove('hidden');
            loadedCards = [];
            displayLoadedCards([]);
            isFetchingCards = false;
            return;
        }

        const initialData = await fetchDataFromCollections();
        const premioBuscadoAPI = initialData.buscandoData[0]?.buscando_o_premio || '';
        const premioBuscadoNormalized = premioBuscadoAPI.replace(/\s+/g, '').trim();

        processCards(cards, initialData.bolasData[0]?.bolas_cantadas || [], premioBuscadoNormalized, initialData.buscandoData[0]?.buscando_a_linha || '');
        
        validationMessageCurrent.classList.add('hidden');
    } catch (error) {
        console.error("Erro ao buscar e processar cartelas:", error);
        validationMessageCurrent.textContent = `Erro ao carregar cartelas. Detalhes: ${error.message}. Verifique a conexão com o servidor e tente novamente.`;
        validationMessageCurrent.classList.remove('hidden');
    } finally {
        isFetchingCards = false;
    }
}

function processCards(cards, bolasCantadas, premioBuscado, linhasAtivas) {
    const processedCards = [];
    
    if (premioBuscado === 'BINGO') {
        bingoWinners.clear();
    }
    
    const isMultiLinePrize = premioBuscado.includes('LINHA') && linhasAtivas;
    const activeLinesArray = isMultiLinePrize ? linhasAtivas.split(',') : [];

    cards.forEach(card => {
        let emOrdem = card.em_ordem;
        let superior = card.superior;
        let central = card.central;
        let inferior = card.inferior;

        if (typeof emOrdem === 'string' && emOrdem) emOrdem = emOrdem.split(',').map(Number);
        if (typeof superior === 'string' && superior) superior = superior.split(',').map(Number);
        if (typeof central === 'string' && central) central = central.split(',').map(Number);
        if (typeof inferior === 'string' && inferior) inferior = inferior.split(',').map(Number);
        
        if (typeof emOrdem !== 'object' && !Array.isArray(emOrdem)) emOrdem = [];
        if (typeof superior !== 'object' && !Array.isArray(superior)) superior = [];
        if (typeof central !== 'object' && !Array.isArray(central)) central = [];
        if (typeof inferior !== 'object' && !Array.isArray(inferior)) inferior = [];

        let count = {
            geral: 0,
            superior: 0,
            central: 0,
            inferior: 0
        };

        bolasCantadas.forEach(bola => {
            if (emOrdem.includes(bola)) { count.geral++; }
            if (superior.includes(bola)) { count.superior++; }
            if (central.includes(bola)) { count.central++; }
            if (inferior.includes(bola)) { count.inferior++; }
        });

        if (premioBuscado.includes('BINGO') && count.geral === 15) {
            bingoWinners.add(card.cartao);
        }

        if (isMultiLinePrize) {
            const lines = [
                { id: 'Sup', numbers: superior, count: count.superior },
                { id: 'Cen', numbers: central, count: count.central },
                { id: 'Inf', numbers: inferior, count: count.inferior }
            ];
            
            lines.forEach(line => {
                if (activeLinesArray.includes(line.id)) {
                    let premioEncontradoLinha = null;
                    if (line.count === 5) {
                        premioEncontradoLinha = 'LINHA'; 
                        playBingoSound()
                    }

                    processedCards.push({
                        cartao: card.cartao,
                        linhaId: line.id,
                        counts: { geral: count.geral, linha: line.count },
                        premioEncontrado: premioEncontradoLinha,
                        originalData: {
                            geral: emOrdem,
                            linha: line.numbers
                        },
                        missingNumbers: line.numbers.filter(num => !bolasCantadas.includes(num))
                    });
                }
            });
        } else if (premioBuscado.includes('QUADRA') || premioBuscado.includes('LINHA')) {
            const lines = [
                { id: 'Sup', numbers: superior, count: count.superior },
                { id: 'Cen', numbers: central, count: count.central },
                { id: 'Inf', numbers: inferior, count: count.inferior }
            ];
            
            lines.forEach(line => {
                let premioEncontradoLinha = null;
                if (premioBuscado.includes('QUADRA') && line.count === 4) {
                    premioEncontradoLinha = 'Q U A D R A';
                    playBingoSound();
                } else if (premioBuscado.includes('LINHA') && line.count === 5) {
                    premioEncontradoLinha = 'L I N H A';
                    playBingoSound();
                }
                
                processedCards.push({
                    cartao: card.cartao,
                    linhaId: line.id,
                    counts: { geral: count.geral, linha: line.count },
                    premioEncontrado: premioEncontradoLinha,
                    originalData: {
                        geral: emOrdem,
                        linha: line.numbers
                    },
                    missingNumbers: line.numbers.filter(num => !bolasCantadas.includes(num))
                });
            });
        } else {
            let premioEncontrado = null;
            if (premioBuscado.includes('DUPLOBINGO') && count.geral === 15) {
                premioEncontrado = 'DUPLO BINGO';
                playBingoSound();
            } else if (premioBuscado.includes('TRIPLO BINGO') && count.geral === 15) {
                premioEncontrado = 'TRIPLO BINGO';
                playBingoSound();
            } else if (premioBuscado.includes('BINGO') && count.geral === 15) {
                premioEncontrado = 'B I N G O';
                playBingoSound();
            } else if (premioBuscado.includes('FALTAUM') && count.geral === 14) {
                premioEncontrado = 'FALTA UM';
                playBingoSound();
            }

            processedCards.push({
                cartao: card.cartao,
                linhaId: null,
                counts: { geral: count.geral },
                premioEncontrado: premioEncontrado,
                originalData: {
                    geral: emOrdem
                },
                missingNumbers: emOrdem.filter(num => !bolasCantadas.includes(num))
            });
        }
    });

    if (premioBuscado.includes('DUPLOBINGO')) {
        loadedCards = processedCards.filter(card => !bingoWinners.has(card.cartao));
    } else {
        loadedCards = processedCards;
    }

    if (premioBuscado.includes('QUADRA') || premioBuscado.includes('LINHA')) {
        loadedCards.sort((a, b) => b.counts.linha - a.counts.linha);
    } else {
        loadedCards.sort((a, b) => b.counts.geral - a.counts.geral);
    }
    
    displayLoadedCards(bolasCantadas);
}

function recalculateAndDisplayCards(bolasCantadas, premioBuscado, linhasAtivas) {
    if (!loadedCards || loadedCards.length === 0) {
        return;
    }
    const normalizedPremioBuscado = premioBuscado.replace(/\s+/g, '').trim();

    const isMultiLinePrize = normalizedPremioBuscado.includes('LINHA') && linhasAtivas;
    const activeLinesArray = isMultiLinePrize ? linhasAtivas.split(',') : [];

    loadedCards.forEach(card => {
        let premioEncontrado = null;
        let sourceNumbers = [];
        let missingNumbers = [];
        
        if (isMultiLinePrize) {
            if (activeLinesArray.includes(card.linhaId)) {
                let count = 0;
                card.originalData.linha.forEach(num => {
                    if (bolasCantadas.includes(num)) {
                        count++;
                    }
                });
                card.counts.linha = count;
                card.counts.geral = bolasCantadas.filter(bola => card.originalData.geral.includes(bola)).length;
                sourceNumbers = card.originalData.linha;
                missingNumbers = sourceNumbers.filter(num => !bolasCantadas.includes(num));

                if (count === 5) {
                    premioEncontrado = 'LINHA';
                    playBingoSound();
                }
            }
        }
        else if (normalizedPremioBuscado.includes('QUADRA') || normalizedPremioBuscado.includes('LINHA')) {
            let count = 0;
            card.originalData.linha.forEach(num => {
                if (bolasCantadas.includes(num)) {
                    count++;
                }
            });
            card.counts.linha = count;
            card.counts.geral = bolasCantadas.filter(bola => card.originalData.geral.includes(bola)).length;
            sourceNumbers = card.originalData.linha;
            missingNumbers = sourceNumbers.filter(num => !bolasCantadas.includes(num));
            
            if (normalizedPremioBuscado.includes('QUADRA') && count === 4) {
                premioEncontrado = 'Q U A D R A';
                playBingoSound();
            } else if (normalizedPremioBuscado.includes('LINHA') && count === 5) {
                premioEncontrado = 'L I N H A';
                playBingoSound();
            }
        } else {
            let count = 0;
            card.originalData.geral.forEach(num => {
                if (bolasCantadas.includes(num)) {
                    count++;
                }
            });
            card.counts.geral = count;
            sourceNumbers = card.originalData.geral;
            missingNumbers = sourceNumbers.filter(num => !bolasCantadas.includes(num));
            
            if (normalizedPremioBuscado.includes('DUPLOBINGO') && count === 15) {
                premioEncontrado = 'DUPLO BINGO';
                playBingoSound();
            } else if (normalizedPremioBuscado.includes('TRIPLO BINGO') && count === 15) {
                premioEncontrado = 'TRIPLO BINGO';
                playBingoSound();
            } else if (normalizedPremioBuscado.includes('BINGO') && count === 15) {
                premioEncontrado = 'B I N G O';
                playBingoSound();
            } else if (normalizedPremioBuscado.includes('FALTAUM') && count === 14) {
                premioEncontrado = 'FALTA UM';
                playBingoSound();
            }
        }

        card.premioEncontrado = premioEncontrado;
        card.missingNumbers = missingNumbers;
    });

    if (normalizedPremioBuscado.includes('QUADRA') || normalizedPremioBuscado.includes('LINHA')) {
        loadedCards.sort((a, b) => b.counts.linha - a.counts.linha);
    } else {
        loadedCards.sort((a, b) => b.counts.geral - a.counts.geral);
    }
    
    displayLoadedCards(bolasCantadas);
}

function displayLoadedCards(bolasCantadas) {
    loader.style.display = 'none';
    const isMobile = isMobileDevice();
    const cardsList = isMobile ? mobileLoadedCardsList : loadedCardsList;
    
    cardsList.innerHTML = '';
    
    const isLinePrize = buscando_o_premio.includes('QUADRA') || buscando_o_premio.includes('LINHA');
    const isMultiLinePrize = isLinePrize && !!buscando_a_linha;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'flex justify-between w-full p-2 bg-gray-800 rounded-t-lg text-gray-300 font-bold mb-1';
    
    let headerText = 'Cartelas com Maior Pontuação';
    if (isMultiLinePrize) {
        headerText = `Faltantes (${buscando_a_linha.replace(/,/g, ' & ')})`;
    } else if (isLinePrize) {
        headerText = 'Números Faltantes (Linha)';
    } else {
        headerText = 'Números Faltantes (Cartela)';
    }

    headerDiv.innerHTML = `
        <span class="w-1/4">Cartela</span>
        <span class="w-3/4 text-right">${headerText}</span>
    `;
    cardsList.appendChild(headerDiv);

    const fragment = document.createDocumentFragment();
    const cardsToDisplay = loadedCards.filter(card => card.premioEncontrado || card.missingNumbers.length > 0);

    if (cardsToDisplay.length === 0) {
        const p = document.createElement('p');
        p.className = 'text-white text-center';
        p.textContent = 'Nenhuma cartela carregada ou com números faltantes.';
        fragment.appendChild(p);
    } else {
        cardsToDisplay.forEach(card => {
            const formattedCardNumber = String(card.cartao);
            
            const cardDiv = document.createElement('div');
            cardDiv.className = 'flex h-8 w-full p-0 bg-transparent rounded-lg text-white font-medium mb-0';
            cardDiv.setAttribute('data-card-number', card.cartao);
            
            if (isLinePrize) {
                cardDiv.setAttribute('data-line-id', card.linhaId);
            }

            const cardLabelHtml = isLinePrize
                ? `<div class="flex-shrink-0 flex gap-1"><span class="w-14 p-2 bg-gray-700 rounded-lg text-center font-bold">${formattedCardNumber}</span><span class="w-10 p-2 bg-gray-800 rounded-lg text-center font-bold">${card.linhaId}</span></div>`
                : `<div class="flex-shrink-0 p-2 bg-gray-700 rounded-lg text-center font-bold w-14"><span>${formattedCardNumber}</span></div>`;

            cardDiv.innerHTML = cardLabelHtml;

            const numbersContainer = document.createElement('div');
            if (card.premioEncontrado) {
               numbersContainer.className = 'flex-1 ml-2 p-0  bg-gray-900 rounded-lg flex flex-wrap gap-1 justify-start';

                const premioTexto = card.premioEncontrado === 'DUPLO BINGO' ? 'DUPLO BINGO' : card.premioEncontrado;
                const premioSpan = document.createElement('span');
                premioSpan.className = 'text-xl bg-red-500 text-white font-bold w-full text-center p-2 rounded-lg animate-blink-red-white';
                premioSpan.textContent = premioTexto;
                numbersContainer.appendChild(premioSpan);
                numbersContainer.classList.add('items-center', 'justify-center');
            } else {
               numbersContainer.className = 'flex-1 ml-2 p-0 bg-transparent rounded-lg flex h-8 flex-wrap gap-1 justify-start';
 
               const missingNumbers = card.missingNumbers || [];
                
                missingNumbers.forEach((num, index) => {
                    const numberSpan = document.createElement('span');
                    
                    let bgColorClass = 'bg-blue-700';
                    if (index === 0) {
                        bgColorClass = 'bg-green-700';
                    } else if (index === 1 || index === 2) {
                        bgColorClass = 'bg-orange-700';
                    }
                    
                    const numberClass = `p-4 rounded-lg text-white font-bold ${bgColorClass} text-sm w-8 h-6 flex items-center justify-center flex-shrink-0`;
                    numberSpan.className = numberClass;
                    numberSpan.textContent = num;
                    numbersContainer.appendChild(numberSpan);
                });
            }

            cardDiv.appendChild(numbersContainer);
            fragment.appendChild(cardDiv);
        });
    }

    cardsList.appendChild(fragment);
}

function showMessage(message, type = 'error') {
    const colorClass = type === 'error' ? 'text-red-500' : 'text-blue-500';
    loader.innerHTML = `<span class="text-xl font-medium ${colorClass}">${message}</span>`;
    loader.style.display = 'flex';
}

function createNumberPanel() {
    const isMobile = isMobileDevice();
    const gridToUse = isMobile ? mobileNumberGrid : numberGrid;
    
    for (let i = 1; i <= 90; i++) {
        const numberDiv = document.createElement('div');
        numberDiv.id = `ball-${i}`;
        numberDiv.textContent = i;
        // A linha abaixo agora define a cor escura
        numberDiv.className = 'flex items-center justify-center h-8 w-8 text-sm font-medium rounded-full bg-black text-gray-900 transition-colors duration-300';
        gridToUse.appendChild(numberDiv);
    }
}

function clearPanels() {
    updateNumericPanel([]);
    
    const isMobile = isMobileDevice();
    const loadedCardsListCurrent = isMobile ? mobileLoadedCardsList : loadedCardsList;
    const faixasDiv = isMobile ? mobileFaixasAdicionadasDiv : faixasAdicionadasDiv;
    const totalSpan = isMobile ? mobileTotalCartelasSpan : totalCartelasSpan;
    const lastRound = isMobile ? mobileLastRoundElement : lastRoundElement;
    const lastOrder = isMobile ? mobileLastOrderElement : lastOrderElement;
    const ball1 = isMobile ? mobileLastBall1 : lastBall1;
    const ball2 = isMobile ? mobileLastBall2 : lastBall2;
    const ball3 = isMobile ? mobileLastBall3 : lastBall3;
    const prizeInfo = isMobile ? mobilePrizeInfoContainer : prizeInfoContainer;
    const prizeValues = isMobile ? mobilePrizeValuesContainer : prizeValuesContainer;
    const cartelaInicial = isMobile ? mobileCartelaInicialInput : cartelaInicialInput;
    const cartelaFinal = isMobile ? mobileCartelaFinalInput : cartelaFinalInput;
    const resultadoSoma = isMobile ? mobileResultadoSomaSpan : resultadoSomaSpan;

    loadedCardsListCurrent.innerHTML = `<p class="text-white text-center">Nenhuma cartela carregada.</p>`;
    prizeValues.innerHTML = '';
    conferencePanelContainer.classList.remove('flex');
    conferencePanelContainer.classList.add('hidden');
    cardNumberElement.textContent = 'Aguardando...';
    winnerNameElement.textContent = 'O Próximo será Seu!';
    cardGridElement.innerHTML = '';
    lastRound.textContent = '...';
    lastOrder.textContent = '...';
    ball1.textContent = '';
    ball2.textContent = '';
    ball3.textContent = '';
    
    cartelaRanges = [];
    loadedCards = [];
    bingoWinners.clear();
    ultimaBolaCantada = null;
    buscando_o_premio = '';
    buscando_a_linha = '';
    faixasDiv.innerHTML = '';
    totalSpan.textContent = '0';
    cartelaInicial.value = '';
    cartelaFinal.value = '';
    resultadoSoma.textContent = '0';
    if (isMobile) {
        mobileCartelasContent.classList.add('hidden');
        mobilePrizesContent.classList.add('hidden');
        toggleCartelasButton.textContent = 'Apresentar Painel';
        togglePrizesButton.textContent = 'Apresentar Prêmios';
    }    
    displayPrizeInfo([{ buscando_o_premio: null }]);
}

function updateNumericPanel(bolasCantadas) {
    const isMobile = isMobileDevice();
    const gridToUse = isMobile ? mobileNumberGrid : numberGrid;

    document.querySelectorAll(`#${gridToUse.id} > div`).forEach(div => {
        div.classList.remove('text-green-800', 'text-red-700');
        div.classList.add('text-gray-900');
    });

    if (Array.isArray(bolasCantadas) && bolasCantadas.length > 0) {
        bolasCantadas.forEach(bola => {
            const numberDiv = gridToUse.querySelector(`#ball-${bola}`);
            if (numberDiv) {
                numberDiv.classList.remove('text-gray-900');
                numberDiv.classList.add('text-green-800');
            }
        });
        const lastBall = bolasCantadas[bolasCantadas.length - 1];
        const lastBallDiv = gridToUse.querySelector(`#ball-${lastBall}`);
        if (lastBallDiv) {
            lastBallDiv.classList.remove('text-green-800');
            lastBallDiv.classList.add('text-red-700');
        }
    }
}

function displayLastThree(bolasData) {
    const isMobile = isMobileDevice();
    const lastRound = isMobile ? mobileLastRoundElement : lastRoundElement;
    const lastOrder = isMobile ? mobileLastOrderElement : lastOrderElement;
    const balls = isMobile ? [mobileLastBall1, mobileLastBall2, mobileLastBall3] : [lastBall1, lastBall2, lastBall3];

    lastRound.textContent = '...';
    lastOrder.textContent = '...';
    balls.forEach(ball => ball.textContent = '');

    if (bolasData && typeof bolasData === 'object' && Array.isArray(bolasData.bolas_cantadas)) {
        const bolasCantadas = bolasData.bolas_cantadas;
        const lastThree = bolasCantadas.slice(-3).reverse();

        lastRound.textContent = bolasData.rodada || 'N/A';
        lastOrder.textContent = bolasData.ordem === 0 || bolasData.ordem ? bolasData.ordem : '0';

        for (let i = 0; i < 3; i++) {
            if (lastThree[i]) {
                balls[i].textContent = lastThree[i];
                balls[i].classList.remove('bg-gray-300', 'text-gray-800');
                if (i === 0) {
                    balls[i].classList.add('bg-red-700', 'text-gray-300');
                } else {
                    balls[i].classList.add('bg-green-800', 'text-gray-300');
                }
            } else {
                balls[i].classList.add('bg-gray-300', 'text-gray-800');
            }
        }
    } else {
        lastOrder.textContent = '0';
    }
}

function displayPrizeInfo(buscandoData) {
    const isMobile = isMobileDevice();
    const prizeInfoContainerCurrent = isMobile ? mobilePrizeInfoContainer : prizeInfoContainer;
    
    prizeInfoContainerCurrent.innerHTML = '';
    const prizeItem = document.createElement('span');
    prizeItem.className = 'text-3xl text-gray-200 font-semibold';
    const buscandoValue = buscandoData && buscandoData.length > 0 ? buscandoData[0].buscando_o_premio : null;
    
    if (!buscandoValue || buscandoValue.toString().trim().toLowerCase() === 'null' || buscandoValue.trim() === '') {
        prizeItem.innerHTML = '. . .';
    } else {
        prizeItem.innerHTML = buscandoValue;
    }
    prizeInfoContainerCurrent.appendChild(prizeItem);
}

function displayPrizeValues(premioData, topeData = null) {
    const isMobile = isMobileDevice();
    const prizeValuesContainerCurrent = isMobile ? mobilePrizeValuesContainer : prizeValuesContainer;
    
    prizeValuesContainerCurrent.innerHTML = '';
    
    if (premioData && Array.isArray(premioData) && premioData.length > 0) {
        const validPrizes = premioData.filter(premio => {
            const cleanedValue = premio.valor.toString().replace('R$', '').replace('.', '').trim();
            const numericValue = parseFloat(cleanedValue.replace(',', '.'));
            return numericValue > 0 && !isNaN(numericValue);
        });
        
        if (validPrizes.length === 0) {
            const defaultMessage = document.createElement('span');
            defaultMessage.className = 'text-lg text-white';
            defaultMessage.textContent = 'Nenhum prêmio cadastrado.';
            prizeValuesContainerCurrent.appendChild(defaultMessage);
            return;
        }

        const prizeOrder = ['QUADRA', 'LINHA', '3 LINHAS', 'FALTA 1', 'BINGO', 'DUPLO BINGO', 'TRIPLO BINGO', 'SUPER BINGO', 'ACUMULADO'];

        validPrizes.sort((a, b) => {
            const indexA = prizeOrder.indexOf(a.tipo_premio);
            const indexB = prizeOrder.indexOf(b.tipo_premio);
            
            const aIsValid = indexA > -1;
            const bIsValid = indexB > -1;

            if (aIsValid && !bIsValid) return -1;
            if (!aIsValid && !bIsValid) return 1;
            if (!aIsValid && !bIsValid) return 0;
            
            return indexA - indexB;
        });

        validPrizes.forEach(premio => {
            let prizeText = `${premio.tipo_premio}: ${premio.valor}`;
            
            if (topeData && topeData.length > 0) {
                const currentTopeData = topeData[0];
                if (premio.tipo_premio.includes('SUPER BINGO') && currentTopeData.bola_tope_sb) {
                    prizeText += ` (TOPE: ${currentTopeData.bola_tope_sb})`;
                } else if (premio.tipo_premio.includes('ACUMULADO') && currentTopeData.bola_tope_ac) {
                    prizeText += ` (TOPE: ${currentTopeData.bola_tope_ac})`;
                }
            }

            const prizeItem = document.createElement('div');
            prizeItem.className = 'text-lg text-white font-medium text-center';
            prizeItem.textContent = prizeText;
            prizeValuesContainerCurrent.appendChild(prizeItem);
        });
    } else {
        const defaultMessage = document.createElement('span');
        defaultMessage.className = 'text-lg text-white';
        defaultMessage.textContent = 'Nenhum prêmio cadastrado.';
        prizeValuesContainerCurrent.appendChild(defaultMessage);
    }
}

function updateCardHighlighting(bolasCantadas) {
    const lastBall = bolasCantadas[bolasCantadas.length - 1];
    const cardNumbersDivs = cardGridElement.querySelectorAll('.card-number-item');
    cardNumbersDivs.forEach(div => {
        const numeroNaCartela = parseInt(div.textContent, 10);
        div.classList.remove('bg-red-500', 'bg-green-800', 'text-gray-100', 'bg-gray-300', 'text-gray-800');
        if (bolasCantadas.includes(numeroNaCartela)) {
            if (numeroNaCartela === lastBall) {
                div.classList.add('bg-red-500', 'text-gray-100');
            } else {
                div.classList.add('bg-green-800', 'text-gray-100');
            }
        } else {
            div.classList.add('bg-gray-300', 'text-gray-800');
        }
    });
}

function displayCardGrid(numerosString, bolasCantadas) {
    cardGridElement.innerHTML = '';
    let cardHasNumbers = false;
    if (numerosString && typeof numerosString === 'string') {
        const numerosArray = numerosString.match(/.{1,3}/g) || [];
        if (numerosArray.length > 0) {
            cardHasNumbers = true;
            numerosArray.forEach(subtext => {
                const numero = subtext.replace(/[+*]/g, '').trim();
                if (numero) {
                    const numberDiv = document.createElement('div');
                    numberDiv.className = 'card-number-item p-2 bg-gray-300 rounded-lg text-gray-800 font-bold text-2xl text-center';
                    numberDiv.textContent = numero;
                    cardGridElement.appendChild(numberDiv);
                }
            });
        }
    }
    if (!cardHasNumbers) {
        for (let i = 0; i <  15; i++) {
            const placeholderDiv = document.createElement('div');
            placeholderDiv.className = 'card-number-item p-2 bg-gray-300 rounded-lg text-gray-800 font-bold text-2xl text-center';
            placeholderDiv.textContent = '00';
            cardGridElement.appendChild(placeholderDiv);
        }
    }
    updateCardHighlighting(bolasCantadas);
}

function displayConferencePanel(confereData, bolasCantadas) {
    if (confereData && confereData.length > 0 && typeof confereData[0] === 'object') {
        const data = confereData[0];
        const numeroDoCartao = parseInt(data.cartao, 10);
        const nomeDoGanhador = data.ganhador;
        const numerosDaCartela = data.numeros;
        const cartaoValido = !isNaN(numeroDoCartao) && numeroDoCartao > 0;

        if (cartaoValido) {
            conferencePanelContainer.classList.remove('hidden');
            conferencePanelContainer.classList.add('flex');
            cardNumberElement.textContent = numeroDoCartao;
            winnerNameElement.textContent = nomeDoGanhador || 'O Próximo será Seu!';
            displayCardGrid(numerosDaCartela, bolasCantadas);
        } else {
            conferencePanelContainer.classList.remove('flex');
            conferencePanelContainer.classList.add('hidden');
            cardNumberElement.textContent = 'Aguardando...';
            winnerNameElement.textContent = 'O Próximo será Seu!';
            displayCardGrid(null, bolasCantadas);
        }
    } else {
        conferencePanelContainer.classList.remove('flex');
        conferencePanelContainer.classList.add('hidden');
        cardNumberElement.textContent = 'Aguardando...';
        winnerNameElement.textContent = 'O Próximo será Seu!';
        displayCardGrid(null, bolasCantadas);
    }
}

async function fetchDataFromCollections() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/initial-data`);
        if (!response.ok) {
            throw new Error('Falha ao buscar dados iniciais.');
        }
        return await response.json();
    } catch (error) {
        console.error("Erro ao buscar dados iniciais:", error);
        return null;
    }
}

async function renderMainContent(data) {
    if (!data) return;

    const { bolasData, buscandoData, premioData, rodadaData, confereData, topeData } = data;
    
    const bolasCantadas = bolasData && Array.isArray(bolasData) && bolasData.length > 0
        ? bolasData[0].bolas_cantadas : [];
    
    const ultimaBolaDaLista = bolasCantadas.length > 0 ? bolasCantadas[bolasCantadas.length - 1] : null;

    const premioBuscadoDaAPI = buscandoData[0]?.buscando_o_premio.replace(/\s+/g, '').trim() || '';
    const linhasAtivasDaAPI = buscandoData[0]?.buscando_a_linha || '';

    if (premioBuscadoDaAPI !== buscando_o_premio.replace(/\s+/g, '').trim() || linhasAtivasDaAPI !== buscando_a_linha) {
        buscando_o_premio = premioBuscadoDaAPI;
        buscando_a_linha = linhasAtivasDaAPI;
        if (cartelaRanges.length > 0) {
            fetchAndProcessCards();
        } else {
            loadedCards = [];
            displayLoadedCards([]);
        }
    } else if (ultimaBolaDaLista !== ultimaBolaCantada) {
        ultimaBolaCantada = ultimaBolaDaLista;
        if (loadedCards.length > 0) {
            recalculateAndDisplayCards(bolasCantadas, premioBuscadoDaAPI, linhasAtivasDaAPI);
        }
    }
  
    if (data.cardRanges) {
        cardRanges = data.cardRanges;
    }  
    updateNumericPanel(bolasCantadas);
    displayLastThree(bolasData?.[0]);
    displayConferencePanel(confereData, bolasCantadas);
    
    const rodadaState = rodadaData && rodadaData.length > 0 ? rodadaData[0].estado.trim() : null;
    if (rodadaState === 'intervalo') {
        clearPanels();
        return;
    }
 
    // NOVA CHAMADA: Exibe os períodos de cartelas
    if (data.cardRanges) {
        displayCardRanges(data.cardRanges);
    }
   
    displayPrizeInfo(buscandoData);
    displayPrizeValues(premioData, topeData);
    checkTotalCards();
}

async function init() {
    checkDeviceType();
    createNumberPanel();
    showMessage('Carregando dados...');

    try {
        const initialData = await fetchDataFromCollections();
        if (!initialData) {
            showMessage('Não foi possível conectar ao servidor. Verifique se o backend está em execução.', 'error');
            return;
        }

        const versionResponse = await fetch(`${API_BASE_URL}/api/version`);
        const versionData = await versionResponse.json();
        frontendVersionElement.textContent = "1.0.0";
        backendVersionElement.textContent = versionData.version;

        const premioInfo = initialData.premioInfo;
        minCartelas = premioInfo?.minimo_de_cartelas || 0;
        maxCartelas = premioInfo?.maximo_de_cartelas || 0;

        const maxCardNumber = initialData.maxCardNumber || 0;
        setupCartelasEmJogo(maxCardNumber);

        cartelaInicialInput.max = maxCardNumber;
        cartelaFinalInput.max = maxCardNumber;
        cartelaInicialInput.min = 1;

        mobileCartelaInicialInput.max = maxCardNumber;
        mobileCartelaFinalInput.max = maxCardNumber;
        mobileCartelaInicialInput.min = 1;
        mobileCartelasContent.classList.add('hidden');
        mobilePrizesContent.classList.add('hidden');
        toggleCartelasButton.textContent = 'Apresentar Painel';
        togglePrizesButton.textContent = 'Apresentar Prêmios';

        loader.style.display = 'none';
        renderMainContent(initialData);
        connectWebSocket();
    } catch (error) {
        console.error('Erro ao iniciar a aplicação:', error);
        showMessage('Não foi possível conectar ao servidor. Verifique se o backend está em execução.', 'error');
    }
}

function startHideTimer() {
    // Limpa o temporizador anterior, se existir
    if (timeoutId) {
        clearTimeout(timeoutId);
    }

    // Inicia um novo temporizador
    timeoutId = setTimeout(() => {
        const isMobile = isMobileDevice();
        const cartelasContent = isMobile ? mobileCartelasContent : document.getElementById('cartelas-content');
        const toggleButton = isMobile ? toggleCartelasButton : document.getElementById('toggle-cartelas-button-desktop');

        if (cartelasContent) {
            cartelasContent.classList.add('hidden');
            if (toggleButton) {
                toggleButton.textContent = 'Apresentar Painel';
                toggleButton.classList.remove('bg-red-800');
                toggleButton.classList.add('bg-green-light');
            }
        }
    }, secundsCardsoutId * 1000); // x segundos 8 1000
}

function startPrizeHideTimer() {
    // Limpa o temporizador anterior, se existir
    if (prizeTimeoutId) {
        clearTimeout(prizeTimeoutId);
    }
    // Inicia um novo temporizador
    prizeTimeoutId = setTimeout(() => {
        const isMobile = isMobileDevice();
        const prizesContent = isMobile ? mobilePrizesContent : document.getElementById('prizes-content'); // Ajuste o ID se necessário
        const toggleButton = isMobile ? togglePrizesButton : document.getElementById('toggle-prizes-button-desktop'); // Ajuste o ID se necessário

        if (prizesContent) {
            prizesContent.classList.add('hidden');
            if (toggleButton) {
                toggleButton.textContent = 'Apresentar Prêmios';
                toggleButton.classList.remove('bg-red-800'); // Ou a classe que define a cor padrão
                toggleButton.classList.add('bg-green-800'); // Classe para a cor verde
            }
        }
    }, secundsPrizeTimeoutId * 1000); // x segundos * 1000
}

togglePrizesButton.addEventListener('click', () => {
    mobilePrizesContent.classList.toggle('hidden');
    if (mobilePrizesContent.classList.contains('hidden')) {
        // Se o painel for ocultado, cancela qualquer temporizador em execução
        if (prizeTimeoutId) {
            clearTimeout(prizeTimeoutId);
        }
        togglePrizesButton.textContent = 'Apresentar Prêmios';
       togglePrizesButton.classList.remove('bg-red-800'); // Ou a classe que define a cor padrão
        togglePrizesButton.classList.add('bg-green-800');
    } else {
        // Se o painel for exibido, inicia o temporizador
        startPrizeHideTimer();
        togglePrizesButton.textContent = 'Ocultar Prêmios';
        togglePrizesButton.classList.remove('bg-green-800');
        togglePrizesButton.classList.add('bg-red-800'); // Ou a classe que define a cor padrã//o
//        playBingoSound()
    }
});

if (toggleCartelasButton && mobileCartelasContent) {
    toggleCartelasButton.addEventListener('click', () => {
        const isMobile = isMobileDevice();
        const cartelasContent = isMobile ? mobileCartelasContent : document.getElementById('cartelas-content');
        
        // Alterna a visibilidade do painel
        cartelasContent.classList.toggle('hidden');

        if (cartelasContent.classList.contains('hidden')) {
            // Se o painel for ocultado, cancela qualquer temporizador em execução
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            toggleCartelasButton.textContent = 'Apresentar Painel';
            toggleCartelasButton.classList.remove('bg-red-800');
            toggleCartelasButton.classList.add('bg-green-light');
        } else {
            // Se o painel for exibido, inicia o temporizador
            startHideTimer();
            toggleCartelasButton.textContent = 'Ocultar Painel';
            toggleCartelasButton.classList.remove('bg-green-light');
            toggleCartelasButton.classList.add('bg-red-800');
        }
    });
}

// A função que trava a orientação da tela em modo retrato
function lockScreenOrientation() {
    // Verifica se a API de Orientação da Tela é suportada pelo navegador
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait')
            .then(() => {
                console.log("LOG: Orientação de tela travada em modo retrato.");
            })
            .catch((err) => {
                console.error("Erro ao travar a orientação da tela:", err);
            });
    } else {
        console.log("Aviso: A API de Orientação de Tela não é suportada neste navegador.");
    }
}

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
        requestWakeLock(); // <--- Adicione esta linha
    };
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'UPDATE') {
                renderMainContent(data);
            }
        } catch (e) {
            console.error('Falha ao processar mensagem do WebSocket:', e);
        }
    };
    ws.onclose = (event) => {
        releaseWakeLock(); // <--- Adicione esta linha
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

// Adiciona o ouvinte de evento para redimensionamento da janela
window.addEventListener('resize', checkDeviceType);

//document.addEventListener('DOMContentLoaded', init);
document.addEventListener('DOMContentLoaded', () => {
    // Trava a orientação da tela em retrato
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch((err) => {
            console.error("Erro ao travar a orientação da tela:", err);
        });
    }

    // Referencia os elementos de entrada para validação
    inputInicial = document.getElementById('card-initial-input');
    inputFinal = document.getElementById('card-final-input');
    adicionarBtn = document.getElementById('adicionar-cartela');
    resultadoSpan = document.getElementById('resultado');
    cardRangeValidation = document.getElementById('card-range-validation');
    // Chama a sua função de inicialização
    init();
});