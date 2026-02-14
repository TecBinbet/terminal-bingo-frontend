// ======================================================
// 1. CONFIGURAÇÃO AUTOMÁTICA (LOCAL vs PRODUÇÃO)
// ======================================================

// --- INÍCIO DA CONFIGURAÇÃO AUTOMÁTICA (MODO SERVIDOR INDEPENDENTE) ---

// Detecta protocolo e host automaticamente
const protocolWS = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const host = window.location.host;

// Variáveis GLOBAIS
// Agora o API_BASE_URL fica vazio porque cada servidor responde na própria raiz /
var API_BASE_URL = ""; 

// O ID da Sala agora é apenas para exibição ou identificação no Front, 
// pois o Backend já sabe quem ele é através do .env
const urlParamsGlobal = new URLSearchParams(window.location.search);
var currentSalaId = urlParamsGlobal.get('sala') || "001"; 

// Montagem da URL do WebSocket
// Simples e direta: aponta sempre para o /stream do host atual
var WS_URL = `${protocolWS}${host}/stream`;
var ws = null;
var reconnectInterval = null;


console.log(`🚀 Conectado ao Servidor: ${host}`);
console.log(`🔧 Sala identificada no Front: ${currentSalaId}`);
console.log(`🔌 WebSocket Alvo: ${WS_URL}`);

// --- FIM DA CONFIGURAÇÃO ---//
//const backendVersionElement = document.getElementById('backend-version');
//const frontendVersionElement = document.getElementById('frontend-version');
const loader = document.getElementById('loader');

const btnToggleTemaMobile = document.getElementById('btn-toggle-tema-mobile');

const numberGrid = document.getElementById('number-grid');
const mobileNumberGrid = document.getElementById('mobile-number-grid');

const estatisticasBody = document.getElementById('estatisticas-body');
const estatisticasPanel = document.getElementById('estatisticas-panel');

const loadingStats = document.getElementById('loading-stats');

const customModal = document.getElementById('custom-modal-global');
const modalTitle = document.getElementById('modal-title');
const modalMsg = document.getElementById('modal-message');
const modalIcon = document.getElementById('modal-icon');

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

const btnMenuFullscreen = document.getElementById('menu-btn-fullscreen');
const statusFullscreen = document.getElementById('menu-status-fullscreen');
const iconFullscreen = document.getElementById('icon-fullscreen');

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

// CONTROLE DE ESTADO LOCAL (Para evitar repetição visual)
let bolasProcessadasLocal = new Set(); // O 'Set' é melhor que Array pois não aceita duplicatas
let ultimaBolaExibida = null;          // Para controlar a "Bola Grande"

//let clienteLogado = false;

let donoDoModal = null;

let globalUserNick = null;
let globalUserSaldo = 0.0;
var globalPrecoCartela = 0;

var currentEventoId = null;   // ID do Evento ativo (usado para buscar cartelas)
var globalIdCliente = null;   // ID do Cliente logado
var globalMinhasCartelas = { cartelas: [], cupons_extra: [] }; // Cache de jogos
var globalBolasCantadas = []; // Cache de sorteio

let eventoSelecionadoParaCompra = 0;

let cacheIdEvento = null; // Para saber se o evento mudou
let cacheImagem = '';     // A foto do carro
let cacheTexto = '';      // O texto "Valendo Moto"

let lastPrizeJson = "";
let lastBuscandoJson = "";

let tipoDoSorteio = "";
let Carregando = true;
let cachedRawCards = [];
let MAX_BOLAS = 90;

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
// aquix
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

let lastStatusEvento = '';

let ValorSerie = 0;

// Variável global para armazenar o ID do temporizador.
let timeoutId = null;
// Nova variável para o temporizador do painel de prêmios.
let prizeTimeoutId = null;

//let ws = null;

let iniciandoRodada = true;
let winnerBingo = false;

let cartelaRanges = [];
let cartelasDoJogador = [];

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

function pegarSalaDaUrl() {
    const params = new URLSearchParams(window.location.search);
    const sala = params.get('sala');

    // Se a sala for nula (não existe), vazia ou indefinida, retorna '000'
    if (!sala) {
        return '000';
    }

    return sala;
}


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
    // 1. Abre o modal primeiro
    const modal = document.getElementById('events-panel-container');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    // 2. ATIVA O LOADING (Bloqueia a tela enquanto busca)
    showFullLoading("Carregando agenda...");

    try {   
        // 3. Busca os dados no servidor
        const response = await fetch(`${API_BASE_URL}/api/proximos_eventos`);
        
        if (!response.ok) {
             throw new Error('Falha na comunicação com o servidor');
        }

        const eventos = await response.json();
        
        // 4. Renderiza a lista (agora com a premiação corrigida)
        renderEventsList(eventos);

    } catch (error) {
        console.error("Erro ao carregar eventos:", error);
        
        // Exibe mensagem de erro amigável dentro do modal se falhar
        const listContent = document.getElementById('events-list-content');
        if (listContent) {
            listContent.innerHTML = `
                <div class="flex flex-col items-center justify-center h-40 text-red-400">
                    <span class="text-3xl mb-2">⚠️</span>
                    <p>Não foi possível atualizar a agenda.</p>
                </div>
            `;
        }
    } finally {
        // 5. DESATIVA O LOADING (Sempre executa, dando erro ou não)
        hideFullLoading();
    }
}


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
        // Adicionamos uma tolerância de 1 horas para eventos que acabaram de começar não sumirem
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
                <div class="-mt-1 border-t border-gray-700 pt-1">  
                    <button onclick="abrirModalCompra('${evt.id_evento}')" 
                            class="w-full bg-green-900 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow-md flex items-center justify-center gap-2 transition-colors active:scale-95">
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

        let rawPremios = evt.premios_desc || evt.premios || [];
        let listaPremios = [];

        if (Array.isArray(rawPremios)) {
            // Se já for array, usa direto
            listaPremios = rawPremios;
        } else if (typeof rawPremios === 'string') {
            // Se for string (ex: "Carro, Moto"), transforma em array
            listaPremios = rawPremios.split(',').map(p => p.trim()).filter(p => p !== "");
        }

        // Renderiza a lista de prêmios
       const premiosHtml = listaPremios.map(p =>
            `<li class="flex items-start gap-0"><span class="text-yellow-500">★</span> ${p}</li>`
        ).join('');

        // Montagem do HTML do Cartão
        const card = document.createElement('div');
        card.className = cardClass;
        card.innerHTML = `
            ${statusBadge}
            
            <div class="pr-2 mt-3">
                <h3 class="text-[15px] font-bold text-yellow-500 leading-tight drop-shadow-sm -mb-0.5">${evt.descricao}</h3>
                <p class="text-[13px] font-semibold text-blue-300 font-mono -mb-0.5 flex items-center gap-1">
                     ${evt.data} <span class="mx-1">|</span> <span>⏰</span> ${evt.hora}
                </p>
            </div>

            <!-- Área de Prêmios -->
            <div class="bg-black/40 rounded-lg p-1 border border-gray-700/50">
                <p class="text-[10px]  text-center text-green-00 font-bold uppercase -mb-1 -mt-1 tracking-wider">Premiação Prevista:</p>
                
                <ul class="grid grid-cols-2 gap-x-2 text-[11px] text-yellow-300 font-medium leading-tight mt-0.5">
                    ${premiosHtml}
                </ul>
            </div>

            <!-- Rodapé do Cartão (Preço e Info) -->
            <div class="flex justify-between items-end -mt-1">
                <div class="text-gray-250">
                    <span class="block text-[9px] font-bold">ID: ${evt.id_evento}</span>
                    <span class="text-xs text-gray-300">Kit c/ <strong>${evt.unidade_venda}</strong> cartelas</span>
                </div>
                <div class="text-right">
                    <span class="block text-[9px] font-bold  text-gray-400 uppercase">Valor do Kit</span>
                    <span class="text-xl font-bold text-green-400 tracking-tighter">${preco}</span>
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


// ======================================================
// FUNÇÃO DE DECISÃO (O "Guarda de Trânsito")
// Conectada ao botão: onclick="iniciarCompraCartelas()"
// ======================================================
function iniciarCompraCartelas(idEvento) {
    console.log("🛒 Botão de compra acionado. ID recebido:", idEvento);

    // 1. Limpa painéis anteriores (Fecha lista de eventos se estiver aberta)
    if (typeof closeEventsPanel === 'function') closeEventsPanel();

    // 2. Verifica Login (Segurança Básica)
    if (!isUsuarioLogado()) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert("Você precisa fazer login para comprar cartelas.", "Login Necessário", "🔒");
        }
        if (typeof abrirModalLogin === 'function') abrirModalLogin();
        return; 
    }

    // 3. Lógica de Decisão
    if (idEvento) {
        // CASO A: Já sabemos o ID (clicou num evento específico da lista)
        // Chama direto a função que você mandou
        abrirModalCompra(idEvento); 

    } else {
        // CASO B: Clicou no botão flutuante genérico (sem ID)
        // Precisamos perguntar pro servidor quem está ativo
        
        fetch(`${API_BASE_URL}/api/status_evento_ativo`)
            .then(response => response.json())
            .then(data => {
                const statusReal = (data.status || '').toLowerCase().trim();
                const idDoBanco = data.id_evento || data.id || data.numero; // Garante pegar o ID certo

                console.log(`📡 Status do Evento Ativo: ${statusReal} (ID: ${idDoBanco})`);

                if (statusReal === 'ativo' && idDoBanco) {
                    // ✅ CENÁRIO 1: Existe evento rodando
                    // Abre direto o modal de compra para esse evento
                    abrirModalCompra(idDoBanco);
                } else {
                    // ❌ CENÁRIO 2: Não tem evento ativo (está agendado, finalizado ou null)
                    // Abre a lista para o usuário escolher
                    console.warn("⚠️ Nenhum evento ativo automático. Abrindo painel de escolha.");
                    if (typeof openEventsPanel === 'function') {
                        openEventsPanel();
                    }
                }
            })
            .catch(err => {
                console.error("❌ Erro ao verificar status:", err);
                // Na dúvida (erro de rede), abre a lista de eventos
                if (typeof openEventsPanel === 'function') openEventsPanel();
            });
    }
}


// Funções de busca de cartelas compradas
async function carregarCartelasAutomaticas(idEvento) {
    if (!idEvento) return;

    // --- NOVA PROTEÇÃO (ADICIONE ISTO) ---
    // Verifica se existe um ID de evento principal definido globalmente (currentEventID)
    // Se o idEvento que estamos tentando carregar NÃO for o atual, paramos aqui.
    if (typeof currentEventID !== 'undefined' && currentEventID && idEvento !== currentEventID) {
        console.log(`🛡️ Bloqueado: Tentativa de carregar cartelas do evento ${idEvento} na mesa do evento ${currentEventID}.`);
        return; 
    }

    // Se já estiver carregado, não mostra loading nem faz nada
    if (eventoCarregadoAtual === idEvento && typeof cartelaRanges !== 'undefined' && cartelaRanges.length > 0) {
        console.log("Cartelas já carregadas na memória.");
        return; 
    }

    // 1. ATIVA O LOADING (Se já não estiver ativo por outra função)
    // Verifica se o loader está visível, se não, mostra.
    if (!loader || loader.style.display === 'none') {
        showFullLoading("Buscando suas cartelas...");
    }

    console.log(`🔄 Buscando cartelas do evento ${idEvento}...`);
    
    let url = `/api/consultar_cartelas_evento?id_evento=${idEvento}`;
    if (clienteLogadoId) {
        url += `&id_cliente=${clienteLogadoId}`;
    }

    try {
        const response = await fetch(url, { credentials: 'include' });
        const data = await response.json();

        if (data.error) {
            console.warn("⚠️ Aviso:", data.error);
            const container = document.getElementById('my-cards-list');
            if(container) container.innerHTML = `<p class="text-center text-gray-500 py-4">${data.error}</p>`;
            return;
        }

        if (data.cartelas && data.cartelas.length > 0) {
            eventoCarregadoAtual = idEvento;
            
            // Processa cartelas
            cartelasDoJogador = data.cartelas;
            cartelaRanges = converterListaParaRanges(data.cartelas); 
            cartelasEmJogo = data.cartelas.length; 
            renderizarListaMinhasCartelas(data.cartelas);
            
            // Baixa a matriz de números
            await fetchAndProcessCards(); 

        } else {
            const container = document.getElementById('my-cards-list');
            if(container) container.innerHTML = '<p class="text-center text-gray-500 py-4">Você ainda não tem cartelas nesta rodada.</p>';
            cartelasEmJogo = 0;
            loadedCards = [];
            displayLoadedCards([]);
        }

    } catch (error) {
        console.error("Erro ao buscar cartelas:", error);
    } finally {
        // 2. DESATIVA O LOADING
        hideFullLoading();
    }
}


// --- FUNÇÃO: Sincronia de Compras Externas (COM REGRA DE BLOQUEIO) ---
async function verificarNovasCompras() {
    // 1. Verificações básicas de login e IDs
    if (!clienteLogado || !clienteLogadoId || !idRodada) return;

    // 2. Evita sobreposição de chamadas
    if (isFetchingCards) return;

    // --- NOVA REGRA: BLOQUEIO DURANTE SORTEIO ---
    // Se o estado atual não for de vendas (ex: está em 'andamento' ou 'finalizada'),
    // nós abortamos a verificação imediatamente.
    // (Ajuste 'aberta' e 'intervalo' conforme os nomes exatos que você usa no banco)
    if (lastRodadaState !== 'aberta' && lastRodadaState !== 'intervalo') {
        // console.log("Sorteio em andamento. Verificação de vendas pausada.");
        return; 
    }
    // ---------------------------------------------

    
    // Se for localhost, ignoramos qualquer prefixo de sala (/sala1) e vamos na raiz
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
         urlBaseSegura = ""; 
    }
                              /// new forma
    try {
        // 3. Consulta Silenciosa
        const url = `${API_BASE_URL}/api/consultar_cartelas_evento?id_evento=${idRodada}&id_cliente=${clienteLogadoId}`;
        const response = await fetch(url, { credentials: 'include' });
        
        if (!response.ok) return;

        const data = await response.json();
        
        if (data.cartelas) {
            const qtdNoServidor = data.cartelas.length;
            // Garante que a variável local existe, senão assume 0
            const qtdLocal = (typeof globalMinhasCartelas !== 'undefined') ? globalMinhasCartelas.length : 0;

            // 4. Comparação
            if (qtdNoServidor !== qtdLocal) {
                console.log(`♻️ Sincronia: Mudança de ${qtdLocal} para ${qtdNoServidor} cartelas.`);
                
                // Se aumentou, mostra aviso (Opcional)
                if (qtdNoServidor > qtdLocal) {
                    showCustomAlert(`Você recebeu novas cartelas!`, "Nova Compra", "🎟️");
                }

                // 5. Atualização
                // Passa 'true' se quiser indicar reload forçado, ou chama normal
                await carregarCartelasAutomaticas(idRodada);
            }
        }
    } catch (e) {
        console.warn("Erro na verificação silenciosa:", e);
    }
}


// Função auxiliar para transformar [1, 2, 3, 5, 6] em [{inicial:1, final:3}, {inicial:5, final:6}]
function agruparNumerosEmRanges2(numeros) {
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


// --- FUNÇÕES VISUAIS DE CARTELAS ---

function renderizarListaMinhasCartelas(dados) {

    let listaBingo = [];
    let listaExtra = [];

    // ============================================================
    // 🧠 INTELIGÊNCIA DE PRESERVAÇÃO
    // ============================================================
    
    // CASO 1: Chegou apenas um Array (Atualização do Bingo Automática)
    if (Array.isArray(dados)) {
        console.log("⚠️ Atualização Parcial: Apenas Cartelas Bingo");
        listaBingo = dados;
        
        // O PULO DO GATO: Se já tínhamos cupons na memória, MANTENHA-OS!
        if (globalMinhasCartelas && Array.isArray(globalMinhasCartelas.cupons_extra) && globalMinhasCartelas.cupons_extra.length > 0) {
            listaExtra = globalMinhasCartelas.cupons_extra;
            console.log(`♻️ Mantendo ${listaExtra.length} cupons da memória.`);
        }
    } 
    // CASO 2: Chegou o Objeto Completo (Clicou em 'Meus Jogos')
    else if (dados && typeof dados === 'object') {
        console.log("✨ Atualização Completa: Bingo + Extra");
        if (Array.isArray(dados.cartelas)) listaBingo = dados.cartelas;
        if (Array.isArray(dados.cupons_extra)) listaExtra = dados.cupons_extra;
    }

    // Atualiza a memória global com O QUE TIVER DE MAIS ATUAL
    globalMinhasCartelas = { cartelas: listaBingo, cupons_extra: listaExtra };

    console.log(`📊 Resumo Visual: ${listaBingo.length} Cartelas | ${listaExtra.length} Cupons Extra`);

    // ============================================================
    // RENDERIZAÇÃO
    // ============================================================
    const container = document.getElementById('my-cards-list');
    const totalEl = document.getElementById('my-cards-total');
    
    if (!container) return;
    
    container.innerHTML = ''; 

    // Verifica vazio
    if (listaBingo.length === 0 && listaExtra.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-gray-400">Nenhum jogo encontrado.</div>';
        if(totalEl) totalEl.textContent = "0";
        return;
    }

    let htmlFinal = '';

// 🅰️ RENDERIZA CUPONS DA SORTE EXTRA
    if (listaExtra.length > 0) {
        htmlFinal += `
        <div class="bg-gray-800 p-2 rounded border -mt-1 border-yellow-600/50">
            <h3 class="text-yellow-400 font-bold text-sm uppercase mb-2 flex items-center gap-2 border-b border-gray-700 pb-1">
                🍀 Sorte Extra <span class="bg-yellow-500 text-black text-xs px-2 rounded-full">${listaExtra.length}</span>
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-2">`;
        
        listaExtra.forEach((cupom, index) => {
            // --- Lógica Híbrida (ID Novo vs Array Antigo) ---
            let idExibicao = index + 1; 
            let listaNumeros = [];

            if (cupom && cupom.numeros && Array.isArray(cupom.numeros)) {
                idExibicao = cupom.id_cupom; // Usa o ID real do banco
                listaNumeros = cupom.numeros;
            } else if (Array.isArray(cupom)) {
                listaNumeros = cupom; // Compatibilidade legado
            }

            if (listaNumeros.length > 0) {
                const nums = listaNumeros.map(n => n.toString().padStart(2, '0')).join('<span class="text-yellow-600 ">-</span>');
                
                htmlFinal += `
                    <div class="bg-black/40 border border-yellow-500/30 rounded px-1 py-1 text-center shadow-md">
                        <div class="text-[9px] text-yellow-400 uppercase tracking-wider">Cupom: ${idExibicao}</div>
                        <div class="text-[12px] font-mono text-yellow-200 font-bold -mt-1 tracking-widest whitespace-nowrap">
                            ${nums}
                        </div>
                    </div>`;
            }
        });
        htmlFinal += `</div></div>`;
    }


    // 🅱️ RENDERIZA CARTELAS DO BINGO
    if (listaBingo.length > 0) {
        if (listaExtra.length > 0) htmlFinal += `<div class="mt-4 border-t border-gray-700 pt-2">`;
        else htmlFinal += `<div>`;

        htmlFinal += `<h3 class="text-blue-400 font-bold text-sm uppercase mb-1 px-1">🎱 Cartelas do Bingo (${listaBingo.length})</h3>`;

        let ranges = [];
        try {
            if (typeof converterListaParaRanges === 'function') {
                ranges = converterListaParaRanges(listaBingo);
            } else {
                ranges = [{inicial: listaBingo[0], final: listaBingo[listaBingo.length-1]}];
            }
        } catch (e) { ranges = []; }
        
        htmlFinal += `
        <div class="grid grid-cols-3 bg-gray-700 text-xs text-gray-300 px-2 rounded-t  border-b border-gray-700">
            <div class="text-center">N° Inicial</div>
            <div class="text-center">N° Final</div>
            <div class="text-center">Cartelas</div>
        </div>
        <div class="border border-gray-800 rounded-b overflow-hidden bg-gray-800/30">`;

        ranges.forEach(range => {
            const qtd = (range.final - range.inicial) + 1;
            htmlFinal += `
            <div class="grid grid-cols-3 border-b border-gray-700 hover:bg-white/5 py-1 text-sm text-gray-300">
                <div class="text-center text-[14px] font-bold text-gray-150">${range.inicial}</div>
                <div class="text-center text-[14px] font-bold text-gray-150">${range.final}</div>
                <div class="text-center flex items-center justify-center">
                    <span class="text-yellow-600 text-[14px] font-bold">${qtd}</span>
                </div>
            </div>`;
        });
        htmlFinal += `</div></div>`;
    }

    container.innerHTML = htmlFinal;
    if(totalEl) totalEl.textContent = listaBingo.length + listaExtra.length;
}



// 2. Gatilho para redesenhar ao abrir a aba/menu (VITAL PARA CORRIGIR O BUG DA TELA VAZIA)
document.addEventListener('click', function(e) {
    // Se clicou na aba de extrato, no botão de minhas cartelas ou qualquer botão de aba do modal
    if (e.target && (e.target.id === 'tab-extrato' || e.target.id === 'tab-compra' || e.target.id === 'btn-minhas-cartelas')) {
        setTimeout(() => renderizarListaMinhasCartelas(), 100);
    }
});


// --- FUNÇÃO OBRIGATÓRIA (Garanta que ela está no arquivo também) ---
// Função auxiliar corrigida para retornar OBJETOS {inicial, final}
function converterListaParaRanges(lista) {
    if (!lista || lista.length === 0) return [];
    
    // Garante que são números e ordena
    lista = lista.map(n => parseInt(n)).sort((a, b) => a - b);
    
    let ranges = [];
    let start = lista[0];
    let prev = start;
    
    for (let i = 1; i < lista.length; i++) {
        if (lista[i] !== prev + 1) {
            // Quebrou a sequência, fecha a faixa anterior
            ranges.push({ inicial: start, final: prev });
            start = lista[i];
        }
        prev = lista[i];
    }
    // Adiciona a última faixa
    ranges.push({ inicial: start, final: prev });
    return ranges;
}


function isMobileDevice() {
    return true; ////Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// MENU
function openSideMenu() {
    if (!menuOverlay) return;
    //if (typeof telaFull !== 'undefined' && !telaFull && typeof goFullscreen === 'function') goFullscreen();

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
        if (typeof telaFull !== 'undefined' && !telaFull && typeof goFullscreen === 'function') { 
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

        if (typeof telaFull !== 'undefined' && !telaFull && typeof goFullscreen === 'function') { 
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


// 15. ABRIR PAINEL DE MINHAS CARTELAS
async function openMyCardsPanel() {
    // Busca os IDs das variáveis globais ou da URL como segurança
    const urlParams = new URLSearchParams(window.location.search);
    const idEvt = eventoCarregadoAtual;
    const idCli =clienteLogadoId || urlParams.get('id_cliente') || localStorage.getItem('idCliente');

    if (!idEvt || !idCli || idCli === 'null' || idCli === 'undefined') {
        console.error("⚠️ Falha ao abrir cartelas: Dados ausentes", { idEvt, idCli });
        showCustomAlert("Aguardando identificação do evento/cliente.", "Aviso", "⏳");
        return;
    }

    // Caminho RELATIVO para funcionar no Docker e Online
    const urlApi = `/api/consultar_cartelas_evento?id_evento=${idEvt}&id_cliente=${idCli}`;

    try {
        const response = await fetch(urlApi);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ${response.status}: ${errorText}`);
        }
        const data = await response.json();
        // Salva e renderiza
        renderizarListaMinhasCartelas(data); 
        document.getElementById('my-cards-panel-container').classList.remove('hidden');
    } catch (error) {
        console.error("❌ Erro ao buscar cartelas:", error);
        showCustomAlert("Não foi possível carregar seus jogos agora.", "Erro", "❌");
    }
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



// 1. Função para Alternar (Entrar/Sair)
function toggleFullscreen() {
    if (!document.fullscreenElement &&    // Padrão
        !document.mozFullScreenElement && // Firefox
        !document.webkitFullscreenElement && // Chrome, Safari e Opera
        !document.msFullscreenElement) {  // IE/Edge
        
        // --- ENTRAR NA TELA CHEIA ---
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    } else {
        // --- SAIR DA TELA CHEIA ---
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

// 2. Função Visual (Atualiza o botão ON/OFF)
function updateFullscreenUI() {
    // Verifica se há algum elemento em fullscreen
    const isFull = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

    if (isFull) {
        // MODO ATIVO
        if(statusFullscreen) {
            statusFullscreen.textContent = "ON";
            statusFullscreen.classList.remove('text-gray-500');
            statusFullscreen.classList.add('text-green-500');
        }
        if(iconFullscreen) iconFullscreen.textContent = "↙️"; // Ícone de recolher
    } else {
        // MODO DESATIVADO
        if(statusFullscreen) {
            statusFullscreen.textContent = "OFF";
            statusFullscreen.classList.remove('text-green-500');
            statusFullscreen.classList.add('text-gray-500');
        }
        if(iconFullscreen) iconFullscreen.textContent = "⛶"; // Ícone de expandir
    }
}

// 3. Adiciona os Listeners
if (btnMenuFullscreen) {
    btnMenuFullscreen.addEventListener('click', (e) => {
        e.preventDefault(); // Evita scroll ou comportamentos estranhos
        toggleFullscreen();
    });
}

// Escuta mudanças no navegador (ex: se apertar F11 ou ESC) para atualizar o botão
document.addEventListener('fullscreenchange', updateFullscreenUI);
document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
document.addEventListener('mozfullscreenchange', updateFullscreenUI);
document.addEventListener('msfullscreenchange', updateFullscreenUI);

updateFullscreenUI();

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
        showCustomAlert("Erro: Esta faixa de cartelas se sobrepõe a uma faixa já adicionada.", "Supreposição", "🎟️");
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
            updateDigitalBola("--");  // xx
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
        headerElement.className = 'text-center text-sm text-yellow-500 font-bold mb-0 -mt-1 p-2'
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

//    corFundoTitulo
                   
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

    bolasProcessadasLocal.clear();
    ultimaBolaExibida = null;
    cartelasDoJogador = [];
    closeAvisoPanel(); // <--- Adicione 
    lastAvisoTimestamp = 0; // Reseta para permitir novos avisos iguais

    updateDigitalBola("--");  

    precoSerie.textContent = '';    
    cartelaRanges = [];
    newRanges = [];
    cachedRawCards = [];
    globalBolasCantadas = [];

    atualizarVisualizacaoAcumulado(
               premioInfo.premio_acumulado, 
               0,  
               globalBolasCantadas          
    );

    loadedCards = [];
    displayLoadedCards([]);
    isFetchingCards = false;

    const tipoSorteio = (typeof globalParametros !== 'undefined' && globalParametros.tipo_sorteio) 
                        ? globalParametros.tipo_sorteio 
                        : 'automatico'; // assume automático se não achar
 
    // Lógica: Se NÃO for manual, volta para a imagem padrão
    if (tipoSorteio !== 'manual') {
        const imgPainel = document.getElementById('img-premio-painel');
        const txtPainel = document.getElementById('texto-premio-painel');

        if (imgPainel) {
            // Caminho da sua imagem padrão (aquela que você definiu no HTML)
            imgPainel.src = "/img/premios/premio_padrao.webp";
        }

        if (txtPainel) {
            // Opcional: Limpa o texto ou coloca uma mensagem de espera
            txtPainel.innerText = ""; 
        }
    }
  
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

    // --- PASSO 4: DESENHO (Sua lógica original preservada) ---  xxx Erro no envio do pacote: name 'socketio' is not defined xxx
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
                         //togglePrizesButton.textContent = 'Ocultar Prêmios';
                         //togglePrizesButton.classList.remove('bg-gray-700');
                         //togglePrizesButton.classList.add('bg-red-800'); 
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
   donoDoModal = 'BINGO';
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
            if (donoDoModal === 'BINGO') {                          
                ocultarConferencia();
            } 
        }
    } else {
        if (donoDoModal === 'BINGO') {
            ocultarConferencia();
        }
    }
}


// --- FUNÇÃO PARA EXIBIR O GANHADOR DO SORTE EXTRA NA TV (COM DESTAQUE) ---
function exibirConferenciaSorteExtra(dados) {
    donoDoModal = 'CUPOM';
    const container = document.getElementById('conference-panel-container');
    const titleEl = container.querySelector('h2'); 
    const cardNumEl = document.getElementById('card-number');
    const winnerEl = document.getElementById('winner-name');
    const gridEl = document.getElementById('card-grid');
    
    // 1. Preenche os Textos
    titleEl.textContent = dados.premio_titulo || "🍀 CONFERÊNCIA EXTRA 🍀";
    titleEl.className = "text-center text-xl text-yellow-400 font-black uppercase tracking-widest border-b-2 border-yellow-500 pb-1 w-full animate-pulse";

    cardNumEl.textContent = dados.id || "---"; 
    winnerEl.textContent = dados.nick || "Visitante"; 

    // 2. Preenche os Números
    gridEl.innerHTML = '';
    
    // Layout Flex centralizado
    gridEl.className = 'flex flex-wrap justify-center items-center gap-3 w-full p-4 bg-gray-800/50 rounded-xl border border-yellow-600/30';

    // Recupera as bolas que já saíram no jogo (Garante que é um array)  
    const bolasDoJogo = (typeof globalBolasCantadas !== 'undefined' && Array.isArray(globalBolasCantadas)) 
        ? globalBolasCantadas 
        : [];

    if (dados.nums && Array.isArray(dados.nums)) {
        dados.nums.forEach(num => {
            const el = document.createElement('div');
            
            // Converte para inteiro para garantir a comparação (ex: "05" == 5)
            const numInt = parseInt(num);
            
            // Verifica se este número está na lista de bolas sorteadas do jogo
            const foiSorteada = bolasDoJogo.some(b => parseInt(b) === numInt);

            if (foiSorteada) {
                // ESTILO 1: BOLA SORTEADA (Amarelo Brilhante - DESTAQUE)
                el.className = "w-14 h-14 rounded-full bg-yellow-500 border-4 border-white text-black font-black text-2xl flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.6)] animate-pop transform scale-110";
            } else {
                // ESTILO 2: NÃO SORTEADA (Cinza Escuro / Apagada)
                el.className = "w-14 h-14 rounded-full bg-gray-700 border-2 border-gray-600 text-gray-500 font-bold text-2xl flex items-center justify-center opacity-60 grayscale";
            }

            el.innerText = num < 10 ? '0' + num : num;
            gridEl.appendChild(el);
        });
    }

    // 3. Exibe o Painel
    container.classList.remove('hidden');
    container.classList.add('flex');
}


// Função auxiliar para esconder e limpar (ATUALIZADA)
function ocultarConferencia() {
    const container = document.getElementById('conference-panel-container');
    
    // Pega o título para resetar o estilo (volta de Amarelo para Branco)
    const titleEl = container.querySelector('h2');

    container.classList.remove('flex');
    container.classList.add('hidden');
    donoDoModal = null;
    // Reseta os textos usando as variáveis globais
    if (cardNumberElement) cardNumberElement.textContent = '...';
    if (winnerNameElement) winnerNameElement.textContent = '...';
    
    // --- RESETA ESTILOS PARA O BINGO NORMAL ---
    if (titleEl) {
        titleEl.textContent = "🎉 Conferência 🎉";
        // Restaura a classe original do HTML (Branco, sem pulsação)
        titleEl.className = "text-center text-xl text-white uppercase tracking-widest border-b-2 border-yellow-500 pb-0 w-full";
    }
    
    // --- LIMPA O GRID ---
    if (cardGridElement) {
        cardGridElement.innerHTML = '';
        // Importante: Remove as classes Flex do Sorte Extra para não quebrar o Grid do Bingo Normal
        cardGridElement.className = ''; 
    }
    
    // Garante que a lógica interna também limpe
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
console.log("Grupo recebido:", grupo);
        // Container do Grupo (Prêmio)
        const groupDiv = document.createElement('div');
        groupDiv.className = 'bg-gray-800 rounded-lg p-1 border border-gray-700 mb-1';

        // Cabeçalho do Prêmio
        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex justify-between items-center border-b border-gray-600 pb-1 mb-1';

        headerDiv.innerHTML = `
            <span class="text-green-400 font-bold text-lg">${grupo.premio}</span>
            <span class="text-white font-bold bg-green-700 px-1 py-0.5 rounded text-sm">${grupo.valor_total_premio}</span>
        `;
        groupDiv.appendChild(headerDiv);

        // Lista de Ganhadores deste prêmio
        if (grupo.ganhadores && Array.isArray(grupo.ganhadores)) {
console.log("Ganhadores encontrados:", grupo.ganhadores);
            grupo.ganhadores.forEach(ganhador => {
console.log("Dados do ganhador individual:", ganhador);
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
        row.className = `grid ${gridClasses} text-[8px] leading-none text-white rounded hover:bg-gray-800`;
        // 1. Cartela
        const cartela = document.createElement('span');
        cartela.className = 'text-[9px] text-center font-bold text-yellow-500';
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
        
        let listaLimpa = [];

        if (Array.isArray(rawNums)) {
            listaLimpa = rawNums;
        } else if (typeof rawNums === 'string') {
            listaLimpa = rawNums.split(',').map(n => n.trim()).filter(n => n !== "");
        }

        // 2. CORTE RIGOROSO: Pega apenas os primeiros 24 números
        // O resto é ignorado completamente.
        const primeiros24 = listaLimpa.slice(0, 24);

        // 3. Formata e exibe
        const numerosFormatados = primeiros24.map(n => n.toString().padStart(2, '0')).join(' . ');
        
        // Se houver prêmio (winnerPremio), adiciona ao final
        numerosFaltantes.textContent = `${numerosFormatados} ${winnerPremio || ''}`;
        numerosFaltantes.className = 'text-[9px] text-green-400';  

        // 4. Nome (Player)
        const nome = document.createElement('span');
        if  (haGanhador) {
           nome.className = 'truncate text-[9px] text-yellow-300 font-bold';     
        } else {   
           nome.className = 'truncate  text-[10px]  text-yellow-400 font-semibold';
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
    if (numero >= 1 && numero <= 15) return 'bg-blue-600 border-4 border-blue-400';
    if (numero >= 16 && numero <= 30) return 'bg-red-600 border-4 border-red-400';
    if (numero >= 31 && numero <= 45) return 'bg-purple-600 border-4 border-purple-400';
    if (numero >= 46 && numero <= 60) return 'bg-green-600 border-4 border-green-400';
    if (numero >= 61 && numero <= 75) return 'bg-yellow-600 border-4 border-yellow-400';
    return 'bg-black border-4 border-green-700'; // Cor padrão
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

    // Calcula as cores baseadas no número (ou padrão se não for número)
    const corClasses = getBallColorClass(numeroBola);
    
    // Remove todas as cores antigas
    bolaDigitalElement.classList.remove(...allBgColors);
    bolaDigitalElement.classList.remove(...allBorderColors);   

    // --- LÓGICA DO TREVO 🍀 (AQUI ESTÁ A ALTERAÇÃO) ---
    // Tenta converter para inteiro para fazer a comparação matemática
    const valorNumerico = parseInt(numeroBola);

    // Se NÃO for um número (NaN) OU se o número for menor que 1
    if (isNaN(valorNumerico) || valorNumerico < 1) {
        bolaDigitalElement.textContent = "🍀";
    } else {
        bolaDigitalElement.textContent = numeroBola;
    }
    // ---------------------------------------------------

    // Adiciona as novas classes de cor
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


// --- VARIÁVEIS GLOBAIS NECESSÁRIAS (Coloque no topo do arquivo se não tiver) ---
// let bolasProcessadasLocal = new Set(); 
// let ultimaBolaExibida = null;
// -------------------------------------------------------------------------------

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
    
    if (rodadaData && rodadaData.length > 0) {
        const idVindoDoBanco = rodadaData[0].id_evento || rodadaData[0].rodada;
        
        if (idVindoDoBanco) {
            idRodada = parseInt(idVindoDoBanco);
            
            const elRoundMobile = document.getElementById('mobile-last-round');
            const elRoundPC = document.getElementById('last-round');
            if (elRoundMobile) elRoundMobile.textContent = idRodada;
            if (elRoundPC) elRoundPC.textContent = idRodada;
        }
    }

    // --- RESET DA MATRIZ QUANDO MUDA DE RODADA ---
    if (rodadaState === 'intervalo' && lastRodadaState !== 'intervalo') {
        clearPanels();
        lastRodadaState = rodadaState; 
        window.ultimoEventoProcessado = null;
        
        // NOVO: Limpa a memória local de bolas já cantadas
        if (typeof bolasProcessadasLocal !== 'undefined') bolasProcessadasLocal.clear();
        ultimaBolaExibida = null;
        
        // return; 
    } else if (rodadaState !== null) {
        lastRodadaState = rodadaState;
    }

    if (ganhadoresData && ganhadoresData.length > 0) {
        displayWinnersPanel(ganhadoresData);
    }

    const imgFinal = data.imagem_premio || cacheImagem || '';
    const txtFinal = data.premio_atual || cacheTexto || 'PRÊMIO DA RODADA';

    if (typeof atualizarImagemPremio === 'function') {
        atualizarImagemPremio(imgFinal, txtFinal);
    }
    
    // =========================================================================
    // >>> PROTEÇÃO ANTI-PISCA NAS BOLAS (CORREÇÃO DO "FALTAM 15") <<<
    // =========================================================================
    let bolasCantadasRaw = (bolasData && bolasData.length > 0) ? bolasData[0].bolas_cantadas : [];
    
    // Se veio vazio do servidor, mas nós já tínhamos bolas na memória...
    if (bolasCantadasRaw.length === 0 && globalBolasCantadas.length > 0) {
        // Verifica se NÃO é um Reset real
        if (buscando_o_premio && buscando_o_premio !== '...' && buscando_o_premio !== 'null') {
             bolasCantadasRaw = globalBolasCantadas; // Ignora o vazio e usa o cache
        }
    }
    
    const bolasCantadas = bolasCantadasRaw;
    globalBolasCantadas = bolasCantadas; // Atualiza a global

    const proximaBola = (bolasData && bolasData.length > 0 && bolasData[0].proxima_bola) ? bolasData[0].proxima_bola : "--";
    
    // --- LÓGICA DA MATRIZ (SET) AQUI ---
    // Pega a última bola da lista do servidor
    const ultimaBolaDaLista = bolasCantadas.length > 0 ? bolasCantadas[bolasCantadas.length - 1] : null;
    
    // Determina se a bola realmente mudou usando TRÊS critérios:
    // 1. É diferente da última registrada globalmente?
    // 2. Não é nula?
    // 3. (NOVO) Ainda não está na nossa matriz local de processados? (Proteção Extra)
    let bolaMudou = false;

    if (ultimaBolaDaLista !== null && ultimaBolaDaLista !== undefined) {
        // Verifica se já processamos essa bola nesta rodada
        const jaProcessada = (typeof bolasProcessadasLocal !== 'undefined') ? bolasProcessadasLocal.has(ultimaBolaDaLista) : false;

        if (ultimaBolaDaLista !== ultimaBolaCantada && !jaProcessada) {
            bolaMudou = true;
            // Adiciona na matriz para não processar de novo se o pacote repetir
            if (typeof bolasProcessadasLocal !== 'undefined') bolasProcessadasLocal.add(ultimaBolaDaLista);
        }
    }

    if (tipoDoSorteio !== 'manual') updateDigitalBola(proximaBola);

    // =========================================================================
    // >>> PROTEÇÃO ANTI-PISCA NOS DADOS DE PRÊMIO <<<
    // =========================================================================
    
    let dadosBuscando = {};
    let usarDadosFake = false;

    if (buscandoData && buscandoData.length > 0) {
        dadosBuscando = buscandoData[0];
    } else {
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
 
console.error("premioBuscadoDaAPI                   :",premioBuscadoDaAPI);
console.error( "buscando_o_premio                      :",buscando_o_premio.replace(/\s+/g, '').trim()); 

console.error("linhasAtivasDaAPI                           :", linhasAtivasDaAPI );
console.error("buscando_a_linha                           :",buscando_a_linha); 

    const premioMudou = (premioBuscadoDaAPI !== buscando_o_premio.replace(/\s+/g, '').trim() || linhasAtivasDaAPI !== buscando_a_linha);

    // --- AÇÃO QUANDO A BOLA MUDA ---
    if (premioMudou) {
        buscando_o_premio = premioBuscadoDaAPI;
        buscando_a_linha = linhasAtivasDaAPI;
        bolaBuscandoPremio = bolasCantadas.length;
    }

    if (bolaMudou) {
        falarTexto(`${ultimaBolaDaLista}`);
        ultimaBolaCantada = ultimaBolaDaLista;
        ultimaBolaExibida = ultimaBolaDaLista; // Atualiza controle visual
        setTimeout(() => {
             if (typeof cartelasDoJogador !== 'undefined' && cartelasDoJogador.length > 0) {
                 console.log("🎱 Bola nova detectada visualmente. Recalculando cartelas...");
                 forcarReprocessamentoVisual();
             }
        }, 50);
    }

    // --- REPROCESSAMENTO LOCAL ---
    if ((premioMudou || bolaMudou) && cachedRawCards.length > 0) {
        const premioNormalizado = premioBuscadoDaAPI.replace(/\s+/g, '').trim();
        processCards(cachedRawCards, bolasCantadas, premioNormalizado, linhasAtivasDaAPI);
    } 
    else if (cartelaRanges && cartelaRanges.length > 0 && cachedRawCards.length === 0 && !isFetchingCards) {
          fetchAndProcessCards();
    }
    
    globalPromocionalData = promocionalData;

    if (parametrosInfo && Object.keys(parametrosInfo).length > 0) {
        // ... (Mantive o código original aqui para baixo por brevidade, copie do seu original)
        // Certifique-se de copiar o resto da função original que lida com YouTube, 
        // Painel de Avisos, Promoção, Atualização Numérica, etc.
        const nome_da_sala = parametrosInfo.nome_sala; 
        if (nome_da_sala && salaTitleElement) salaTitleElement.textContent = nome_da_sala;
        
        const tipoCartelaConfig = parseInt(parametrosInfo.tipo_cartela || 15);
        MAX_BOLAS = (tipoCartelaConfig === 25) ? 75 : 90;
        tempoExibicaoGanhador = parseInt(parametrosInfo.tempo_ganhador);
        
        const tipoSorteio = parametrosInfo.modo_sorteio;
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

                const videoContainer = document.getElementById('video-container'); // Confirme se o ID é esse
                
                // Só clica se estiver FECHADO. Se já estiver aberto, apenas a atualização do .src acima já basta.
                if (videoContainer && videoContainer.classList.contains('hidden')) {
                     abrirYoutubeBtn.click();
                }
            }
        }         // --- FIM se Manual-

        if (abrirYoutubeBtn) {
             // if (typeof telaFull !== 'undefined' && !telaFull && typeof goFullscreen === 'function') goFullscreen();
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
        const limiteBola = (topeData && topeData.length > 0) ? topeData[0].bola_tope_ac : 0;
        atualizarVisualizacaoAcumulado(
                premioInfo.premio_acumulado, // Valor do prêmio (ex: 10000 ou "R$ 10.000,00")
                limiteBola,        // Limite de bolas (ex: 40)
                globalBolasCantadas             // Array das bolas que já saíram
        );
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

// =================================================================
// 🕵️‍♂️ DETETIVE DE ID (Versão Corrigida para Array)
// =================================================================

let idDoEvento = null;

// 1. DETETIVE DE ID (Evento)
if (initialData.rodadaData && Array.isArray(initialData.rodadaData) && initialData.rodadaData.length > 0) {
    idDoEvento = initialData.rodadaData[0].id_evento;
} else if (initialData.id_evento) {
    idDoEvento = initialData.id_evento;
} else if (initialData.premioInfo && initialData.premioInfo.id_evento) {
    idDoEvento = initialData.premioInfo.id_evento;
}

console.log("🔎 ID DETECTADO NO INIT:", idDoEvento);

if (idDoEvento) {
    // Atualiza o ID do Evento
    eventoCarregadoAtual = idDoEvento; 

    // ============================================================
    // 🛡️ PROTEÇÃO DE LOGIN (AQUI ESTÁ A CORREÇÃO)
    // ============================================================
    // Só atualizamos o globalIdCliente se o servidor mandou um ID válido.
    // Se o servidor mandou null, mas nós JÁ TEMOS um ID (do auto-login), MANTEMOS O NOSSO!
    
    if (initialData.id_cliente) {
        globalIdCliente = initialData.id_cliente; // Servidor confirmou login
    } else if (window.userId) {
        globalIdCliente = window.userId;          // Mantém o login local
    }
    
    // Se ambos forem null, aí sim o usuário é anônimo, mas não forçamos logout aqui.
    
    console.log(`💾 Estado Estável -> Evento: ${eventoCarregadoAtual}, Cliente: ${globalIdCliente}`);

    // Carrega botão
    carregarSorteExtra(false, idDoEvento);
    
} else {
    console.error("❌ init: ID do evento não encontrado.");
}

        if (typeof connectWebSocket === 'function') {
            connectWebSocket(); 
        } else {
            console.error("❌ Erro Crítico: Função connectWebSocket não encontrada!");
        }

        setInterval(() => {
            // Só verifica se o cliente estiver logado e o jogo já tiver começado (não estiver na animação de início)
            if (typeof clienteLogado !== 'undefined' && clienteLogado && !iniciandoRodada) {
                if (typeof verificarNovasCompras === 'function') {
                    verificarNovasCompras();
                }
            }
        }, 30000);

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

// yyy
async function sincronizarCupomViaArquivo() {
    try {
        // Busca o arquivo JSON via API normal (HTTPS - super estável)
        const response = await fetch('/api/get_cupom_atual');
        const cupom = await response.json();

        if (cupom) {
            console.log("📄 Cupom recuperado do arquivo do servidor.");
            exibirConferenciaSorteExtra(cupom);
        } else {
            if (donoDoModal === 'CUPOM') {
               ocultarConferencia();
            } 
        }
    } catch (err) {
        console.error("Erro ao ler arquivo de cupom:", err);
    }
}


function connectWebSocket() {
    // 1. LIMPEZA E RESET (Garante que não existam conexões fantasmas)
    if (ws) {
        console.log("♻️ Fechando conexão anterior para garantir um início limpo...");
        try {
            ws.onopen = null;
            ws.onmessage = null;
            ws.onclose = null;
            ws.onerror = null;
            ws.close();
        } catch (e) {
            console.error("Erro ao limpar WS antigo:", e);
        }
    }

    // 2. MONTAGEM DA URL
    //xxx const wsUrlWithRoom = `${WS_URL}${WS_URL.includes('?') ? '&' : '?'}idsala=${currentSalaId}`;
    const wsUrlWithRoom = `${WS_URL}?idsala=${currentSalaId}`;
    console.log("🔌 [FRONT] Conectando ao Servidor Independente:", wsUrlWithRoom);

    // 3. INICIALIZAÇÃO
    ws = new WebSocket(wsUrlWithRoom);

    ws.onopen = async () => {
        console.log("✅ [FRONT] WebSocket Conectado com Sucesso!");

        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
        
        //xxx try { requestWakeLock(); } catch(e) { console.warn("WakeLock não suportado."); }
        try { if(navigator.wakeLock) navigator.wakeLock.request('screen'); } catch(e){}

        // --- SINCRONIZAÇÃO DUPLA (BINGO + ARQUIVO DO CUPOM) ---

        // A. Solicita estado do Bingo (via WebSocket)
        ws.send(JSON.stringify({ action: "GET_INITIAL_STATE" }));
        console.log("📤 Solicitando estado inicial do Bingo.");

        // B. Busca Cupom Ativo (via Arquivo/API - Segurança máxima para celular)
        // Isso resolve o problema de não aparecer no celular ao conectar/reconectar
        if (typeof sincronizarCupomViaArquivo === 'function') {
            sincronizarCupomViaArquivo(); 
        }
        //xxx setTimeout(processarParametrosURL, 500); 
    };

    ws.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            
            // --- TRATAMENTO DE ATUALIZAÇÃO DE RODADA ---
            if (payload.type === 'UPDATE') {
                const melhoresData = payload.melhoresData;
                let idSocket = null;
                if (payload.rodadaData && payload.rodadaData.length > 0) {
                    idSocket = payload.rodadaData[0].id_evento;
                }
                if (!idSocket) {
                    const params = payload.parametros || payload.parametrosInfo || {};
                    idSocket = payload.id_evento || params.id_evento;
                }
                if (idSocket) { buscarImagemDoPremio(idSocket); }

                renderMainContent(payload); 
                
                if (melhoresData) { renderMelhores(melhoresData); }              
                verificarNovasCompras();
            }
            
            // --- TRATAMENTO DE SORTEIO EXTRA / CUPOM (PUSH) ---
            else if (payload.type === 'EXIBIR_CUPOM') {
                console.log("📨 Comando de exibição de cupom recebido via Socket.");
                if (typeof tratarExibicaoCupom === 'function') {
                    tratarExibicaoCupom(payload.cupom);
                } 
            }

        } catch (e) {
            console.error('❌ [FRONT] Erro crítico no processamento da mensagem:', e);
        }
    };

    ws.onclose = (event) => {
        console.warn(`⚠️ [FRONT] Conexão Perdida (Código: ${event.code}). Tentando Reconectar...`);
        try { releaseWakeLock(); } catch(e){}
        
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                console.log("🔄 Tentativa de reconexão automática...");
                connectWebSocket();
            }, 3000);
        }
    };

    ws.onerror = (error) => {
        console.error('❌ [FRONT] Erro técnico detectado no WebSocket.');
        if (ws) ws.close();
    };
}

// ======================================================
// FUNÇÕES DE APOIO PARA O CUPOM EM ARQUIVO
// ======================================================

async function sincronizarCupomViaArquivo() {
    try {
        console.log("📂 Buscando estado do cupom no servidor...");
        // API_BASE_URL deve estar vazio ou apontar para a raiz da Digital Ocean
        const resp = await fetch(`${API_BASE_URL}/api/get_cupom_atual?t=${Date.now()}`); 
        const cupom = await resp.json();
        
        console.log("📄 Resultado da busca por arquivo:", cupom);
        tratarExibicaoCupom(cupom);
    } catch (err) {
        console.error("❌ Erro ao sincronizar cupom via arquivo:", err);
    }
}

function tratarExibicaoCupom(dadosCupom) {
    if (dadosCupom && Object.keys(dadosCupom).length > 0) {
        // Se a função abaixo existir, ela será chamada com os dados do arquivo ou socket
        if (typeof exibirConferenciaSorteExtra === "function") {
            exibirConferenciaSorteExtra(dadosCupom);
        } else {
            console.error("A função exibirConferenciaSorteExtra não foi encontrada!");
        }
    } else {
        if (typeof ocultarConferencia === "function") {
            if (donoDoModal === 'CUPOM') {                          
                ocultarConferencia();
            }
        }
    }
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

    // --- LÓGICA BLINDADA DO BOTÃO DE COMPRA MOBILE ---
    const btnCompraMobile = document.getElementById('btn-comprar-cartelas-mobile');
    
    if (btnCompraMobile) {
        // Transformamos a função em ASYNC para poder esperar o servidor responder
        btnCompraMobile.onclick = async function(e) {
            e.preventDefault(); 
            
            // 1. Pega o ID do evento que está carregado na tela agora
            // (Se for nulo ou 0, assume que não tem evento carregado)
            const idParaChecar = (typeof eventoCarregadoAtual !== 'undefined') ? eventoCarregadoAtual : 0;

            console.log(`🔘 Verificando status do evento ID: ${idParaChecar}...`);

            if (!idParaChecar) {
                // Se não tem ID, abre a agenda direto
                openEventsPanel();
                return;
            }

            // 2. Feedback visual rápido (opcional, muda o cursor ou opacidade)
            btnCompraMobile.style.opacity = "0.7";
            btnCompraMobile.textContent = "⏳ ...";

            try {
                // 3. Pergunta ao servidor o status ATUAL
                const response = await fetch(`${API_BASE_URL}/api/verificar_status_evento?id_evento=${idParaChecar}`);
                const data = await response.json();
                
                const statusReal = (data.status || '').toLowerCase().trim();
                console.log(`📡 Resposta do servidor: O evento ${idParaChecar} está '${statusReal}'`);

                // 4. TOMADA DE DECISÃO
                if (statusReal === 'ativo') {
                    // Se está valendo -> Tela de Compra
                    iniciarCompraCartelas(idParaChecar);
                } else {
                    // Se finalizou, agendado ou erro -> Agenda
                    // (Você pode até mostrar um alerta se quiser: "Este evento já encerrou!")
                    openEventsPanel();
                }

            } catch (err) {
                console.error("Erro ao checar status:", err);
                // Em caso de erro de rede, por segurança abre a Agenda
                openEventsPanel();
            } finally {
                // 5. Restaura o botão
                btnCompraMobile.style.opacity = "1";
                btnCompraMobile.textContent = "🛒 Comprar"; // Ou o ícone que estava antes
            }
        };
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

        // if (typeof telaFull !== 'undefined' && !telaFull && typeof goFullscreen === 'function') goFullscreen();

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
            if (typeof closeSideMenu === 'function') {
                closeSideMenu();
            }
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
                abrirYoutubeBtn.textContent = '❌ Fechar YouTube';
                // Define src para tocar
                youtubeIframe.src = videoUrl;
                // if (typeof telaFull !== 'undefined' && !telaFull && typeof goFullscreen === 'function') goFullscreen();
            } else {
                abrirYoutubeBtn.textContent = '📺 Abrir   YouTube';
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

   connectWebSocket();
    
    // 2. Polling de Segurança (Backup a cada 5s para garantir que o cupom apareça)
    setInterval(() => {
        // Só executa se a função existir (evita erros)
        if (typeof sincronizarCupomViaArquivo === 'function') {
            sincronizarCupomViaArquivo();
        }
    }, 5000);

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

function atualizarVisualizacaoAcumulado(valorAcumulado, bolaTope, bolasCantadas) {
    const container = document.getElementById('quadro-premio-acumulado');
    const valorSpan = document.getElementById('premio-acumulado');

    // Proteção se os elementos não existirem
    if (!container || !valorSpan) return;

    // 1. Verifica se existe valor acumulado (maior que zero)
    // Convertemos para número caso venha como string monetária
    let valorNumerico = 0;
    if (typeof valorAcumulado === 'string') {
        // Remove R$, pontos e troca vírgula por ponto para verificar
        valorNumerico = parseFloat(valorAcumulado.replace(/[^0-9,-]+/g,"").replace(",","."));
    } else {
        valorNumerico = valorAcumulado;
    }

    // Se for zero ou menor, esconde tudo e sai da função
    if (!valorNumerico || valorNumerico <= 0) {
        container.classList.add('hidden');
        return;
    }

    // Se chegou aqui, mostra o container e atualiza o texto
    container.classList.remove('hidden');
    valorSpan.textContent = typeof valorAcumulado === 'number' 
        ? `R$ ${valorAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
        : valorAcumulado;

    // 2. Verifica a regra do Tope (Bola Limite)
    const quantidadeBolas = bolasCantadas.length; // Ou usar globalBolasCantadas.length

    if (quantidadeBolas <= bolaTope) {
        // --- ESTILO ATIVO (VÁLIDO) ---
        // Aplica o estilo amarelo com borda
        container.className = "text-[10px] font-bold text-yellow-300 border-2 border-yellow-700 rounded-lg px-3";
    } else {
        // --- ESTILO INATIVO (ULTRAPASSADO) ---
        // Aplica o estilo cinza sem borda
        container.className = "text-[10px] font-semibold text-gray-500 border-0 px-0";
    }
}

// --- LÓGICA DE CLIENTE / AUTOATENDIMENTO ---

let clienteLogado = false;

// CORREÇÃO: Adicionei (idEventoEspecifico = null) nos parênteses
function abrirMenuCliente(idEventoEspecifico = null) {
    // Verifica se os modais existem no HTML antes de tentar abrir
    if (typeof telaFull !== 'undefined' && !telaFull && typeof goFullscreen === 'function') goFullscreen();
    const modalLogin = document.getElementById('modal-login');
    const modalCarteira = document.getElementById('modal-carteira');

    if (!modalLogin || !modalCarteira) {
        alert("Erro: Modais não encontrados. Verifique o HTML.");
        return;
    }

    if (!clienteLogado) {
        modalLogin.classList.remove('hidden');
        if(idEventoEspecifico) window.eventoPendenteLogin = idEventoEspecifico;

    } else {
        atualizarDadosCliente(); 

        const lblEvento = document.getElementById('lbl-evento-compra');
        
        // LÓGICA CORRETA DE SELEÇÃO:
        if (idEventoEspecifico) {
            eventoSelecionadoParaCompra = idEventoEspecifico;
            if (lblEvento) {
                lblEvento.textContent = `EVENTO ID: ${idEventoEspecifico}`;
                lblEvento.className = "text-sm font-black text-red-600 uppercase blink-anim"; // Destaque em vermelho
            }
        } else {
            // Se veio do botão genérico "Minha Carteira", usa a rodada atual
            eventoSelecionadoParaCompra = idRodada; 
            if (lblEvento) {
                lblEvento.textContent = "RODADA ATUAL (AO VIVO)";
                lblEvento.className = "text-sm font-bold text-blue-700 uppercase"; // Destaque em verde
            }
        }
        
        console.log("Evento definido para compra:", eventoSelecionadoParaCompra);
        modalCarteira.classList.remove('hidden');
    }
}

// =========================================================================
// FUNÇÕES AUXILIARES DE MODAL (Adicione ao final do arquivo)
// =========================================================================

// Caso você tenha revertido o HTML, verifique se esta função ainda é necessária
function toggleVisualizarSenha(inputId, btnElement) {
    const input = document.getElementById(inputId);
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        // Ícone Olho Fechado/Riscado
        btnElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-green-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>`;
    } else {
        input.type = "password";
        // Ícone Olho Aberto
        btnElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>`;
    }
}

function autocadastro() {
    // Fecha o modal de login se estiver aberto
    fecharModal('modal-login');
    
    // Abre o modal de cadastro
    const modal = document.getElementById('modal-cadastro');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

// --- FUNÇÃO 2: Máscara de Celular (Visual) ---
function mascaraCelular(input) {
    let v = input.value.replace(/\D/g, ""); // Remove tudo que não é dígito
    v = v.replace(/^(\d\d)(\d)/g, "($1) $2"); // Coloca parênteses no DDD
    v = v.replace(/(\d{5})(\d)/, "$1-$2"); // Coloca hífen
    input.value = v.substring(0, 15); // Limita tamanho
}


// Variável de controle para impedir o cadastro se o nick já existir
let nickDisponivel = false;

// --- FUNÇÃO: Verifica se o usuário já existe (Chamada no onblur) ---
async function verificarUsuarioExistente(usuario) {
    const msgElement = document.getElementById('msg-nick-erro');
    const inputElement = document.getElementById('cad-usuario');
    
    if (!usuario || usuario.length < 3) {
        nickDisponivel = false;
        return; 
    }

    usuario = usuario.trim().toLowerCase();

    try {
        // Chama o backend para checar apenas o nick
        const response = await fetch(`${API_BASE_URL}/api/checar_nick_disponivel?nick=${usuario}`);
        const data = await response.json();

        if (data.disponivel === false) {
            // Se NÃO estiver disponível
            nickDisponivel = false;
            
            // --- AQUI ESTÁ A CORREÇÃO ---
            // Usa a mensagem que veio do Python (data.erro) em vez de texto fixo
            const mensagemErro = data.erro || "Usuário indisponível.";
            
            msgElement.textContent = "❌ " + mensagemErro;
            msgElement.className = "text-[11px] mt-1 text-red-400 font-bold block";
            
            inputElement.classList.add('border-red-500');
            inputElement.classList.remove('border-green-500');
        } else {
            // Se estiver livre
            nickDisponivel = true;
            msgElement.textContent = "✅ Usuário disponível!";
            msgElement.className = "text-[11px] mt-1 text-green-400 font-bold block";
            inputElement.classList.remove('border-red-500');
            inputElement.classList.add('border-green-500');
        }

    } catch (e) {
        console.warn("Não foi possível verificar o nick agora.", e);
        // Em caso de erro de rede, permitimos tentar enviar, o backend barrará depois
        nickDisponivel = true; 
    }
}


// --- FUNÇÃO: Salvar Novo Usuário (Atualizada) ---
async function salvarNovoUsuario() {
    // 1. Coleta os dados
    const nome = document.getElementById('cad-nome').value.trim();
    // Sobrenome removido
    const celular = document.getElementById('cad-celular').value.trim();
    const cidade = document.getElementById('cad-cidade').value.trim();
    const pix = document.getElementById('cad-pix').value.trim();
    const pixConfirma = document.getElementById('cad-pix-confirma').value.trim();
    const usuario = document.getElementById('cad-usuario').value.trim().toLowerCase();
    const senha = document.getElementById('cad-senha').value;
    const confirma = document.getElementById('cad-confirma').value;

    // 2. Validações
    if (!nome || !celular || !usuario || !senha || !pix  || !cidade) {
        showCustomAlert("Por favor, preencha todos os campos, incluindo a Chave Pix.", "Dados Incompletos", "⚠️");
        return;
    }

    // Validação do Nick (Feita no onblur, mas reforçada aqui)
    if (nickDisponivel === false && usuario.length > 0) {
        // Tenta verificar uma última vez caso o usuário tenha digitado rápido e clicado no botão
        await verificarUsuarioExistente(usuario);
        if (nickDisponivel === false) {
           // Em vez de uma frase fixa, pegamos o texto que o Python mandou e que já está na tela
            const elErro = document.getElementById('msg-nick-erro');
            
            // Pega o texto do erro (ex: "❌ Escolha um apelido respeitoso.")
            // O .replace remove o "❌ " inicial para não ficar estranho no alerta
            let textoErroReal = elErro ? elErro.textContent.replace('❌ ', '') : "O usuário escolhido não é válido.";
            
            // Mostra o alerta com o motivo real (Ofensa, Reservado ou Duplicado)
            showCustomAlert(textoErroReal, "Atenção", "⛔");
            
            document.getElementById('cad-usuario').focus();
            return;  
      }
    }

    // Validação Pix
    if (pix !== pixConfirma) {
        showCustomAlert("A confirmação da Chave Pix não confere.", "Erro no Pix", "❌");
        return;
    }

    // Validação Senha
    if (senha !== confirma) {
        showCustomAlert("As senhas não coincidem.", "Erro de Senha", "❌");
        return;
    }

    if (senha.length < 4) {
        showCustomAlert("A senha deve ter pelo menos 4 caracteres.", "Senha Fraca", "⚠️");
        return;
    }

    if (senha.toLowerCase() === "senha") {
        showCustomAlert("⚠️ Você não pode usar a senha padrão 'Senha'. Por favor, crie uma senha pessoal e segura.", "Senha Inválida", "🚫");
        return;
    }

    // 3. Envio
    showFullLoading("Criando sua conta...");

    try {
        const response = await fetch(`${API_BASE_URL}/api/cadastrar_cliente`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome: nome,
                celular: celular,
                pix: pix,        // Enviando Pix
                cidade: cidade,
                usuario: usuario,
                senha: senha
            })
        });

        const data = await response.json();

        if (response.ok && data.status === 'ok') {
            fecharModal('modal-cadastro');
            showCustomAlert("Cadastro realizado! Use seu usuário e senha para entrar.", "Bem-vindo!", "🎉");
            
            const campoUser = document.getElementById('login-user');
            if(campoUser) campoUser.value = usuario;
            
            setTimeout(() => abrirModalLogin(), 1500);
            
        } else {
            showCustomAlert(data.erro || "Erro ao criar cadastro.", "Erro", "❌");
        }

    } catch (error) {
        console.error(error);
        showCustomAlert("Erro de conexão com o servidor.", "Falha", "❌");
    } finally {
        hideFullLoading();
    }
}


// Função auxiliar para verificar se o usuário está logado
function isUsuarioLogado() {
    // Se o ID tiver algum valor, retorna VERDADEIRO
    if (globalIdCliente !== null && globalIdCliente !== undefined && globalIdCliente !== '') {
        return true;
    }
    return false;
}


// ABRIR CARTEIRA (CHAMA ATUALIZAÇÃO DO EXTRATO)
function abrirModalCarteira() {
   closeSideMenu(); // Fecha o menu lateral se estiver aberto

    if (!isUsuarioLogado()) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert("Faça login para ver seu extrato.", "Acesso Restrito", "🔒");
        }
        abrirModalLogin();
        return;
    }

    // Fecha outros modais que possam atrapalhar
    if (typeof fecharModal === 'function') fecharModal('modal-comprar-cartelas');

    const modalCarteira = document.getElementById('modal-carteira');
    if (modalCarteira) {
        modalCarteira.classList.remove('hidden');
        modalCarteira.classList.add('flex');
        
        // 1. Atualiza o saldo visual imediatamente (usando o que já temos na memória)
        const elSaldo = document.getElementById('carteira-saldo-atual');
        if (elSaldo) {
            elSaldo.textContent = `R$ ${globalUserSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }
        
        // 2. CHAMA O SERVIDOR PARA BUSCAR O EXTRATO ATUALIZADO
        atualizarDadosCliente(); 
        
        // Reseta aba
        if (typeof mudarAbaCarteira === 'function') {
            mudarAbaCarteira('saque');
        }
    }
}


// --- FUNÇÃO 2: Gerenciar Abas (Saque vs Extrato) ---
function mudarAbaCarteira(aba) {
    const tabSaque = document.getElementById('tab-saque');
    const tabExtrato = document.getElementById('tab-extrato');
    const contSaque = document.getElementById('conteudo-saque');
    const contExtrato = document.getElementById('conteudo-extrato');

    if (aba === 'saque') {
        // Ativa Saque
        contSaque.classList.remove('hidden');
        contExtrato.classList.add('hidden');
        
        tabSaque.classList.add('text-white', 'border-green-500', 'bg-gray-700/50');
        tabSaque.classList.remove('text-gray-400', 'border-transparent');
        
        tabExtrato.classList.remove('text-white', 'border-green-500', 'bg-gray-700/50');
        tabExtrato.classList.add('text-gray-400', 'border-transparent');
    } else {
        // Ativa Extrato
        contSaque.classList.add('hidden');
        contExtrato.classList.remove('hidden');
        
        tabExtrato.classList.add('text-white', 'border-green-500', 'bg-gray-700/50');
        tabExtrato.classList.remove('text-gray-400', 'border-transparent');
        
        tabSaque.classList.remove('text-white', 'border-green-500', 'bg-gray-700/50');
        tabSaque.classList.add('text-gray-400', 'border-transparent');
        
        // Chama a função existente de carregar extrato (se você já tiver ela pronta)
        if (typeof carregarExtrato === 'function') {
            carregarExtrato(); // <--- Verifique se o nome da sua função antiga é esse
        }
    }
}

// --- FUNÇÃO 3: Usar Saldo Total ---
function usarSaldoTotal() {
    // Pega o texto do saldo (ex: "R$ 1.500,00")
    const textoSaldo = document.getElementById('carteira-saldo-atual').textContent;
    
    // Limpa "R$", pontos e troca vírgula por ponto para o input entender
    // Ex: "R$ 1.500,50" -> 1500.50
    let valorLimpo = textoSaldo.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
    
    const input = document.getElementById('valor-saque');
    input.value = valorLimpo;
}


// --- FUNÇÃO 4: Enviar Pedido ao Servidor (Corrigida) ---
async function confirmarSaque() {
    // Verifica IDs (confira se no seu HTML é 'valor-saque' ou 'saque-valor')
    const inputValor = document.getElementById('valor-saque') || document.getElementById('saque-valor');
    const inputPix = document.getElementById('chave-pix'); // Se tiver campo de PIX
    
    if (!inputValor) {
        console.error("Campo de valor do saque não encontrado!");
        return;
    }

    // Converte vírgula para ponto (ex: 50,00 -> 50.00)
    let valorStr = inputValor.value.replace(',', '.');
    const valor = parseFloat(valorStr);

    if (isNaN(valor) || valor <= 0) {
        showCustomAlert("Digite um valor válido para saque.", "Atenção", "⚠️");
        return;
    }

    showFullLoading("Processando solicitação...");

    try {
        const response = await fetch(`${API_BASE_URL}/api/solicitar_saque`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // <--- ESSENCIAL: Envia o login junto
            body: JSON.stringify({ 
                valor: valor,
                chave_pix: inputPix ? inputPix.value : '' // Envia PIX se existir campo
            })
        });

        const data = await response.json();

        if (response.ok && data.status === 'ok') {
            // Sucesso
            showCustomAlert("Sua solicitação foi enviada para análise!", "Sucesso", "✅");
            inputValor.value = ""; // Limpa campo
            
            // Fecha modal (use o ID correto da sua carteira)
            if (typeof fecharModal === 'function') fecharModal('modal-carteira');

            // Atualiza extrato se possível
            if (typeof atualizarDadosCliente === 'function') atualizarDadosCliente();
            
        } else {
            // Erro do backend
            showCustomAlert(data.erro || "Erro ao solicitar saque.", "Erro", "❌");
        }

    } catch (e) {
        console.error(e);
        showCustomAlert("Erro de conexão com o servidor.", "Falha", "❌");
    } finally {
        hideFullLoading();
    }
}


function selecionarQtd(n) {
    const input = document.getElementById('qtd-manual'); // Seu código usava 'input-qtd'
    if (input) {
        input.value = n;
        // Chama o calculo visual se existir, se não, segue a vida
        if (typeof calcularTotalCompra === 'function') calcularTotalCompra();
    }
}

// Calculo visual do total (Auxiliar)
function calcularTotalCompra() {
    const input = document.getElementById('qtd-manual');
    const display = document.getElementById('total-compra-display');
    if (input && display) {
        const total = (parseInt(input.value) || 0) * globalPrecoCartela;
        display.textContent = `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }
}

// CONFIRMAR COMPRA (COM RECARREGAMENTO FORÇADO)
async function confirmarCompra() {
    let idEventoFinal = 0;
    
    // 1. Descobre o ID do evento alvo da compra
    if (typeof obterIdEventoAlvo === 'function') {
        idEventoFinal = obterIdEventoAlvo();
    } else {
        const elLastRound = document.getElementById('mobile-last-round');
        idEventoFinal = parseInt(elLastRound?.textContent) || 0;
    }

    const inputQtd = document.getElementById('qtd-manual');
    const qtd = inputQtd ? parseInt(inputQtd.value) : 0;

    if (qtd <= 0) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Selecione a quantidade.", "Atenção", "⚠️");
        else alert("Selecione a quantidade.");
        return;
    }

    // Função auxiliar para converter "R$ 1.200,50" em 1200.50
    function lerDinheiro(idElemento) {
        const el = document.getElementById(idElemento);
        if (!el) return 0.0;
        
        let texto = el.value || el.textContent || "0";
        texto = texto.toString()
                      .replace('R$', '')
                      .replace(/\s/g, '')     
                      .replace(/\./g, '')     
                      .replace(',', '.');     
        
        return parseFloat(texto) || 0.0;
    }

    // Validação de Saldo (Client-side)
    const valorTotalReais = lerDinheiro('total-compra-display');
    const saldoAtualReais = lerDinheiro('saldo-modal-compra');

    if (valorTotalReais > saldoAtualReais) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert("Seu saldo é insuficiente para esta compra. Faça uma recarga!", "Saldo Insuficiente", "🚫");
        } 
        return; 
    }

    if (typeof showFullLoading === 'function') showFullLoading("Processando compra...");

    try {
        const res = await fetch(`${API_BASE_URL}/api/comprar_cartelas`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({
                quantidade: qtd, 
                id_evento: idEventoFinal 
            })
        });
        
        const data = await res.json();

        if (res.ok) {
            // SUCESSO
            if (typeof showCustomAlert === 'function') showCustomAlert(`Sucesso! ${data.msg}`, "Compra Confirmada", "✅");
            else alert(data.msg);
            
            // Atualiza Saldo e Extrato (sempre deve acontecer)
            if (typeof atualizarDadosCliente === 'function') await atualizarDadosCliente(); 
            
            // --- AQUI ESTÁ A CORREÇÃO (O FILTRO INTELIGENTE) ---
            
            // Verificamos: O evento que acabei de comprar (idEventoFinal) 
            // é o mesmo que está rolando na tela (currentEventID)?
            
            // Pega o ID global do evento ativo (se existir)
            const idEventoNaTela = (typeof currentEventID !== 'undefined') ? currentEventID : null;

            // Compara como STRING para evitar erros (ex: "17" vs 17)
            if (idEventoNaTela && String(idEventoFinal) === String(idEventoNaTela)) {
                
                console.log(`🔄 Compra no evento ATUAL (${idEventoFinal}). Atualizando mesa...`);

                // Só limpa a memória se for realmente recarregar
                if (typeof eventoCarregadoAtual !== 'undefined') {
                    eventoCarregadoAtual = null; 
                }

                // Delay técnico para o banco processar
                await new Promise(r => setTimeout(r, 500));

                // Recarrega as cartelas na mesa
                if (typeof carregarCartelasAutomaticas === 'function') {
                    await carregarCartelasAutomaticas(idEventoFinal);
                } 

            } else {
                // Se for diferente, NÃO FAZ NADA na mesa.
                console.log(`📅 Compra Agendada (Evento ${idEventoFinal}). Mesa mantida no Evento ${idEventoNaTela}.`);
            }

            // --- FIM DA CORREÇÃO ---

            // Fecha modal e limpa inputs
            if (typeof fecharModal === 'function') fecharModal('modal-comprar-cartelas');
            if (inputQtd) inputQtd.value = '';

        } else {
            // ERRO DO SERVIDOR
            if (typeof showCustomAlert === 'function') showCustomAlert(data.erro || "Erro desconhecido.", "Erro", "❌");
            else alert(data.erro);
        }

    } catch (e) {
        console.error(e);
        if (typeof showCustomAlert === 'function') showCustomAlert("Erro de comunicação.", "Falha", "🌐");
    } finally {
        if (typeof hideFullLoading === 'function') hideFullLoading();
    }
}


// BUSCAR DADOS DO CLIENTE (SALDO E EXTRATO)
async function atualizarDadosCliente() {
    // Só roda se tiver algum indício de login
    if (typeof isUsuarioLogado === 'function' && !isUsuarioLogado()) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/dados_cliente`, { 
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include' 
        });

        if (!response.ok) return;

        const data = await response.json();

        // 1. ATUALIZA SALDO GLOBAL E NA TELA
        globalUserSaldo = parseFloat(data.saldo || 0);
        
        // Atualiza todos os lugares que mostram saldo
        const elementosSaldo = [
            'sidebar-user-balance', 
            'mobile-user-balance', 
            'carteira-saldo-atual', 
            'saldo-modal-compra'
        ];
        
        const saldoFormatado = `R$ ${globalUserSaldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
        
        elementosSaldo.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = saldoFormatado;
        });

        // 2. ATUALIZA O EXTRATO (AQUI ESTÁ A CORREÇÃO)
        // Tenta achar a lista (<ul>). Se não achar, tenta achar o container e criar a lista.
        let listaContainer = document.getElementById('lista-transacoes');
        
        if (!listaContainer) {
            const wrapper = document.getElementById('tabela-extrato-container');
            if (wrapper) {
                // Se achou o container vazio, cria a lista dentro dele
                wrapper.innerHTML = '<ul id="lista-transacoes" class="space-y-2 max-h-85 overflow-y-auto"></ul>';
                listaContainer = document.getElementById('lista-transacoes');
            }
        }

        // Se achou onde desenhar, desenha!
        if (listaContainer && data.extrato) {
            listaContainer.innerHTML = ''; // Limpa lista antiga

            if (data.extrato.length === 0) {
                listaContainer.innerHTML = `
                    <li class="text-center text-gray-500 py-4 italic flex flex-col items-center">
                        <span class="text-2xl mb-1">📭</span>
                        <span>Nenhuma movimentação.</span>
                    </li>`;
            } else {
                data.extrato.forEach(item => {
                    // Define se é Entrada (Verde) ou Saída (Vermelho)
                    // Tipos comuns: 'compra' (saída), 'saque' (saída), 'ganho' (entrada), 'deposito' (entrada)
                    const isSaida = ['compra', 'saque'].includes(item.tipo);
                    
                    const corValor = isSaida ? "text-red-400" : "text-green-400";
                    const sinal = isSaida ? "- " : "+ ";
                    
                    // Ícones bonitinhos
                    let icone = '💰';
                    if (item.tipo === 'compra') icone = '🛒';
                    if (item.tipo === 'ganho') icone = '🏆';
                    if (item.tipo === 'saque') icone = '💸';

                    // Converte valor para float seguro
                    let valorItem = parseFloat(item.valor);
                    if (isNaN(valorItem)) valorItem = 0;

                    // Cria o HTML do item
                    const li = `
                        <li class="flex justify-between items-center bg-gray-800 p-0 rounded-lg border border-gray-700 shadow-sm hover:bg-gray-750 transition-colors">
                            <div class="flex items-center gap-3">
                                <span class="text-xl bg-gray-900 p-1.5 rounded-full">${icone}</span>
                                <div class="flex flex-col text-left">
                                    <span class="font-bold text-gray-200 text-xs sm:text-sm uppercase tracking-wide">
                                        ${item.desc || item.descricao || "Movimentação"}
                                    </span>
                                    <span class="text-[12px] text-yellow-500 font-mono">
                                        ${item.data || ""}
                                    </span>
                                </div>
                            </div>
                            <span class="font-bold text-lg ${corValor} whitespace-nowrap">
                                ${sinal}R$ ${valorItem.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                            </span>
                        </li>
                    `;
                    listaContainer.innerHTML += li;
                });
            }
        }

    } catch (error) {
        console.error("Erro ao atualizar extrato:", error);
    }
}


async function fazerLogout() {
    const confirmou = await showCustomConfirm("Tem certeza que deseja sair da conta?", "Sair do Sistema", "🚪");
    if(!confirmou) return;

    try {
        // Avisa o servidor para matar a sessão
        await fetch('/api/logout', {method: 'POST'});
    } catch (e) {
        console.log("Erro ao avisar logout, saindo localmente...");
    }

    // === CRÍTICO: LIMPEZA DO AUTO-LOGIN ===
    // Remove as credenciais salvas para impedir que o sistema logue sozinho após o reload
    console.log("🧹 Limpando credenciais de auto-login...");
    localStorage.removeItem('bingo_nick_v2');
    localStorage.removeItem('bingo_senha_v2');
    localStorage.removeItem('bingo_lembrar');
    // =========

    // 1. Zera variáveis locais
    clienteLogado = false;
    
    // 2. Fecha modais e menus abertos
    if (typeof fecharModal === 'function') fecharModal('modal-carteira');
    
    if (typeof closeSideMenu === 'function') closeSideMenu();

    // 3. Atualiza a tela (Recarrega a página para limpar o cache visual do usuário)
    window.location.reload();
}


function toggleLoginPassword() {
    const input = document.getElementById('login-pass');
    const btn = event.currentTarget; // O botão que foi clicado
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈'; // Muda ícone para olho fechado (ou use outro emoji)
    } else {
        input.type = 'password';
        btn.textContent = '👁️'; // Volta para olho aberto
    }
}

// --- FUNÇÕES DE LOADING ---
function showFullLoading(mensagem) {
    if (!loader) return;
    
    // Cria um visual bonito com Spinner + Texto
    loader.innerHTML = `
        <div class="flex flex-col items-center justify-center bg-gray-900/80 p-6 rounded-xl border border-gray-700 shadow-2xl">
            <div class="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-green-500 mb-4"></div>
            <span class="text-white text-lg font-bold tracking-wide">${mensagem}</span>
        </div>
    `;

    // CORREÇÃO CRÍTICA: Remove a classe 'hidden' para vencer o !important do CSS
    loader.classList.remove('hidden');
    loader.style.display = 'flex';
}

function hideFullLoading() {
    if (loader) {
        // CORREÇÃO CRÍTICA: Adiciona a classe 'hidden' novamente
        loader.classList.add('hidden');
        loader.style.display = 'none';
        loader.innerHTML = ''; // Limpa para não deixar lixo
    }
}


/**
 * Substituto bonito para o alert()
 * Uso: showCustomAlert("Sua mensagem aqui", "Título Opcional", "emoji")
 */
function showCustomAlert(mensagem, titulo = "Aviso", icone = "ℹ️") {
    return new Promise((resolve) => {
        // 1. BUSCA O BOTÃO ATUAL NO DOM (Essencial para evitar o erro de null)
        const btnConfirm = document.getElementById('btn-modal-confirm');
        const btnCancel = document.getElementById('btn-modal-cancel');

        // 2. Configura textos
        if(modalTitle) modalTitle.textContent = titulo;
        if(modalMsg) modalMsg.innerHTML = mensagem;
        if(modalIcon) modalIcon.textContent = icone;

        // 3. Configura botões
        if(btnCancel) btnCancel.classList.add('hidden');
        
        if(btnConfirm) {
            btnConfirm.textContent = "OK";
            btnConfirm.className = "flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg border border-blue-500";
            
            // CLONE E SUBSTITUIÇÃO (Limpa listeners antigos)
            const newBtn = btnConfirm.cloneNode(true);
            btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);
            
            // Adiciona evento de fechar
            newBtn.addEventListener('click', () => {
                closeCustomModal();
                resolve(true);
            });
        }

        // 4. Mostra Modal
        if(customModal) {
            customModal.classList.remove('hidden');
            customModal.classList.add('flex');
        }
    });
}

// Substituto bonito para o confirm()
function showCustomConfirm(mensagem, titulo = "Confirmação", icone = "❓") {
    return new Promise((resolve) => {
        // 1. BUSCA OS BOTÕES ATUAIS NO DOM
        const btnConfirm = document.getElementById('btn-modal-confirm');
        const btnCancel = document.getElementById('btn-modal-cancel');

        // 2. Configura textos
        if(modalTitle) modalTitle.textContent = titulo;
        if(modalMsg) modalMsg.innerHTML = mensagem;
        if(modalIcon) modalIcon.textContent = icone;

        // 3. Configura botão CANCELAR
        if(btnCancel) {
            btnCancel.classList.remove('hidden');
            const newBtnCancel = btnCancel.cloneNode(true);
            btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
            
            newBtnCancel.addEventListener('click', () => {
                closeCustomModal();
                resolve(false); // Retorna FALSE
            });
        }

        // 4. Configura botão CONFIRMAR
        if(btnConfirm) {
            btnConfirm.textContent = "Sim, confirmar";
            btnConfirm.className = "flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg border border-green-500";
            
            const newBtnConfirm = btnConfirm.cloneNode(true);
            btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);
            
            newBtnConfirm.addEventListener('click', () => {
                closeCustomModal();
                resolve(true); // Retorna TRUE
            });
        }

        // 5. Mostra Modal
        if(customModal) {
            customModal.classList.remove('hidden');
            customModal.classList.add('flex');
        }
    });
}

function closeCustomModal() {
    if(customModal) {
        customModal.classList.add('hidden');
        customModal.classList.remove('flex');
    }
}


// --- FUNÇÃO: Alternar Visibilidade da Senha ---
function toggleVisualizarSenha(inputId, btnElement) {
    const input = document.getElementById(inputId);
    
    if (!input) return;

    if (input.type === "password") {
        // MOSTRAR SENHA
        input.type = "text";
        
        // Troca o ícone para "Olho Fechado" (indica que clicar vai esconder)
        // Ou mantém olho aberto com cor diferente. Aqui vou colocar o ícone de "Olho Riscado"
        btnElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-green-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
        `;
    } else {
        // ESCONDER SENHA
        input.type = "password";
        
        // Volta para o ícone de "Olho Aberto"
        btnElement.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        `;
    }
}


// FUNÇÃO DE LOGIN ATUALIZADA (Copie e substitua no script.js)
async function fazerLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    
    if (!user || !pass) {
        showCustomAlert("Por favor, preencha usuário e senha.", "Erro de Acesso", "❌");
        return;
    }

    // 1. ATIVA O LOADING
    if (typeof showFullLoading === 'function') {
        showFullLoading("Autenticando usuário...");
    }

    try {                                        
        const res = await fetch(`${API_BASE_URL}/api/login_cliente`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({usuario: user, senha: pass})
        });

        if (!res.ok) throw new Error(`Erro do Servidor (${res.status})`);

        const data = await res.json();

        if (data.status === 'ok') {
            clienteLogado = true;

            if (data.id || data.id_cliente) {
                clienteLogadoId = data.id || data.id_cliente;
                console.log("✅ Login efetuado. ID cliente:", clienteLogadoId);
            }
            
            fecharModal('modal-login');
            abrirMenuCliente(); 
            
            document.getElementById('login-user').value = "";
            document.getElementById('login-pass').value = "";
            
            // --- AQUI ESTÁ A MÁGICA (Correção da Sincronização) ---
            
            let idEventoDoServidor = null;

            // 1. Verifica se o backend mandou o ID do evento ativo
            if (data.id_evento_ativo) {
                console.log(`📡 Servidor indicou evento ativo: ${data.id_evento_ativo}`);
                idEventoDoServidor = data.id_evento_ativo;
                
                // ATUALIZA AS VARIÁVEIS GLOBAIS IMEDIATAMENTE
                // Isso impede que o sistema tente voltar para o evento 19
                if (typeof currentEventID !== 'undefined') currentEventID = idEventoDoServidor;
                if (typeof idRodada !== 'undefined') idRodada = idEventoDoServidor;
            } 
            else {
                // Fallback: Se o servidor não mandou nada (raro), tenta adivinhar pelo HTML (modo antigo)
                const el = document.getElementById('mobile-last-round');
                if (el) idEventoDoServidor = el.textContent || 0;
            }

            // 2. Carrega as cartelas do evento CORRETO
            if (idEventoDoServidor) {
                // Mantemos o loading ativo, mas mudamos a mensagem
                showFullLoading("Sincronizando cartelas...");
                
                // Força limpar cache anterior para garantir download novo
                eventoCarregadoAtual = null; 
                
                await carregarCartelasAutomaticas(idEventoDoServidor);
            }

        } else {
            // Se o login falhar (senha errada, etc), verifica se tem erro específico
            // Se o backend mandou data.erro (ex: "Senha incorreta"), usamos ele.
            const msgErro = data.erro || "Senha incorreta ou usuário não encontrado.";
            showCustomAlert(msgErro, "Acesso Negado", "❌");
        }

    } catch (e) {
        console.error("Falha no login:", e);
        showCustomAlert("Falha na comunicação: " + e.message, "Erro de Conexão", "❌");
    } finally {
        // 2. DESATIVA O LOADING (Sempre, ao final de tudo)
        hideFullLoading();
    }
}

// FUNÇÃO DE LOGIN (SEM ABRIR CARTEIRA AUTOMATICAMENTE)
async function realizarLogin() {
    const userInput = document.getElementById('login-user');
    const passInput = document.getElementById('login-pass');
    
    // 1. CAPTURA O CHECKBOX
    const checkLembrar = document.getElementById('lembrar-dados');

    if (!userInput || !passInput) return;

    const usuario = userInput.value.trim();
    const senha = passInput.value.trim();

    if (!usuario || !senha) {
        if (typeof showCustomAlert === 'function') showCustomAlert("Preencha usuário e senha.", "Atenção", "⚠️");
        else alert("Preencha usuário e senha.");
        return;
    }

    if (typeof showFullLoading === 'function') showFullLoading("Autenticando...");

    try {
        const response = await fetch(`${API_BASE_URL}/api/login_cliente`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', 
            body: JSON.stringify({ usuario, senha })
        });

        const data = await response.json();

        if (data.status === 'troca_senha_obrigatoria') {
            // Backend mandou trocar a senha. Redirecionar imediatamente.
            // if (data.mensagem) alert(data.mensagem); // Opcional: avisar antes de ir
            window.location.href = data.redirect_url;
            return; // Pára tudo aqui para não dar erro embaixo
        }

        if (response.ok && data.status === 'ok') {
            
            // === NOVA LÓGICA: SALVAR NO LOCALSTORAGE ===
            if (checkLembrar && checkLembrar.checked) {
                console.log("💾 Salvando credenciais...");
                localStorage.setItem('bingo_nick_v2', usuario);
                localStorage.setItem('bingo_senha_v2', senha);
                localStorage.setItem('bingo_lembrar', 'true');
            } else {
                console.log("🧹 Limpando credenciais salvas...");
                localStorage.removeItem('bingo_nick_v2');
                localStorage.removeItem('bingo_senha_v2');
                localStorage.removeItem('bingo_lembrar');
            }
            // ===========================================

            // 1. GRAVA DADOS
            const idSeguro = data.id_cliente || data.id || data._id || data.userId;
            
            // Atualiza variáveis novas e antigas
            clienteLogado = true;              
            clienteLogadoId = idSeguro;        
            globalIdCliente = idSeguro;        
            globalUserSaldo = parseFloat(data.saldo_atual || data.saldo || 0);

            // 2. ATUALIZA O VISUAL (Nome e Saldo na barra)
            if (typeof atualizarInterfaceAposLogin === 'function') {
                atualizarInterfaceAposLogin(data);
            }
            
            // 3. RECUPERA DADOS EXTRAS (Silenciosamente)
            if (typeof carregarMinhasCartelas === 'function') carregarMinhasCartelas();
            
            // 4. FECHA O MODAL DE LOGIN
            if (typeof fecharModal === 'function') {
                fecharModal('modal-login');
            } else {
                const modal = document.getElementById('modal-login');
                if (modal) modal.classList.add('hidden');
            }

            // Garante que a carteira esteja fechada
            if (typeof fecharModal === 'function') fecharModal('modal-carteira');

            // Limpa campos visuais (segurança), mas já salvamos no storage
            userInput.value = '';
            passInput.value = '';

            // Mensagem discreta
            if (typeof showCustomAlert === 'function') {
                showCustomAlert(`Bem-vindo de volta, ${data.nick || usuario}!`, "Login Sucesso", "✅");
            }

        } else {
            if (typeof showCustomAlert === 'function') showCustomAlert(data.erro || "Dados incorretos.", "Erro", "❌");
            else alert(data.erro || "Dados incorretos.");
        }
    } catch (error) {
        console.error("Erro no login:", error);
        if (typeof showCustomAlert === 'function') showCustomAlert("Erro de conexão.", "Falha", "🌐");
    } finally {
        if (typeof hideFullLoading === 'function') hideFullLoading();
    }
}



// 4. ATUALIZAR SALDO NA TELA (Busca os IDs corretos do seu HTML)
function atualizarInterfaceAposLogin(dados) {
    const saldoVal = parseFloat(dados.saldo_atual || 0);
    const saldoTxt = `R$ ${saldoVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    // Atualiza Menu Lateral (PC)
    const nomePC = document.getElementById('sidebar-user-name');
    const saldoPC = document.getElementById('sidebar-user-balance');
    const infoDiv = document.getElementById('user-info-sidebar');
    const btnLogin = document.getElementById('login-btn-sidebar');

    if (nomePC) nomePC.textContent = dados.nick;
    if (saldoPC) saldoPC.textContent = saldoTxt;
    
    if (infoDiv) {
        infoDiv.classList.remove('hidden');
        infoDiv.style.display = 'flex';
    }
    if (btnLogin) btnLogin.classList.add('hidden');

    // Atualiza Header (Celular)
    const saldoMobile = document.getElementById('mobile-user-balance');
    const divMobile = document.getElementById('mobile-balance-display');
    if (saldoMobile) saldoMobile.textContent = saldoTxt;
    if (divMobile) divMobile.classList.remove('hidden');

   // =========================================================
    // ✅ NOVO CÓDIGO: EXIBIR NOME NO CENTRO DA TELA
    // =========================================================
    const containerUser = document.getElementById('nameUser_container');
    const labelUser = document.getElementById('nameUser');

    if (containerUser && labelUser) {
        // Pega o ID (do parametro dados ou da variavel global)
        const userId = dados.id || dados.id_cliente || globalIdCliente;
        // Pega o Nick
        const userNick = dados.nick || dados.usuario || "";

        if (userId && userNick) {
            // Formato: "154 - ANGÉLICA" (ID - NOME MAIÚSCULO)
            labelUser.textContent = `${userId} - ${userNick.toUpperCase()}`;
            
            // Remove o hidden para mostrar
            containerUser.classList.remove('hidden');
        }
    }
    // =========================================================

}


// --- BUSCA O PREÇO E DETALHES DO EVENTO ---
async function atualizarPrecoDoEvento() {
    const idAlvo =obterIdEventoAlvo();

    if (idAlvo === 0) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/dados_evento?id_evento=${idAlvo}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            
            // 1. Atualiza Preço Global
            if (data.preco_cartela) {
                globalPrecoCartela = parseFloat(data.preco_cartela);
                
                // 2. ATUALIZA O TÍTULO DO MODAL (Com 3 linhas)
                const tituloModal = document.querySelector('#modal-comprar-cartelas h3');
                
                if (tituloModal) {
                    const desc = data.descricao || `Evento #${idAlvo}`;
                    const dataHora = (data.data_evento && data.hora_evento) 
                                     ? `${data.data_evento} às ${data.hora_evento}` 
                                     : '';

                    // Aqui criamos a estrutura com quebras de linha e tamanhos diferentes
                    tituloModal.innerHTML = `
                        <div class="flex flex-col items-center leading-tight">
                            <div class="flex items-center gap-2 text-xl">
                                <span>🛒</span> Comprar Cartelas
                            </div>
                            <span class="text-base text-yellow-500 font-bold  uppercase">${desc}</span>
                            ${dataHora ? `<span class="text-base' text-blue-400 font-semibold -mt-0.5">📅 ${dataHora}</span>` : ''}
                        </div>
                    `;
                }
                
                // Recalcula total
                calcularTotalCompra();
            }
        }
    } catch (error) {
        console.error("Erro ao buscar preço:", error);
    }
}

// ABRIR MODAL COMPRA (CORRIGIDA: FECHA O MODAL DE EVENTOS ANTES)
async function abrirModalCompra(idEventoEspecifico = 0) {
    // 1. Verifica Login
    if (!isUsuarioLogado()) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert("Você precisa fazer login para comprar cartelas.", "Login Necessário", "🔒");
        }
        abrirModalLogin();
        return;
    }

    // 2. Define qual evento será comprado
    if (idEventoEspecifico > 0) {
        eventoSelecionadoParaCompra = idEventoEspecifico;
    } else {
        eventoSelecionadoParaCompra = 0; 
    }

    // --- 3. FECHA OUTROS MODAIS (AQUI ESTÁ A CORREÇÃO) ---
    // Fecha a carteira e tenta fechar o modal de lista de eventos
    if (typeof fecharModal === 'function') {
        fecharModal('modal-carteira');
        
        // Tenta fechar possíveis nomes do seu modal de eventos
        // (Verifique no seu HTML qual é o ID correto da div principal da lista de eventos)
        fecharModal('events-panel-container');
    }

    // Feedback visual
    const btnCompra = document.querySelector('a[onclick="abrirModalCompra()"]');
    if(btnCompra) btnCompra.style.opacity = "0.5";

    // 4. Busca preço
    await atualizarPrecoDoEvento(); 
    
    if(btnCompra) btnCompra.style.opacity = "1";

    // 5. Abre o modal de compra
    const modal = document.getElementById('modal-comprar-cartelas');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        const saldoModal = document.getElementById('saldo-modal-compra');
        if (saldoModal) {
            saldoModal.textContent = `R$ ${globalUserSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }
        
        const input = document.getElementById('qtd-manual');
        const totalDisplay = document.getElementById('total-compra-display');
        if(input) input.value = '';
        if(totalDisplay) totalDisplay.textContent = 'R$ 0,00';
    }
}


// --- ABRIR MODAL DE LOGIN ---
// Função genérica para abrir Login
function abrirModalLogin() {
    // if (typeof telaFull !== 'undefined' && !telaFull && typeof goFullscreen === 'function') goFullscreen();
    const modal = document.getElementById('modal-login');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

// Função genérica para fechar qualquer modal
function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}


// --- FUNÇÃO CÉREBRO: DECIDE QUAL EVENTO USAR ---
function obterIdEventoAlvo() {
    // 1º Prioridade: Se o usuário selecionou um evento específico (ex: clicou em "Próximos Eventos")
    if (typeof eventoSelecionadoParaCompra !== 'undefined' && eventoSelecionadoParaCompra > 0) {
        return eventoSelecionadoParaCompra;
    }

    // 2º Prioridade: O evento atual que está rolando na tela
    // Tenta pegar da variável global 'idRodada' (se existir no seu código antigo)
    if (typeof idRodada !== 'undefined' && idRodada > 0) {
        return idRodada;
    }

    // 3º Tentativa: Pega do HTML (número da rodada no topo)
    const elLastRound = document.getElementById('mobile-last-round');
    if (elLastRound) {
        return parseInt(elLastRound.textContent) || 0;
    }

    return 0; // Nenhum evento identificado
}


// Função para carregar dados salvos ao abrir a tela (Versão DEBUG)
function verificarCredenciaisSalvas() {
    // 1. Ler do Navegador
    const nickSalvo = localStorage.getItem('bingo_nick_v2'); 
    const senhaSalva = localStorage.getItem('bingo_senha_v2');
    const lembrarSalvo = localStorage.getItem('bingo_lembrar');
    
    // 2. Buscar Elementos na Tela
    const inputUser = document.getElementById('login-user');
    const inputPass = document.getElementById('login-pass');
    const checkLembrar = document.getElementById('lembrar-dados');

    if (!inputUser || !inputPass) {
        console.warn("⚠️ [DEBUG] ALERTA: Os inputs de login não foram achados. O script rodou antes do HTML carregar?");
        return;
    }

    // 3. Lógica do Checkbox (Padrão TRUE)
    if (checkLembrar) {
        if (lembrarSalvo === null || lembrarSalvo === 'true') {
            checkLembrar.checked = true;
        } else {
            checkLembrar.checked = false;
        }
    }

    // 4. Preenchimento
    if (nickSalvo && (lembrarSalvo === null || lembrarSalvo === 'true')) {
        
        inputUser.value = nickSalvo;
        inputPass.value = senhaSalva || ''; 
        
    } else {
        console.log("⏭️ [DEBUG] Nada preenchido (Sem dados salvos ou 'Lembrar' desligado).");
    }
}


// --- AUTO-LOGIN NO CARREGAMENTO DA PÁGINA ---
window.addEventListener('load', () => {
    // 1. Primeiro, recupera os dados do localStorage e preenche os inputs
    verificarCredenciaisSalvas();

    // 2. Agora lê os campos já preenchidos
    const inputUser = document.getElementById('login-user');
    const inputPass = document.getElementById('login-pass');
    const checkLembrar = document.getElementById('lembrar-dados');

    const usuario = inputUser ? inputUser.value.trim() : '';
    const senha = inputPass ? inputPass.value.trim() : '';
    const lembrar = checkLembrar ? checkLembrar.checked : false;

    // 3. Decisão: Logar sozinho ou só mostrar a tela?
    if (usuario && senha && lembrar) {
        console.log("🚀 [AUTO-LOGIN] Credenciais encontradas. Entrando...");
        
        // Dica visual: Já mostra o loading imediatamente para não "piscar" a tela de login
        if (typeof showFullLoading === 'function') {
            showFullLoading("Conectando automaticamente...");
        }

        // Chama a função de login que já ajustamos
        realizarLogin();

    } else {
        console.log("👤 [LOGIN] Aguardando digitação do usuário.");        
        // Abre o modal para ele digitar
        if (typeof abrirModal === 'function') {
            abrirModal('modal-login');
        } else {
            const modal = document.getElementById('modal-login');
            if (modal) modal.classList.remove('hidden');
        }
    }
});


// --- FUNÇÕES DE HISTÓRICO DE SORTEIOS ---

// 1. Abre o Modal e inicia a busca
function abrirModalHistorico() {
    // Fecha o menu principal se estiver aberto
    if (typeof closeSideMenu === 'function') {
         closeSideMenu();
   }

    fecharModal('modal-menu-cliente'); 
    
    const modal = document.getElementById('modal-historico');
    if(modal) {
        modal.classList.remove('hidden');
        carregarHistoricoResultados(); // Chama a API
    }
}

// 2. Busca e Renderiza os Dados
async function carregarHistoricoResultados() {
    const container = document.getElementById('historico-container');
    const loader = document.getElementById('loader-historico');
    
    // Limpa conteúdo anterior (mantendo o loader se quiser, ou recriando)
    if(container) {
        container.innerHTML = `
            <div id="loader-historico" class="flex flex-col items-center justify-center h-48 space-y-3">
                 <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500"></div>
                 <p class="text-gray-400 text-sm">Buscando resultados...</p>
             </div>
        `;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/historico_resultados`);
        const data = await response.json();

        if(container) container.innerHTML = ''; // Limpa o loader

        if (data.status === 'ok' && data.historico && data.historico.length > 0) {
            
            // Loop para criar cada card
            data.historico.forEach(evento => {
                const cardHTML = criarCardHistorico(evento);
                container.insertAdjacentHTML('beforeend', cardHTML);
            });

        } else {
            // Caso não tenha histórico
            if(container) container.innerHTML = `
                <div class="text-center py-10 opacity-50">
                    <p class="text-4xl mb-2">📂</p>
                    <p class="text-gray-400">Nenhum sorteio finalizado encontrado.</p>
                </div>
            `;
        }

    } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        if(container) container.innerHTML = `
            <div class="text-center py-10 text-red-400">
                <p>❌ Falha ao carregar dados.</p>
                <button onclick="carregarHistoricoResultados()" class="mt-2 text-sm underline text-gray-300">Tentar novamente</button>
            </div>
        `;
    }
}

// 3. Monta o HTML de um Card Individual
function criarCardHistorico(evento) {
    // Formata a lista de ganhadores
    let ganhadoresHTML = '';
    
    if (evento.ganhadores && evento.ganhadores.length > 0) {
        ganhadoresHTML = evento.ganhadores.map(g => `
            <div class="flex justify-between items-center bg-gray-900/50 p-1 rounded border border-gray-700/50 mb-1 last:mb-0">
                <div class="flex flex-col">
                    <span class="text-xs text-yellow-500 font-bold uppercase tracking-wider">${g.premio}</span>
                    <span class="text-sm text-gray-200 font-medium -mt-0.5 truncate max-w-[150px]">👤 ${g.nome}</span>
                </div>
                <div class="text-right">
                    <div class="text-green-400 font-bold text-sm">${g.valor}</div>
                    <div class="text-[12px] text-gray-150 -mt-0.5">Cartela: ${g.cartela}</div>
                </div>
            </div>
        `).join('');
    } else {
        ganhadoresHTML = '<p class="text-xs text-gray-500 italic p-2 text-center">Nenhum ganhador registrado.</p>';
    }

    // HTML do Card Completo
    return `
        <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-lg animate-fade-in relative">
            
            <div class="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-600 to-yellow-800"></div>

            <div class="p-2 pl-5">
                <div class="flex justify-between items-start mb-1 border-b border-gray-700 pb-1">
                    <div>
                        <h4 class="text-blue-400 font-bold text-lg -mt-2">${evento.id_evento}- ${evento.descricao}</h4>
                        <p class="text-lg text-gray-300">📅 ${evento.data} às ${evento.hora_fim}</p>
                    </div>
                    <div class="bg-gray-700 px-2 py-1 rounded text-center">
                        <span class="block text-[10px] text-gray-400 uppercase">Bolas</span>
                        <span class="block text-sm font-bold text-white">${evento.total_bolas}</span>
                    </div>
                </div>

                <div class="space-y-1">
                    ${ganhadoresHTML}
                </div>
            </div>
        </div>
    `;
}

// Função para atualizar a imagem do prêmio no painel da bola
function atualizarImagemPremio(nomeArquivo, descricaoPremio) {
    const imgElement = document.getElementById('img-premio-painel');
    const textoElement = document.getElementById('texto-premio-painel');
    
    // Caminho base onde você salvou as fotos no passo 1
    const caminhoBase = '/img/premios/';

    // 1. Atualiza a imagem
    if (imgElement) {
        if (nomeArquivo && nomeArquivo.trim() !== '') {
            // Se veio nome do banco (ex: "fiat_toro.webp")
            imgElement.src = caminhoBase + nomeArquivo;
        } else {
            // Imagem padrão se o banco estiver vazio
            imgElement.src = caminhoBase + 'premio_padrao.webp'; 
        }
    }

    // 2. Atualiza o texto (Ex: "VALENDO MOTO")
    if (textoElement) {
        textoElement.textContent = descricaoPremio || "PRÊMIO ESPECIAL";
    }
}


// Função auxiliar para buscar a imagem no banco de vendas
async function buscarImagemDoPremio(idEvento) {

    if (!idEvento) return;

    // 1. SISTEMA DE CACHE INTELIGENTE
    // Se já buscamos esse evento e temos a imagem, para por aqui.
    if (cacheIdEvento === idEvento && cacheImagem !== '') {
        // Opcional: Se quiser garantir que a tela está certa mesmo com cache
        // atualizarImagemPremio(cacheImagem, cacheTexto); 
        return; 
    }

    try {
        console.log(`🔍 Buscando foto do prêmio para o evento ${idEvento}...`);
        
        const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
        const urlParaBuscar = `${baseUrl}/api/verificar_status_evento?id_evento=${idEvento}`;

        console.log(`🚀 [DEBUG] URL Gerada: ${urlParaBuscar}`);
       
        const response = await fetch(urlParaBuscar);
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") === -1) {
            const textoErro = await response.text(); // Lê o HTML para ver o erro
            throw new Error(`Resposta não é JSON! Servidor devolveu: ${textoErro.substring(0, 100)}...`);
        }

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const data = await response.json();

        // 3. ATUALIZAÇÃO
        if (data && data.imagem_premio) {
            // Salva no cache para não buscar de novo na próxima rodada
            cacheIdEvento = idEvento;
            cacheImagem = data.imagem_premio; // Ex: "carro.jpg"
            cacheTexto = data.premio_atual;   // Ex: "MOTO 0KM"
            
            console.log("✅ Imagem encontrada:", cacheImagem);
            
            // Chama a função visual que configuramos antes
            if (typeof atualizarImagemPremio === 'function') {
                atualizarImagemPremio(cacheImagem, cacheTexto);
            }
        }
    } catch (error) {
        console.error("❌ Erro ao buscar imagem do prêmio:", error);
        // Em caso de erro, não limpamos o cache para manter a imagem anterior se houver
    }
}


// =========================================================
// === MÓDULO SORTE EXTRA (LÓGICA DO CLIENTE) ===
// =========================================================

// Variáveis de Estado
let configSorteExtra = {
    ativo: false,
    idEvento: null,
    qtde_dezenas: 3,
    preco: 5.00,
    numeros_selecionados: [], // Volante atual
    carrinho: [] // Cupons prontos para pagar
};


function gerarBadgeStatusEvento(config) {
    if (!config.ativo) return '';

    // CENÁRIO 1: É EVENTO FUTURO (Aviso Amarelo com Fundo Vermelho)
    if (config.is_evento_futuro) {
        return `
        <div class="w-full bg-red-600 border-2 border-yellow-400 p-0 rounded-lg mb-1 shadow-lg animate-pulse">
            <div class="flex items-center justify-center gap-2 text-black font-black text-sm uppercase tracking-wider">
                ⚠️ ATENÇÃO: PRÓXIMO EVENTO
            </div>
            <div class="text-center text-white font-bold text-xs">
                Vendas abertas para: <span class="text-yellow-300 block text-sm -mt-1.5">${config.data_hora_evento}</span>
            </div>
        </div>
        `;
    } 
    
    // CENÁRIO 2: É O EVENTO ATUAL (Verde)
    else {
        return `
        <div class="w-full bg-green-900/50 border border-green-500 p-1 rounded mb-2 flex justify-center items-center gap-2 shadow-md">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span class="text-green-400 font-bold uppercase tracking-widest text-[10px]">Evento Atual</span>
        </div>
        `;
    }
}
//

// 1. INICIALIZAR E BUSCAR REGRAS (COM CONTROLE DE ABERTURA)
async function carregarSorteExtra(abrirTela = true, idOverride = null) {
    let rawId = idOverride; // 1ª Prioridade: Parâmetro passado manualmente

    // 2ª Prioridade: Sua variável global (A melhor opção)
    if (!rawId) {
        if (typeof eventoCarregadoAtual !== 'undefined' && eventoCarregadoAtual && eventoCarregadoAtual.id_evento) {
            rawId = eventoCarregadoAtual.id_evento;
            console.log("✅ ID recuperado de 'eventoCarregadoAtual':", rawId);
        }
    }

    // 3ª Prioridade: URL (Caso seja um link direto)
    if (!rawId) {
        const urlParams = new URLSearchParams(window.location.search);
        rawId = urlParams.get('idsala');
    }

    // 4ª Prioridade: Outras variáveis globais (Fallback)
    if (!rawId || rawId === 'padrao') {
        if (typeof premioInfo !== 'undefined' && premioInfo && premioInfo.id_evento) {
            rawId = premioInfo.id_evento;
        } else if (typeof currentSalaId !== 'undefined' && currentSalaId !== 'padrao') {
            rawId = currentSalaId;
        }
    }

    // --- VALIDAÇÃO FINAL (INPUT) ---
    const idEvento = parseInt(rawId, 10);
    
    if (!idEvento || isNaN(idEvento) || idEvento <= 0) { // <--- Adicione idEvento <= 0
        console.warn(`⚠️ Sorte Extra ignorado: ID inválido (Recebido: ${rawId}).`);
        
        // Esconde botões...
        const btnMenu = document.getElementById('btn-open-extra');
        if (btnMenu) btnMenu.classList.add('hidden');
        // ... (resto do código de ocultar)
        
        return; // ABORTA ANTES DO FETCH
    }

    // Fecha o menu lateral...
    if (typeof closeSideMenu === 'function') closeSideMenu();

    try {
        console.log(`🔄 Buscando Sorte Extra para o Evento ID: ${idEvento}`);
        const res = await fetch(`${API_BASE_URL || ''}/api/cliente/config_sorte_extra/${idEvento}`);
       
        if (!res.ok) throw new Error("Recurso não configurado ou offline");
        
        const dados = await res.json();

        // =================================================================
        // 🛑 NOVA VALIDAÇÃO: SE O SERVIDOR RETORNAR ID ZERO, OCULTA TUDO
        // =================================================================
        if (!dados.id_evento || parseInt(dados.id_evento) === 0) {
            console.log("🚫 Sorte Extra está inativo (ID 0) no servidor. Ocultando botões.");
            
            const btnMenu = document.getElementById('btn-open-extra');
            if (btnMenu) btnMenu.classList.add('hidden');
            
            const btnFloat = document.getElementById('btn-floating-extra');
            if (btnFloat) btnFloat.classList.add('hidden');

            return; // SAI DA FUNÇÃO AQUI
        }
        // =================================================================

        // Salva Configuração Global
        configSorteExtra = {
            ...configSorteExtra,
            ativo: dados.ativo,
            idEvento: parseInt(dados.id_evento),
            qtde_dezenas: dados.qtde_dezenas,
            preco: dados.preco_cupom,
            // Mantém o carrinho se já existir, senão zera
            carrinho: configSorteExtra.carrinho || [],           
            numeros_selecionados: [] 
        };

        const htmlBadge = gerarBadgeStatusEvento(dados);
        
        // Você precisa ter um <div id="container-aviso-extra"></div> no seu HTML do modal
        const containerBadge = document.getElementById('container-aviso-extra');
        
        if (containerBadge) {
            containerBadge.innerHTML = htmlBadge;
        } else {
            console.log("⚠️ Nota: Crie a <div id='container-aviso-extra'></div> no modal para ver o aviso.");
        }

        // Atualiza Textos da UI com segurança (verifica se elementos existem)
        const elPreco = document.getElementById('lbl-preco');
        if (elPreco) elPreco.innerText = `R$ ${dados.preco_cupom.toFixed(2)}`;
        
        const elQtde = document.getElementById('lbl-qtde');
        if (elQtde) elQtde.innerText = dados.qtde_dezenas;
        
        const elRegras = document.getElementById('lbl-regras-resumo');
        const containerBtnHeader = document.getElementById('container-btn-regras-novo');

        if (containerBtnHeader) containerBtnHeader.innerHTML = '';

        if (elRegras) {
            // 2. Preenche o rodapé com as informações financeiras
            elRegras.innerHTML = `
                <div class="flex flex-col items-center justify-center gap-1">
                    <span class="font-bold text-gray-200">
                        🏆Prêmio Máx: R$ ${dados.premio_maximo.toFixed(2)} | Base: R$ ${dados.premio_base.toFixed(2)}
                    </span>
                    <div id="conteudo-regras-extra" class="hidden mt-2 p-2 bg-gray-900/90 rounded border border-yellow-500/50 shadow-lg w-full max-w-md">
                         <p class="text-white font-medium text-sm animate-pulse text-center">
                              ${dados.texto_regra_vitoria || ''}
                         </p>
                    </div>
                </div>
            `;

            // 3. Se houver regras, CRIA O BOTÃO lá no Cabeçalho (Header)
            if (dados.texto_regra_vitoria && dados.texto_regra_vitoria.trim() !== "") {
                if (containerBtnHeader) {
                    containerBtnHeader.innerHTML = `
                        <button id="btn-ver-regras" onclick="toggleRegrasExtra()" 
                            class="text-[16px] md:text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-green-300 py-1 px-2 rounded border border-gray-500 transition-all shadow-sm flex items-center gap-1">
                            <span>📜 Regras</span>
                        </button>
                    `;
                }
            }
        }
        
        // --- MOSTRAR BOTÕES (Só chega aqui se o ID > 0) ---
        const btnMenu = document.getElementById('btn-open-extra');
        if (btnMenu) btnMenu.classList.remove('hidden');

        const btnFloat = document.getElementById('btn-floating-extra');
        if (btnFloat) btnFloat.classList.remove('hidden');

        renderizarGridVolante(); 
        
        // Atualiza seleções visuais
        atualizarDisplaySelecao();
        atualizarCarrinhoUI();
        
        // --- O SEGREDINHO: SÓ ABRE SE FOR SOLICITADO ---
        if (abrirTela === true) {
            const modal = document.getElementById('modal-sorte-extra');
            if (modal) modal.classList.remove('hidden');
        }

    } catch (e) {
        // Se der erro, esconde os botões para não confundir o usuário
        const btnMenu = document.getElementById('btn-open-extra');
        if (btnMenu) btnMenu.classList.add('hidden');
        const btnFloat = document.getElementById('btn-floating-extra');
        if (btnFloat) btnFloat.classList.add('hidden');
        
        console.warn("Sorte Extra indisponível:", e.message); 
    }
}


function abrirTelaSorteExtra() {
    console.log("👆 Abrindo tela do Sorte Extra...");
    const modal = document.getElementById('modal-sorte-extra');
    if (typeof telaFull !== 'undefined' && !telaFull && typeof goFullscreen === 'function') goFullscreen();
    
    if (modal) {
        closeSideMenu(); 
        modal.classList.remove('hidden');
        // Garante que o grid esteja renderizado caso não tenha sido antes
        if (typeof renderizarGridVolante === 'function') {
            renderizarGridVolante();
        }
    } else {
        console.error("❌ ERRO: Elemento 'modal-sorte-extra' não existe no HTML.");
        alert("Erro ao abrir janela: HTML não encontrado.");
    }
}

// 2. RENDERIZAR GRID DE NÚMEROS
function renderizarGridVolante() {
    // Define o total: Usa a global MAX_BOLAS se existir, senão usa 90 (segurança)
    const totalBolas = (typeof MAX_BOLAS !== 'undefined') ? MAX_BOLAS : 90;

    const container = document.getElementById('grid-volante');
    container.innerHTML = ""; // Limpa

    for (let i = 1; i <= totalBolas; i++) {
        const btn = document.createElement('div');
        // Estilo das Bolinhas do Grid
        btn.className = "h-6 w-full bg-gray-700 rounded-lg flex items-center justify-center text-white -mb-0.5 font-bold cursor-pointer hover:bg-gray-600 transition-all select-none border border-gray-600 shadow-sm active:scale-95";
        btn.innerText = i;
        btn.onclick = () => toggleNumeroExtra(i, btn);
        container.appendChild(btn);
    }
}

// 3. SELEÇÃO (CLICK NO NÚMERO)
function toggleNumeroExtra(num, elemento) {
    const index = configSorteExtra.numeros_selecionados.indexOf(num);
    fecharRegrasSeEstiveremAbertas();
    // Se já existe -> Remove
    if (index > -1) {
        configSorteExtra.numeros_selecionados.splice(index, 1);
        styleBola(elemento, false);
    } 
    // Se não existe -> Adiciona (com verificação de limite)
    else {
        if (configSorteExtra.numeros_selecionados.length < configSorteExtra.qtde_dezenas) {
            configSorteExtra.numeros_selecionados.push(num);
            styleBola(elemento, true);
        } else {
            // Efeito visual de erro/limite
            elemento.classList.add('animate-shake');
            setTimeout(() => elemento.classList.remove('animate-shake'), 300);
        }
    }
    atualizarDisplaySelecao();
}

// Função auxiliar de estilo
function styleBola(el, selecionado) {
    if (selecionado) {
        el.className = "h-6 w-full bg-yellow-500 text-black font-black rounded-lg flex items-center justify-center -mb-0.5 cursor-pointer transition-all shadow-lg scale-105 border-2 border-white";
    } else {
        el.className = "h-6 w-full bg-gray-700 text-white font-bold rounded-lg flex items-center justify-center -mb-0.5 cursor-pointer hover:bg-gray-600 transition-all border border-gray-600";
    }
}

// 4. ATUALIZAR DISPLAY (BOLINHAS NO TOPO)
function atualizarDisplaySelecao() {
    const container = document.getElementById('display-selecao');
    container.innerHTML = "";
    
    for (let i = 0; i < configSorteExtra.qtde_dezenas; i++) {
        const num = configSorteExtra.numeros_selecionados[i];
        const el = document.createElement('div');
        
        if (num !== undefined) {
            el.className = "w-8 h-8 rounded-full bg-yellow-500 -mt-2 text-black font-bold flex items-center justify-center shadow border-2 border-white animate-pop";
            el.innerText = num;
        } else {
            el.className = "w-8 h-8 rounded-full border-2 border-dashed border-gray-600 -mt-2 flex items-center justify-center text-gray-500 text-xs";
            el.innerText = i+1;
        }
        container.appendChild(el);
    }

    // Botão Adicionar
    const btnAdd = document.getElementById('btn-add-cupom');
    const completo = configSorteExtra.numeros_selecionados.length === configSorteExtra.qtde_dezenas;
    btnAdd.disabled = !completo;
}

// 5. ADICIONAR CUPOM AO CARRINHO (Versão Final e Segura)
function adicionarCupomAoCarrinho() {
    // 1. Prepara e ordena a combinação atual para comparação
    const cupomAtual = [...configSorteExtra.numeros_selecionados].sort((a, b) => a - b);
    const chaveNova = cupomAtual.join('-');

    // 2. Verifica se a combinação já existe no carrinho (dentro do objeto configSorteExtra)
    const jaExiste = configSorteExtra.carrinho.some(itemNoCarrinho => {
        // Ordenamos os números salvos para comparar maçãs com maçãs
        const numerosExistentes = [...itemNoCarrinho.numeros].sort((a, b) => a - b);
        return numerosExistentes.join('-') === chaveNova;
    });

    if (jaExiste) {
        showCustomAlert("Você já escolheu esses mesmos números em outro cupom!", "Ops", "⚠️");
        return; 
    }   
 
    // 3. Adiciona ao carrinho se for único
    configSorteExtra.carrinho.push({
        numeros: cupomAtual, // Salva ordenado para facilitar a vida
        id_temp: Date.now()
    });

    // 4. Limpeza e Atualização Visual
    configSorteExtra.numeros_selecionados = [];
    
    renderizarGridVolante(); 
    atualizarDisplaySelecao();
    atualizarCarrinhoUI();
    
    // Auto-scroll para o último cupom adicionado
    setTimeout(() => {
        const lista = document.getElementById('lista-carrinho');
        if (lista) lista.scrollTop = lista.scrollHeight;
    }, 100);
}


// 6. GERENCIAR CARRINHO UI
function atualizarCarrinhoUI() {
    const lista = document.getElementById('lista-carrinho');
    const lblTotal = document.getElementById('lbl-total-carrinho');
    const qtdTotal = document.getElementById('lbl-qtde-carrinho');
    const btnFinalizar = document.getElementById('btn-finalizar-extra');

    // --- BLINDAGEM: Se os elementos não existirem, para aqui e não dá erro ---
    if (!lista || !lblTotal || !btnFinalizar) return;

    lista.innerHTML = "";
    let total = 0;
    let qtde = 0;

    if (configSorteExtra.carrinho.length === 0) {
        lista.innerHTML = '<div class="text-center text-gray-500 text-sm mt-8 italic">Nenhum cupom.</div>';
    } else {
        configSorteExtra.carrinho.forEach((item, index) => {
            total += configSorteExtra.preco;
            qtde ++;
            const row = document.createElement('div');
            row.className = "bg-gray-700/50 rounded-lg border border-gray-600 flex justify-between items-center px-1 animate-fade-in-left";
            row.innerHTML = `
                <div class="flex gap-2">
                    ${item.numeros.map(n => `<span class="bg-black text-yellow-500 text-[14px] px-3 py-0.5 rounded font-bold">${n < 10 ? '0'+n : n}</span>`).join('')}
                </div>
                <button onclick="removerCupom(${index})" class="text-red-400 hover:text-red-200 hover:bg-red-900/30 rounded">
                    🗑️
                </button>
            `;
            lista.appendChild(row);
        });
    }

    lblTotal.innerText = `R$ ${total.toFixed(2)}`;
    qtdTotal.innerText = `Qt ${qtde}`;

    // Habilita Botão Finalizar
    if (configSorteExtra.carrinho.length > 0) {
        btnFinalizar.disabled = false;
        btnFinalizar.innerHTML = `✅ PAGAR R$ ${total.toFixed(2)}`;
    } else {
        btnFinalizar.disabled = true;
        btnFinalizar.innerHTML = `🛒 CARRINHO VAZIO`;
    }
}

function removerCupom(index) {
    configSorteExtra.carrinho.splice(index, 1);
    atualizarCarrinhoUI();
}

// 7. FECHAR MODAL
function fecharModalSorteExtra() {
    document.getElementById('modal-sorte-extra').classList.add('hidden');
}

// 8. FINALIZAR COMPRA REAL (COM TRATAMENTO DE ERRO 401)
async function finalizarCompraExtra() {
    // 1. Validações Básicas: Carrinho Vazio
    if (configSorteExtra.carrinho.length === 0) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert("Seu carrinho está vazio!", "Carrinho Vazio", "🚫");
        }
        return;
    }
    
    // 2. Verifica Login
    if (!clienteLogado) {
        if (typeof showCustomAlert === 'function') {
            showCustomAlert("Você precisa fazer LOGIN para comprar.", "Realizar Login", "🚫");
        }
        fecharModalSorteExtra();
        abrirModalLogin(); 
        return;
    }

    // ============================================================
    // 🛡️ NOVA PROTEÇÃO: VERIFICA SE O ID DO EVENTO É VÁLIDO
    // (Isso evita o Erro 400 Bad Request no servidor)
    // ============================================================
    if (!configSorteExtra.idEvento || configSorteExtra.idEvento <= 0) {
        console.error("⛔ Erro Crítico: ID do evento inválido na compra:", configSorteExtra.idEvento);
        if (typeof showCustomAlert === 'function') {
            showCustomAlert("Erro técnico: Identificação do evento perdida. Por favor, recarregue a página.", "Erro Interno", "❌");
        } else {
            alert("Erro técnico: Identificação do evento perdida. Recarregue a página.");
        }
        return; // ABORTA AQUI PARA NÃO QUEBRAR O SERVIDOR
    }
    // ============================================================

    // 3. Confirmação Visual
    const total = configSorteExtra.carrinho.length * configSorteExtra.preco;
    const confirmou = await showCustomConfirm(`Confirmar a compra de ${configSorteExtra.carrinho.length} cupons?\nTotal: R$ ${total.toFixed(2)}`, "Comprar Cupons", "🛒");
    if(!confirmou) return;

    // 4. Feedback de Loading
    const btn = document.getElementById('btn-finalizar-extra');
    let textoOriginal = "FINALIZAR COMPRA";
    if (btn) {
        textoOriginal = btn.innerText;
        btn.disabled = true;
        btn.innerText = "⏳ Processando...";
    }

    try {
        // 5. Envia para o Backend
        const response = await fetch(`${API_BASE_URL || ''}/api/cliente/comprar_sorte_extra`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Envia o cookie da sessão 
            body: JSON.stringify({
                id_evento: configSorteExtra.idEvento,
                carrinho: configSorteExtra.carrinho.map(c => c.numeros)
            })
        });

        const data = await response.json();

        // --- TRATAMENTO ESPECIAL PARA ERRO 401 (Sessão Expirada) ---
        if (response.status === 401) { 
            if (typeof showCustomAlert === 'function') {
                showCustomAlert("Sua sessão expirou. Por favor, faça login novamente.", "Sessão Expirada", "🚫");
            }
            clienteLogado = false; 
            fecharModalSorteExtra();
            abrirModalLogin();
            return;
        }

        if (response.ok && data.status === 'ok') {
            // === SUCESSO ===
            if (typeof showCustomAlert === 'function') {
                showCustomAlert(`✅ ${data.msg}\nNovo Saldo: R$ ${data.novo_saldo.toFixed(2)}`, "Saldo Atualizado", "✅");
            }
            
            // Limpa o carrinho e atualiza UI
            configSorteExtra.carrinho = [];
            configSorteExtra.numeros_selecionados = [];
            atualizarCarrinhoUI();
            renderizarGridVolante(); 
            
            // Atualiza o saldo na tela principal
            if (typeof atualizarDadosCliente === 'function') {
                atualizarDadosCliente();
            }
            
            fecharModalSorteExtra();

        } else {
            // Erro retornado pela API (mas com status 200 ou outro)
            throw new Error(data.erro || "Erro ao processar compra.");
        }

    } catch (erro) {
        console.error("Erro na compra:", erro);
        if (typeof showCustomAlert === 'function') {
             showCustomAlert("Falha: " + erro.message, "Erro", "❌");
        } else {
             alert("❌ Falha: " + erro.message);
        }
    } finally {
        // Restaura o botão
        if(btn) {
            btn.disabled = false;
            btn.innerText = textoOriginal;
        }
    }
}


/**
 * Alterna a visibilidade: O botão está no Header, o texto está no Footer
 */
function toggleRegrasExtra() {
    const conteudo = document.getElementById('conteudo-regras-extra');
    const btn = document.getElementById('btn-ver-regras');

    if (conteudo) {
        if (conteudo.classList.contains('hidden')) {
            // MOSTRAR
            conteudo.classList.remove('hidden');
            // Opcional: Rolar suavemente até as regras para garantir que o usuário veja
            conteudo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            if (btn) {
                btn.classList.remove('bg-gray-700', 'text-green-300');
                btn.classList.add('bg-gray-600', 'text-white'); // Muda cor para indicar "Ativo"
            }
        } else {
            // ESCONDER
            conteudo.classList.add('hidden');
            
            if (btn) {
                btn.classList.remove('bg-gray-600', 'text-white');
                btn.classList.add('bg-gray-700', 'text-green-300');
            }
        }
    }
}

/**
 * Chama esta função ao clicar num número para limpar a tela
 */
function fecharRegrasSeEstiveremAbertas() {
    const conteudo = document.getElementById('conteudo-regras-extra');
    const btn = document.getElementById('btn-ver-regras');

    if (conteudo && !conteudo.classList.contains('hidden')) {
        conteudo.classList.add('hidden');
        if (btn) {
            btn.classList.remove('bg-gray-600', 'text-white');
            btn.classList.add('bg-gray-700', 'text-green-300');
        }
    }
}

/**
 * 🛠️ FIX: Função de Reprocessamento Forçado
 * Recalcula matematicamente os acertos e força a atualização da interface
 * usando a função centralizadora displayLoadedCards.
 */
function forcarReprocessamentoVisual() {
    // 1. Verificações de segurança
    // Verifica se temos cartelas E se temos cache de bolas para cruzar
    if (!cartelasDoJogador || cartelasDoJogador.length === 0) {
        // Se não tiver cartela, não tem o que reprocessar
        return; 
    }
    
    // Se bolasSorteadasCache for undefined (início do jogo), assumimos array vazio
    const bolasParaConferir = globalBolasCantadas || [];

    console.log(`🔄 [FIX] Reprocessando ${cartelasDoJogador.length} cartelas com ${bolasParaConferir.length} bolas.`);

    // 2. Loop Matemático (Recalcula acertos um por um)
    cartelasDoJogador.forEach(cartela => {
        let contaAcertos = 0;
        
        if (cartela.numeros && Array.isArray(cartela.numeros)) {
            // Cruza os números da cartela com as bolas do cache
            contaAcertos = cartela.numeros.filter(num => bolasParaConferir.includes(num)).length;
        }

        // Atualiza o objeto da cartela na memória
        cartela.acertos = contaAcertos;
    });

    // 3. Ordenação (Do maior acerto para o menor para exibir no topo)
    cartelasDoJogador.sort((a, b) => b.acertos - a.acertos);

    // 4. Força a atualização Visual usando sua função centralizadora
    if (typeof displayLoadedCards === 'function') {
        displayLoadedCards(bolasParaConferir);
    } else {
        console.warn("⚠️ Função displayLoadedCards não encontrada.");
    }

    console.log("✅ [FIX] Visual atualizado.");
}


