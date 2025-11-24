//Criar menu
//Destacar Linha ou quadra
//
const backendVersionElement = document.getElementById('backend-version');
const frontendVersionElement = document.getElementById('frontend-version');
const loader = document.getElementById('loader');

const numberGrid = document.getElementById('number-grid');
const mobileNumberGrid = document.getElementById('mobile-number-grid');

const estatisticasBody = document.getElementById('estatisticas-body');
const estatisticasPanel = document.getElementById('estatisticas-panel');

const loadingStats = document.getElementById('loading-stats');

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

const digitalBolaPanel = document.getElementById('digital-bola-panel'); 
const bolaDigitalElement = document.getElementById('bola-digital');
let tipoDoSorteio = "";

const youtubePanel = document.getElementById('youtube-panel'); 
const youtubeIframe = document.getElementById('youtube-iframe');
const abrirYoutubeBtn = document.getElementById('abrir-youtube-btn');
//
let cartelasEmJogo = 0;
// Timer promocionais
let seePromocoes = true; // Controla se o sistema deve verificar e exibir promoções
let promocionalTimer = null; // Armazena a referência do temporizador

let globalPromocionalData = [];

let clienteLogadoId = null;

let vozAtiva = true; 

let eventoCarregadoAtual = null;

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

// --- Variável Global para a Rodada (vinda da URL) ---
let idRodada = 0; 

let lastRodadaState = null;

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


/**
 * Converte uma lista de números [1, 2, 3, 5, 6] em objetos de faixa
 * [{inicial: 1, final: 3}, {inicial: 5, final: 6}]
 * Isso otimiza o processamento no backend.
 */
function agruparNumerosEmRanges(numeros) {
    if (!numeros || numeros.length === 0) return [];
    
    // Ordena numericamente (crescente)
    numeros.sort((a, b) => a - b);
    
    const ranges = [];
    let inicio = numeros[0];
    let anterior = numeros[0];
    
    for (let i = 1; i < numeros.length; i++) {
        if (numeros[i] === anterior + 1) {
            // É sequencial, continua a faixa
            anterior = numeros[i];
        } else {
            // Quebrou a sequência, fecha a faixa anterior
            ranges.push({ inicial: inicio, final: anterior });
            inicio = numeros[i];
            anterior = numeros[i];
        }
    }
    // Adiciona a última faixa
    ranges.push({ inicial: inicio, final: anterior });
    
    return ranges;
}

// Funções de busca de cartelas compradas
async function carregarCartelasAutomaticas(idEvento) {
    // Verifica se já carregamos este evento para não ficar piscando a tela
    if (eventoCarregadoAtual === idEvento && cartelaRanges.length > 0) {
        return; 
    }

    // Obtém ID do cliente da URL (modo quiosque/link único)
    const urlParamsGlobal = new URLSearchParams(window.location.search);
    // Tenta pegar da URL, se não tiver, tenta de alguma variável de sessão ou define fixo para teste
    //const clienteLogadoId = urlParamsGlobal.get('id_cliente'); 

    if (!clienteLogadoId) {
        console.log("Modo Espectador: Nenhum ID de cliente na URL.");
        return;
    }

    // Feedback visual (opcional)
    const headerElement = isMobileDevice() ? document.getElementById('mobile-loaded-cards-header') : document.getElementById('loaded-cards-header');
    if(headerElement) headerElement.textContent = "Buscando suas cartelas...";

    try {
        const url = `${API_BASE_URL}/api/consultar_cartelas_evento?id_evento=${idEvento}&id_cliente=${clienteLogadoId}`;
        console.log("🔄 Buscando cartelas do cliente:", url);

        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error("Erro API Vendas:", data.error);
            return;
        }

        // Se encontrou cartelas
        if (data.cartelas && data.cartelas.length > 0) {
            console.log(`✅ Cliente possui ${data.quantidade} cartelas. Processando...`);
            
            // 1. Converte a lista de IDs em faixas otimizadas
            const novasFaixas = agruparNumerosEmRanges(data.cartelas);
            
            // 2. Atualiza a variável global que o sistema usa
            cartelaRanges = novasFaixas;
            
            // 3. Atualiza a visualização da lista de faixas (aqueles botões de remover)
            displayCartelaRanges(); 
            
            // 4. Dispara o motor principal do jogo!
            // Isso vai baixar os números de cada cartela e começar a conferência
            await fetchAndProcessCards(); 
            
            // Atualiza controle para não recarregar à toa
            eventoCarregadoAtual = idEvento;

            // Feedback para o usuário
            const msg = `Carregadas ${data.quantidade} cartelas para o Sorteio ${idEvento}!`;
            if(isMobileDevice()) {
               const validationMsg = document.getElementById('mobile-validation-message');
               validationMsg.textContent = msg;
               validationMsg.classList.remove('hidden');
               validationMsg.classList.remove('text-red-500');
               validationMsg.classList.add('text-green-500');
               setTimeout(() => validationMsg.classList.add('hidden'), 5000);
            }

        } else {
            console.log("⚠️ Nenhuma cartela encontrada para este evento/cliente.");
            // Opcional: Se mudou de evento e o cliente não comprou nada, limpa a tela?
            if (eventoCarregadoAtual !== idEvento) {
                clearPanels(); // Limpa se for um evento novo sem compras
                eventoCarregadoAtual = idEvento;
            }
        }

    } catch (error) {
        console.error("❌ Erro na requisição automática:", error);
    }
}


// Função auxiliar para transformar [1, 2, 3, 5, 6] em [{inicial:1, final:3}, {inicial:5, final:6}]
function agruparNumerosEmRanges(numeros) {
    if (numeros.length === 0) return [];
    numeros.sort((a, b) => a - b);
    
    let ranges = [];
    let start = numeros[0];
    let prev = numeros[0];
    
    for (let i = 1; i < numeros.length; i++) {
        if (numeros[i] === prev + 1) {
            prev = numeros[i];
        } else {
            ranges.push({ inicial: start, final: prev });
            start = numeros[i];
            prev = numeros[i];
        }
    }
    ranges.push({ inicial: start, final: prev });
    return ranges;
}

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
    desbloquearAudio();
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
    
    // --- INÍCIO DA MODIFICAÇÃO (Listener do Botão) ---
    adicionarBtn.addEventListener('click', () => {
        // 1. Chama a nova função helper
        // O 'true' indica que foi um clique do usuário (para disparar timers)
        if (adicionarFaixaDeCartelas(true)) {
            // 2. Se a faixa foi adicionada com sucesso, busca no servidor
            fetchAndProcessCards();
        }
    });
    // --- FIM DA MODIFICAÇÃO ---
}

// --- INÍCIO DA NOVA FUNÇÃO (Helper para Adicionar Faixa) ---
/**
 * Lógica central para adicionar uma faixa de cartelas.
 * Não busca os dados, apenas atualiza o array 'cartelaRanges' e a UI.
 * @param {boolean} disparadoPorUsuario - Controla se os timers (promo/hide) devem ser acionados.
 * @returns {boolean} - Retorna 'true' se a faixa foi adicionada, 'false' se falhou (ex: sobreposição).
 */
function adicionarFaixaDeCartelas(disparadoPorUsuario = false) {
    const isMobile = isMobileDevice();
    const inputInicial = isMobile ? mobileCartelaInicialInput : cartelaInicialInput;
    const inputFinal = isMobile ? mobileCartelaFinalInput : cartelaFinalInput;
    
    if (disparadoPorUsuario) {
         startPromocionalTimer();
    }

    const valorInicial = parseInt(inputInicial.value, 10);
    const valorFinal = parseInt(inputFinal.value, 10);
    
    // Validação de segurança (caso o 'validarECalcular' falhe)
    if (!valorInicial || !valorFinal || valorFinal < valorInicial) {
        console.warn("Tentativa de adicionar faixa inválida.");
        return false;
    }
    
    const novaFaixa = { inicial: valorInicial, final: valorFinal };

    // Validação de sobreposição
    const sobreposicao = cartelaRanges.some(faixa =>
        (valorInicial >= faixa.inicial && valorInicial <= faixa.final) ||
        (valorFinal >= faixa.inicial && valorFinal <= faixa.final) ||
        (faixa.inicial >= valorInicial && faixa.inicial <= valorFinal)
    );

    if (sobreposicao) {
        alert('Erro: Esta faixa de cartelas se sobrepõe a uma faixa já adicionada.');
        return false; // Falhou
    }

    const totalCartelasSpanCurrent = isMobile ? mobileTotalCartelasSpan : totalCartelasSpan;
    const novaSoma = parseInt(totalCartelasSpanCurrent.textContent) + ((valorFinal - valorInicial) + 1);

    cartelaRanges.push(novaFaixa);
    displayCartelaRanges(); // Atualiza a UI e o total
    
    // Limpa os campos
    inputInicial.value = '';
    inputFinal.value = '';
    (isMobile ? mobileResultadoSomaSpan : resultadoSomaSpan).textContent = '0';
    (isMobile ? mobileAdicionarCartelasBtn : adicionarCartelasBtn).classList.add('hidden');

    if (disparadoPorUsuario) {
        startHideTimer();
    }
    
    return true; // Sucesso
}
// --- FIM DA NOVA FUNÇÃO ---


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
            updateDigitalBola("--");
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

        // --- INÍCIO DA ALTERAÇÃO: Captura do Layout Visual ---
        // Tenta pegar o campo 'numeros' (que geralmente é a string visual bruta do banco)
        // Se não existir, usa 'em_ordem' como fallback.
        let rawLayout = superior + ',' + central + ',' + inferior; // card.numeros || card.em_ordem; 
        let layoutGrid = [];
        console.error("rawLayout     :",rawLayout);
        if (typeof rawLayout === 'string') {
            // Remove caracteres não numéricos (como * ou +) exceto espaço e vírgula
            // Divide por espaço ou vírgula e converte para número
            layoutGrid = rawLayout.replace(/[^\d, ]/g, ' ').trim().split(/[\s,]+/).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
        } else if (Array.isArray(rawLayout)) {
            layoutGrid = rawLayout.map(Number);
        }
        // --- FIM DA ALTERAÇÃO ---

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

        // Objeto base que será inserido no array
        let cardObj = {
            cartao: card.cartao,
            linhaId: null,
            counts: { geral: count.geral },
            premioEncontrado: null,
            originalData: {
                geral: emOrdem,
                linha: [] 
            },
            layoutGrid: layoutGrid, // <--- AQUI: Adicionamos o campo novo
            missingNumbers: []
        };

        if (isMultiLinePrize) {
            const lines = [
                { id: 'Sup', numbers: superior, count: count.superior },
                { id: 'Cen', numbers: central, count: count.central },
                { id: 'Inf', numbers: inferior, count: count.inferior }
            ];
            
            lines.forEach(line => {
                if (activeLinesArray.includes(line.id)) {
                    // Clona o objeto base para não misturar referências
                    let lineCardObj = JSON.parse(JSON.stringify(cardObj)); 
                    lineCardObj.linhaId = line.id;
                    lineCardObj.counts.linha = line.count;
                    lineCardObj.originalData.linha = line.numbers;
                    lineCardObj.layoutGrid = layoutGrid; // Garante que o layout vai junto
                    lineCardObj.missingNumbers = line.numbers.filter(num => !bolasCantadas.includes(num));

                    if (line.count === 5) {
                        lineCardObj.premioEncontrado = 'LINHA';
                        playPremiadoSound(linhaSound);
                        showPremiadoGif('linha'); 
                    }
                    processedCards.push(lineCardObj);
                }
            });
        } else if (premioBuscado.includes('QUADRA') || premioBuscado.includes('LINHA')) {
            const lines = [
                { id: 'Sup', numbers: superior, count: count.superior },
                { id: 'Cen', numbers: central, count: count.central },
                { id: 'Inf', numbers: inferior, count: count.inferior }
            ];
            
            lines.forEach(line => {
                let lineCardObj = JSON.parse(JSON.stringify(cardObj));
                lineCardObj.linhaId = line.id;
                lineCardObj.counts.linha = line.count;
                lineCardObj.originalData.linha = line.numbers;
                lineCardObj.layoutGrid = layoutGrid;
                lineCardObj.missingNumbers = line.numbers.filter(num => !bolasCantadas.includes(num));

                if (premioBuscado.includes('QUADRA') && line.count === 4) {
                    lineCardObj.premioEncontrado = 'Q U A D R A';
                    playPremiadoSound(quadraSound);
                    showPremiadoGif('quadra');                   
                    playBingoSound();
                } else if (premioBuscado.includes('LINHA') && line.count === 5) {
                    lineCardObj.premioEncontrado = 'L I N H A';
                    showPremiadoGif('linha');                    
                    playPremiadoSound(linhaSound);                    
                }
                processedCards.push(lineCardObj);
            });
        } else {
            // Processamento padrão (Cartela Cheia, Duplo Bingo, etc)
            cardObj.originalData.geral = emOrdem;
            cardObj.missingNumbers = emOrdem.filter(num => !bolasCantadas.includes(num));
            
            let premioEncontrado = null;
            const xBolasCantadas = bolasCantadas.length; 
            
            if (premioBuscado.includes('DUPLOBINGO') && count.geral === 15 && xBolasCantadas !== bolaBuscandoPremio) {
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
            cardObj.premioEncontrado = premioEncontrado;
            processedCards.push(cardObj);
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
        headerElement.className = 'text-center text-sm text-yellow-500 font-bold mb-0'
        headerElement.textContent = `Cartelas Carregadas = ${formattedCount}`;
    }
 
    cardsList.innerHTML = '';
    
    const isLinePrize = buscando_o_premio.includes('QUADRA') || buscando_o_premio.includes('LINHA');
    const isMultiLinePrize = isLinePrize && !!buscando_a_linha;
// aquix
    const headerDiv = document.createElement('div');
    headerDiv.className = 'flex justify-between w-full p-0 bg-gray-800 rounded-t-lg text-sm text-gray-400 font-bold mb-0';
    
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
            cardDiv.className = 'flex h-6 w-full p-0 bg-transparent rounded-lg text-white font-medium mb-0';
            cardDiv.setAttribute('data-card-number', card.cartao);
            
            if (isLinePrize) {
                cardDiv.setAttribute('data-line-id', card.linhaId);
            }

            const cardLabelHtml = isLinePrize
                ? `<div class="flex-shrink-0 flex gap-1"><span class="w-14 p-0 bg-gray-700 rounded-lg text-center font-bold flex items-center justify-center text-sm gap-y-0 ">${formattedCardNumber}</span><span class="w-5 p-0 bg-gray-800 rounded-lg text-center font-bold  flex items-center justify-center">${card.linhaId[0]}</span></div>`
                : `<div class="flex-shrink-0 p-0 bg-gray-700 rounded-lg text-center font-bold  flex items-center justify-center text-sm gap-y-0 w-14"><span>${formattedCardNumber}</span></div>`;

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
               numbersContainer.className = 'flex-1 ml-1 p-0 bg-transparent rounded-lg flex h-5 gap-x-1 gap-y-0 justify-start';
 
               const missingNumbers = card.missingNumbers || [];
                
                missingNumbers.forEach((num, index) => {
                    const numberSpan = document.createElement('span');
                    
                    let bgColorClass = 'bg-blue-700';
                    if (index === 0) {
                        bgColorClass = 'bg-green-700';
                    } else if (index === 1 || index === 2) {
                        bgColorClass = 'bg-orange-700';
                    }
                    
                    const numberClass = `py-3 px-2 rounded-lg text-white font-bold ${bgColorClass} text-sm w-7 h-5 flex items-center justify-center flex-shrink-0`;
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
    renderOscartoes(bolasCantadas);
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
    
    updateDigitalBola("--");

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

// Função para renderizar os dados de "Melhores"
function renderMelhores(melhoresData) {
    estatisticasBody.innerHTML = ''; 
    if (!melhoresData || melhoresData.length === 0) {
        estatisticasBody.innerHTML = '<p class="text-center text-gray-500 mt-6 text-xs">Nenhuma cartela no topo.</p>';
        return;
    }
    if (melhoresData[0].cartela === "null") {
        estatisticasBody.innerHTML = '<p class="text-center text-gray-500 mt-6 text-xs">Nenhuma cartela no topo.</p>';
        return;
    }
	
    melhoresData.forEach(item => {
        let posicaoWidth = '13px'; // Largura padrão se 'posicao' não for vazio
        let haGanhador = false;
        // Verifica se 'posicao' é uma string vazia ("") ou nula.
        if (!item.posicao || item.posicao === "") {
            posicaoWidth = '4px'; 
        }

        // 2. Constrói a string da classe
        // Usa template literals (crase `) para injetar a variável
        const gridClasses = `grid-cols-[23px_${posicaoWidth}_1fr_55px]`;

        const row = document.createElement('div');
        row.className = `grid ${gridClasses} text-[8px] leading-none text-white p-0.5 rounded hover:bg-gray-800`;
        
        // 1. Cartela
        const cartela = document.createElement('span');
        cartela.className = 'text-center font-bold text-yellow-600';
        cartela.textContent = item.cartela;

        // 2. Posição
        const posicao = document.createElement('span');
        posicao.className = 'text-center';
        posicao.textContent = item.posicao;
        if (posicaoWidth === '0px') {
            posicao.classList.add('hidden');
        }

        // 3. Números Faltantes (A chave é 'numeros_faltantes')
        let winnerPremio = ''; 
        if (item.premio && item.premio !== null  && item.premio !== "null") {
           winnerPremio = item.premio;
           haGanhador = true; 
        }
      
        const numerosFaltantes = document.createElement('span');
        const numerosFaltantesOriginal = item.numeros_faltantes; // Ex: "04,25,65"
        const numerosComEspaco = numerosFaltantesOriginal.replaceAll(',', ' . ');
        
        if  (haGanhador) {
            numerosFaltantes.className = 'truncate text-[10px] text-yellow-300 font-bold';
        } else {
            numerosFaltantes.className = 'truncate text-[8px] text-green-500 font-medium';
        } 
        numerosFaltantes.textContent = `${numerosComEspaco} ${winnerPremio}`; 

        // 4. Nome (Player)
        const nome = document.createElement('span');
        if  (haGanhador) {
           nome.className = 'truncate text-[9px] text-yellow-300 font-bold';     
        } else {   
           nome.className = 'truncate text-gray-300';
        }
        nome.textContent = item.nome;

        row.appendChild(cartela);
        row.appendChild(posicao);
        row.appendChild(numerosFaltantes);
        row.appendChild(nome);
        
        estatisticasBody.appendChild(row);
    });
}

// Função para mapear o número da bola à cor (padrão de bingo)
function getBallColorClass(numero) {
    if (numero >= 1 && numero <= 18) return 'bg-blue-600 border-4 border-blue-400';
    if (numero >= 19 && numero <= 36) return 'bg-red-600 border-4 border-red-400';
    if (numero >= 37 && numero <= 54) return 'bg-purple-600 border-4 border-purple-400';
    if (numero >= 55 && numero <= 72) return 'bg-green-600 border-4 border-green-400';
    if (numero >= 73 && numero <= 90) return 'bg-yellow-600 border-4 border-yellow-400';
    return 'bg-gray-700 border-4 border-gray-400'; // Cor padrão
}

function updateDigitalBola(numeroBola) {
    if (!bolaDigitalElement) return;
    
    const allBgColors = [
        'bg-gray-700', 'bg-blue-600', 'bg-red-600', 
        'bg-purple-600', 'bg-green-600', 'bg-yellow-600'
    ];
    
    const allBorderColors = [
        'border-gray-400', 'border-blue-400', 'border-red-400', 
        'border-purple-400', 'border-green-400', 'border-yellow-400'
    ];

    const corClasses = getBallColorClass(numeroBola);
    
    // Remove todas as cores antigas (necessário para a mudança de cor)

    bolaDigitalElement.classList.remove(...allBgColors);
    bolaDigitalElement.classList.remove(...allBorderColors);   
 //   bolaDigitalElement.className = bolaDigitalElement.className.replace(/bg-[\w-]+ border-[\w-]+/g, '');

    // Adiciona o novo número e as novas classes de cor
    bolaDigitalElement.textContent = numeroBola;
    bolaDigitalElement.classList.add(...corClasses.split(' '));
    
    // Opcional: Adicionar uma classe de animação de contorno se necessário
    bolaDigitalElement.classList.add('animate-pulsing-border'); 
}

function updateEstatisticasPanelWidth(tipoSorteio) {
    const classDigital = 'w-3/5';
    const classPadrao = 'w-2/4';

    estatisticasPanel.classList.remove(classDigital, classPadrao);

    if (tipoSorteio === "digital") {
        estatisticasPanel.classList.add(classDigital);
    } else {
        estatisticasPanel.classList.add(classPadrao);
    }
}
// ATUALIZADO: Renderiza as 8 melhores cartelas com Destaque APENAS na Linha Alvo
function renderOscartoes(bolasCantadas) {
    const totalCartelas = loadedCards ? loadedCards.length : 0;
    const formattedCount = new Intl.NumberFormat('pt-BR').format(cartelasEmJogo);
    const textoTitulo = `8 Melhores Cartelas (${formattedCount})`;

    const pcHeader = document.getElementById('oscartoes-header');
    const mobileHeader = document.getElementById('mobile-oscartoes-header');

    if (pcHeader) pcHeader.textContent = textoTitulo;
    if (mobileHeader) mobileHeader.textContent = textoTitulo;

    const containers = [
        document.getElementById('oscartoes-content'),       
        document.getElementById('mobile-oscartoes-content') 
    ];

    let conteudoVazio = false;
    let dadosParaRenderizar = [];

    if (!loadedCards || loadedCards.length === 0) {
        conteudoVazio = true;
    } else {
        dadosParaRenderizar = loadedCards.slice(0, 8);
    }

    // Verifica se é modo LINHA ou QUADRA
    const premioAtual = buscando_o_premio.replace(/\s+/g, '').toUpperCase();
    const isModoLinhaOuQuadra = premioAtual.includes('LINHA') || premioAtual.includes('QUADRA');

    containers.forEach(container => {
        if (!container) return; 

        container.innerHTML = '';
        container.className = 'grid grid-cols-2 gap-2 pb-4 content-start';

        if (conteudoVazio) {
            container.className = 'flex flex-col items-center justify-center h-full';
            container.innerHTML = '<p class="text-center text-gray-500 text-xs mt-4">Nenhuma cartela processada.</p>';
            return;
        }

        dadosParaRenderizar.forEach(cardData => {
            const numeroCartao = cardData.cartao;
            
            const numerosGerais = cardData.layoutGrid && cardData.layoutGrid.length > 0 
                                  ? cardData.layoutGrid 
                                  : (cardData.originalData ? cardData.originalData.geral : []);

            if (!numerosGerais || numerosGerais.length === 0) return;

            // Container
            const cardDiv = document.createElement('div');
            cardDiv.className = 'bg-gray-900 border border-gray-700 rounded p-1 flex flex-col gap-0.5 shadow-sm';

            // Header
            const faltam = cardData.missingNumbers ? cardData.missingNumbers.length : 15;
            const faltamClass = faltam <= 1 ? 'text-red-500 animate-pulse' : 'text-blue-400';

            const header = document.createElement('div');
            header.className = 'flex justify-between items-center border-b border-gray-700 pb-0.5 mb-0.5';
            header.innerHTML = `
                <span class="text-gray-400 font-bold text-[10px]">Cartela: <span class="text-yellow-500">${numeroCartao}</span></span>
                <span class="text-[10px] font-bold ${faltamClass}">Faltam: ${faltam}</span>
            `;
            cardDiv.appendChild(header);

            // Grid
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-5 gap-0.5';

            numerosGerais.forEach((num, index) => {
                const cell = document.createElement('div');
                let cellClass = 'h-4 w-full flex items-center justify-center text-[9px] font-bold rounded border ';
                
                if (bolasCantadas.includes(num)) {
                    // 1. JÁ SORTEADO (Cinza Escuro / Apagado)
                    cellClass += 'bg-gray-800 text-gray-600 border-gray-800'; 
                } else {
                    // 2. NÃO SORTEADO (Faltante)
                    let isTargetLine = true;

                    // Se for modo LINHA/QUADRA, verifica se o número pertence à linha "boa"
                    if (isModoLinhaOuQuadra && cardData.linhaId) {
                        let linhaDoNumero = '';
                        if (index >= 0 && index <= 4) linhaDoNumero = 'Sup';
                        else if (index >= 5 && index <= 9) linhaDoNumero = 'Cen';
                        else if (index >= 10 && index <= 14) linhaDoNumero = 'Inf';

                        // Se a linha do número não for a linha premiada da cartela
                        if (linhaDoNumero !== cardData.linhaId) {
                            isTargetLine = false;
                        }
                    }

                    if (isTargetLine) {
                        // DESTAQUE (Branco com Borda Amarela)
                        // É um número faltante NA linha que estamos torcendo
                        cellClass += 'bg-gray-700 text-white border-yellow-600 shadow-sm'; 
                    } else {
                        // "GRAY-250" (Cinza Claro mas sem destaque)
                        // É um número faltante, mas numa linha que NÃO vai bater agora
                        // Usamos text-gray-400 para simular o "gray-250" visível mas discreto
                        cellClass += 'bg-gray-800 text-gray-300 border-gray-800'; 
                    }
                }
                
                cell.className = cellClass;
                cell.textContent = num;
                grid.appendChild(cell);
            });

            cardDiv.appendChild(grid);
            
            if (cardData.premioEncontrado) {
                const footer = document.createElement('div');
                footer.className = 'mt-0.5 text-center text-[8px] font-bold rounded py-0.5 animate-prize-blink';
                footer.textContent = `${cardData.premioEncontrado}`;
                cardDiv.appendChild(footer);
            }

            container.appendChild(cardDiv);
        });
    });
}

async function renderMainContent(data) {
    if (!data) return;

    // 1. Desestruturação dos dados recebidos
    const { 
        bolasData, 
        buscandoData, 
        premioData, 
        promocionalData, 
        rodadaData, 
        confereData, 
        topeData, 
        premioInfo, 
        parametrosInfo = {} 
    } = data;

    // =========================================================================
    // >>> LÓGICA DE CARREGAMENTO AUTOMÁTICO DE CARTELAS (PRIORIDADE ALTA) <<<
    // =========================================================================
    // Movemos isso para o topo para garantir que cartelas sejam carregadas 
    // assim que soubermos qual é o evento, independente de bolas ou prêmios.
    
    if (typeof clienteLogadoId !== 'undefined' && clienteLogadoId) {
        // Verifica se temos a informação da rodada (evento) atual
        // Pode vir em premioInfo.rodada OU rodadaData[0].id_evento (depende do seu backend)
        const eventoAtual = premioInfo?.rodada || rodadaData?.[0]?.id_evento;

        if (eventoAtual) {
            // Inicializa a variável de controle se não existir
            if (typeof window.ultimoEventoProcessado === 'undefined') {
                window.ultimoEventoProcessado = null;
            }

            // Se o evento mudou OU se é a primeira carga (null) e temos evento
            if (window.ultimoEventoProcessado != eventoAtual) {
                console.log(`[AutoLoad] Novo evento detectado: ${window.ultimoEventoProcessado} -> ${eventoAtual}`);
                console.log("Buscando cartelas para o cliente ID:", clienteLogadoId);
                
                // Atualiza o controle para não buscar repetidamente
                window.ultimoEventoProcessado = eventoAtual;
                
                // Chama a função que vai no server.py -> mongo vendas -> busca cartelas
                // IMPORTANTE: Não usamos 'await' aqui para não bloquear a renderização da tela
                carregarCartelasAutomaticas(eventoAtual);
            }
        }
    }
    // =========================================================================

    // 2. Gerenciamento de Estado da Rodada (Intervalo vs Em Jogo)
    const rodadaState = rodadaData && rodadaData.length > 0 ? rodadaData[0].estado.trim() : null;
    
    if (rodadaState === 'intervalo' && lastRodadaState !== 'intervalo') {
        clearPanels();
        lastRodadaState = rodadaState; 
        // Resetamos o controle de evento para forçar recarga quando o intervalo acabar
        window.ultimoEventoProcessado = null; 
        return; 
    } else if (rodadaState !== null) {
        lastRodadaState = rodadaState;
    }
    
    // 3. Processamento das Bolas
    const bolasCantadas = bolasData && Array.isArray(bolasData) && bolasData.length > 0
        ? bolasData[0].bolas_cantadas : [];
    
    const proximaBola = bolasData[0]?.proxima_bola ? bolasData[0].proxima_bola : "--"; 
    const ultimaBolaDaLista = bolasCantadas.length > 0 ? bolasCantadas[bolasCantadas.length - 1] : null;

    // 4. Atualização do Painel Digital
    if (tipoDoSorteio === 'digital') {
       updateDigitalBola(proximaBola);
    }

    // 5. Verificação de Mudança de Prêmio ou Linha
    // Essa parte REPROCESSA cartelas JÁ carregadas. A busca de NOVAS cartelas foi feita no passo 1.
    const premioBuscadoDaAPI = buscandoData[0]?.buscando_o_premio.replace(/\s+/g, '').trim() || '';
    const linhasAtivasDaAPI = buscandoData[0]?.buscando_a_linha || '';

    if (premioBuscadoDaAPI !== buscando_o_premio.replace(/\s+/g, '').trim() || linhasAtivasDaAPI !== buscando_a_linha) {
        buscando_o_premio = premioBuscadoDaAPI;
        buscando_a_linha = linhasAtivasDaAPI;
        
        bolaBuscandoPremio = bolasCantadas.length;
        
        // Se já temos faixas definidas (carregadas pelo passo 1), processamos a conferência
        if (cartelaRanges.length > 0) {
            fetchAndProcessCards();
        } else {
            // Se não tem faixas, limpa a tela (mas não reseta o evento, pois o cliente pode estar só esperando)
            loadedCards = [];
            displayLoadedCards([]);
        }
    } else if (ultimaBolaDaLista !== ultimaBolaCantada) {
        // Verifica se não é nulo e se realmente mudou
        if (ultimaBolaDaLista !== null && ultimaBolaDaLista !== undefined) {
             falarTexto(`${ultimaBolaDaLista}`);
        }
        // Se saiu bola nova, recalcula as cartelas já carregadas
        ultimaBolaCantada = ultimaBolaDaLista;
        if (loadedCards.length > 0) {
            recalculateAndDisplayCards(bolasCantadas, premioBuscadoDaAPI, linhasAtivasDaAPI);
        }
    }
    
    // 6. Dados Promocionais
    globalPromocionalData = promocionalData;

    // 7. Configurações da Sala e Vídeo
    if (parametrosInfo) {
        const nome_da_sala = parametrosInfo.nome_sala; 

        if (nome_da_sala && salaTitleElement) {
            salaTitleElement.textContent = nome_da_sala;
        }
        
        const tipoSorteio = parametrosInfo.tipo_sorteio;
        const rawVideoID = parametrosInfo.url_live || parametrosInfo.url_padrao || '';
        video_local = parametrosInfo.video_local;
        
        // Só atualiza vídeo se mudar (evita reload do iframe)
        const videoID = rawVideoID.split('&')[0];
        const newVideoUrl = `https://www.youtube.com/embed/${videoID}?autoplay=1`;
        
        if (currentVideoUrl !== newVideoUrl) {
             currentVideoUrl = newVideoUrl;
             // Lógica de atualização do iframe se necessário
        }
        
        tipoDoSorteio = tipoSorteio;
    
        if (abrirYoutubeBtn) {
            const isLocal = String(video_local).toLowerCase() === 'true'; 
            updateEstatisticasPanelWidth(tipoSorteio);

            if (isLocal || tipoSorteio === "digital") {
                abrirYoutubeBtn.classList.add('hidden');
                if (youtubePanel && !youtubePanel.classList.contains('hidden')) {
                    abrirYoutubeBtn.click(); 
                }  
                if (tipoSorteio === "digital") {
                   digitalBolaPanel.classList.remove('hidden');
                }  
            } else {
                if (tipoSorteio !== "digital") {
                   digitalBolaPanel.classList.add('hidden');
                }  
                abrirYoutubeBtn.classList.remove('hidden');
            }
        }
    }

    // 8. Listeners de Promoção
    if (promocionalContainer) {
        promocionalContainer.onclick = () => {
            hidePromocionalPanel();
            startPromocionalTimer();
        };
    }

    // 9. Atualização de Paineis Visuais
    updateNumericPanel(bolasCantadas);
    displayLastThree(bolasData?.[0]);
    displayConferencePanel(confereData, bolasCantadas);

    // 10. Preço da Série
    if (premioInfo && typeof premioInfo.preco_da_serie === 'number') {
        const preco = premioInfo.preco_da_serie;
        ValorSerie = preco;
        const formattedPreco = new Intl.NumberFormat('pt-BR', {
            style: 'decimal',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(preco);
        
        if(precoSerieElement) precoSerieElement.textContent = formattedPreco;
        if(mobilePrecoSerieElement) mobilePrecoSerieElement.textContent = formattedPreco;
    }

    // 11. Exibe os períodos de cartelas na tela (Tags azuis)
    // Se o backend mandar ranges globais, exibe. 
    // Se preferir exibir os locais (do cliente), use 'cartelaRanges'
    if (cartelaRanges && cartelaRanges.length > 0) {
        displayCardRanges(cartelaRanges);
    } else if (data.cardRanges) {
        displayCardRanges(data.cardRanges); 
    }

    // 12. Exibe informações de Prêmios e Totais
    displayPrizeInfo(buscandoData, premioData);
    displayPrizeValues(premioData, topeData);
    
    // Atualiza totalizadores visuais
    const totalAtual = isMobileDevice() ? 
        (mobileTotalCartelasSpan ? parseInt(mobileTotalCartelasSpan.textContent) : 0) : 
        (totalCartelasSpan ? parseInt(totalCartelasSpan.textContent) : 0);
        
    checkTotalCards(totalAtual);
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

// NEW: Busca e renderiza os dados iniciais de "Melhores"
    try {
        const response = await fetch(`${API_BASE_URL}/api/melhores`);
        if (response.ok) {
            const melhoresData = await response.json();
            renderMelhores(melhoresData);
        } else {
            console.error('Erro ao buscar dados iniciais de melhores.');
            renderMelhores([]);
        }
    } catch (error) {
        console.error('Erro ao buscar dados iniciais de melhores:', error);
        renderMelhores([]);
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
        
        // Renderiza o estado inicial (que pode chamar clearPanels())
        renderMainContent(initialData); 
        
        // Conecta ao WebSocket
        connectWebSocket();
        
        // A função processarParametrosURL() agora é chamada dentro do 'ws.onopen'
        
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

// Variável para controlar se a voz está ativa (pode virar um botão de "mudo" depois)

function falarTexto(texto) {
    if (!vozAtiva) return;

    // Verifica se o navegador suporta a API
    if ('speechSynthesis' in window) {
        // Cancela qualquer fala que esteja ocorrendo (para não encavalar se o sorteio for rápido)
        window.speechSynthesis.cancel();

        const utter = new SpeechSynthesisUtterance();
        utter.text = texto;
        utter.lang = 'pt-BR'; // Define português
        utter.volume = 1;     // 0 a 1
        utter.rate = 1.1;     // Velocidade (1.1 fica mais dinâmico)
        utter.pitch = 1;      // Tom de voz

        // Tenta pegar uma voz específica (opcional, melhora a qualidade se disponível)
        const vozes = window.speechSynthesis.getVoices();
        // Procura voz do Google ou Microsoft em PT-BR (são mais naturais)
        const vozMelhor = vozes.find(v => v.lang === 'pt-BR' && (v.name.includes('Google') || v.name.includes('Microsoft')));
        if (vozMelhor) utter.voice = vozMelhor;

        window.speechSynthesis.speak(utter);
    } else {
        console.warn("Navegador não suporta síntese de voz.");
    }
}

function desbloquearAudio() {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(""); // Fala nada
        window.speechSynthesis.speak(msg);
    }
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
        requestWakeLock(); 
        const initialRequest = { action: "GET_INITIAL_STATE" };
        ws.send(JSON.stringify(initialRequest));
        console.log("Conexão aberta. Solicitando estado inicial ao servidor.");

        // --- INÍCIO DA MODIFICAÇÃO (CHAMADA DA FUNÇÃO) ---
        // Agora que o app está conectado, processamos os parâmetros da URL.
        // Damos um pequeno atraso para garantir que a primeira mensagem (estado inicial)
        // seja processada antes de tentarmos carregar as cartelas.
        setTimeout(processarParametrosURL, 500); // 500ms de atraso
        // --- FIM DA MODIFICAÇÃO ---
    };

ws.onmessage = (event) => {
    try {
        const payload = JSON.parse(event.data);
        
        const melhoresData = payload.melhoresData;
        
        const mainData = payload.data; 

        if (payload.type === 'UPDATE') {
            // Se o payload for 'UPDATE', renderiza o conteúdo principal
            renderMainContent(payload); 
            
            // E se houver dados de melhores, renderiza-os
            if (melhoresData) {
                renderMelhores(melhoresData);
            }
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

    const btnIrTop10 = document.getElementById('btn-ir-para-top10');
    const btnIrLista = document.getElementById('btn-ir-para-lista');
    const viewLista = document.getElementById('view-lista-numerica');
    const viewTop10 = document.getElementById('view-top10-grafico');

    if (btnIrTop10 && btnIrLista && viewLista && viewTop10) {
        btnIrTop10.addEventListener('click', () => {
            viewLista.classList.add('hidden');
            viewTop10.classList.remove('hidden');
        });

        btnIrLista.addEventListener('click', () => {
            viewTop10.classList.add('hidden');
            viewLista.classList.remove('hidden');
        });
    }

// --- CONTROLE DE VOZ (MOBILE) ---
    const btnToggleVoz = document.getElementById('btn-toggle-voz');
    const iconVozOn = document.getElementById('icon-voz-on');
    const iconVozOff = document.getElementById('icon-voz-off');

    // Sincroniza o botão com o estado inicial (vozAtiva = true)
    if (btnToggleVoz) {
        // Função interna para atualizar os ícones
        const updateVozIcons = () => {
            if (vozAtiva) {
                iconVozOn.classList.remove('hidden');
                iconVozOff.classList.add('hidden');
                btnToggleVoz.classList.add('bg-gray-700');     // Estilo Ativo
                btnToggleVoz.classList.remove('bg-red-900');
            } else {
                iconVozOn.classList.add('hidden');
                iconVozOff.classList.remove('hidden');
                btnToggleVoz.classList.remove('bg-gray-700');
                btnToggleVoz.classList.add('bg-red-900');      // Estilo Mudo (Vermelho escuro)
            }
        };

        // Estado inicial
        updateVozIcons();

        // Clique no botão
        btnToggleVoz.addEventListener('click', () => {
            vozAtiva = !vozAtiva; // Inverte o estado (true <-> false)
            
            // Se ativou, tenta desbloquear o áudio (para iOS/Chrome)
            if (vozAtiva) {
                desbloquearAudio();
                falarTexto("Áudio Ativado");
            } else {
                window.speechSynthesis.cancel(); // Para qualquer fala atual
            }
            
            updateVozIcons();
        });
    }

// --- LÓGICA PARA ALTERNAR VISUALIZAÇÃO NO MOBILE ---
    const btnMobileTop10 = document.getElementById('btn-ir-para-top10-mobile');
    const btnMobileLista = document.getElementById('btn-ir-para-lista-mobile');
    const viewMobileLista = document.getElementById('view-lista-numerica-mobile');
    const viewMobileTop10 = document.getElementById('view-top10-grafico-mobile');

    if (btnMobileTop10 && btnMobileLista && viewMobileLista && viewMobileTop10) {
        btnMobileTop10.addEventListener('click', () => {
            viewMobileLista.classList.add('hidden');
            viewMobileTop10.classList.remove('hidden');
        });

        btnMobileLista.addEventListener('click', () => {
            viewMobileTop10.classList.add('hidden');
            viewMobileLista.classList.remove('hidden');
        });
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

// --- INÍCIO DAS NOVAS FUNÇÕES (Movidas do index.html para cá) ---
// (Estas funções agora são parte do script.js e não estão mais no index.html)

/**
 * Função principal que processa os parâmetros da URL.
 * É chamada pelo ws.onopen
 */
async function processarParametrosURL() {
    
    console.log("Processando parâmetros da URL...");
    
    const urlParams = new URLSearchParams(window.location.search);
    // --- Processa o idcliente --- 
    clienteLogadoId =  urlParams.get('idcliente');
    //if (!clienteLogadoId) {
    //    console.log("Nenhum parâmetro 'idcliente' encontrado.");
    //}
    console.log("idcliente encontrado  :",clienteLogadoId);
    // --- Processa o idrodada ---
    const idRodadaParam = urlParams.get('idrodada');
    if (idRodadaParam) {
        try {
            idRodada = parseInt(idRodadaParam);
            if (isNaN(idRodada)) idRodada = 0;
            console.log("ID da Rodada definido globalmente:", idRodada);
        } catch (e) { idRodada = 0; }
    }
    
    // --- Processa os Períodos ---
    const periodosArr = urlParams.getAll('periodo');
    if (periodosArr.length === 0) {
        console.log("Nenhum parâmetro 'periodo' encontrado.");
        return; // Sai da função
    }

    //console.log("Parâmetros de período detectados:", periodosArr);
    
    // Pega os elementos
    const loader = document.getElementById('loader');
    const pcInicioInput = document.getElementById('cartela-inicial-input');
    const pcFimInput = document.getElementById('cartela-final-input');
    const mobileInicioInput = document.getElementById('mobile-cartela-inicial-input');
    const mobileFimInput = document.getElementById('mobile-cartela-final-input');

    let faixasAdicionadas = false;

    // Loop por CADA período
    for (const periodo of periodosArr) {
        try {
            const partes = periodo.split(',');
            const inicio = partes[0].trim();
            const fim = partes[1].trim();

            if (!inicio || !fim || isNaN(parseInt(inicio)) || isNaN(parseInt(fim))) {
                console.warn("Pulando período mal formatado:", periodo);
                continue; // Pula para o próximo
            }

            // Preenche os inputs (ambos os modos)
            // (Não precisamos disparar 'input' pois vamos chamar o helper diretamente)
            pcInicioInput.value = inicio;
            pcFimInput.value = fim;
            mobileInicioInput.value = inicio;
            mobileFimInput.value = fim;

            // Chama a função helper DIRETAMENTE
            // (O 'false' impede que os timers de esconder/promo sejam disparados)
            if (adicionarFaixaDeCartelas(false)) {
                console.log(`Período ${inicio}-${fim} adicionado ao cartelaRanges.`);
                faixasAdicionadas = true;
            } else {
                console.warn(`Falha ao adicionar período ${inicio}-${fim} (provavelmente sobreposição).`);
            }

        } catch (e) {
            console.error("Erro ao processar período:", periodo, e);
        }
    } // Fim do loop 'for'
    
    // --- CHAMADA ÚNICA ---
    // Se adicionamos pelo menos uma faixa, agora buscamos TODAS de uma vez
    if (faixasAdicionadas) {
        console.log("Todas as faixas processadas. Buscando todas as cartelas de uma vez...");
        
        // Mostra o loader manualmente
        loader.classList.remove('hidden'); 
        loader.style.display = 'flex';
        
        // Chama a função de busca
        await fetchAndProcessCards();
        
        // fetchAndProcessCards() já esconde o loader no 'finally'
    }
    
    console.log("Todos os períodos da URL foram processados.");
}

// --- FIM DAS NOVAS FUNÇÕES ---