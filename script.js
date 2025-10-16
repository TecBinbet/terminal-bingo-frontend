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
const precoSerieElement = document.getElementById('preco-serie');
const lastBall1 = document.getElementById('last-ball-1');
const lastBall2 = document.getElementById('last-ball-2');
const lastBall3 = document.getElementById('last-ball-3');

// ... (após mobileLastBall3, etc.) ...
const youtubePanel = document.getElementById('youtube-panel'); // Já deve existir
const youtubeIframe = document.getElementById('youtube-iframe'); // Já deve existir
const abrirYoutubeBtn = document.getElementById('abrir-youtube-btn'); // Já deve existir

//
let cartelasEmJogo = 0;
// Timer promocionais
let seePromocoes = true; // Controla se o sistema deve verificar e exibir promoções
let promocionalTimer = null; // Armazena a referência do temporizador

let globalPromocionalData = [];

// NOVOS ELEMENTOS:
const salaTitleElement = document.getElementById('sala-title');
let currentVideoUrl = ''; // Variável global para a URL dinâmica

// SE TELA CHEIA
let telaFull = false;

// NOVOS ELEMENTOS PARA O PAINEL PROMOCIONAL
const youtubePlaceholder = document.getElementById('youtube-placeholder'); // Certifique-se de que este elemento existe no seu HTML
const promocionalContainer = document.getElementById('promocional-container');
const promocionalContent = document.getElementById('promocional-content');
const promocionalText = document.getElementById('promocional-text');

const mobileLastRoundElement = document.getElementById('mobile-last-round');
const mobileLastOrderElement = document.getElementById('mobile-last-order');
const mobilePrecoSerieElement = document.getElementById('mobile-preco-serie');
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
const loadedCardsHeader = document.getElementById('loaded-cards-header'); 

const mobileCartelaInicialInput = document.getElementById('mobile-cartela-inicial-input');
const mobileCartelaFinalInput = document.getElementById('mobile-cartela-final-input');
const mobileResultadoSomaSpan = document.getElementById('mobile-resultado-soma');
const mobileAdicionarCartelasBtn = document.getElementById('mobile-adicionar-cartelas');
const mobileFaixasAdicionadasDiv = document.getElementById('mobile-faixas-adicionadas');
const mobileTotalCartelasSpan = document.getElementById('mobile-total-cartelas');
const mobileValidationMessage = document.getElementById('mobile-validation-message');
const mobileLoadedCardsHeader = document.getElementById('mobile-loaded-cards-header'); 

const toggleCartelasButton = document.getElementById('toggle-cartelas-button');
const mobileCartelasContent = document.getElementById('mobile-cartelas-content');

const loadedCardsList = document.getElementById('loaded-cards-list');
const mobileLoadedCardsList = document.getElementById('mobile-loaded-cards-list');

const togglePrizesButton = document.getElementById('toggle-prizes-button');
const mobilePrizesContent = document.getElementById('mobile-prizes-content');
const cardRangesDisplay = document.getElementById('card-ranges-display');

let lastRodadaState = null;

// Sua nova variável global
let ValorSerie = 0;

// Variável global para armazenar o ID do temporizador.
let timeoutId = null;
// Nova variável para o temporizador do painel de prêmios.
let prizeTimeoutId = null;

let ws = null;

let iniciandoRodada = true;
let winnerBingo = false;

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
let bolaBuscandoPremio = 0;
let buscando_a_linha = '';
let cartelaEmJogo = 0;
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
function playPremiadoSound(soundElement) {
    if (!soundElement || typeof soundElement.play !== 'function') {
        console.error('Erro: Elemento de som não fornecido ou inválido.');
        return;
    }
    soundElement.currentTime = 0; 
    soundElement.play().catch(e => {
        console.error('Erro ao tentar tocar o som:', e);
        // Este erro geralmente acontece porque o navegador bloqueia a reprodução automática.
    });
}

function showPremiadoGif(gifFileName) {
    if (!labelPremiado) {
        console.error('Erro: Elemento #labelPremiado não encontrado.');
        return;
    }

    // 1. Monta o caminho do arquivo (Ajuste o '/gifs/' se necessário)
    const gifUrl = `/gifs/${gifFileName}.gif`;
    
    // 2. Aplica os estilos para exibir a imagem
    labelPremiado.style.display = 'block'; // Torna o overlay visível
    labelPremiado.style.backgroundImage = `url('${gifUrl}')`; 
    labelPremiado.style.backgroundSize = 'contain';      // Garante que o GIF se ajuste
    labelPremiado.style.backgroundRepeat = 'no-repeat';  // Não repete a imagem
    labelPremiado.style.backgroundPosition = 'center';   // Centraliza na tela
    
    // OPCIONAL: Oculta o GIF após alguns segundos (ex: 3 segundos)
    setTimeout(hidePremiadoGif, secundsGifPremiadoTimeout * 1000); 
}

function hidePremiadoGif() {
    if (labelPremiado) {
        labelPremiado.style.display = 'none';
        labelPremiado.style.backgroundImage = 'none'; // Limpa a imagem
    }
}

/**
 * Verifica se um recurso existe na URL fornecida usando o método HEAD.
 * @param {string} url O caminho para o recurso (ex: '/gifs/promocional.gif').
 * @returns {Promise<boolean>} Retorna true se o recurso for acessível (status 200/204), false caso contrário.
 */
// A função de verificação permanece correta
async function checkIfFileExists(url) {
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            cache: 'no-store'
        });
        return response.ok;
    } catch (error) {
        console.error("Erro ao tentar verificar o arquivo:", error);
        return false;
    }
}

// 🛑 A função precisa ser 'async' para usar 'await'
async function updatePromocionalPanelPosition() {
    // 🛑 Obtenha o elemento de texto aqui (ou certifique-se que é uma variável global)
    // Assumindo que você usa uma variável global ou que o elemento deve ser obtido:
    const promocionalText = document.getElementById('promocional-text-id'); // 🚨 Substitua pelo ID real se não for global!

    if (!promocionalContainer || !youtubePlaceholder || promocionalContainer.classList.contains('hidden')) {
        return; 
    }

    const content = document.getElementById('promocional-content'); 
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const isYoutubePanelVisible = !youtubePlaceholder.classList.contains('hidden');

    // 1. Definição da Largura Manual (100% da viewport, com 1px de margem de segurança)
    content.style.width = `${windowWidth}px`; 
    content.style.left = '0px'; 
    content.style.right = '0px';
    
    // Reseta propriedades verticais do content
    content.style.height = '';
    content.style.bottom = '';
    
    // ----------------------------------------------------
    // 🚨 Verifica a existência do arquivo e controla a execução
    // ----------------------------------------------------
    const gifUrl = '/gifs/promocional.gif';
    const fileExists = await checkIfFileExists(gifUrl); // Aguarda a resposta

    if (fileExists) {
        // Arquivo existe. Aplica o background.
        content.style.backgroundImage = `url('${gifUrl}?t=${new Date().getTime()}')`;
        // OBS: O texto já foi carregado pela função 'displayPromocionalText',
        // então não precisamos redefinir o innerHTML aqui.
        
    } else {
        // 🛑 Arquivo NÃO existe. Esconde o painel, limpa o fundo e SAI.
        content.style.backgroundImage = 'none'; // Garante que nenhum GIF antigo seja exibido
        promocionalContainer.classList.add('hidden'); // Esconde o painel principal
        if (promocionalText) {
             promocionalText.innerHTML = ''; // Limpa o texto
        }
        
        console.warn(`O arquivo promocional não foi encontrado em: ${gifUrl}. Painel escondido.`);
        
        return; // 🛑 SAI DA FUNÇÃO. Nenhum código de posicionamento será executado.
    }
    // ----------------------------------------------------
    
    // O contêiner principal (#promocional-container) só serve de wrapper fixo.
    // O restante do código de posicionamento SÓ é executado se o GIF existir.

    if (isYoutubePanelVisible) {
        // --- CENÁRIO 1: VÍDEO ATIVO (usa top e bottom para esticar) ---
        let topText = 180;        
        let fonteText = 24;
        if (!telaFull) { 
            topText = 108;
            fonteText = 16;
        }
        const placeholderRect = youtubePlaceholder.getBoundingClientRect();
        
        // TOP: Colado ao bottom do placeholder (posição de viewport)
        const contentTop = placeholderRect.bottom; 
        
        // Define a altura forçando o esticamento
        content.style.top = `${contentTop}px`; 
        content.style.bottom = '0px'; // Estica até o final da tela
        if (promocionalText) {
            promocionalText.style.paddingTop =`${topText}px`;
            promocionalText.style.fontSize =`${fonteText}px`;
        }
    } else {
        // --- CENÁRIO 2: VÍDEO INATIVO (92% da tela total) ---
        let topMargin = 20;
        let percento = 0.92;
        let topText = 250;    

        if (!telaFull) { 
            topMargin = 55;
            topText = 200;
        }    
        const heightPercent = windowHeight * percento;
        // Define a altura manualmente
        content.style.top = `${topMargin}px`; 
        content.style.height = `${heightPercent}px`; 
        if (promocionalText) {
            promocionalText.style.paddingTop =`${topText}px`; 
            promocionalText.style.fontSize = '28px';
        }
    }
}

// NOVO: Função para verificar e exibir a promoção (se houver dados)
function checkAndDisplayPromocionalContent() {
    // 1. Check A: O sistema está autorizado a mostrar a promoção?
    if (!seePromocoes) {
        return; 
    }

    // 2. Check B: Temos dados promocionais válidos para exibir?
    // Verifica se a array não está vazia, o que indica que o server enviou dados.
    const hasPromoData = globalPromocionalData && globalPromocionalData.length > 0;

    if (hasPromoData) {
       
        // *OPCIONAL:* Chame a função que insere o texto no painel aki
        displayPromocionalText(globalPromocionalData);

        if (promocionalContainer.classList.contains('hidden')) {
            promocionalContainer.classList.remove('hidden');
            // Garante que o painel pegue as dimensões corretas (no modo INATIVO)
            updatePromocionalPanelPosition(); 
        }
 //   }  else {
//        if (!promocionalContainer.classList.contains('hidden')) {
//             promocionalContainer.classList.add('hidden');
//         }
    }
}

// NOVO: Inicia ou reseta a contagem regressiva
function startPromocionalTimer() {
    if (promocionalTimer) {
        clearTimeout(promocionalTimer);
    }
    // Inicia um novo temporizador
    promocionalTimer = setTimeout(() => {
        checkAndDisplayPromocionalContent();
    }, secundsPromocoesTimeout * 1000); // Converte segundos para milissegundos
}

// NOVO: Oculta o painel e desativa a visualização de promoções
function hidePromocionalPanel() {
    if (!promocionalContainer.classList.contains('hidden')) {
        promocionalContainer.classList.add('hidden');
    }
    // Desativa a variável global para parar as verificações
    
    // Limpa o timer para evitar que a promoção apareça após o bingo
    if (promocionalTimer) {
        clearTimeout(promocionalTimer);
        promocionalTimer = null;
    }
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

function lockSizeScreen() {
    const isMobileTest = isMobileDevice();
     if (!isMobileTest) {
         return;
     }              
     if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch((err) => {
             console.error("Erro ao travar a orientação da tela:", err);
            });
     }
}  
 
// Oculta ou exibe o botão com base no modo de tela cheia
function handleFullscreenChange() {
    const fullscreenButton = document.getElementById('fullscreen-button');
    if (document.fullscreenElement) {
        // Se o sistema está em tela cheia, esconde o botão
        lockSizeScreen() 
        telaFull = true;
        fullscreenButton.classList.add('hidden');
        if (cartelas_Em_Jogo === 0 && rodadaState === 'intervalo') {
           seePromocoes = true;
           startPromocionalTimer();
        }
    } else {
        // Se o sistema saiu da tela cheia, mostra o botão novamente
        telaFull = false;
        fullscreenButton.classList.remove('hidden');
        if (cartelas_Em_Jogo === 0 && rodadaState === 'intervalo') {
           seePromocoes = true;
           startPromocionalTimer();
        }      
    }
}

// Adiciona um listener ao botão
const fullscreenButton = document.getElementById('fullscreen-button');
if (fullscreenButton) {
    fullscreenButton.addEventListener('click', goFullscreen);
    startPromocionalTimer();
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
            const resultado = (valorFinal - valorInicial) + 1;
            resultadoSpan.textContent = resultado;
            adicionarBtn.classList.remove('hidden');
        } else {
            resultadoSpan.textContent = '0';
            adicionarBtn.classList.add('hidden');           
        }

    };

    const corrigirValor = (event) => {
           let value = parseInt(event.target.value, 10);
           if (value > maxCardNumber) {
               event.target.value = maxCardNumber;           
           }   
        validarECalcular();
     }  

    inputInicial.addEventListener('input', corrigirValor);
    inputFinal.addEventListener('input', corrigirValor);
    
    inputInicial.addEventListener('input', validarECalcular);
    inputFinal.addEventListener('input', validarECalcular);

    inputInicial.addEventListener('input', startHideTimer);
    inputFinal.addEventListener('input', startHideTimer);
    adicionarBtn.addEventListener('click', () => {
        startPromocionalTimer();
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
        const totalSeries = Math.floor(numCartelas / 6);
        const totalSoma = totalSeries *ValorSerie;  
        const totalFormatado = new Intl.NumberFormat('pt-BR', {
             minimumFractionDigits: 2,
             maximumFractionDigits: 2
        }).format(totalSoma);
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between w-full h-8 bg-gray-800 rounded-lg text-xl text-gray-400 text-[16px] font-bold';
        div.innerHTML = `
             <span>${faixa.inicial} a ${faixa.final} = (${totalSeries}) R$ ${totalFormatado }</span>
            <button class="remover-faixa px-2 h-8 bg-red-800 rounded-md text-[14px] text-gray-300 font-normal" data-index="${index}">Remover</button>
        `;
        faixasDiv.appendChild(div);
    });

    totalSpan.textContent = total;
    cartelasEmJogo = total
    checkTotalCards();
    if (total > 0 ) { 
       cartelaEmJogo = total;
       seePromocoes = false; 
       hidePromocionalPanel();
    }
       document.querySelectorAll('.remover-faixa').forEach(button => {
       button.addEventListener('click', (e) => {
            startPromocionalTimer(); 
            const index = parseInt(e.target.dataset.index, 10);
            const numCartelasRemovidas = (cartelaRanges[index].final - cartelaRanges[index].inicial) + 1;
            const novoTotal = parseInt(totalSpan.textContent) - numCartelasRemovidas;

            if (cartelaRanges.length > 0 && novoTotal < minCartelas) {
                const confirmacao = confirm(`Remover a última faixa de cartelas (${numCartelasRemovidas}) fará com que o total fique abaixo do mínimo exigido de ${minCartelas}. Deseja continuar?`);
                 if (!confirmacao) {
                    return;
                }
           }
            if (novoTotal === 0) {
                cartelaEmJogo = 0;
                seePromocoes = true; 
                startPromocionalTimer();                               
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
        return; // Para a execução da função aki
    }

    // 2. Verifica se o total está abaixo do mínimo exigido
    if (total < minCartelas) {
        validationMessageCurrent.textContent = `Atenção: A quantidade de cartelas (${total}) está abaixo do mínimo exigido (${minCartelas}).`;
        validationMessageCurrent.classList.remove('hidden');
        return; // Para a execução da função aki
    }

    // 3. Verifica se o total está acima do máximo exigido
    if (total > maxCartelas) {
        validationMessageCurrent.textContent = `Atenção: A quantidade de cartelas (${total}) excede o máximo permitido (${maxCartelas}).`;
        validationMessageCurrent.classList.remove('hidden');
        return; // Para a execução da função aki
    }
    cartelaEmJogo = total;
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
                        playPremiadoSound(linhaSound);
                        showPremiadoGif('linha'); 
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
                    playPremiadoSound(quadraSound);
                    showPremiadoGif('quadra');                   
playBingoSound();
                } else if (premioBuscado.includes('LINHA') && line.count === 5) {
                    premioEncontradoLinha = 'L I N H A';
                    showPremiadoGif('linha');                    
                    playPremiadoSound(linhaSound);                    
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
            const xBolasCantadas =  bolasCantadas.length; 
            if (premioBuscado.includes('DUPLOBINGO') && count.geral === 15 && xBolasCantadas !== bolaBuscandoPremio) {
 console.error(' houve alteração ' ,bolaBuscandoPremio); // aquix 
                premioEncontrado = 'DUPLO BINGO';
                showPremiadoGif('duplobingo');
                playPremiadoSound(duplobingoSound);              
            } else if (premioBuscado.includes('TRIPLO BINGO') && count.geral === 15  && xBolasCantadas !== bolaBuscandoPremio) {
                premioEncontrado = 'TRIPLO BINGO';
                showPremiadoGif('triplobingo');
                playPremiadoSound(triplobingoSound);
            } else if (premioBuscado.includes('BINGO') && count.geral === 15 && xBolasCantadas !== bolaBuscandoPremio) {
                premioEncontrado = 'B I N G O';
                showPremiadoGif('bingo');
                playPremiadoSound(bingoSound);                
playBingoSound();
            } else if (premioBuscado.includes('FALTAUM') && count.geral === 14) {
                premioEncontrado = 'FALTA UM';
                showPremiadoGif('faltaum');
                playPremiadoSound(faltaumSound);                
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
                    showPremiadoGif('linha');   
                    playPremiadoSound(linhaSound);                    
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
                showPremiadoGif('quadra');
                playPremiadoSound(quadraSound);                
playBingoSound();
            } else if (normalizedPremioBuscado.includes('LINHA') && count === 5) {
                premioEncontrado = 'L I N H A';
                showPremiadoGif('linha');
                playPremiadoSound(linhaSound);                 
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
            const xBolasCantadas =  bolasCantadas.length; 
            if (normalizedPremioBuscado.includes('DUPLOBINGO') && count === 15 && xBolasCantadas !== bolaBuscandoPremio) {
                premioEncontrado = 'DUPLO BINGO';
                showPremiadoGif('duplobingo');
                playPremiadoSound(duplobingoSound);               
            } else if (normalizedPremioBuscado.includes('TRIPLO BINGO') && count === 15 && xBolasCantadas !== bolaBuscandoPremio) {
                premioEncontrado = 'TRIPLO BINGO';
                showPremiadoGif('triplobingo');
                playPremiadoSound(triplobingoSound);                
playBingoSound();
            } else if (normalizedPremioBuscado.includes('BINGO') && count === 15 && xBolasCantadas !== bolaBuscandoPremio) {
                premioEncontrado = 'B I N G O';
                showPremiadoGif('bingo');
                playPremiadoSound(bingoSound);
            } else if (normalizedPremioBuscado.includes('FALTAUM') && count === 14) {
                premioEncontrado = 'FALTA UM';
                showPremiadoGif('faltaum');
                playPremiadoSound(faltaumSound);
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
    
    const headerElement = isMobile ? mobileLoadedCardsHeader : loadedCardsHeader; 
    const totalCards = loadedCards.length;
    const formattedCount = new Intl.NumberFormat('pt-BR').format(cartelasEmJogo);
    if (headerElement) {
        headerElement.textContent = `Cartelas Carregadas = ${formattedCount}`;
    }
 
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
        if (totalCards === 0 && headerElement) {
             headerElement.textContent = ``;  // texto acima CART... xxx
        }
        p.textContent = '';  // texto para linha inferior, abaixo do CARTELA   NÚMEROS FALTANTES xxx
        fragment.appendChild(p);
    } else {
    // Atualiza o texto do cabeçalho com a contagem total
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

// limpar painel
function clearPanels() {
    updateNumericPanel([]);
    const isMobile = isMobileDevice();
    const loadedCardsListCurrent = isMobile ? mobileLoadedCardsList : loadedCardsList;
    const faixasDiv = isMobile ? mobileFaixasAdicionadasDiv : faixasAdicionadasDiv;
    const totalSpan = isMobile ? mobileTotalCartelasSpan : totalCartelasSpan;
    const lastRound = isMobile ? mobileLastRoundElement : lastRoundElement;
    const lastOrder = isMobile ? mobileLastOrderElement : lastOrderElement;
    const precoSerie =  isMobile ? mobilePrecoSerieElement :precoSerieElement;
    const ball1 = isMobile ? mobileLastBall1 : lastBall1;
    const ball2 = isMobile ? mobileLastBall2 : lastBall2;
    const ball3 = isMobile ? mobileLastBall3 : lastBall3;
    const prizeInfo = isMobile ? mobilePrizeInfoContainer : prizeInfoContainer;
    const prizeValues = isMobile ? mobilePrizeValuesContainer : prizeValuesContainer;
    const cartelaInicial = isMobile ? mobileCartelaInicialInput : cartelaInicialInput;
    const cartelaFinal = isMobile ? mobileCartelaFinalInput : cartelaFinalInput;
    const resultadoSoma = isMobile ? mobileResultadoSomaSpan : resultadoSomaSpan;
    const headerElement = isMobile ? mobileLoadedCardsHeader : loadedCardsHeader; 
    cartelaEmJogo = 0;
    loadedCardsListCurrent.innerHTML = `<p class="text-white text-center">Nenhuma cartela carregada.</p>`;
    prizeValues.innerHTML = '';
    headerElement.textContent = `Nenhuma Cartela Carregada`;
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
    
    precoSerie.textContent = '';    
    cartelaRanges = [];
    loadedCards = [];
    displayLoadedCards([]);
    isFetchingCards = false;
   
    bingoWinners.clear();
    ultimaBolaCantada = null;
    buscando_o_premio = '';
    bolaBuscandoPremio = 0;
    buscando_a_linha = '';
    faixasDiv.innerHTML = '';
    totalSpan.textContent = '0';
    cartelasEmJogo = 0;
    cartelaInicial.value = '';
    cartelaFinal.value = '';
    resultadoSoma.textContent = '0';
    if (isMobile) {
        mobileCartelasContent.classList.add('hidden');
        mobilePrizesContent.classList.add('hidden');
        toggleCartelasButton.textContent = 'INCLUIR Cartelas';
        togglePrizesButton.textContent = 'Apresentar Prêmios';
    }    
    displayPrizeInfo([{ buscando_o_premio: null }],[]);
    iniciandoRodada = true;
    startPromocionalTimer();     
    seePromocoes = true;
}

function updateNumericPanel(bolasCantadas) {
    const isMobile = isMobileDevice();
    const gridToUse = isMobile ? mobileNumberGrid : numberGrid;

    document.querySelectorAll(`#${gridToUse.id} > div`).forEach(div => {
        div.classList.remove('text-green-700', 'text-red-700');
        div.classList.add('text-gray-900');
    });

    if (Array.isArray(bolasCantadas) && bolasCantadas.length > 0) {
        bolasCantadas.forEach(bola => {
            const numberDiv = gridToUse.querySelector(`#ball-${bola}`);
            if (numberDiv) {
                numberDiv.classList.remove('text-gray-900');
                numberDiv.classList.add('text-green-700');
            }
        });
        const lastBall = bolasCantadas[bolasCantadas.length - 1];
        const lastBallDiv = gridToUse.querySelector(`#ball-${lastBall}`);
        if (lastBallDiv) {
            lastBallDiv.classList.remove('text-green-700');
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

function displayPrizeInfo(buscandoData, premioData = null) {
    const isMobile = isMobileDevice();
    const prizeInfoContainerCurrent = isMobile ? mobilePrizeInfoContainer : prizeInfoContainer;
    
    const cleanTextForComparison = (text) => {
        if (!text) return "";
        // Remove todos os espaços em branco (\s) globalmente (g) e converte para MAIÚSCULAS
        return text.toString().replace(/\s/g, '').toUpperCase();
    }
    prizeInfoContainerCurrent.innerHTML = '';
    const prizeItem = document.createElement('span');
    prizeItem.className = 'text-3xl text-gray-200 font-semibold';

    let buscandoValue = buscandoData && buscandoData.length > 0 ? buscandoData[0].buscando_o_premio : null;
    const linhasTaisLinhas = buscandoData[0]?.buscando_a_linha || '';
    const qtdeLinhas = buscandoData[0]?.qtde_linha || '';

    let prizeToFind = cleanTextForComparison(buscandoValue);

    if (qtdeLinhas === 3 && buscandoValue === "L I N H A")  {
        const linhasEmJogo = `L I N H A S: ( ${linhasTaisLinhas.toUpperCase()} )`  
        buscandoValue = linhasEmJogo;
        prizeToFind = '3LINHAS'
    }
    if (prizeToFind === 'FALTAUM') {
       prizeToFind ='FALTA1';
    }
    // --- LÓGICA DE BUSCA DO PRÊMIO ---
    let valorPremio = '';
    let nomePremio = '';
    if (premioData && premioData.length > 0 && prizeToFind) {
        
        // Loop FOR...OF para iterar por todos os prêmios
        for (const item of premioData) {
            // Normaliza o tipo de prêmio do item atual para comparação
            const itemPrizeType =cleanTextForComparison(item.tipo_premio);
            if (itemPrizeType === prizeToFind ) {
                // Encontrado! Extrai os dados
                nomePremio = item.tipo_premio;
                valorPremio = item.valor; // Assumindo que 'valor' já está formatado como R$
                const comValor = `${buscandoValue}  -  ${valorPremio}`  
                buscandoValue = comValor;
                break; // Sai do loop imediatamente, pois já encontramos o prêmio
            }
        }
    }
   
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
            if (iniciandoRodada) {
               if (premio.tipo_premio=== 'BINGO') {
                  const valorLimpo = premio.valor
                      .replace('R$', '')  // Remove o símbolo da moeda
                      .replace(/\./g, '') // Remove o separador de milhares (ponto)
                      .replace(',', '.')  // Troca a vírgula por ponto (separador decimal do JS)
                      .trim();             // Remove espaços extras
                  const valorNumerico = parseFloat(valorLimpo);
                  if (valorNumerico > 0 )  {   
                      if (mobilePrizesContent.classList.contains('hidden')) {
                         seePromocoes = false; 
                         hidePromocionalPanel();
                         startPrizeHideTimer();
                         mobilePrizesContent.classList.remove('hidden'); 
                         togglePrizesButton.textContent = 'Ocultar Prêmios';
                         togglePrizesButton.classList.remove('bg-green-800');
                         togglePrizesButton.classList.add('bg-red-800'); 
                      }
                   }
               }
            }    
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
    const { bolasData, buscandoData, premioData, promocionalData, rodadaData, confereData, topeData, premioInfo,parametrosInfo = {}  } = data;

    const rodadaState = rodadaData && rodadaData.length > 0 ? rodadaData[0].estado.trim() : null;
     if (rodadaState === 'intervalo' && lastRodadaState !== 'intervalo') {
        clearPanels();
        lastRodadaState = rodadaState; // Atualiza o estado
        return;
    }
    else if (rodadaState !== null) {
  //   Atualiza o estado para que a próxima iteração saiba qual é o estado atual.
         lastRodadaState = rodadaState;
    }
    
    const bolasCantadas = bolasData && Array.isArray(bolasData) && bolasData.length > 0
        ? bolasData[0].bolas_cantadas : [];
    
    const ultimaBolaDaLista = bolasCantadas.length > 0 ? bolasCantadas[bolasCantadas.length - 1] : null;

    const premioBuscadoDaAPI = buscandoData[0]?.buscando_o_premio.replace(/\s+/g, '').trim() || '';
    const linhasAtivasDaAPI = buscandoData[0]?.buscando_a_linha || '';

    if (premioBuscadoDaAPI !== buscando_o_premio.replace(/\s+/g, '').trim() || linhasAtivasDaAPI !== buscando_a_linha) {
        buscando_o_premio = premioBuscadoDaAPI;
        buscando_a_linha = linhasAtivasDaAPI;
        
        bolaBuscandoPremio = bolasCantadas.length
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
    
    globalPromocionalData = promocionalData;
//    displayPromocionalText(promocionalData); 

    if (parametrosInfo) {
         const nome_da_sala = parametrosInfo.nome_sala; 

        if (nome_da_sala && salaTitleElement) {
            salaTitleElement.textContent = nome_da_sala;
        }
        const rawVideoID = parametrosInfo.url_live || parametrosInfo.url_padrao || '';
        const videoID = rawVideoID.split('&')[0];
        video_local = parametrosInfo.video_local;
        currentVideoUrl = `https://www.youtube.com/embed/${videoID}?autoplay=1`;
        
        if (abrirYoutubeBtn) {
            // Converte o valor do banco (string 'false' ou boolean) para booleano seguro
            const isLocal = String(video_local).toLowerCase() === 'true'; 
            if (isLocal) {
                abrirYoutubeBtn.classList.add('hidden');
                if (youtubePanel && !youtubePanel.classList.contains('hidden')) {
                    abrirYoutubeBtn.click(); 
                }
            } else {
                abrirYoutubeBtn.classList.remove('hidden');
            }
        }
    }
    if (promocionalContainer) {
        promocionalContainer.addEventListener('click', () => {
            hidePromocionalPanel();
            startPromocionalTimer();
                 // Você pode adicionar um pequeno feedback visual ou log aki
        });
    }


    if (data.cardRanges) {
        cardRanges = data.cardRanges;
    }  
    updateNumericPanel(bolasCantadas);
    displayLastThree(bolasData?.[0]);
    displayConferencePanel(confereData, bolasCantadas);

    if (premioInfo && typeof premioInfo.preco_da_serie === 'number') {
        const preco = premioInfo.preco_da_serie;
        ValorSerie = preco;
        const formattedPreco = new Intl.NumberFormat('pt-BR', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(preco);
        precoSerieElement.textContent = formattedPreco;
        mobilePrecoSerieElement.textContent = formattedPreco;

        // DEBUG: Confirme se o elemento está sendo encontrado
        if (!precoSerieElement) console.error("Elemento 'preco-serie' não encontrado!");
        if (!mobilePrecoSerieElement) console.error("Elemento 'mobile-preco-serie' não encontrado!");
    }

    // NOVA CHAMADA: Exibe os períodos de cartelas
    if (data.cardRanges) {
        displayCardRanges(data.cardRanges);
    }

    displayPrizeInfo(buscandoData, premioData);
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

        // NOVO CÓDIGO: Busca o valor de preco_da_serie e o exibe
        if (premioInfo && typeof premioInfo.preco_da_serie === 'number') {
            const preco = premioInfo.preco_da_serie;
            ValorSerie = preco;
            const formattedPreco = new Intl.NumberFormat('pt-BR', {
                 style: 'decimal',
                 minimumFractionDigits: 2,
                 maximumFractionDigits: 2
            }).format(preco);
            precoSerieElement.textContent = formattedPreco;
            mobilePrecoSerieElement.textContent = formattedPreco;
        }

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
        toggleCartelasButton.textContent = 'INCLUIR Cartelas';
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
    startPromocionalTimer();
    // Inicia um novo temporizador
    timeoutId = setTimeout(() => {
        const isMobile = isMobileDevice();
        const cartelasContent = isMobile ? mobileCartelasContent : document.getElementById('cartelas-content');
        const toggleButton = isMobile ? toggleCartelasButton : document.getElementById('toggle-cartelas-button-desktop');

        if (cartelasContent) {
            cartelasContent.classList.add('hidden');
            if (toggleButton) {
                toggleButton.textContent = 'INCLUIR Cartelas';
                toggleButton.classList.remove('bg-red-800');
                toggleButton.classList.add('bg-green-light');
                if (cartelas_Em_Jogo === 0 && rodadaState === 'intervalo') {
                   seePromocoes = true;
                   startPromocionalTimer();
                }
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
    let Mutiplicador = 1000;
    if (iniciandoRodada) {
       Mutiplicador = 3000; 
       iniciandoRodada = false;
    } 
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
                if (cartelas_Em_Jogo === 0 && rodadaState === 'intervalo') {
                   seePromocoes = true;
                   startPromocionalTimer();
                }
            }
        }
    }, secundsPrizeTimeoutId * Mutiplicador); // x segundos * 1000 (Mutiplicador)
}

togglePrizesButton.addEventListener('click', () => {
    startPromocionalTimer();
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
    }
});

if (toggleCartelasButton && mobileCartelasContent) {
    toggleCartelasButton.addEventListener('click', () => {
        startPromocionalTimer();
        const isMobile = isMobileDevice();
        const cartelasContent = isMobile ? mobileCartelasContent : document.getElementById('cartelas-content');
        
        // Alterna a visibilidade do painel
        cartelasContent.classList.toggle('hidden');

        if (cartelasContent.classList.contains('hidden')) {
            // Se o painel for ocultado, cancela qualquer temporizador em execução
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            toggleCartelasButton.textContent = 'INCLUIR Cartelas';
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
        const initialRequest = { action: "GET_INITIAL_STATE" };
        ws.send(JSON.stringify(initialRequest));
        console.log("Conexão aberta. Solicitando estado inicial ao servidor.");
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

document.addEventListener('DOMContentLoaded', () => {
    const isMobileTest = isMobileDevice();
    if (isMobileTest) {
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('portrait').catch((err) => {
                console.error("Erro ao travar a orientação da tela:", err);
            });
        }
    }   
 
// Referencia os painéis e botões
    const mobilePanelsContainer = document.getElementById('mobile-panels-container');
    if (abrirYoutubeBtn && youtubePanel && mobilePanelsContainer && youtubePlaceholder) {
        abrirYoutubeBtn.addEventListener('click', () => {
            startPromocionalTimer();
   
            const videoToLoad = currentVideoUrl; 

            if (!videoToLoad) {
                alert('Nenhuma URL de vídeo LIVE ou PADRÃO configurada.');
                return;
            }
        
            // Define a URL do iframe
            let videoUrl;
        
            // 1. Tenta identificar se já é um link de embed ou uma URL completa
            if (videoToLoad.includes('youtube.com/embed/')) {
                videoUrl = videoToLoad; 
            } else {
                // 2. Assume que é o ID do vídeo (ou link curto) e cria o link de embed
                // Adicionamos o autoplay=1 para iniciar o vídeo
                const videoID = videoToLoad.split('&')[0];

                videoUrl = `https://www.youtube.com/embed/${videoID}?autoplay=1`;
            }
            // Alterna a visibilidade do painel do YouTube
            youtubePanel.classList.toggle('hidden');
            
            // Alterna a visibilidade do painel mobile para mostrar o YouTube
            mobilePanelsContainer.classList.toggle('hidden');
            
            // Alterna a visibilidade do placeholder para empurrar o conteúdo
            youtubePlaceholder.classList.toggle('hidden');
            // Verifica o estado atual do painel do YouTube
            const isYoutubePanelVisible = !youtubePanel.classList.contains('hidden');
            
            if (isYoutubePanelVisible) {
                // Se o painel for exibido, altere o texto e inicie o vídeo
                abrirYoutubeBtn.textContent = 'Fechar YouTube';
                youtubeIframe.src =currentVideoUrl;
                 if (!telaFull) { 
                    goFullscreen(); 
                 } 
            } else {
                // Se o painel for ocultado, altere o texto e pare o vídeo
                abrirYoutubeBtn.textContent = 'Abrir YouTube';
                youtubeIframe.src = ''; // Define o src vazio para parar o vídeo
            }
            updatePromocionalPanelPosition();
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