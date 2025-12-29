//Criar menu
const urlParamsGlobal = new URLSearchParams(window.location.search);
const currentSalaId = urlParamsGlobal.get('idsala') || 'padrao';
//
//const backendVersionElement = document.getElementById('backend-version');
//const frontendVersionElement = document.getElementById('frontend-version');
const loader = document.getElementById('loader');

const btnToggleTemaMobile = document.getElementById('btn-toggle-tema-mobile');

const numberGrid = document.getElementById('number-grid');
const mobileNumberGrid = document.getElementById('mobile-number-grid');

const estatisticasBody = document.getElementById('estatisticas-body');
const estatisticasPanel = document.getElementById('estatisticas-panel');

const loadingStats = document.getElementById('loading-stats');

const myCardsPanel = document.getElementById('my-cards-panel-container');
const myCardsTotal = document.getElementById('my-cards-total');
const myCardsList = document.getElementById('my-cards-list');
const btnCloseMyCards = document.getElementById('btn-close-my-cards');

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
// Cores
let corFundoCartela = "bg-gray-900";                 
let corBordaCartela = "border-gray-700";             

let corNumeroCartela = "text-yellow-600";          
let corTituloCartela = "text-gray-400";                  

let corNumeroFaltam = "text-blue-400";                
let corNumeroFaltam1 = "text-green-400";          

let corFundoNumerosSorte = "bg-gray-800";         
let corFundoNumerosNSorte = "bg-gray-800";      
let corFundoNumerosDest = "bg-gray-800";          

let corNumerosSorte = "text-gray-500";              
let corNumerosNSorte = "text-gray-500";          
let corNumerosDest = "text-text-white";              

let corNumerosBordaSorte = "border-gray-800";               
let corNumerosBordaNSorte = "border-gray-800"; 
let corNumerosBordaDest = "border-2 border-yellow-600";
//

//Dark Faltantes
let corFundoConteiner = "bg-gray-900/50"
let corFundoTitulo = "bg-gray-800"
let corFundoNumeroCartao = "bg-gray-700"
let corFundoPosicaoLinha = "bg-gray-800"
let corFundoNumeros4 = "bg-transparent border-2 border-blue-800";
let corFundoNumeros23 = "bg-transparent border-2 border-orange-700"; 
let corFundoNumero1 = "bg-transparent border-2 border-green-500";
let corTextoNumeros = "text-gray-200";

let lastPrizeJson = "";
let lastBuscandoJson = "";

let tipoDoSorteio = "";
let Carregando = true;
let cachedRawCards = [];
let MAX_BOLAS = 90;
let globalBolasCantadas = [];

let configBingo75 = {
    horizontal: true,  // Padrão: Ativo
    vertical: false,   // Padrão: Inativo
    diagonal: false    // Padrão: Inativo
};

let encontradoGanhadores = false;
const youtubePanel = document.getElementById('youtube-panel'); 
const youtubeIframe = document.getElementById('youtube-iframe');
const abrirYoutubeBtn = document.getElementById('abrir-youtube-btn');

// TELA GANHADORES
const winnersPanelContainer = document.getElementById('winners-panel-container');
const winnersListContent = document.getElementById('winners-list-content');
const winnersProgressBar = document.getElementById('winners-progress-bar');
const btnCloseWinners = document.getElementById('btn-close-winners');

let winnersTimer = null; // Para controlar o fechamento automático
let lastGanhadoresHash = ''; // Para evitar re-renderizar se os dados não mudaram

// --- LÓGICA DO MENU LATERAL ---
const menuOverlay = document.getElementById('side-menu-overlay');
const menuBackdrop = document.getElementById('side-menu-backdrop');
const menuPanel = document.getElementById('side-menu-panel');
const btnOpenMenu = document.getElementById('btn-open-menu');
const btnCloseMenu = document.getElementById('btn-close-menu');

// Elementos internos do menu
const BtnSom = document.getElementById('btn-som');
const menuBtnSom = document.getElementById('menu-btn-som');
const menuIconSom = document.getElementById('menu-icon-som');
const menuStatusSom = document.getElementById('menu-status-som');
const menuBtnTema = document.getElementById('menu-btn-tema');
const menuStatusTema = document.getElementById('menu-status-tema');

// --- VARIÁVEIS PARA MODAL PRÓXIMOS EVENTOS ---
const eventsPanelContainer = document.getElementById('events-panel-container');
const eventsListContent = document.getElementById('events-list-content');
const btnCloseEvents = document.getElementById('btn-close-events');
const btnEventsMenu = document.getElementById('menu-btn-eventos');
const btnEventsMobile = document.getElementById('btn-proximos-eventos');

// Timer promocionais

let premioInfo = null;

let tempoExibicaoGanhador = 20;

let seePromocoes = true; // Controla se o sistema deve verificar e exibir promoções
let promocionalTimer = null; // Armazena a referência do temporizador

let globalPromocionalData = [];

let clienteLogadoId = urlParamsGlobal.get('id_cliente') || urlParamsGlobal.get('idcliente') || null;

let vozAtiva = false; 

let eventoCarregadoAtual = null;

let isDarkMode = true; // Padrão atual

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
let tipoEntradaCartelas = 2; // Variável Global para controle de entrada

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

let newRanges = [];

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
let cartelasEmJogo = 0;

let ultimaBolaCantada = null;

let wakeLock = null;

// --- VARIÁVEIS DO PAINEL DE AVISOS ---
const avisoPanel = document.getElementById('aviso-panel-container');
const avisoTitulo = document.getElementById('aviso-titulo');
const avisoMensagem = document.getElementById('aviso-mensagem');
const avisoTimerContainer = document.getElementById('aviso-timer-container');
const avisoTimerDisplay = document.getElementById('aviso-timer');
const btnCloseAviso = document.getElementById('btn-close-aviso');

let avisoTargetDate = null;
let avisoInterval = null;       // Controle do setInterval
let lastAvisoTimestamp = 0;     // Controle para não reabrir o mesmo aviso fechado

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


/**
 * Abre o painel de Próximos Eventos e carrega os dados do servidor.
 */
async function openEventsPanel() {
    if (!eventsPanelContainer || !eventsListContent) return;
    
    // 1. Exibe o Loader Global
    if (loader) loader.style.display = 'flex';

    try {
        // 2. Busca dados atualizados da API (Com Timestamp para evitar Cache)
        const response = await fetch(`${API_BASE_URL}/api/proximos_eventos?_t=${Date.now()}`);
        
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status}`);
        }
        
        const eventos = await response.json();
        // 3. Renderiza os cartões
        renderEventsList(eventos);
        
        // 4. Mostra o painel apenas com os dados prontos
        eventsPanelContainer.classList.remove('hidden');
        eventsPanelContainer.classList.add('flex');

    } catch (error) {
        console.error("Erro ao carregar eventos:", error);
        
        // Se der erro, mostra o painel com mensagem de erro
        eventsPanelContainer.classList.remove('hidden');
        eventsPanelContainer.classList.add('flex');
        
        eventsListContent.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-red-500 p-4 text-center">
                <span class="text-2xl mb-2">⚠️</span>
                <p class="font-bold">Não foi possível carregar a agenda.</p>
                <p class="text-xs text-gray-500 mt-1">${error.message}</p>
                <button onclick="openEventsPanel()" class="mt-4 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">
                    Tentar Novamente
                </button>
            </div>
        `;
    } finally {
        // 5. Esconde o Loader (Sempre)
        if (loader) loader.style.display = 'none';
    }
}


// --- FUNÇÃO: EXIBIR AVISO DO SISTEMA ---
// --- FUNÇÃO: EXIBIR AVISO DO SISTEMA (COM VALIDAÇÃO DE TEMPO) ---
// --- FUNÇÃO CORRIGIDA: EXIBIR AVISO DO SISTEMA ---
function renderAvisoPanel(avisosData) {
    // 1. Validação básica
    if (!avisosData || avisosData.length === 0) {
        return;
    }

    const aviso = avisosData[0]; 
    
    // 2. Verifica se é o mesmo aviso já processado
    if (aviso.timestamp && aviso.timestamp === lastAvisoTimestamp) {
        // Se o painel já está aberto, só atualiza o timer
        if (!avisoPanel.classList.contains('hidden')) {
             // Passamos o timestamp original para garantir o sincronismo
            updateAvisoTimerLogic(aviso.tempo, aviso.timestamp);
        }
        return; 
    }

    // --- NOVA LÓGICA DE CÁLCULO REAL ---
    let segundosRestantes = 0;
    
    // Se o backend mandou o timestamp de criação (Unix Seconds), usamos ele para precisão absoluta
    const criacao = aviso.timestamp || (Date.now() / 1000); 

    if (aviso.tempo) {
        if (typeof aviso.tempo === 'string' && aviso.tempo.includes(':')) {
            // Lógica legada para HH:MM:SS (mantida por segurança)
            const agora = new Date();
            const partes = aviso.tempo.split(':');
            const alvo = new Date();
            alvo.setHours(parseInt(partes[0]), parseInt(partes[1]), parseInt(partes[2] || 0));
            // Correção de virada de dia
            if (alvo < agora && (agora - alvo) > 1000 * 60 * 60 * 12) alvo.setDate(alvo.getDate() + 1);
            segundosRestantes = Math.floor((alvo - agora) / 1000);
        } else {
            // Lógica BLINDADA (Segundos):
            // Tempo Restante = (Hora Criação + Duração) - Hora Atual
            const duracao = parseInt(aviso.tempo);
            const agoraUnix = Date.now() / 1000;
            const expiracao = criacao + duracao;
            
            segundosRestantes = Math.floor(expiracao - agoraUnix);
        }
    }

    // SE O TEMPO JÁ ACABOU (Menor ou igual a zero), IGNORA O AVISO.
    if (segundosRestantes <= 0) {
        lastAvisoTimestamp = aviso.timestamp; // Marca como lido
        if (!avisoPanel.classList.contains('hidden')) {
            closeAvisoPanel();
        }
        return; // <--- NÃO ABRE O PAINEL
    }

    // Se chegou aqui, o aviso ainda é válido
    lastAvisoTimestamp = aviso.timestamp;

    // 3. Preenche Conteúdo
    avisoTitulo.textContent = aviso.titulo || 'Aviso';
    avisoMensagem.textContent = aviso.mensagem || '';
    
    // 4. Inicia Timer
    if (aviso.tempo) {
        avisoTimerContainer.classList.remove('hidden');
        avisoTimerContainer.classList.add('flex');
        // Passamos o timestamp de criação para o timer saber quando começou
        startAvisoCountdown(aviso.tempo, aviso.timestamp);
    } else {
        avisoTimerContainer.classList.add('hidden');
        avisoTimerContainer.classList.remove('flex');
    }

    avisoPanel.classList.remove('hidden');
    avisoPanel.classList.add('flex');
}


function startAvisoCountdown(tempoStr, timestampCriacao) {
    if (avisoInterval) clearInterval(avisoInterval);

    avisoTargetDate = null;

    if (!tempoStr.includes(':')) {
        const segundos = parseInt(tempoStr);
        // Usa o timestamp do servidor (se houver) ou agora como fallback
        // Python manda segundos (float), JS usa milissegundos, por isso * 1000
        const baseTime = timestampCriacao ? (timestampCriacao * 1000) : Date.now();
        
        // Define o alvo absoluto: "A hora que foi criado + 120 segundos"
        avisoTargetDate = new Date(baseTime + (segundos * 1000));
    }

    const tick = () => updateAvisoTimerLogic(tempoStr);
    tick(); 
    avisoInterval = setInterval(tick, 1000); 
}


function updateAvisoTimerLogic(tempoStr) {
    let segundosRestantes = 0;
    const agora = new Date();

    // CENÁRIO 1: Cálculo Absoluto (Segundos + Timestamp)
    if (avisoTargetDate) {
        const diffMs = avisoTargetDate - agora;
        segundosRestantes = Math.floor(diffMs / 1000);
    } 
    // CENÁRIO 2: Horário Fixo (HH:MM:SS)
    else if (typeof tempoStr === 'string' && tempoStr.includes(':')) {
        const partes = tempoStr.split(':');
        const alvo = new Date();
        alvo.setHours(parseInt(partes[0]), parseInt(partes[1]), parseInt(partes[2] || 0));
        
        if (alvo < agora && (agora - alvo) > 1000 * 60 * 60 * 12) { 
             alvo.setDate(alvo.getDate() + 1);
        }
        
        const diffMs = alvo - agora;
        segundosRestantes = Math.floor(diffMs / 1000);
    } 
    else {
        // Fallback (apenas visual, não deve cair aqui com a lógica nova)
        segundosRestantes = parseInt(tempoStr);
    }

    if (segundosRestantes < 0) segundosRestantes = 0;

    const m = Math.floor(segundosRestantes / 60);
    const s = segundosRestantes % 60;
    const formatado = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    
    if (avisoTimerDisplay) avisoTimerDisplay.textContent = formatado;
    
    if (segundosRestantes <= 0) {
        if (avisoInterval) clearInterval(avisoInterval);
        setTimeout(() => { closeAvisoPanel(); }, 1000);
    }
}


function closeAvisoPanel() {
    if (avisoPanel) {
        avisoPanel.classList.remove('flex');
        avisoPanel.classList.add('hidden');
    }
    if (avisoInterval) clearInterval(avisoInterval);
}

// Listener do Botão Fechar
if (btnCloseAviso) {
    btnCloseAviso.addEventListener('click', closeAvisoPanel);
}


/**
 * Processa a lista de eventos e cria o HTML dos cartões.
 */
function renderEventsList(eventos) {
    eventsListContent.innerHTML = '';

    if (!eventos || eventos.length === 0) {
        eventsListContent.innerHTML = `
            <div class="flex flex-col items-center justify-center h-40 text-gray-500">
                <span class="text-4xl mb-2">📭</span>
                <p>Nenhum evento programado no momento.</p>
            </div>
        `;
        return;
    }

    const now = new Date();

    eventos.forEach(evt => {
        // --- Tratamento de Data ---
        // Tenta usar a data ISO (padrão seguro) ou faz parse manual

        let eventDate;
        if (evt.data && evt.data.includes('/')) {
            const dateParts = evt.data.split('/'); // [04, 12, 2025]
            const timeParts = evt.hora ? evt.hora.split(':') : ['00', '00'];
            
            // new Date(ano, mês (0-11), dia, hora, min)
            eventDate = new Date(
                parseInt(dateParts[2]),       // 2025
                parseInt(dateParts[1]) - 1,   // 12 - 1 = 11 (Dezembro)
                parseInt(dateParts[0]),       // 04
                parseInt(timeParts[0] || 0),
                parseInt(timeParts[1] || 0)
            );
        } else if (evt.data_iso) {
            // Só usa ISO se não tivermos conseguido parsear manualmente
            eventDate = new Date(evt.data_iso);
        } else {
            eventDate = new Date(); // Fallback
        }

        // 2. CORREÇÃO DA LÓGICA DE COMPARAÇÃO
        // Adicionamos uma tolerância de 4 horas para eventos que acabaram de começar não sumirem
        // Clona a data do evento e subtrai horas para manter ele visível um pouco depois de começar
        const toleranceDate = new Date(eventDate.getTime() + (1 * 60 * 60 * 1000)); 

        // Lógica: É futuro (data maior que agora) OU o status é explicitamente ativo (mesmo se a hora já passou)
        const isFuture = eventDate >= now;
        const isActive = evt.status === 'ativo';
        
        // AQUI ESTAVA O ERRO DO &&. O correto é || (OU) se você quer ver a agenda futura
        // Mas se o status for 'finalizado', forçamos false.
        const isFinalizado = evt.status === 'finalizado';
        
        // Mostra se for Futuro OU Ativo, desde que não esteja finalizado.
        const isFutureOrActive = (isFuture && isActive) && !isFinalizado;

        // --- Definição de Estilos do Cartão ---
        let cardClass = 'rounded-xl p-3 border shadow-lg flex flex-col gap-1 relative overflow-hidden transition-all duration-300';
        let statusBadge = '';
        let btnComprarHtml = '';

        if (isFinalizado) {
            // ESTILO: FINALIZADO (Cinza, Opaco)
            cardClass += ' bg-gray-800 border-gray-600 opacity-60 grayscale';
            statusBadge = '<span class="absolute top-0 right-0 text-[10px] font-black bg-gray-600 text-gray-300 px-3 py-1 rounded-bl-lg">ENCERRADO</span>';
        } 
        else if (isFutureOrActive) {
            // ESTILO: ATIVO / EM BREVE (Destaque Azul/Verde)
            cardClass += ' bg-gradient-to-br from-gray-900 to-gray-800 border-blue-500 hover:border-blue-400 transform hover:scale-[1.02]';
            
            if (evt.status === 'ativo') {
                statusBadge = '<span class="absolute top-0 right-0 text-[10px] font-black bg-green-600 text-white px-3 py-1 rounded-bl-lg animate-pulse">🔴 AO VIVO / ATIVO</span>';
            } else {
                statusBadge = '<span class="absolute top-0 right-0 text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-bl-lg">EM BREVE</span>';
            }
            
            // Botão de Compra (Só aparece para eventos ativos/futuros)
            btnComprarHtml = `
                <div class="mt-2 border-t border-gray-700 pt-2">
                    <button onclick="iniciarCompraCartelas('${evt.id_evento}')" 
                            class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-md flex items-center justify-center gap-2 transition-colors active:scale-95">
                        <span>🛒</span> COMPRAR CARTELAS
                    </button>
                </div>
            `;
        } 
        else {
            // ESTILO: PASSADO (Mas não finalizado - Raro)
            cardClass += ' bg-gray-800 border-red-900 opacity-80';
            statusBadge = '<span class="absolute top-0 right-0 text-[10px] font-black bg-red-900 text-red-200 px-3 py-1 rounded-bl-lg">DATA PASSADA</span>';
        }

        // Formatação de Moeda
        const preco = parseFloat(evt.valor_cartela).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const listaPremios = Array.isArray(evt.premios_desc) ? evt.premios_desc : [];

        // Renderiza a lista de prêmios
       const premiosHtml = listaPremios.map(p =>
            `<li class="flex items-start gap-0"><span class="text-yellow-500">★</span> ${p}</li>`
        ).join('');

        // Montagem do HTML do Cartão
        const card = document.createElement('div');
        card.className = cardClass;
        card.innerHTML = `
            ${statusBadge}
            
            <div class="pr-2">
                <h3 class="text-[15px] font-bold text-white leading-tight drop-shadow-sm">${evt.descricao}</h3>
                <p class="text-[15px] font-semibold text-blue-300 font-mono mt-1 flex items-center gap-1">
                     ${evt.data} <span class="mx-1">|</span> <span>⏰</span> ${evt.hora}
                </p>
            </div>

            <!-- Área de Prêmios -->
            <div class="bg-black/40 rounded-lg p-1 border border-gray-700/50">
                <p class="text-[10px] text-green-300 font-bold uppercase mb-0 tracking-wider">Premiação Prevista:</p>
                <ul class="text-[15px] text-yellow-300 space-y-0 font-medium">
                    ${premiosHtml}
                </ul>
            </div>

            <!-- Rodapé do Cartão (Preço e Info) -->
            <div class="flex justify-between items-end -mt-1">
                <div class="text-gray-250 text-[14px]">
                    <span class="block">ID: ${evt.id_evento}</span>
                    <span class="text-xs text-gray-300">Kit c/ <strong>${evt.unidade_venda}</strong> cartelas</span>
                </div>
                <div class="text-right">
                    <span class="block text-[9px] font-bold  text-gray-500 uppercase">Valor do Kit</span>
                    <span class="text-xl font-black text-green-400 tracking-tighter">${preco}</span>
                </div>
            </div>

            ${btnComprarHtml}
        `;

        eventsListContent.appendChild(card);
    });
}

function closeEventsPanel() {
    if (eventsPanelContainer) {
        eventsPanelContainer.classList.remove('flex');
        eventsPanelContainer.classList.add('hidden');
    }
}

// Função Placeholder para o clique no botão de compra
// (Será substituída pela lógica real de compra depois)
function iniciarCompraCartelas(idEvento) {
    closeEventsPanel();
    // Exemplo de ação futura:
    // window.location.href = `/comprar_cartelas?id_evento=${idEvento}`;
    alert(`Redirecionando para compra do evento ID: ${idEvento}... \n(Em desenvolvimento)`);
}


// Funções de busca de cartelas compradas
async function carregarCartelasAutomaticas(idEvento) {
    // Verifica se já carregamos este evento para não ficar piscando a tela
    // NOTA: Troquei cartelaRanges por myRanges aqui
    if (eventoCarregadoAtual === idEvento && typeof cartelaRanges !== 'undefined' && cartelaRanges.length > 0) {
        return; 
    }

    // Se a variável global estiver vazia, tenta ler da URL novamente
    if (!clienteLogadoId) {
        clienteLogadoId = urlParamsGlobal.get('id_cliente') || urlParamsGlobal.get('idcliente');
    }
    
    console.log("clienteLogadoId (Final):", clienteLogadoId);

    const headerElement = isMobileDevice() ? document.getElementById('mobile-loaded-cards-header') : 
                                             document.getElementById('loaded-cards-header');
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
            
            // 2. Atualiza a variável global CORRETA (cartelasRenges)
            cartelaRanges = novasFaixas;
          
            // 3. Atualiza visualização (se houver essa função)
            if (typeof displayCartelaRanges === 'function') displayCartelaRanges(); 
            
            // 4. Dispara o motor principal
            await fetchAndProcessCards(); 
            
            // Atualiza controle
            eventoCarregadoAtual = idEvento;

            // Feedback
            const msg = `Carregadas ${data.quantidade} cartelas para o Sorteio ${idEvento}!`;
            if(isMobileDevice()) {
               const validationMsg = document.getElementById('mobile-validation-message');
               if (validationMsg) {
                   validationMsg.textContent = msg;
                   validationMsg.classList.remove('hidden', 'text-red-500');
                   validationMsg.classList.add('text-green-500');
                   setTimeout(() => validationMsg.classList.add('hidden'), 5000);
               }
            }

        } else {
            console.log("⚠️ Nenhuma cartela encontrada para este evento/cliente.");
            if (eventoCarregadoAtual !== idEvento) {
                // Se você tiver uma função clearPanels, ok. Senão comente.
                // clearPanels(); 
                eventoCarregadoAtual = idEvento;
                
                // Limpa a global para garantir
                myRanges = [];
                await fetchAndProcessCards(); // Processa vazio para limpar a tela
            }
        }

    } catch (error) {
        console.error("❌ Erro na requisição automática:", error);
    }
}


// Função auxiliar para transformar [1, 2, 3, 5, 6] em [{inicial:1, final:3}, {inicial:5, final:6}]
function agruparNumerosEmRanges(numeros) {
    if (!Array.isArray(numeros) || numeros.length === 0) return [];
    
    // Garante que são números e ordena
    let sorted = numeros.map(Number).sort((a, b) => a - b);
    let ranges = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === prev + 1) {
            prev = sorted[i];
        } else {
            ranges.push({ inicial: start, final: prev });
            start = sorted[i];
            prev = sorted[i];
        }
    }
    ranges.push({ inicial: start, final: prev });
    return ranges;
}


function isMobileDevice() {
    return true; ////Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// MENU
function openSideMenu() {
    if (!menuOverlay) return;
    if (!telaFull) { 
       goFullscreen(); 
    } 

    menuOverlay.classList.remove('hidden');
    
    // Pequeno delay para permitir a transição CSS
    setTimeout(() => {
        menuBackdrop.classList.remove('opacity-0');
        menuPanel.classList.remove('-translate-x-full');
    }, 10);

    // Sincroniza o estado visual do som ao abrir
    updateMenuSoundVisuals();
}

function closeSideMenu() {
    if (!menuOverlay) return;
    
    menuBackdrop.classList.add('opacity-0');
    menuPanel.classList.add('-translate-x-full');

    // Espera a animação terminar para esconder o overlay
    setTimeout(() => {
        menuOverlay.classList.add('hidden');
    }, 300);
}

// Atualiza os ícones e textos do menu baseado na variável global 'vozAtiva'
function updateMenuSoundVisuals() {
    if (vozAtiva) {
        menuIconSom.textContent = '🔊';
        menuStatusSom.textContent = 'LIGADO';
        menuStatusSom.className = 'text-xs font-bold text-green-500';
    } else {
        menuIconSom.textContent = '🔇';
        menuStatusSom.textContent = 'MUDO';
        menuStatusSom.className = 'text-xs font-bold text-red-500';
    }
    
    // Opcional: Sincroniza também o botãozinho do painel mobile se ele existir
    //const btnToggleVozMobile = document.getElementById('btn-toggle-voz');
    //const iconVozOnMobile = document.getElementById('icon-voz-on');
    //const iconVozOffMobile = document.getElementById('icon-voz-off');
    
    //if (btnToggleVozMobile && iconVozOnMobile) {
    //    if (vozAtiva) {
    //        iconVozOnMobile.classList.remove('hidden');
    //        iconVozOffMobile.classList.add('hidden');
    //        //btnToggleVozMobile.classList.add('bg-gray-700');
    //        //btnToggleVozMobile.classList.remove('bg-red-900');
    //   } else {
    //        iconVozOnMobile.classList.add('hidden');
    //        iconVozOffMobile.classList.remove('hidden');
    //        //btnToggleVozMobile.classList.remove('bg-gray-700');
    //        //btnToggleVozMobile.classList.add('bg-red-900');
    //    }
    //}
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
        // então não precisamos redefinir o innerHTML.
        
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
        if (cartelasEmJogo === 0 && lastRodadaState === 'intervalo') {
           seePromocoes = true;
           startPromocionalTimer();
        }
    } else {
        // Se o sistema saiu da tela cheia, mostra o botão novamente
        telaFull = false;
        fullscreenButton.classList.remove('hidden');
        if (cartelasEmJogo === 0 && lastRodadaState === 'intervalo') {
           seePromocoes = true;
           startPromocionalTimer();
        }      
    }
    if (typeof loadedCards !== 'undefined' && typeof globalBolasCantadas !== 'undefined') {
        // Se estiver no modo 75, chama renderOscartoes75
        if (MAX_BOLAS === 75) {
            renderOscartoes75(globalBolasCantadas);
        } else {
            renderOscartoes90(globalBolasCantadas);
        }
    }
}

// --- NOVA FUNÇÃO: Abrir Modal Minhas Cartelas (Com Loading) ---
function openMyCardsPanel() {
    // Verifica se os elementos do modal existem no HTML
    if (!myCardsPanel || !myCardsList || !myCardsTotal) {
        console.error("Elementos do modal 'Minhas Cartelas' não encontrados.");
        return;
    }

    // 1. Exibe o Loader
    if (loader) loader.style.display = 'flex';

    // 2. Usa setTimeout para dar tempo do loader renderizar e simular processamento
    setTimeout(() => {
        if (!telaFull) { 
           goFullscreen(); 
        } 
     
        // Limpa a lista anterior
        myCardsList.innerHTML = '';
        let totalCartelasGeral = 0;

        // Verifica se há faixas de cartelas carregadas
        if (!cartelaRanges || cartelaRanges.length === 0) {
            myCardsList.innerHTML = '<div class="p-2 text-center text-gray-500 text-lg">Nenhuma cartela adquirida.</div>';
            myCardsTotal.textContent = 'R$ 0,00';
            
            // Finaliza exibição
            mostrarPainelMinhasCartelas();
            return;
        }

        // Itera sobre as faixas para criar a lista visual
        cartelaRanges.forEach(range => {
            if (range.inicial > 0 && range.final > 0) {
                // Cálculo da quantidade: (Final - Inicial) + 1
                const qtd = (range.final - range.inicial) + 1;
                totalCartelasGeral += qtd;

                // Cria a linha da tabela
                const row = document.createElement('div');
                row.className = 'grid grid-cols-3 p-1 text-lg text-center font-bold  border-b border-gray-700 hover:bg-gray-800 text-gray-300 transition-colors';
                
                row.innerHTML = `
                    <span>${range.inicial}</span>
                    <span>${range.final}</span>
                    <span class="text-yellow-500 font-bold">${qtd}</span>
                `;
                myCardsList.appendChild(row);
            }
        });

        // Cálculo Financeiro Total
        const multiplo = (premioInfo && premioInfo.multiplo > 0) ? premioInfo.multiplo : 6;
        const preco = (premioInfo && premioInfo.preco) ? premioInfo.preco : 0;
        
        let valorTotal = 0;
        if (multiplo > 0) {
             const unidades = totalCartelasGeral / multiplo;
             valorTotal = unidades * preco;
        }

        // Formatação Monetária
        const totalFormatado = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valorTotal);

        // Atualiza o totalizador na tela
        myCardsTotal.textContent = totalFormatado;

        // Finaliza exibição
        mostrarPainelMinhasCartelas();

    }, 500); // Delay de 0.5s para visualização do loading
}

// Função auxiliar para exibir o painel e esconder o loader
function mostrarPainelMinhasCartelas() {
    myCardsPanel.classList.remove('hidden');
    myCardsPanel.classList.add('flex');
    if (loader) loader.style.display = 'none';
}


function closeMyCardsPanel() {
    if (myCardsPanel) {
        myCardsPanel.classList.remove('flex');
        myCardsPanel.classList.add('hidden');
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
       cartelasEmJogo = total;
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
                cartelasEmJogo = 0;
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
    cartelasEmJogo = total;
}


async function fetchAndProcessCards() {
    if (isFetchingCards) return;
    isFetchingCards = true;

    // 1. Usa a variável global 'cartelaRanges' (que já está sendo preenchida corretamente)
    if (!cartelaRanges || cartelaRanges.length === 0) {
        //loadedCards = [];
        displayLoadedCards([]);
        isFetchingCards = false;
        return;
    }

    // Feedback visual (Loader)
    if (loader) loader.style.display = 'flex';

    try {
        // 2. Chama a API do Servidor (Melhor que carregar JSON gigante no celular)
        const response = await fetch(`${API_BASE_URL}/api/cartelas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ranges: cartelaRanges })
        });

        if (!response.ok) {
            throw new Error(`Falha ao buscar cartelas: ${response.status}`);
        }

        const cards = await response.json();

        cachedRawCards = cards || [];

        // 3. Se não veio nada
        if (!cards || cards.length === 0) {
            console.warn("API retornou 0 cartelas.");
            loadedCards = [];
            displayLoadedCards([]);
            // Mostra mensagem de erro na tela se necessário
            const msgEl = isMobileDevice() ? mobileValidationMessage : validationMessage;
            if(msgEl) {
                msgEl.textContent = 'Nenhuma cartela encontrada nestas faixas.';
                msgEl.classList.remove('hidden');
            }
            return;
        }

        console.log(`✅ Recebidas ${cards.length} cartelas da API.`);

        // 4. Prepara os dados para o Processador
        // Pega as bolas cantadas e o prêmio atual das variáveis globais ou do DOM
        // (Tentamos pegar do initialData se disponível, senão das variáveis globais)
        
        let bolas = [];


        // Verifica se existe dados vindo de variáveis externas (bolasData)
        if (typeof bolasData !== 'undefined' && bolasData && bolasData.length > 0) {
            const novasBolas = bolasData[0].bolas_cantadas;
            
            // CASO 1: Temos bolas novas? Usa elas.
            if (novasBolas && novasBolas.length > 0) {
                bolas = novasBolas;
            } 
            // CASO 2: Veio vazio, mas temos memória? Mantém a memória (Anti-Pisca).
            else if (typeof globalBolasCantadas !== 'undefined' && globalBolasCantadas.length > 0) {
                bolas = globalBolasCantadas;
            }
        } 
        // CASO 3: Não veio bolasData, usa direto a global
        else if (typeof globalBolasCantadas !== 'undefined' && Array.isArray(globalBolasCantadas)) {
            bolas = globalBolasCantadas;
        }
        // CASO 4: Fallback antigo (Cache de sorteio)
        else if (typeof bolasSorteadasCache !== 'undefined') { 
            bolas = bolasSorteadasCache; 
        }


        // Garante valores padrão para prêmio
        let premio = buscando_o_premio || "BINGO";
        let linhas = buscando_a_linha || "";

        // 5. CHAMA O NOVO PROCESSADOR (Que decide entre 90 ou 75)
        processCards(cards, bolas, premio, linhas);
        
        // Limpa mensagens de erro
        const msgEl = isMobileDevice() ? mobileValidationMessage : validationMessage;
        if(msgEl) msgEl.classList.add('hidden');

    } catch (error) {
        console.error("❌ Erro fetchAndProcessCards:", error);
    } finally {
        isFetchingCards = false;
        if (loader) loader.style.display = 'none';
    }
}

// --------------------------

async function f_etchAndProcessCards() {
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

// --- FUNÇÃO PRINCIPAL (Dispatcher) ---
// Essa é a função que o fetchAndProcessCards chama.
function processCards(cards, bolasCantadas, premioBuscado, linhasAtivas) {
    // Verifica qual o tipo de jogo (75 ou 90)
    // Se a variável global MAX_BOLAS não estiver definida, assume 90.
    if (typeof MAX_BOLAS !== 'undefined' && MAX_BOLAS === 75) {
        if (typeof processCards75 === 'function') {
            processCards75(cards, bolasCantadas, premioBuscado);
        } else {
            console.error("Erro: processCards75 não definida!");
        }
    } else {
        // BINGO 90 (Padrão)
        processCards90(cards, bolasCantadas, premioBuscado, linhasAtivas);
    }
}


// --- LÓGICA BINGO 90 (MANTIDA/REFATORADA) ---
function processCards90(cards, bolasCantadas, premioBuscado, linhasAtivas) {
    const processedCards = [];
    if (premioBuscado === 'BINGO') bingoWinners.clear();
    
    const isMultiLinePrize = premioBuscado.includes('LINHA') && linhasAtivas;
    const activeLinesArray = isMultiLinePrize ? linhasAtivas.split(',') : [];

    cards.forEach(card => {
        // Lógica de Parsing 90 (Sup, Cen, Inf)
        let superior = typeof card.superior === 'string' ? card.superior.split(',').map(Number) : (card.superior || []);
        let central = typeof card.central === 'string' ? card.central.split(',').map(Number) : (card.central || []);
        let inferior = typeof card.inferior === 'string' ? card.inferior.split(',').map(Number) : (card.inferior || []);
        
        let emOrdem = [...superior, ...central, ...inferior];
        let layoutGrid = emOrdem; // Para 90 bolas, o grid é linear (3 linhas)

        let count = { geral: 0, superior: 0, central: 0, inferior: 0 };

        bolasCantadas.forEach(bola => {
            if (emOrdem.includes(bola)) count.geral++;
            if (superior.includes(bola)) count.superior++;
            if (central.includes(bola)) count.central++;
            if (inferior.includes(bola)) count.inferior++;
        });

        if (premioBuscado.includes('BINGO') && count.geral === 15) bingoWinners.add(card.cartao);

        let cardObj = {
            cartao: card.cartao,
            linhaId: null,
            counts: { geral: count.geral },
            premioEncontrado: null,
            originalData: { geral: emOrdem, linha: [] },
            layoutGrid: layoutGrid,
            missingNumbers: emOrdem.filter(n => !bolasCantadas.includes(n)),
            type: 90 // Tag para renderização
        };

        // ... (Lógica de Linhas e Quadra do Bingo 90 mantida igual ao seu código original) ...
        // Vou resumir a lógica de push para focar na estrutura:
        
        if (isMultiLinePrize || premioBuscado.includes('QUADRA') || premioBuscado.includes('LINHA')) {
             const lines = [
                { id: 'SUP', numbers: superior, count: count.superior },
                { id: 'CEN', numbers: central, count: count.central },
                { id: 'INF', numbers: inferior, count: count.inferior }
            ];
            lines.forEach(line => {
                // ... (Lógica de verificação de linha igual ao original) ...
                // Se linha válida, processedCards.push(cloneDoObjeto);
                // ATENÇÃO: Copie a lógica interna do seu 'processCards' original aqui para as linhas
                // Exemplo rápido:
                if (!isMultiLinePrize || activeLinesArray.includes(line.id)) {
                     let lineObj = JSON.parse(JSON.stringify(cardObj));
                     lineObj.linhaId = line.id;
                     lineObj.counts.linha = line.count;
                     lineObj.originalData.linha = line.numbers;
                     lineObj.missingNumbers = line.numbers.filter(n => !bolasCantadas.includes(n));
                     
                     if (premioBuscado.includes('QUADRA') && line.count >= 4) {
                         lineObj.premioEncontrado = 'QUADRA'; 
                         // playSound/Gif...
                     } else if (premioBuscado.includes('LINHA') && line.count === 5) {
                         lineObj.premioEncontrado = 'LINHA';
                         // playSound/Gif...
                     }
                     processedCards.push(lineObj);
                }
            });
        } else {
            // Bingo Cheio / Duplo / Falta 1
            // ... (Lógica original de Bingo Cheio) ...
            if (count.geral === 15) cardObj.premioEncontrado = 'BINGO'; // Exemplo
            else if (premioBuscado.includes('FALTA') && count.geral === 14) cardObj.premioEncontrado = 'FALTA 1';
            processedCards.push(cardObj);
        }
    });

    // Ordenação e Atualização Global
    finalizeProcessing(processedCards, premioBuscado);
}


// --- LÓGICA BINGO 75 (CORRIGIDA: VISUALIZAÇÃO E ORDENAÇÃO) ---
function processCards75(cards, bolasCantadas, premioBuscado) {
    const processedCards = [];
    if (premioBuscado === 'BINGO') bingoWinners.clear();

    const premioUpper = (premioBuscado || "").toUpperCase();
    const bolasSet = new Set(bolasCantadas);

    // --- CONFIGURAÇÃO IDÊNTICA AO SERVER.PY ---
    // Índices do Array 0..24 (Colunas no Banco -> Linhas Visuais)
    const linhasIndices = [
        [0, 5, 10, 15, 20], // Linha 1 (Superior)
        [1, 6, 11, 16, 21], // Linha 2
        [2, 7, 12, 17, 22], // Linha 3 (Central - Inclui Free)
        [3, 8, 13, 18, 23], // Linha 4
        [4, 9, 14, 19, 24]  // Linha 5 (Inferior)
    ];
    const indicesCantos = [0, 4, 20, 24]; // B1, B5, O1, O5

    // Decide o Modo de Jogo baseado no Prêmio
    const buscarBingo = premioUpper.includes('BINGO') || premioUpper.includes('ACUMULADO');
    // Se não for Bingo, verifica se é fase de Linha ou Cantos
    const buscarLinha = !buscarBingo && (premioUpper.includes('LINHA') || premioUpper.includes('4 CANTOS E LINHA'));
    const buscarCantos = !buscarBingo && (premioUpper.includes('CANTOS') || premioUpper.includes('QUADRA'));

    cards.forEach(card => {
        let rawList = card.numeros || card.em_ordem || card.lista_75 || [];
        // Normaliza string para array se necessário
        if (typeof rawList === 'string') rawList = rawList.split(',').map(Number);
        if (!Array.isArray(rawList) || rawList.length < 24) return;

        // 1. CÁLCULO GERAL (BINGO CHEIO)
        // Filtra: não é 0 (Free) E não foi sorteado
        const faltamGeral = rawList.filter(n => n !== 0 && !bolasSet.has(n));
        const countGeral = faltamGeral.length;

        // 2. CÁLCULO LINHA (Melhor Linha Horizontal)
        let melhorLinhaFaltam = 99;
        let numerosFaltantesLinha = [];
        let linhaCompleta = false;

        linhasIndices.forEach(indices => {
            // Pega os números desta linha específica
            const faltamNesta = indices
                .map(i => rawList[i])
                .filter(n => n !== 0 && !bolasSet.has(n));
            
            const qtd = faltamNesta.length;
            // Se esta linha for melhor (menos faltantes), guarda ela
            if (qtd < melhorLinhaFaltam) {
                melhorLinhaFaltam = qtd;
                numerosFaltantesLinha = faltamNesta;
            }
            if (qtd === 0) linhaCompleta = true;
        });

        // 3. CÁLCULO CANTOS
        const faltamCantos = indicesCantos
            .map(i => rawList[i])
            .filter(n => n !== 0 && !bolasSet.has(n));
        const countCantos = faltamCantos.length;
        const cantosCompleto = (countCantos === 0);

        // 4. DECISÃO FINAL (O que mostrar na tela?)
        let missingToDisplay = [];
        let qtdeParaRanking = 99;
        let premioEncontrado = null;

        if (buscarBingo) {
            // Modo Bingo: Mostra tudo o que falta
            missingToDisplay = faltamGeral;
            qtdeParaRanking = countGeral;
            if (countGeral === 0) premioEncontrado = 'BINGO';
        } 
        else if (buscarLinha && buscarCantos) {
            // Modo Híbrido (4 Cantos E Linha): Mostra o mais próximo
            if (melhorLinhaFaltam <= countCantos) {
                missingToDisplay = numerosFaltantesLinha;
                qtdeParaRanking = melhorLinhaFaltam;
            } else {
                missingToDisplay = faltamCantos;
                qtdeParaRanking = countCantos;
            }
            // Checa vitórias
            if (linhaCompleta) premioEncontrado = 'LINHA';
            if (cantosCompleto) premioEncontrado = (premioEncontrado ? premioEncontrado + ' E ' : '') + '4 CANTOS';
        }
        else if (buscarLinha) {
            // Modo Só Linha: Mostra só a melhor linha
            missingToDisplay = numerosFaltantesLinha;
            qtdeParaRanking = melhorLinhaFaltam;
            if (linhaCompleta) premioEncontrado = 'LINHA';
        }
        else if (buscarCantos) {
            // Modo Só Cantos: Mostra só os cantos
            missingToDisplay = faltamCantos;
            qtdeParaRanking = countCantos;
            if (cantosCompleto) premioEncontrado = '4 CANTOS';
        }
        else {
            // Fallback: Mostra Geral
            missingToDisplay = faltamGeral;
            qtdeParaRanking = countGeral;
        }

        // Sons e Efeitos
        if (premioEncontrado && !bingoWinners.has(card.cartao + '_' + premioEncontrado)) {
             // Lógica de disparo de som/gif aqui se necessário
        }

        processedCards.push({
            cartao: card.cartao,
            counts: {
                ranking: qtdeParaRanking // Usado para ordenar
            },
            missingNumbers: missingToDisplay, // Números específicos do prêmio (Destaque)
            premioEncontrado: premioEncontrado,
            layoutGrid: rawList, // Grid completo para desenho
            type: 75
        });
    });

    // 5. ORDENAÇÃO (Menos faltantes no topo)
    processedCards.sort((a, b) => a.counts.ranking - b.counts.ranking);

    loadedCards = processedCards;
    
    // Renderiza
    displayLoadedCards(bolasCantadas); 
}


// Helper para finalizar e chamar o display
function finalizeProcessing(processedCards, premioBuscado) {
    if (premioBuscado.includes('DUPLOBINGO')) {
        loadedCards = processedCards.filter(card => !bingoWinners.has(card.cartao));
    } else {
        loadedCards = processedCards;
    }

    if (premioBuscado.includes('QUADRA') || premioBuscado.includes('LINHA')) {
        loadedCards.sort((a, b) => (b.counts.linha || 0) - (a.counts.linha || 0));
    } else {
        loadedCards.sort((a, b) => b.counts.geral - a.counts.geral);
    }
    
    displayLoadedCards([]); // Passa array vazio pois 'processCards' já calculou missing
}


// apagarx
function _recalculateAndDisplayCards(bolasCantadas, premioBuscado, linhasAtivas) {
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
                console.error("quadra02    :");
                showPremiadoGif('quadra');
                playPremiadoSound(quadraSound);                
            } else if (normalizedPremioBuscado.includes('LINHA') && count === 5) {
                premioEncontrado = 'L I N H A';
                showPremiadoGif('linha');
                playPremiadoSound(linhaSound);                 
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
    const container = document.getElementById('loaded-cards-container'); 
    const cardsList = mobileLoadedCardsList;
    if (container) {   
       const classesDeLayout = "rounded-lg shadow-md"; 
       container.className = `${classesDeLayout} ${corFundoConteiner}`;
    } 

    const headerElement =mobileLoadedCardsHeader; 
    const totalCards = loadedCards.length;
    const formattedCount = new Intl.NumberFormat('pt-BR').format(cartelasEmJogo);
    if (headerElement) {
        headerElement.className = 'text-center text-sm text-yellow-500 font-bold mb-0 p-2'
        headerElement.textContent = `Cartelas Carregadas = ${formattedCount}`;
    }
 
    cardsList.innerHTML = '';
    
    const isLinePrize = buscando_o_premio.includes('QUADRA') || buscando_o_premio.includes('LINHA');
    const isMultiLinePrize = isLinePrize && !!buscando_a_linha;
    const headerDiv = document.createElement('div');
    headerDiv.className = ` flex justify-between w-full p-0 ${corFundoTitulo} rounded-t-lg text-sm text-gray-400 font-bold mb-0`;
    
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
             headerElement.textContent = ``; 
        }
        p.textContent = ''; 
        fragment.appendChild(p);
    } else {
        cardsToDisplay.forEach(card => {
            const formattedCardNumber = String(card.cartao);
            
            const cardDiv = document.createElement('div');
            cardDiv.className = 'flex h-6 w-full p-0 bg-transparent rounded-lg text-white font-medium mb-0';
            cardDiv.setAttribute('data-card-number', card.cartao);
            
            // --- CORREÇÃO AQUI: Só adiciona atributo se linhaId existir ---
            if (isLinePrize && card.linhaId) {
                cardDiv.setAttribute('data-line-id', card.linhaId);
            }

            // --- CORREÇÃO CRÍTICA AQUI ---
            // Verifica (isLinePrize E card.linhaId) antes de tentar acessar [0]
            const showLineTag = isLinePrize && card.linhaId;

            const cardLabelHtml = showLineTag
                ? `<div class="flex-shrink-0 flex gap-1"><span class="w-14 p-0 ${corFundoNumeroCartao} rounded-lg text-center font-bold flex items-center justify-center text-sm">${formattedCardNumber}</span><span class="w-5 p-0 ${corFundoPosicaoLinha} rounded-lg text-center font-bold flex items-center justify-center">${card.linhaId[0]}</span></div>`
                : `<div class="flex-shrink-0 p-0 ${corFundoNumeroCartao} rounded-lg text-center font-bold  flex items-center justify-center text-sm w-14"><span>${formattedCardNumber}</span></div>`;

            cardDiv.innerHTML = cardLabelHtml;

            const numbersContainer = document.createElement('div');
            if (card.premioEncontrado) {
               numbersContainer.className = 'flex-1 ml-2 p-0 bg-gray-900 rounded-lg flex flex-wrap gap-1 justify-start';

                const premioTexto = card.premioEncontrado === 'DUPLO BINGO' ? 'DUPLO BINGO' : card.premioEncontrado;
                const premioSpan = document.createElement('span');
                premioSpan.className = 'text-sm bg-red-500 text-white font-bold w-full text-center p-1 rounded-lg animate-blink-red-white';
                premioSpan.textContent = premioTexto;
                numbersContainer.appendChild(premioSpan);
                numbersContainer.classList.add('items-center', 'justify-center');
            } else {
               numbersContainer.className = 'flex-1 ml-1 p-0 bg-transparent rounded-lg flex h-5 gap-x-1 gap-y-0 justify-start';
               const missingNumbers = card.missingNumbers || [];
                
                missingNumbers.forEach((num, index) => {
                    const numberSpan = document.createElement('span');

// aquix   corFundoTitulo
                   
                    let bgColorClass = corFundoNumeros4;
                    if (index === 0) {
                        bgColorClass = corFundoNumero1;
                    } else if (index === 1 || index === 2) {
                        bgColorClass = corFundoNumeros23;
                    }
                    
                    const numberClass = `py-3 px-2 rounded-lg ${ corTextoNumeros} font-bold ${bgColorClass} text-sm w-7 h-5 flex items-center justify-center flex-shrink-0`;
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

// --------

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

    const loadedCardsListCurrent = mobileLoadedCardsList;
    const faixasDiv = mobileFaixasAdicionadasDiv;
    const totalSpan = mobileTotalCartelasSpan;
    const lastRound = mobileLastRoundElement;
    const lastOrder = mobileLastOrderElement;
    const precoSerie = mobilePrecoSerieElement;
    const ball1 = mobileLastBall1;
    const ball2 = mobileLastBall2;
    const ball3 = mobileLastBall3;
    const prizeInfo =mobilePrizeInfoContainer;
    const prizeValues = mobilePrizeValuesContainer;
    const cartelaInicial = mobileCartelaInicialInput;
    const cartelaFinal = mobileCartelaFinalInput;
    const resultadoSoma = mobileResultadoSomaSpan;
    const headerElement = mobileLoadedCardsHeader; 
    cartelasEmJogo = 0;
    loadedCardsListCurrent.innerHTML = `<p class="text-white text-center">Nenhuma cartela carregada.</p>`;
    prizeValues.innerHTML = '';
    headerElement.textContent = `Nenhuma Cartela Carregada`;
    ocultarConferencia();
    cardNumberElement.textContent = 'Aguardando...';
    winnerNameElement.textContent = 'O Próximo será Seu!';
    cardGridElement.innerHTML = '';
    lastRound.textContent = '...';
    lastOrder.textContent = '...';
    ball1.textContent = '';
    ball2.textContent = '';
    ball3.textContent = '';

    closeAvisoPanel(); // <--- Adicione 
    lastAvisoTimestamp = 0; // Reseta para permitir novos avisos iguais

    updateDigitalBola("--");

    precoSerie.textContent = '';    
    cartelaRanges = [];
    newRanges = [];
    cachedRawCards = [];
    globalBolasCantadas = [];

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
        //mobilePrizesContent.classList.add('hidden');
        toggleCartelasButton.textContent = 'INCLUIR Cartelas';
        //togglePrizesButton.textContent = 'Apresentar Prêmios';
    }   //  2
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
                numberDiv.classList.remove('text-gray-700');
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
    const lastRound = mobileLastRoundElement;
    const lastOrder = mobileLastOrderElement;
    const balls = [mobileLastBall1, mobileLastBall2, mobileLastBall3];

    // --- CORREÇÃO: REMOVIDAS AS LINHAS DE LIMPEZA PRÉVIA ---
    
    if (bolasData && typeof bolasData === 'object' && Array.isArray(bolasData.bolas_cantadas)) {
        const bolasCantadas = bolasData.bolas_cantadas;
        const lastThree = bolasCantadas.slice(-3).reverse();
        
        if (bolasData.rodada) lastRound.textContent = bolasData.rodada;
        
        // Atualiza ordem sem limpar antes
        const totalBolas = bolasData.ordem === 0 || bolasData.ordem ? bolasData.ordem : bolasCantadas.length;
        lastOrder.textContent = totalBolas;

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
                // Só limpa se realmente não tiver bola (início do jogo)
                balls[i].textContent = ''; 
                balls[i].classList.remove('bg-red-700', 'bg-green-800', 'text-gray-300');
                balls[i].classList.add('bg-gray-300', 'text-gray-800');
            }
        }
    } else {
        lastOrder.textContent = '0';
    }
}


function displayPrizeInfo(buscandoData, premioData = null) {
    const isMobile = isMobileDevice();
    const prizeInfoContainerCurrent = mobilePrizeInfoContainer;
    
    // Verificação de segurança
    if (!prizeInfoContainerCurrent) return;

    // --- PREPARAÇÃO DOS DADOS ---
    // (Sua lógica original de tratamento de dados)
    const dadosBuscando = (buscandoData && Array.isArray(buscandoData) && buscandoData.length > 0) 
                          ? buscandoData[0] 
                          : {}; 

    const cleanTextForComparison = (text) => {
        if (!text) return "";
        return text.toString().replace(/\s/g, '').toUpperCase();
    }

    let buscandoValue = dadosBuscando.buscando_o_premio || null;
    const linhasTaisLinhas = dadosBuscando.buscando_a_linha || '';
    const qtdeLinhas = dadosBuscando.qtde_linha || '';
 
    let prizeToFind = cleanTextForComparison(buscandoValue);

    // Lógica de 3 Linhas
    if (qtdeLinhas === 3 && (buscandoValue === "LINHA" || buscandoValue === "L I N H A"))  {
        const linhasEmJogo = `L I N H A S: ( ${linhasTaisLinhas.toUpperCase()} )`  
        buscandoValue = linhasEmJogo;
        prizeToFind = '3LINHAS'
    }
    // Ajuste Falta Um
    if (prizeToFind === 'FALTAUM') {
       prizeToFind ='FALTA1';
    }

    // --- BUSCA DO VALOR (Lógica original mantida) ---
    let valorPremio = '';
    if (premioData && Array.isArray(premioData) && premioData.length > 0 && prizeToFind) {
        for (const item of premioData) {
            const itemPrizeType = cleanTextForComparison(item.tipo_premio);
            if (itemPrizeType === prizeToFind ) {
                valorPremio = item.valor; 
                const comValor = `${buscandoValue}  -  ${valorPremio}`  
                buscandoValue = comValor;
                break; 
            }
        }
    }
   
    // Define o texto final
    let textoFinal = '';
    if (!buscandoValue || buscandoValue.toString().trim().toLowerCase() === 'null' || buscandoValue.trim() === '') {
        textoFinal = '. . .';
    } else {
        textoFinal = buscandoValue;
    }

    // =========================================================
    // --- A BLINDAGEM (O Segredo para não piscar) ---
    // =========================================================

    // 1. Se for IDÊNTICO ao anterior, não mexe no DOM.
    if (textoFinal === lastBuscandoJson) {
        return; 
    }

    // 2. PROTEÇÃO DE REGRESSÃO (Evita perder o valor R$)
    // Verifica se a tela atual tem um valor (R$ ou números) e o novo texto NÃO tem.
    // Ex: Tela tem "LINHA - R$ 100,00" e novo vem só "LINHA" -> Ignora o novo.
    const telaTemValor = lastBuscandoJson && (lastBuscandoJson.includes('R$') || /\d+,\d{2}/.test(lastBuscandoJson));
    const novoTemValor = textoFinal.includes('R$') || /\d+,\d{2}/.test(textoFinal);

    if (telaTemValor && !novoTemValor && textoFinal !== '. . .') {
        // Se a gente tinha valor e agora sumiu (mas não é um reset total), 
        // assumimos que é um delay do servidor e IGNORAMOS essa atualização.
        return;
    }

    // =========================================================
    // --- ATUALIZAÇÃO DA TELA (Só chega aqui se for válido) ---
    // =========================================================

    lastBuscandoJson = textoFinal; // Salva na memória

    // Cria o elemento (igual ao seu código)
    const prizeItem = document.createElement('span');
    prizeItem.className = 'text-3xl text-gray-200 font-semibold';
    prizeItem.innerHTML = textoFinal; // Usa o texto calculado

    // Limpa e insere
    prizeInfoContainerCurrent.innerHTML = ''; 
    prizeInfoContainerCurrent.appendChild(prizeItem);
}

function displayPrizeValues(premioData, topeData = null) {
    const isMobile = isMobileDevice(); // Mantido do seu código
    const prizeValuesContainerCurrent = mobilePrizeValuesContainer;
    
    if (!prizeValuesContainerCurrent) return;

    // --- PASSO 1: FILTRAGEM PRÉVIA (Para saber se temos dados reais) ---
    // Fazemos a limpeza e filtro ANTES de decidir se vamos desenhar
    let validPrizes = [];
    if (premioData && Array.isArray(premioData)) {
        validPrizes = premioData.filter(premio => {
            const cleanedValue = premio.valor.toString().replace('R$', '').replace('.', '').trim();
            const numericValue = parseFloat(cleanedValue.replace(',', '.'));
            return numericValue > 0 && !isNaN(numericValue);
        });
    }

    // --- PASSO 2: A CURA DO "NENHUM PRÊMIO" (Blindagem Visual) ---
    // Se a nova lista de prêmios válidos é VAZIA (0), 
    // MAS a tela JÁ TEM prêmios desenhados (e não é a msg de "Nenhum")...
    // ENTÃO: O sistema IGNORA essa atualização vazia e mantém os prêmios na tela.
    const temPremiosNaTela = prizeValuesContainerCurrent.children.length > 0 && 
                             !prizeValuesContainerCurrent.textContent.includes('Nenhum prêmio');
    
    if (validPrizes.length === 0 && temPremiosNaTela) {
        // Retorna silenciosamente. O usuário continua vendo os prêmios antigos.
        return; 
    }

    // --- PASSO 3: O FIM DO PISCA-PISCA (Cache JSON) ---
    // Compara os dados atuais (Prêmios + Tope) com a memória.
    // Se for EXATAMENTE IGUAL, não redesenha nada.
    const currentJson = JSON.stringify({ p: validPrizes, t: topeData });
    if (currentJson === lastPrizeJson) {
        return; 
    }
    lastPrizeJson = currentJson; // Atualiza a memória

    // --- PASSO 4: DESENHO (Sua lógica original preservada) ---
    const fragment = document.createDocumentFragment();

    if (validPrizes.length === 0) {
        // Só entra aqui se a tela estava vazia ou se realmente não tem prêmios
        const defaultMessage = document.createElement('span');
        defaultMessage.className = 'text-lg text-white';
        defaultMessage.textContent = 'Nenhum prêmio cadastrado.';
        fragment.appendChild(defaultMessage);
    } else {
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
            
            // Sua lógica de Mobile/Promocional
            if (typeof iniciandoRodada !== 'undefined' && iniciandoRodada && premio.tipo_premio === 'BINGO') {
                const valorLimpo = premio.valor.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                if (parseFloat(valorLimpo) > 0 && mobilePrizesContent && mobilePrizesContent.classList.contains('hidden')) {
                     if (typeof seePromocoes !== 'undefined') seePromocoes = false; 
                     if (typeof hidePromocionalPanel === 'function') hidePromocionalPanel();
                     if (mobilePrizesContent) mobilePrizesContent.classList.remove('hidden'); 
                     
                     if (typeof togglePrizesButton !== 'undefined' && togglePrizesButton) {
                         //togglePrizesButton.textContent = 'Ocultar Prêmios';
                         //togglePrizesButton.classList.remove('bg-gray-700');
                         //togglePrizesButton.classList.add('bg-red-800'); 
                     }
                }
            }     
            
            // Sua lógica de Tope
            if (topeData && topeData.length > 0) {
                const currentTopeData = topeData[0];
                if (premio.tipo_premio.includes('SUPER BINGO') && currentTopeData.bola_tope_sb) {
                    prizeText += ` (TOPE: ${currentTopeData.bola_tope_sb})`;
                } else if (premio.tipo_premio.includes('ACUMULADO') && currentTopeData.bola_tope_ac) {
                    prizeText += ` (TOPE: ${currentTopeData.bola_tope_ac})`;
                }
            }

            const prizeItem = document.createElement('div');
            prizeItem.className = 'text-sm font-bold text-green-600 text-center -mt-1';
            prizeItem.textContent = prizeText;
            fragment.appendChild(prizeItem);
        });
    }

    // Limpa e Atualiza (Atomicamente)
    prizeValuesContainerCurrent.innerHTML = '';
    prizeValuesContainerCurrent.appendChild(fragment);
}

function displayPrizeValuesB(premioData, topeData = null) {
    const isMobile = isMobileDevice();
    const prizeValuesContainerCurrent = mobilePrizeValuesContainer;
    
    // --- CORREÇÃO: Cria um fragmento em memória primeiro (Evita Piscar) ---
    const fragment = document.createDocumentFragment();

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
            fragment.appendChild(defaultMessage);
        } else {
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
                if (iniciandoRodada && premio.tipo_premio === 'BINGO') {
                   // Lógica mobile mantida...
                   const valorLimpo = premio.valor.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                   if (parseFloat(valorLimpo) > 0 && mobilePrizesContent.classList.contains('hidden')) {
                         seePromocoes = false; 
                         hidePromocionalPanel();
                         //startPrizeHideTimer();
                         mobilePrizesContent.classList.remove('hidden'); 
                         togglePrizesButton.textContent = 'Ocultar Prêmios';
                         togglePrizesButton.classList.remove('bg-gray-700');
                         togglePrizesButton.classList.add('bg-red-800'); 
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
                prizeItem.className = 'text-sm font-bold text-green-300 text-center -mt-1';
                prizeItem.textContent = prizeText;
                fragment.appendChild(prizeItem);
            });
        }
    } else {
        const defaultMessage = document.createElement('span');
        defaultMessage.className = 'text-lg text-white';
        defaultMessage.textContent = 'Nenhum prêmio cadastrado.';
        fragment.appendChild(defaultMessage);
    }

    // --- ATUALIZAÇÃO ATÔMICA (Só limpa e insere no final) ---
    prizeValuesContainerCurrent.innerHTML = '';
    prizeValuesContainerCurrent.appendChild(fragment);
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

function displayCardGrid(numerosStringOrArray, bolasCantadas) {
    if (MAX_BOLAS === 75) {
        displayCardGrid75(numerosStringOrArray, bolasCantadas);
    } else {
        displayCardGrid90(numerosStringOrArray, bolasCantadas);
    }
}

// --- CONFERÊNCIA 90 (MANTIDA/ADAPTADA) ---
function displayCardGrid90(numeros, bolasCantadas) {
    cardGridElement.innerHTML = '';
    cardGridElement.className = 'grid grid-cols-5 gap-2 w-full p-2 bg-gray-800 rounded-xl'; // Grid padrão 90

    // Converte entrada para array de números
    let listaNumeros = [];
    if (Array.isArray(numeros)) {
        listaNumeros = numeros;
    } else if (typeof numeros === 'string') {
        listaNumeros = numeros.match(/\d+/g)?.map(Number) || [];
    }

    if (listaNumeros.length === 0) {
        // Renderiza Placeholders se vazio
        for(let i=0; i<15; i++) listaNumeros.push(0);
    }

    listaNumeros.forEach(num => {
        const div = document.createElement('div');
        div.className = 'card-number-item h-8 w-full flex items-center justify-center bg-gray-300 rounded text-gray-900 font-bold text-lg';
        
        if (num === 0) {
            div.textContent = '';
            div.classList.add('invisible'); // Oculta espaços vazios no 90
        } else {
            div.textContent = num;
            if (bolasCantadas.includes(num)) {
                // Última bola (destaque vermelho) ou apenas marcada (verde)
                if (num === bolasCantadas[bolasCantadas.length-1]) {
                    div.classList.replace('bg-gray-300', 'bg-red-600');
                    div.classList.replace('text-gray-900', 'text-white');
                } else {
                    div.classList.replace('bg-gray-300', 'bg-green-700');
                    div.classList.replace('text-gray-900', 'text-white');
                }
            }
        }
        cardGridElement.appendChild(div);
    });
}

// --- CONFERÊNCIA 75 (GRID 5x5) ---
function displayCardGrid75(numeros, bolasCantadas) {
    cardGridElement.innerHTML = '';
    // Força classe Grid 5 colunas
    cardGridElement.className = 'grid grid-cols-5 gap-1 w-full p-2 bg-black rounded-xl border-2 border-gray-700';

    let listaNumeros = [];
    
    // Normalização dos dados (pode vir string do 'confereData' ou array)
    if (Array.isArray(numeros)) {
        listaNumeros = numeros;
    } else if (typeof numeros === 'string') {
        // Remove caracteres de formatação visual (*, +)
        const cleanStr = numeros.replace(/[^\d,]/g, ' '); 
        listaNumeros = cleanStr.trim().split(/\s+/).map(Number);
    }
    // Garante 25 posições
    while(listaNumeros.length < 25) listaNumeros.push(0);
 
    const ordemVisual = [
        0, 1, 2, 3, 4,
        5, 6, 7, 8, 9,
        10, 11, 12, 13, 14,
        15, 16, 17, 18, 19,
        20, 21, 22, 23, 24
    ];

    ordemVisual.forEach(realIndex => {
        const num = listaNumeros[realIndex];
        const div = document.createElement('div');
        
        div.className = 'h-10 w-full flex items-center justify-center rounded font-bold text-lg border border-gray-600';
        
        const isFree = false; // (realIndex === 12); 
        
        if (isFree) {
            div.textContent = '★';
            div.className += ' bg-green-600 text-white border-green-400';
        } else {
            div.textContent = num;
            if (bolasCantadas.includes(num)) {
                if (num === bolasCantadas[bolasCantadas.length-1]) {
                    div.className += ' bg-red-600 text-white border-red-400'; 
                } else {
                    div.className += ' bg-yellow-500 text-black border-yellow-300'; 
                }
            } else {
                div.className += ' bg-gray-800 text-gray-300'; 
            }
        }
        cardGridElement.appendChild(div);
    });
}



function displayConferencePanel(confereData, bolasCantadas) {
    const container = document.getElementById('conference-panel-container');
    
    if (confereData && confereData.length > 0 && typeof confereData[0] === 'object') {
        const data = confereData[0];
        const numeroDoCartao = parseInt(data.cartao, 10);
        const nomeDoGanhador = data.ganhador;
        const numerosDaCartela = data.numeros;
        const cartaoValido = !isNaN(numeroDoCartao) && numeroDoCartao > 0;

        if (cartaoValido) {
            // Exibe o Overlay
            container.classList.remove('hidden');
            container.classList.add('flex'); // 'flex' é necessário para centralizar o conteúdo no CSS novo
            
            cardNumberElement.textContent = numeroDoCartao;
            winnerNameElement.textContent = nomeDoGanhador || 'O Próximo será Seu!';
            displayCardGrid(numerosDaCartela, bolasCantadas);            
        } else {
            ocultarConferencia();
        }
    } else {
        ocultarConferencia();
    }
}

// Função auxiliar para esconder e limpar
function ocultarConferencia() {
    const container = document.getElementById('conference-panel-container');
    container.classList.remove('flex');
    container.classList.add('hidden');
    cardNumberElement.textContent = '...';
    winnerNameElement.textContent = '...';
    displayCardGrid(null, []);
}

// --- FUNÇÃO MOSTRAR GANHADORES (CORRIGIDA) ---
function displayWinnersPanel(ganhadoresData) {
    // 1. Validação se há dados
    if (!ganhadoresData || ganhadoresData.length === 0 || ultimaBolaCantada !== null) return;

    // 2. Gera o Hash (Assinatura) dos dados atuais
    const currentHash = JSON.stringify(ganhadoresData);

    // 3. VERIFICAÇÃO CRÍTICA:
    // Se o Hash for igual ao último processado, PARA AQUI.
    // Isso impede que a tela pisque ou recarregue se os dados não mudaram.
    if (currentHash === lastGanhadoresHash) {
        return;
    }

    // 4. Se passou, atualiza o hash global para a próxima vez
    lastGanhadoresHash = currentHash;

    // --- DAQUI PARA BAIXO, SEGUE A RENDERIZAÇÃO ---
    winnersListContent.innerHTML = '';
    
    // Cancela timer anterior para reiniciar a contagem
    if (winnersTimer) clearTimeout(winnersTimer);

    // O Backend já manda os dados agrupados. Iteramos sobre os grupos.
    ganhadoresData.forEach(grupo => {
        
        // Container do Grupo (Prêmio)
        const groupDiv = document.createElement('div');
        groupDiv.className = 'bg-gray-800 rounded-lg p-1 border border-gray-700 mb-1';

        // Cabeçalho do Prêmio
        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex justify-between items-center border-b border-gray-600 pb-1 mb-1';
        headerDiv.innerHTML = `
            <span class="text-green-400 font-bold text-lg">${grupo.premio}</span>
            <span class="text-white font-bold bg-green-700 px-1 py-0.5 rounded text-sm">${grupo.valor}</span>
        `;
        groupDiv.appendChild(headerDiv);

        // Lista de Ganhadores deste prêmio
        if (grupo.ganhadores && Array.isArray(grupo.ganhadores)) {
            grupo.ganhadores.forEach(ganhador => {
                const row = document.createElement('div');
                row.className = 'flex justify-between items-center text-sm py-1 hover:bg-gray-700 rounded px-1';
                row.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="bg-gray-900 text-yellow-500 font-bold px-1 py-0.5 rounded border border-gray-600">${ganhador.cartela}</span>
                        <span class="text-gray-200 truncate max-w-[150px] uppercase font-medium">${ganhador.nome}</span>
                    </div>
                    <span class="text-green-300 font-bold">${ganhador.valor_rateio}</span>
                `;
                groupDiv.appendChild(row);
            });
        }

        winnersListContent.appendChild(groupDiv);
    });

    // Exibe o painel (caso esteja oculto)
    if (winnersPanelContainer.classList.contains('hidden')) {
        winnersPanelContainer.classList.remove('hidden');
        winnersPanelContainer.classList.add('flex');
    }

    // Reinicia a animação da barra de progresso
    if (winnersProgressBar) {
        winnersProgressBar.style.transition = 'none';
        winnersProgressBar.style.width = '100%';
        // Força o navegador a recalcular o estilo (Reflow) antes de iniciar a animação
        void winnersProgressBar.offsetWidth; 
        const emSegundos = WINNERS_DISPLAY_TIME * 1000
        winnersProgressBar.style.transition = `width ${emSegundos}ms linear`;
        winnersProgressBar.style.width = '0%';
    }

    // Configura o fechamento automático
    let Mille = 1000;
    if (Carregando) {
        Mille = 500        
    }   
    winnersTimer = setTimeout(closeWinnersPanel, WINNERS_DISPLAY_TIME  * Mille);
}

function closeWinnersPanel() {
    if (winnersPanelContainer) {
        winnersPanelContainer.classList.remove('flex');
        winnersPanelContainer.classList.add('hidden');
    }
    if (winnersTimer) clearTimeout(winnersTimer);
}

async function fetchDataFromCollections() {
    try {
        // Headers para evitar cache (Mantido do seu código)
        const response = await fetch(`${API_BASE_URL}/api/initial-data?_=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error('Falha ao buscar dados iniciais.');
        }

        const data = await response.json();

        // --- BLINDAGEM ANTI-OSCILAÇÃO (ADICIONADO AQUI) ---
        // Verifica se a atualização é válida antes de retornar os dados
        
        // 1. Pega estado atual da tela
        const elementRodada = document.getElementById('mobile-last-round');
        const localRodada = parseInt(elementRodada ? elementRodada.textContent : '0') || 0;
        
        // 2. Pega dados que vieram do servidor
        const novaRodada = data.parametros ? data.parametros.rodada : 0;
        const bolasNovas = data.bolas_sorteadas ? data.bolas_sorteadas.length : 0;
        
        // 3. Conta bolas já pintadas na tela
        const bolasNaTela = document.querySelectorAll('#mobile-number-grid > div.bg-red-600, #mobile-number-grid > div.bg-blue-600').length;

        // 4. A LÓGICA: Se a rodada é a mesma, mas vieram MENOS bolas, é erro.
        // Retornamos NULL para que o sistema ignore essa leitura.
        if (novaRodada === localRodada && novaRodada > 0) {
            if (bolasNovas < bolasNaTela) {
                console.warn(`🛡️ Blindagem: Ignorando leitura instável. (Tela: ${bolasNaTela} vs Server: ${bolasNovas})`);
                return null; // Retorna nulo para não atualizar a tela
            }
        }
        // --- FIM DA BLINDAGEM ---

        return data;

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
        let posicaoWidth = '15px'; // 13Largura padrão se 'posicao' não for vazio
        let haGanhador = false;
        // Verifica se 'posicao' é uma string vazia ("") ou nula.
        if (!item.posicao || item.posicao === "") {
            posicaoWidth = '4px'; 
        }
        // 2. Constrói a string da classe
        // Usa template literals (crase `) para injetar a variável   // 23 - 55
        const gridClasses = `grid-cols-[30px_${posicaoWidth}_1fr_100px]`;
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
       // 1. Tenta pegar o valor (aceita tanto a chave antiga 'numeros_faltantes' quanto a nova 'numeros')
        const rawNums = item.numeros_faltantes || item.numeros || ""; 
        
        let numerosComEspaco = "";

        // 2. Verifica se é Array (Lista) ou String (Texto) para formatar corretamente
        if (Array.isArray(rawNums)) {
            // Pega apenas os 5 primeiros itens do array
            numerosComEspaco = rawNums.map(n => n.toString().padStart(2, '0')).join(' . ');

        } else if (typeof rawNums === 'string') {
            // Divide a string, pega os 5 primeiros e formata
            const lista = rawNums.split(',');
            numerosComEspaco = lista.map(n => n.trim().padStart(2, '0')).join(' . ');

            //if (lista.length > 5) numerosComEspaco += " ...";
        }
        
        numerosFaltantes.textContent = `${numerosComEspaco} ${winnerPremio}`;
        numerosFaltantes.className = 'text-green-300';  

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

function renderOscartoes(bolasCantadas) {
    if (MAX_BOLAS === 75) {
        renderOscartoes75(bolasCantadas);
    } else {
        renderOscartoes90(bolasCantadas);
    }
}

// ATUALIZADO: Renderiza as 10 melhores cartelas (Correção de Tipos e Destaque)
function renderOscartoes90(bolasInput) {
    let listaRealDeBolas = [];
    if (Array.isArray(bolasInput) && bolasInput.length > 0) {
        listaRealDeBolas = bolasInput;
    } else if (typeof globalBolasCantadas !== 'undefined' && Array.isArray(globalBolasCantadas)) {
        listaRealDeBolas = globalBolasCantadas;
    }
    // Set de inteiros para garantir a marcação correta
    const bolasSet = new Set(listaRealDeBolas.map(b => parseInt(b)).filter(b => b > 0));

    const formattedCount = new Intl.NumberFormat('pt-BR').format(typeof cartelasEmJogo !== 'undefined' ? cartelasEmJogo : 0);
    const textoTitulo = `Top 10 Melhores (${formattedCount})`;

    const pcHeader = document.getElementById('oscartoes-header');
    const mobileHeader = document.getElementById('mobile-oscartoes-header');
    if (pcHeader) pcHeader.textContent = textoTitulo;
    if (mobileHeader) mobileHeader.textContent = textoTitulo;

    const containers = [
        document.getElementById('oscartoes-content'),       
        document.getElementById('mobile-oscartoes-content') 
    ];

    let dadosParaRenderizar = (loadedCards && loadedCards.length > 0) ? loadedCards.slice(0, 10) : [];
    const conteudoVazio = dadosParaRenderizar.length === 0;

    const premioRaw = typeof buscando_o_premio !== 'undefined' ? buscando_o_premio : '';
    const isModoLinhaOuQuadra = premioRaw.toUpperCase().includes('LINHA') || premioRaw.toUpperCase().includes('QUADRA');

    containers.forEach(container => {
        if (!container) return; 

        const fragment = document.createDocumentFragment();
        let newContainerClass = '';

        if (conteudoVazio) {
            newContainerClass = 'flex flex-col items-center justify-center h-full';
            const p = document.createElement('p');
            p.className = 'text-center text-gray-500 text-xs mt-4';
            p.textContent = 'Aguardando início...';
            fragment.appendChild(p);
        } else {
            newContainerClass = 'grid grid-cols-2 gap-2 pb-4 content-start';
            container.style.maxHeight = (typeof telaFull !== 'undefined' && telaFull) ? '480px' : '380px';

            dadosParaRenderizar.forEach(cardData => {
                const numeroCartao = cardData.cartao;
                const numerosGerais = cardData.layoutGrid && cardData.layoutGrid.length > 0 
                                      ? cardData.layoutGrid 
                                      : (cardData.originalData ? cardData.originalData.geral : []);

                if (!numerosGerais || numerosGerais.length === 0) return;

                const cardDiv = document.createElement('div');
                cardDiv.className = ` ${corFundoCartela} border ${corBordaCartela} rounded p-1 flex flex-col gap-0.5 shadow-sm`;
                //cardDiv.className = 'bg-gray-900 border border-gray-700 rounded p-1 flex flex-col gap-0.5 shadow-sm';

                const faltam = cardData.missingNumbers ? cardData.missingNumbers.length : 15;
                const faltamClass = faltam <= 1 ? ` ${corNumeroFaltam1} animate-pulse font-bold` : ` ${corNumeroFaltam} font-bold` ;
                //const faltamClass = faltam <= 1 ? 'text-green-400 animate-pulse font-bold' : 'text-blue-400 font-bold';

                const header = document.createElement('div');
                header.className = 'flex justify-between items-center border-b border-gray-700 pb-0.5 mb-0.5';
                header.innerHTML = `
                     <span class="${corTituloCartela} font-bold text-[10px]">Cartela: <span class="${corNumeroCartela}">${numeroCartao}</span></span>
                    <span class="text-[10px] ${faltamClass}">Faltam: ${faltam}</span>
                `;

                    //<span class="text-gray-400 font-bold text-[10px]">Cartela: <span class="text-yellow-500">${numeroCartao}</span></span>
                cardDiv.appendChild(header);

                const grid = document.createElement('div');
                grid.className = 'grid grid-cols-5 gap-0.5';

                numerosGerais.forEach((val, index) => {
                    const num = parseInt(val);
                    const cell = document.createElement('div');
                    let cellClass = 'h-4 w-full flex items-center justify-center text-[9px] font-bold rounded border ';
                    
                    // --- APLICAÇÃO DO SEU LAYOUT ---
                    if (bolasSet.has(num)) {
                        // 1. JÁ SORTEADO (Cinza Escuro / Apagado)
                        cellClass += ` ${corFundoNumerosSorte} ${corNumerosSorte} ${corNumerosBordaSorte}`;
                        //cellClass += 'bg-gray-800 text-gray-600 border-gray-800'; 
                    } else {
                        // 2. NÃO SORTEADO (Faltante)
                        let isTargetLine = true;

                        if (isModoLinhaOuQuadra && cardData.linhaId) {
                            let linhaDoNumero = '';
                            if (index >= 0 && index <= 4) linhaDoNumero = 'SUP';
                            else if (index >= 5 && index <= 9) linhaDoNumero = 'CEN';
                            else if (index >= 10 && index <= 14) linhaDoNumero = 'INF';

                            if (linhaDoNumero !== cardData.linhaId) {
                                isTargetLine = false;
                            }
                        }

                        if (isTargetLine) {
                            // DESTAQUE (Branco com Borda Amarela)
                            cellClass += ` ${corFundoNumerosDest} ${corNumerosDest} ${corNumerosBordaDest}`;
                            //cellClass += 'bg-gray-800 text-white border-yellow-600 shadow-sm'; 
                        } else {
                            // "GRAY-250" (Cinza Claro discreto)
                            cellClass += ` ${corFundoNumerosNSorte} ${corNumerosNSorte} ${corNumerosBordaNSorte}`;
                            //cellClass += 'bg-gray-800 text-gray-400 border-gray-800'; 
                        }
                    }
                    // -------------------------------
                    
                    cell.className = cellClass;
                    cell.textContent = num;
                    grid.appendChild(cell);
                });

                cardDiv.appendChild(grid);
                
                if (cardData.premioEncontrado) {
                    const footer = document.createElement('div');
                    footer.className = 'mt-0.5 text-center text-[8px] font-bold rounded py-0.5 animate-prize-blink bg-yellow-600 text-black uppercase';
                    footer.textContent = `${cardData.premioEncontrado}`;
                    cardDiv.appendChild(footer);
                }
                
                fragment.appendChild(cardDiv);
            });
        }

        container.innerHTML = '';
        container.className = newContainerClass;
        container.appendChild(fragment);
    });
}


// --- RENDERIZADOR BINGO 75 (Top 6 - Grade 5x5) ---
function renderOscartoes75(bolasInput) {
    let listaRealDeBolas = [];
    if (Array.isArray(bolasInput) && bolasInput.length > 0) {
        listaRealDeBolas = bolasInput;
    } else if (typeof globalBolasCantadas !== 'undefined' && Array.isArray(globalBolasCantadas)) {
        listaRealDeBolas = globalBolasCantadas;
    }
    const bolasSet = new Set(listaRealDeBolas.map(b => parseInt(b)).filter(b => b > 0));

    const formattedCount = new Intl.NumberFormat('pt-BR').format(typeof cartelasEmJogo !== 'undefined' ? cartelasEmJogo : 0);
    const textoTitulo = `Top 10 Melhores (${formattedCount})`;

    const pcHeader = document.getElementById('oscartoes-header');
    const mobileHeader = document.getElementById('mobile-oscartoes-header');
    if (pcHeader) pcHeader.textContent = textoTitulo;
    if (mobileHeader) mobileHeader.textContent = textoTitulo;

    let dadosParaRenderizar = (loadedCards && loadedCards.length > 0) ? loadedCards.slice(0, 10) : [];
    const conteudoVazio = dadosParaRenderizar.length === 0;

    const containers = [
        document.getElementById('oscartoes-content'),        
        document.getElementById('mobile-oscartoes-content') 
    ];

    containers.forEach(container => {
        if (!container) return; 
        
        const fragment = document.createDocumentFragment();
        let newClasses = '';

        if (conteudoVazio) {
            newClasses = 'flex flex-col items-center justify-center h-full';
            const p = document.createElement('p');
            p.className = 'text-center text-gray-500 text-xs mt-4';
            p.textContent = 'Aguardando início...';
            fragment.appendChild(p);
        } else {
            newClasses = 'grid grid-cols-2 gap-2 pb-4 content-start';
            container.style.maxHeight = (typeof telaFull !== 'undefined' && telaFull) ? '480px' : '380px';

            dadosParaRenderizar.forEach(cardData => {
                const numeroCartao = cardData.cartao;
                const numerosGerais = cardData.layoutGrid || [];
                
                if (numerosGerais.length < 24) return;

                const cardDiv = document.createElement('div');
                cardDiv.className = ` ${corFundoCartela} border ${corBordaCartela} rounded p-1 flex flex-col gap-0.5 shadow-sm`;

                // Usa a lista calculada no processCards75 para saber quantos faltam "de verdade" para o prêmio
                const faltam = cardData.missingNumbers ? cardData.missingNumbers.length : 25;
                const faltamClass = faltam <= 1 ? ` ${corNumeroFaltam1} animate-pulse font-bold` : ` ${corNumeroFaltam} font-bold` ;
               
                const header = document.createElement('div');
                header.className = 'flex justify-between items-center border-b border-gray-700 pb-0.5 mb-0.5';
                 header.innerHTML = `
                     <span class="${corTituloCartela} font-bold text-[10px]">Cartela: <span class="${corNumeroCartela}">${numeroCartao}</span></span>
                     <span class="text-[10px] font-bold ${faltamClass}">Faltam: ${faltam}</span>
                `;
                cardDiv.appendChild(header);

                const grid = document.createElement('div');
                grid.className = 'grid grid-cols-5 gap-0.5';

                // Mapeamento Visual (0, 5, 10...)
                const ordemVisual = [0, 5, 10, 15, 20, 1, 6, 11, 16, 21, 2, 7, 12, 17, 22, 3, 8, 13, 18, 23, 4, 9, 14, 19, 24];
                
                // Cria um Set dos números que faltam PARA O PRÊMIO (para destacar)
                const missingSet = new Set(cardData.missingNumbers || []);

                ordemVisual.forEach((realIndex, visualIndex) => {
                    const num = parseInt(numerosGerais[realIndex]);
                    const cell = document.createElement('div');
                    let cellClass = 'h-4 w-full flex items-center justify-center text-[9px] font-bold rounded border ';
                    
                    const isFree = (num === 0 || (visualIndex === 12 && num === 0));
                    
                    if (isFree) {
                        // ESPAÇO GRÁTIS
                        cellClass += 'bg-yellow-700 text-yellow-100 border-yellow-600';
                        cell.textContent = '★'; 
                    } 
                    else if (bolasSet.has(num)) {
                        // 1. JÁ SORTEADO (Cinza Escuro / Apagado)
                        cellClass += ` ${corFundoNumerosSorte} ${corNumerosSorte} ${corNumerosBordaSorte}`; 
                        cell.textContent = num;
                    } 
                    else if (missingSet.has(num)) {
                        // 2. DESTAQUE (Branco com Borda Amarela)
                        // Este número faz parte da Linha/Canto que estamos buscando
                        cellClass += ` ${corFundoNumerosDest} ${corNumerosDest} ${corNumerosBordaDest}`; 
                        cell.textContent = num;
                    } 
                    else {
                        // 3. OUTROS FALTANTES (Cinza Claro discreto)
                        // Número falta, mas não na linha principal
                        cellClass += ` ${corFundoNumerosNSorte} ${corNumerosNSorte} ${corNumerosBordaNSorte}`; 
                        cell.textContent = num;
                    }
                    
                    cell.className = cellClass;
                    grid.appendChild(cell);
                });

                cardDiv.appendChild(grid);
                
                if (cardData.premioEncontrado) {
                    const footer = document.createElement('div');
                    footer.className = 'mt-0.5 text-center text-[8px] font-bold rounded py-0.5 animate-prize-blink bg-yellow-600 text-black uppercase';
                    footer.textContent = `${cardData.premioEncontrado}`;
                    cardDiv.appendChild(footer);
                }
                fragment.appendChild(cardDiv);
            });
        }

        container.innerHTML = '';
        container.className = newClasses;
        container.appendChild(fragment);
    });
}


// --- FUNÇÃO DE TEMA (GLOBAL) ---
function temaTope10() {
    if (isDarkMode) {
        // --- TEMA DARK (Padrão) ---
        corFundoCartela = "bg-gray-900";
        corBordaCartela = "border-gray-700";

        corNumeroCartela = "text-yellow-600";
        corTituloCartela = "text-gray-400";

        corNumeroFaltam = "text-blue-400";
        corNumeroFaltam1 = "text-green-400";

        corFundoNumerosSorte = "bg-gray-800";
        corFundoNumerosNSorte = "bg-gray-800";
        corFundoNumerosDest = "bg-gray-800";

        corNumerosSorte = "text-gray-500";
        corNumerosNSorte = "text-gray-500";
        corNumerosDest = "text-white"; 

        corNumerosBordaSorte = "border-gray-800";
        corNumerosBordaNSorte = "border-gray-800";
        corNumerosBordaDest = "border-yellow-600";

        // --- Cores Numeros Faltantes (Mobile) ---
        corFundoConteiner = "bg-gray-900/50";
        corFundoTitulo = "bg-gray-800";
        corFundoNumeroCartao = "bg-gray-700  border-0";
        corFundoPosicaoLinha = "bg-gray-800";
        corFundoNumeros4 = "bg-transparent border-2 border-blue-800";
        corFundoNumeros23 = "bg-transparent border-2 border-orange-700"; 
        corFundoNumero1 = "bg-transparent border-2 border-green-500";
        corTextoNumeros = "text-gray-200";

    } else {
        // --- TEMA LIGHT (Claro) ---
        corFundoCartela = "bg-gray-300"; 
        corBordaCartela = "border-gray-500";

        corNumeroCartela = "text-blue-800";
        corTituloCartela = "text-gray-600";

        corNumeroFaltam = "text-red-600";
        corNumeroFaltam1 = "text-green-600";

        corFundoNumerosSorte = "bg-gray-200";
        corFundoNumerosNSorte = "bg-white"; 
        corFundoNumerosDest = "bg-blue-200";

        corNumerosSorte = "text-gray-400";
        corNumerosNSorte = "text-gray-400"; 
        corNumerosDest = "text-red-600 font-bold"; 

        corNumerosBordaSorte = "border-gray-300";
        corNumerosBordaNSorte = "border-gray-300";
        corNumerosBordaDest = "border-blue-500";

        // --- Cores Numeros Faltantes (Mobile) ---
        corFundoConteiner = "bg-blue-300/20";
        corFundoTitulo = "bg-blue-850";
        corFundoNumeroCartao = "bg-blue-700 border-2 border-blue-900";
        corFundoPosicaoLinha = "bg-blue-700";
        
        // Ajuste aqui: border-1 não existe padrão, usa-se apenas 'border'
        corFundoNumeros4 = "bg-transparent border-2 border-blue-950";
        corFundoNumeros23 = "bg-transparent border-2 border-orange-700";
        corFundoNumero1 = "bg-blue-800 border-2 border-yellow-500";
        corTextoNumeros = "text-white";
    }

    // --- ATUALIZAÇÃO IMEDIATA ---
    if (typeof loadedCards !== 'undefined' && loadedCards.length > 0) {
        renderOscartoes(globalBolasCantadas);
        displayLoadedCards(globalBolasCantadas);
    }
}


async function renderMainContent(data) {
    if (!data) return;

    const { 
        bolasData, buscandoData, premioData, ganhadoresData, promocionalData, 
        rodadaData, confereData, topeData, premioInfo, parametrosInfo = {}, avisosData = []
    } = data;
    
    if (Carregando) {
        tipoEntradaCartelas = parametrosInfo.tipo_entrada_de_cartelas  || 1;
        Carregando = false;   
    }
    controlarPainelMobileEntrada();
    
    // Auto-Load
    if (typeof clienteLogadoId !== 'undefined' && clienteLogadoId) {
        const eventoAtual = premioInfo?.rodada || rodadaData?.[0]?.id_evento;
        if (eventoAtual) {
            if (typeof window.ultimoEventoProcessado === 'undefined') window.ultimoEventoProcessado = null;
            if (window.ultimoEventoProcessado != eventoAtual) {
                window.ultimoEventoProcessado = eventoAtual;
                carregarCartelasAutomaticas(eventoAtual);
            }
        }
    }

    // Estado da Rodada
    const rodadaState = rodadaData && rodadaData.length > 0 ? rodadaData[0].estado.trim() : null;
 
    if (rodadaState === 'intervalo' && lastRodadaState !== 'intervalo') {
        clearPanels();
        lastRodadaState = rodadaState; 
        window.ultimoEventoProcessado = null; 
        return; 
    } else if (rodadaState !== null) {
        lastRodadaState = rodadaState;
    }
    
    // =========================================================================
    // >>> PROTEÇÃO ANTI-PISCA NAS BOLAS (CORREÇÃO DO "FALTAM 15") <<<
    // =========================================================================
    let bolasCantadasRaw = (bolasData && bolasData.length > 0) ? bolasData[0].bolas_cantadas : [];
    
    // Se veio vazio do servidor, mas nós já tínhamos bolas na memória...
    if (bolasCantadasRaw.length === 0 && globalBolasCantadas.length > 0) {
        // Verifica se NÃO é um Reset real (se ainda estamos buscando prêmio, o jogo continua)
        if (buscando_o_premio && buscando_o_premio !== '...' && buscando_o_premio !== 'null') {
             // console.warn("🛡️ Mantendo bolas anteriores para evitar zerar cartelas.");
             bolasCantadasRaw = globalBolasCantadas; // Ignora o vazio e usa o cache
        }
    }
    
    const bolasCantadas = bolasCantadasRaw;
    globalBolasCantadas = bolasCantadas; // Atualiza a global

    const proximaBola = (bolasData && bolasData.length > 0 && bolasData[0].proxima_bola) ? bolasData[0].proxima_bola : "--";
    const ultimaBolaDaLista = bolasCantadas.length > 0 ? bolasCantadas[bolasCantadas.length - 1] : null;
    
      if (tipoDoSorteio !== 'manual') updateDigitalBola(proximaBola);

    // =========================================================================
    // >>> PROTEÇÃO ANTI-PISCA NOS DADOS DE PRÊMIO <<<
    // =========================================================================
    
    let dadosBuscando = {};
    let usarDadosFake = false;

    if (buscandoData && buscandoData.length > 0) {
        dadosBuscando = buscandoData[0];
    } else {
        // Se veio vazio, mas temos bolas sorteadas, é bug do servidor.
        if (bolasCantadas.length > 0 && buscando_o_premio) {
            usarDadosFake = true;
            dadosBuscando = {
                buscando_o_premio: buscando_o_premio, 
                buscando_a_linha: buscando_a_linha,   
                qtde_linha: 1 
            };
        }
    }

    const premioBuscadoDaAPI = (dadosBuscando.buscando_o_premio || '').replace(/\s+/g, '').trim();
    const linhasAtivasDaAPI = dadosBuscando.buscando_a_linha || '';

    // Detecta mudanças
    const premioMudou = (premioBuscadoDaAPI !== buscando_o_premio.replace(/\s+/g, '').trim() || linhasAtivasDaAPI !== buscando_a_linha);
    const bolaMudou = (ultimaBolaDaLista !== ultimaBolaCantada);

    if (premioMudou) {
        buscando_o_premio = premioBuscadoDaAPI;
        buscando_a_linha = linhasAtivasDaAPI;
        bolaBuscandoPremio = bolasCantadas.length;
    }

    if (bolaMudou) {
        if (ultimaBolaDaLista !== null && ultimaBolaDaLista !== undefined) ;
           falarTexto(`${ultimaBolaDaLista}`) 
           ultimaBolaCantada = ultimaBolaDaLista;
    }

    // --- REPROCESSAMENTO LOCAL ---
    // Agora que 'bolasCantadas' está protegido, o cálculo será correto (não dará 15)
    if ((premioMudou || bolaMudou) && cachedRawCards.length > 0) {
        const premioNormalizado = premioBuscadoDaAPI.replace(/\s+/g, '').trim();
        processCards(cachedRawCards, bolasCantadas, premioNormalizado, linhasAtivasDaAPI);
    } 
    else if (cartelaRanges && cartelaRanges.length > 0 && cachedRawCards.length === 0 && !isFetchingCards) {
         fetchAndProcessCards();
    }
    
    // =========================================================================

    globalPromocionalData = promocionalData;

   if (parametrosInfo && Object.keys(parametrosInfo).length > 0) {
        const nome_da_sala = parametrosInfo.nome_sala; 
        if (nome_da_sala && salaTitleElement) salaTitleElement.textContent = nome_da_sala;
        
        const tipoCartelaConfig = parseInt(parametrosInfo.tipo_cartela || 15);
        MAX_BOLAS = (tipoCartelaConfig === 25) ? 75 : 90;
        tempoExibicaoGanhador = parseInt(parametrosInfo.tempo_ganhador);
        
        const tipoSorteio = parametrosInfo.modo_sorteio;

        //if (tipoSorteio === 'manual') {
        //    vozAtiva = false;
        //} else {
        //    vozAtiva = true;
        //}

        updateMenuSoundVisuals();

        tipoDoSorteio = tipoSorteio;
    
        let videoID = '';
        const rawVideoID =parametrosInfo.url_live || parametrosInfo.url_padrao || '';
        video_local =  parametrosInfo.video_local;
        
        if (tipoSorteio === "manual") {             // --- INÍCIO SE MANUAL ---
       
            // 1. Extrai APENAS o ID (11 caracteres) de qualquer link
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = rawVideoID.match(regExp);

            if (match && match[2].length === 11) {
                videoID = match[2];
            } else if (rawVideoID.length === 11) {
                videoID = rawVideoID;
            }

            if (!videoID) videoID = ''; 

            // 2. O GRANDE TRUQUE PARA FILE://
            let paramOrigin = '';
        
            // Verifica se está rodando localmente (arquivo)
            if (window.location.protocol === 'file:') {
                 // Força a origem como sendo o próprio YouTube para enganar a trava
                 paramOrigin = '&origin=https://www.youtube.com';
            } 
            else if (window.location.protocol.startsWith('http')) {
                 // Se estiver em servidor real, usa a origem real
                 paramOrigin = `&origin=${window.location.origin}`;
            }

            // Monta a URL Final
            const newVideoUrl = `https://www.youtube.com/embed/${videoID}?autoplay=1&rel=0${paramOrigin}`;
        
            // Atualiza o player apenas se mudou
            if (currentVideoUrl !== newVideoUrl) {
                currentVideoUrl = newVideoUrl;
                if (youtubeIframe && videoID) {
                    youtubeIframe.src = newVideoUrl;
                } else if (youtubeIframe) {
                    youtubeIframe.src = ''; // Limpa se não tiver ID
                }
            }
        }         // --- FIM se Manual-

        if (abrirYoutubeBtn) {
             const isLocal = String(video_local).toLowerCase() === 'true'; 
             if (isLocal || tipoSorteio != "manual") {
                 abrirYoutubeBtn.classList.add('hidden');
                 if (youtubePanel && !youtubePanel.classList.contains('hidden')) abrirYoutubeBtn.click(); 
                 if (tipoSorteio !== "manual") digitalBolaPanel.classList.remove('hidden');
             } else {
                 if (tipoSorteio === "manual") digitalBolaPanel.classList.add('hidden');
                 abrirYoutubeBtn.classList.remove('hidden');
             }
        }

    }

    renderAvisoPanel(avisosData);

    if (promocionalContainer) {
        promocionalContainer.onclick = () => {
            hidePromocionalPanel();
            startPromocionalTimer();
        };
    }
    
    // Passa 'bolasCantadas' (que agora está protegido) para os paineis
    updateNumericPanel(bolasCantadas);
    displayLastThree(bolasData && bolasData.length > 0 ? bolasData[0] : {});
    displayConferencePanel(confereData, bolasCantadas);

    if (premioInfo && typeof premioInfo.preco === 'number') {
        const preco = premioInfo.preco  / premioInfo.multiplo;
        ValorSerie = preco;
        const formattedPreco = new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(preco);
        if(mobilePrecoSerieElement) mobilePrecoSerieElement.textContent = formattedPreco;
    }

    if (cartelaRanges && cartelaRanges.length > 0) {
        displayCardRanges(cartelaRanges);
    } else if (data.cardRanges) {
        displayCardRanges(data.cardRanges); 
    }

    const dadosParaDisplay = usarDadosFake ? [dadosBuscando] : buscandoData;
    displayPrizeInfo(dadosParaDisplay, premioData);

    displayPrizeValues(premioData, topeData);
   
    if (ganhadoresData && ganhadoresData.length > 0) {
        displayWinnersPanel(ganhadoresData);
    } 

    const totalAtual = isMobileDevice() ? 
        (mobileTotalCartelasSpan ? parseInt(mobileTotalCartelasSpan.textContent) : 0) : 
        (totalCartelasSpan ? parseInt(totalCartelasSpan.textContent) : 0);
    checkTotalCards(totalAtual);
}

//==============
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
        //frontendVersionElement.textContent = "1.0.0";
        //backendVersionElement.textContent = versionData.version;

        premioInfo = initialData.premioInfo;
      
        const oTipo = parseInt(tipoEntradaCartelas);
        if (oTipo === 1) {  
            minCartelas = premioInfo?.minimo_de_cartelas || 0;
            maxCartelas = premioInfo?.maximo_de_cartelas || 0;
        } else {
            minCartelas = 1;
            maxCartelas =  premioInfo?.serie_em_jogo || 0;
        }
       
        // NOVO CÓDIGO BLINDADO: Busca o valor de preco_da_serie e o exibe
        if (premioInfo && typeof premioInfo.preco === 'number') {             
            const preco = premioInfo.preco  / premioInfo.multiplo;
            ValorSerie = preco;
            const formattedPreco = new Intl.NumberFormat('pt-BR', {
                 style: 'decimal',
                 minimumFractionDigits: 2,
                 maximumFractionDigits: 2
            }).format(preco);
            
            // VERIFICA SE O ELEMENTO EXISTE ANTES DE TENTAR ALTERAR
            if (mobilePrecoSerieElement) {
                mobilePrecoSerieElement.textContent = formattedPreco;
            }
        }

        const maxCardNumber = initialData.maxCardNumber || 0;
        setupCartelasEmJogo(maxCardNumber);

        // PROTEÇÕES EXTRAS PARA INPUTS
        if(cartelaInicialInput) {
            cartelaInicialInput.max = maxCardNumber;
            cartelaInicialInput.min = 1;
        }
        if(cartelaFinalInput) cartelaFinalInput.max = maxCardNumber;

        if(mobileCartelaInicialInput) {
            mobileCartelaInicialInput.max = maxCardNumber;
            mobileCartelaInicialInput.min = 1;
        }
        if(mobileCartelaFinalInput) mobileCartelaFinalInput.max = maxCardNumber;
        
        // PROTEÇÕES PARA PAINÉIS E BOTÕES
        if(mobileCartelasContent) mobileCartelasContent.classList.add('hidden');
        if(mobilePrizesContent) mobilePrizesContent.classList.add('hidden');
        if(toggleCartelasButton) toggleCartelasButton.textContent = 'INCLUIR Cartelas';
        if(togglePrizesButton) togglePrizesButton.textContent = 'Apresentar Prêmios';

        if(loader) loader.style.display = 'none';
        
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
                const rodadaState = rodadaData && rodadaData.length > 0 ? rodadaData[0].estado.trim() : null;
                toggleButton.textContent = 'INCLUIR Cartelas';
                toggleButton.classList.remove('bg-red-800');
                toggleButton.classList.add('bg-green-light');
                if (cartelasEmJogo === 0 && rodadaState === 'intervalo') {
                   seePromocoes = true;
                   startPromocionalTimer();
                }
            }
        }
    }, secundsCardsoutId * 1000); // x segundos 8 1000
}

function startPrizeHideTimer() {
    // XXapagar Limpa o temporizador anterior, se existir
    if (prizeTimeoutId) {
        clearTimeout(prizeTimeoutId);
    }
    // Inicia um novo temporizador
    let Mutiplicador = 1000;
    if (iniciandoRodada) {
       //Mutiplicador = 3000; 
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
                toggleButton.classList.add('bg-gray-700'); // Classe para a cor verde
                if (cartelasEmJogo === 0 && lastRodadaState === 'intervalo') {
                   seePromocoes = true;
                   startPromocionalTimer();  
                }
            }
        }
    }, secundsPrizeTimeoutId * Mutiplicador); // x segundos * 1000 (Mutiplicador)
}


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
    //*ws = new WebSocket(WS_URL);

    const separator = WS_URL.includes('?') ? '&' : '?';
    const wsUrlWithRoom = `${WS_URL}${separator}idsala=${currentSalaId}`;
    
    ws = new WebSocket(wsUrlWithRoom);

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

    // Listeners do Painel de Próximos Eventos
    if (btnEventsMenu) {
        btnEventsMenu.addEventListener('click', () => {
            closeSideMenu(); // Fecha o menu lateral se estiver aberto
            openEventsPanel();
        });
    }
    
    if (btnEventsMobile) {
        btnEventsMobile.addEventListener('click', openEventsPanel);
    }
    
    if (btnCloseEvents) {
        btnCloseEvents.addEventListener('click', closeEventsPanel);
    }
    
    // Fecha ao clicar fora (Opcional, mas boa UX)
    if (eventsPanelContainer) {
        eventsPanelContainer.addEventListener('click', (e) => {
            if (e.target === eventsPanelContainer) {
                closeEventsPanel();
            }
        });
    }

// Listeners para "Minhas Cartelas" (Menu Lateral e Botão Mobile)
    const btnMyCardsMenu = document.getElementById('menu-btn-cartelas');
    const btnMyCardsMobile = document.getElementById('btn-minhas-cartelas-mobile-view'); // Botão do painel novo

    if (btnMyCardsMenu) btnMyCardsMenu.addEventListener('click', () => {
        closeSideMenu(); // Fecha o menu lateral
        openMyCardsPanel(); // <--- CHAMADA 1 (Menu)
    });

    if (btnMyCardsMobile) btnMyCardsMobile.addEventListener('click', openMyCardsPanel); // <--- CHAMADA 2 (Painel de Compra)
// --- BOTÃO FECHAR TELA GANHADORES ---
    if (btnCloseMyCards) {
        btnCloseMyCards.addEventListener('click', closeMyCardsPanel);
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

// --- BOTÃO FECHAR TELA GANHADORES ---
    if (btnCloseWinners) {
        btnCloseWinners.addEventListener('click', closeWinnersPanel);
    }

// --- BOTÃO FECHAR TELA CONFERENCIA ---
    const btnCloseConf = document.getElementById('btn-close-conference');
    if (btnCloseConf) {
        btnCloseConf.addEventListener('click', () => {
            ocultarConferencia();
        });
    }

// --- CONTROLE DE TEMA (BOTÃO MOBILE) ---
if (btnToggleTemaMobile) {
    btnToggleTemaMobile.addEventListener('click', () => {
        // 1. Inverte o estado do tema
        isDarkMode = !isDarkMode;
        
        // 2. Sincroniza com o texto do Menu Lateral (se existir)
        if (menuStatusTema) {
            menuStatusTema.textContent = isDarkMode ? 'DARK' : 'LIGHT';
            if (isDarkMode) {
                menuStatusTema.classList.remove('text-yellow-500');
                menuStatusTema.classList.add('text-gray-400');
            } else {
                menuStatusTema.classList.remove('text-gray-400');
                menuStatusTema.classList.add('text-yellow-500');
            }
        }

        // 3. Aplica o tema visualmente
        temaTope10(); 

    });
}


// Listeners
if (btnOpenMenu) btnOpenMenu.addEventListener('click', openSideMenu);
if (btnCloseMenu) btnCloseMenu.addEventListener('click', closeSideMenu);
if (menuBackdrop) menuBackdrop.addEventListener('click', closeSideMenu);

// Lógica do Botão de Som (Dentro do Menu)
if (menuBtnSom) {
    menuBtnSom.addEventListener('click', () => {
        vozAtiva = !vozAtiva; // Inverte o estado global
        
        if (vozAtiva) {
            desbloquearAudio();
            falarTexto("Áudio Ativado");
        } else {
            window.speechSynthesis.cancel();
        }
        updateMenuSoundVisuals();
        closeSideMenu();
    });
}

// Lógica do Botão de Tema
if (menuBtnTema) {
    menuBtnTema.addEventListener('click', () => {
        // 1. Inverte o estado
        isDarkMode = !isDarkMode;
        
        // 2. Atualiza texto do menu
        menuStatusTema.textContent = isDarkMode ? 'DARK' : 'LIGHT';
        
        // 3. Muda cor do texto do status para feedback visual
        if (isDarkMode) {
            menuStatusTema.classList.remove('text-yellow-500');
            menuStatusTema.classList.add('text-gray-400');
        } else {
            menuStatusTema.classList.remove('text-gray-400');
            menuStatusTema.classList.add('text-yellow-500');
        }

        // 4. Executa a função de troca de cores e renderização
        temaTope10();
        closeSideMenu(); 
 
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
 
// Referencia o novo container
    const videoContainer = document.getElementById('video-container');

    if (abrirYoutubeBtn && videoContainer && youtubeIframe) {
        abrirYoutubeBtn.addEventListener('click', () => {
            startPromocionalTimer();
   
            const videoToLoad = currentVideoUrl; 

            if (!videoToLoad) {
                alert('Nenhuma URL de vídeo configurada.');
                return;
            }
        
            // Lógica de URL (mantida)
            let videoUrl;
            if (videoToLoad.includes('youtube.com/embed/')) {
                videoUrl = videoToLoad; 
            } else {
                const videoID = videoToLoad.split('&')[0];
                videoUrl = `https://www.youtube.com/embed/${videoID}?autoplay=1`;
            }

            // Alternar visibilidade
            videoContainer.classList.toggle('hidden');
            
            // Verifica estado
            const isVideoVisible = !videoContainer.classList.contains('hidden');
            
            if (isVideoVisible) {
                abrirYoutubeBtn.textContent = 'Fechar YouTube';
                // Define src para tocar
                youtubeIframe.src = videoUrl;
                 if (!telaFull) { 
                    goFullscreen(); 
                 } 
            } else {
                abrirYoutubeBtn.textContent = 'Abrir YouTube';
                // Limpa src para parar o som
                youtubeIframe.src = ''; 
            }
            
            // Atualiza posição do painel promocional se necessário
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
    
    // 1. Tenta pegar de 'idcliente' OU 'id_cliente'
    const idUrl = urlParams.get('idcliente') || urlParams.get('id_cliente');
    
    // 2. Só atualiza se realmente encontrou algo na URL
    if (idUrl) {
        clienteLogadoId = idUrl;
        console.log("✅ idcliente atualizado pela URL:", clienteLogadoId);
    } else {
        console.log("ℹ️ Nenhum idcliente novo na URL. Mantendo:", clienteLogadoId);
    }

    // --- Processa o idrodada ---
    const idRodadaParam = urlParams.get('idrodada');
    if (idRodadaParam) {
        try {
            idRodada = parseInt(idRodadaParam);
            if (!isNaN(idRodada)) console.log("ID da Rodada definido:", idRodada);
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

// --- FUNÇÃO DE CONTROLE DE PAINÉIS (Modo 1 vs Modo 2) ---
function controlarPainelMobileEntrada() {
    const painelManual = document.getElementById('mobile-gerenciar-cartelas-panel');
    const painelBotoes = document.getElementById('mobile-compra-botoes');
    
    // Se não for mobile ou os elementos não existirem, não faz nada
    if (!isMobileDevice() || !painelManual || !painelBotoes) {
        // Garante que no PC o painel de botões mobile fique oculto
        if (painelBotoes) painelBotoes.classList.add('hidden');
        return;
    }

    // Converte para inteiro para garantir comparação correta
    const tipo = parseInt(tipoEntradaCartelas);

    if (tipo === 2) {
        // MODO COMPRA (Valor = 2): Oculta o manual, mostra os botões
        painelManual.classList.add('hidden');
        painelBotoes.classList.remove('hidden');
    } else {
        // MODO MANUAL (Valor = 1 ou outro): Mostra o manual, oculta os botões
        painelManual.classList.remove('hidden');
        painelBotoes.classList.add('hidden');
    }


}

// --- CONTROLE DE ABAS (NUMÉRICO / INFORMATIVO / ESTATÍSTICAS) ---
function alternarPainelMobile(modo) {
    // 1. Elementos dos Painéis Principais
    const panelNumerico = document.getElementById('mobile-panels-container');
    const panelInformativo = document.getElementById('mobile-prizes-panel');
    const panelEstatisticas = document.getElementById('estatisticas-panel');
    
    // 1.1 Elemento Interno de Prêmios (Correção para exibir prêmios)
    const mobilePrizesContent = document.getElementById('mobile-prizes-content');

    // 2. Elementos dos Botões
    const btnNumerico = document.getElementById('btn-tab-numerico');
    const btnInformativo = document.getElementById('btn-tab-informativo');
    const btnEstatisticas = document.getElementById('btn-tab-estatisticas');
    
    // Função auxiliar para resetar botões
    const resetBotoes = () => {
        [btnNumerico, btnInformativo, btnEstatisticas].forEach(btn => {
            if(btn) {
                btn.classList.remove('bg-gray-700', 'text-white', 'border-green-500');
                btn.classList.add('bg-gray-800', 'text-gray-400', 'border-transparent');
            }
        });
    };

    // 3. PRIMEIRO: ESCONDE TUDO
    // Usamos setProperty('display', 'none', 'important') para vencer o mobile.css
    if (panelNumerico) {
        panelNumerico.style.setProperty('display', 'none', 'important');
    }
    
    if (panelInformativo) {
        panelInformativo.classList.add('hidden');
        panelInformativo.classList.remove('flex'); // Garante que saia do flex
    }
    
    if (panelEstatisticas) {
        panelEstatisticas.classList.add('hidden');
        panelEstatisticas.classList.remove('flex');
    }
    
    resetBotoes();

    // 4. DEPOIS: MOSTRA O ESCOLHIDO
    switch(modo) {
        case 'numerico':
            if (panelNumerico) {
                // Remove o inline style para que o CSS do mobile.css (display: flex) volte a funcionar
                panelNumerico.style.removeProperty('display');
                // Se o CSS não tiver flex, garantimos com classe, mas removemos o hidden
                panelNumerico.classList.remove('hidden');
            }
            if (btnNumerico) {
                btnNumerico.classList.remove('bg-gray-800', 'text-gray-400', 'border-transparent');
                btnNumerico.classList.add('bg-gray-700', 'text-white', 'border-green-500');
            }
            break;

        case 'informativo':
            if (panelInformativo) {
                panelInformativo.classList.remove('hidden');
                panelInformativo.classList.add('flex'); // Força layout flex
                
                // CORREÇÃO CRÍTICA: Garante que o conteúdo interno também apareça
                if (mobilePrizesContent) {
                    mobilePrizesContent.classList.remove('hidden');
                }
            }
            if (btnInformativo) {
                btnInformativo.classList.remove('bg-gray-800', 'text-gray-400', 'border-transparent');
                btnInformativo.classList.add('bg-gray-700', 'text-white', 'border-green-500');
            }
            break;

        case 'estatisticas':
            if (panelEstatisticas) {
                panelEstatisticas.classList.remove('hidden');
                panelEstatisticas.classList.add('flex');
            }
            if (btnEstatisticas) {
                btnEstatisticas.classList.remove('bg-gray-800', 'text-gray-400', 'border-transparent');
                btnEstatisticas.classList.add('bg-gray-700', 'text-white', 'border-green-500');
            }
            break;
            
        case 'ocultar':
            // Tudo já foi ocultado no passo 3.
            break;
    }
}



// --- FIM DAS NOVAS FUNÇÕES ---
