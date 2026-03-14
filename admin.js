// =========================================================
// === ADMIN.JS - SISTEMA COMPLETO V4 (FINAL) - DEBUG ATIVO ===
// =========================================================

// --- REFERÊNCIAS DE UI ---
const modalOverlay = document.getElementById('custom-modal-overlay');
const modalBox = document.getElementById('custom-modal-box');
const modalTitle = document.getElementById('custom-modal-title');
const modalMessage = document.getElementById('custom-modal-message');
const modalActions = document.getElementById('custom-modal-actions');

const gridContainer = document.getElementById('grid-bolas');
const bolaDestaque = document.getElementById('bola-destaque');
const btnSortear = document.getElementById('btn-sortear');
const contadorElement = document.getElementById('contador-bolas');

// --- VARIÁVEIS DE CONTROLE ---

let tempoEsperaConferenciaRobo = 3;

let tempoInicioTransmissao = 0;

let A_Ultima_Bola = 0;

let isSorting = false;
let autoSorteioInterval = null;
let autoSorteioAtivo = false;
let tempoRestante = 0;
let progressInterval = null;
let configuracaoServer = {}; 
let bolasSorteadasCache = []; 
let ultimoTotalBolasProcessadas = -1; 
let jaAlertouNestaBola = false;
let dadosEventoAtual = null;
let localStream = null;
let vendasTimerInterval = null;
let MAX_BOLAS = 75;

let id_evento_ativo = 0;

// --- CONTROLE SORTE EXTRA ---
let sorteioExtraConfigAtivo = true;    // Se o evento atual tem Sorte Extra
let qtdeDezenasSorteExtra = 5;        // Padrão (será atualizado pela config)
let qtdeTopeSorteExtra = 10;            // Padrão (será atualizado pela config)
let cacheGanhadoresExtraFinal = [];
let buscarSorteExtra = true;

let filaSorteExtra = [];                         // Onde os ganhadores vão esperar a vez
let processandoFilaExtra = false;     // Trava para saber se o timer já está rodando

let premioPrincipalPendente = null;

// Valores Financeiros (Carregados do Banco)
let valorPremioMaximoExtra = 0;   // 5 Acertos
let valorPremioIntermediario = 0; // 4 Acertos
let valorPremioBase = 0;          // 3 Acertos
let valorBonusExtra = 0;          // 2 Acertos (Preço do Cupom)

let jaValidouSorteExtraNestaRodada = false; // Trava para não abrir o modal 20x

let jogoFoiFinalizadoComSucesso = false;
let jogoRoboFinalizadoComSucesso = false;


let cartelasPendentesAuditoria = [];
let idsConfirmadosNestaRodada = new Set()

// --- MATRIZ DE SINCRONIA (BUFFER DE SAÍDA) ---

let bolasEmTransito = new Set();
let aguardandoVideo = 0; // temporizaor de atraso

let matrizEnvio = []; 
let isEnviando = false;
let bolasCacheLocal = new Set();
let timerSincronia = setInterval(processarMatrizEnvio, 200);

let matrizAcoes = []; 

// --- VARIÁVEIS DO MODO ROBÔ ---
let modoRoboAtivo = false;       
let processandoVitoria = false;  

// Controle de Hardware/Config
let modoSorteio = 'auto'; 
let vozAtiva = false;
let enviarPortaSerial = false;  
let portaSerial = null;
 
let cameraAtiva = false;
let sorteioAutomatizadoConfig = false; 

// ======================================================
// CONFIGURAÇÃO BLINDADA (SERVIDOR INDEPENDENTE) - ADMIN
// ======================================================

// 1. Detecta protocolo e host automaticamente
const protocolWS = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
//const host = window.location.host; 
const host = window.location.host.replace('www.', '');

// 2. Define ID da Sala (Apenas para fins visuais no painel)
const urlParamsGlobal = new URLSearchParams(window.location.search);
var currentSalaId = urlParamsGlobal.get('sala') || "001"; 

// 3. Define URLs (API e WebSocket)
// Como o servidor agora é independente, a API e o WS rodam na RAIZ.
var API_BASE_URL = ""; 
var WS_URL = `${protocolWS}${host}/stream`;

console.log(`🚀 [ADMIN] Conectado ao Servidor: ${host}`);
console.log(`🔧 Sala Referência: ${currentSalaId}`);
console.log(`🔗 API Base: ${API_BASE_URL || '(raiz)'}`);
console.log(`🔌 WS Alvo: ${WS_URL}`);

// --- VARIÁVEIS DE CONEXÃO (Mantidas) ---
let socket = null;
let reconnectInterval = null;
let countdownInterval = null;
let houveGanhadorNaSessao = false;
const RECONNECT_DELAY = 2000;

// =========================================================
// === ROTINA APRIMORADA: BUFFER COM RETRY E TRAVA ===
// =========================================================
async function processarMatrizEnvio() {
    
    // 1. TRAVA DE SEGURANÇA
    // Se a fila está vazia OU se já estamos tentando enviar algo, paramos.
    if (matrizEnvio.length === 0 || isEnviando) return;

    // Pega o primeiro da fila (sem remover ainda!)
    const item = matrizEnvio[0]; 
    
    // 2. CÁLCULO DO DELAY DINÂMICO
    // Permite mudar o delay no meio do jogo e afetar as bolas que já estão na fila
    const delayConfigurado = (typeof aguardandoVideo !== 'undefined') ? aguardandoVideo : 0;
    const delayAplicavel = (modoSorteio === 'manual') ? delayConfigurado : 0;

    // Verifica se já "cozinhou" o tempo suficiente
    const tempoDecorrido = Date.now() - item.hora;
    
    // debug opcional (cuidado com flood no console)
    // console.log(`[BUFFER] Item: ${item.valor} | Espera: ${tempoDecorrido}/${delayAplicavel}ms`);

    if (tempoDecorrido >= delayAplicavel) {
        
        // 3. ATIVA A TRAVA
        isEnviando = true;

        try {
            console.log(`[SYNC] 🚀 Enviando item retido há ${(tempoDecorrido/1000).toFixed(1)}s:`, item.tipo);

            let urlEndpoint = '';
            let bodyData = {};

            // Mapeamento dos tipos para configurar a requisição
            switch (item.tipo) {
                case 'BOLA_CLIENTE':
                    //  <<  Ajuste Sincronismo Vídeo 
                    let segundosDesdeOInicio = 0;
                    if (modoSorteio === 'manual' && tempoInicioTransmissao > 0) { 
                       segundosDesdeOInicio = (Date.now() - tempoInicioTransmissao) / 1000;
                    }
                    urlEndpoint = `${API_BASE_URL}/api/admin/publicar_bola`;
                    bodyData = { 
                        bola: item.valor,
                        tempo_video: segundosDesdeOInicio
                    };
                    break;
                case 'PREMIO_CLIENTE':
                    urlEndpoint = `${API_BASE_URL}/api/admin/definir_premio_publico`;
                    bodyData = { premio: item.valor };
                    break;
                case 'LIMPAR_PUBLICO':            
                    urlEndpoint = `${API_BASE_URL}/api/admin/limpar_conferencia_publica`;
                    bodyData = {}; // Body vazio pode ser necessário dependendo do backend
                    break;
                default:
                    console.warn("Tipo desconhecido na matriz, removendo...", item.tipo);
                    matrizEnvio.shift();
                    isEnviando = false;
                    return;
            }

            // 4. EXECUÇÃO DO ENVIO (COM AWAIT REAL)
            const response = await fetch(urlEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            if (response.ok) {
                // ✅ SUCESSO: Agora sim podemos remover da fila
                matrizEnvio.shift(); 
                
                // Feedback visual para o Admin (Opcional: atualizar contador de fila)
                atualizarIndicadorFila(matrizEnvio.length);
            } else {
                // ⚠️ FALHA DO SERVIDOR (500, 404)
                // Não removemos da fila! Ele tentará de novo em 100ms.
                console.error(`[SYNC] Erro servidor ${response.status}. Tentando novamente...`);
            }

        } catch (erroRede) {
            // ❌ FALHA DE REDE (Sem internet)
            // Não removemos da fila. O sistema fica tentando até a internet voltar.
            console.error(`[SYNC] Erro de Rede: ${erroRede.message}. Retentando...`);
        } finally {
            // 5. LIBERA A TRAVA (Sempre, mesmo com erro)
            isEnviando = false;
        }
    }
}

// Função auxiliar para mostrar ao locutor que tem coisas pendentes
function atualizarIndicadorFila(qtd) {
    const el = document.getElementById('indicador-fila-sync');
    if (el) {
        el.innerText = qtd > 0 ? `⏳ Sincronizando: ${qtd}` : "✅ Sincronizado";
        el.style.color = qtd > 0 ? "orange" : "lightgreen";
    }
}


// =========================================================
// === 1. LÓGICA DO ROBÔ (AUTOMATIZAÇÃO) ===
// =========================================================

async function iniciarModoRobo() {
    if (modoRoboAtivo) return;
    modoRoboAtivo = true;
    bloquearInterface(true);
    console.log("🤖 MODO ROBÔ INICIADO");
    customAlert("🤖 O Sorteio Automatizado foi iniciado!", "Modo Robô Ativo",5);
    if (!autoSorteioAtivo) toggleAutoSorteio(true); 
}

function pararModoRobo() {
    if (!modoRoboAtivo) return;
    modoRoboAtivo = false;
    processandoVitoria = false;
    bloquearInterface(false);
    console.log("🤖 MODO ROBÔ PARADO");
    if (autoSorteioAtivo) pararAutoSorteio();
    customAlert("O Sorteio Automatizado foi pausado manualmente.", "Robô Pausado");
}

function bloquearInterface(bloquear) {
    const ids = ['admin-side-menu', 'btn-f1-buscar', 'container-entrada-manual', 'input-tempo-auto'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            if(bloquear) el.classList.add('robo-lock');
            else el.classList.remove('robo-lock');
        }
    });
    const header = document.querySelector('header h1');
    if(header) {
        if(bloquear) header.classList.add('robo-lock');
        else header.classList.remove('robo-lock');
    }

    const btnAuto = document.getElementById('btn-auto-toggle');
    if (btnAuto) {
        if (bloquear) btnAuto.classList.add('robo-unlock');
        else btnAuto.classList.remove('robo-unlock');
    }
}

async function gerenciarVitoriaRobo(ganhadores) {
    if (autoSorteioAtivo) pararAutoSorteio();

// 2. O SEMÁFORO 🚦 (Prioridade para Sorte Extra)
    if (filaSorteExtra.length > 0 || processandoFilaExtra) {
        console.log("✋ [PRIORIDADE] Sorte Extra em andamento. Colocando LINHA/BINGO na fila de espera.");
        
        premioPrincipalPendente = ganhadores; 
        
        return; // Sai da função e deixa a Sorte Extra brilhar
    }


    if (processandoVitoria) return; 
    processandoVitoria = true;
    console.log("🤖 Robô detectou vitória!", ganhadores);

    // tempo ganhador na tela
    let tempoEspera = tempoEsperaConferenciaRobo;  // parseInt(document.getElementById('config-winner-time').value) || 5;
    
    for (const g of ganhadores) {
        const cartela = g.cartela;
        console.log(`🤖 Apresentando cartela ${cartela}...`);
        abrirSessaoAuditoria(true); 
        const input = document.getElementById('input-auditoria');
        if(input) {
            input.value = cartela;
            await validarCartelaAuditoria(); 
        }
        await new Promise(r => setTimeout(r, tempoEspera * 1000));
        await confirmarGanhadorAtual();
        await encerrarSessaoConferencia(true); 
        await new Promise(r => setTimeout(r, 2000));
    }
    await decidirProximoPassoRobo();
    processandoVitoria = false;
}

async function decidirProximoPassoRobo() {
    let info = null;
    cartelasPendentesAuditoria = [];
    idsConfirmadosNestaRodada.clear();
    try {
        const resp = await fetch(`${API_BASE_URL}/api/initial-data`);
        const data = await resp.json();
        info = data.buscandoMesaData[0];
    } catch (e) { console.error("Erro check robo", e); }

    if (!info) return;

    if (info.buscando_o_premio === 'LINHA' && info.buscando_a_linha && info.buscando_a_linha.length > 0) {
        console.log("🤖 Ainda faltam linhas. Retomando sorteio...");
        toggleAutoSorteio(true); 
        return;
    }

    const ordem = ['QUADRA', 'LINHA', 'FALTAUM', 'BINGO', 'DUPLO BINGO'];
    let atualKey = info.buscando_o_premio;
    if (atualKey === 'FALTA 1') atualKey = 'FALTAUM';
    if (atualKey === '3 LINHAS') atualKey = 'LINHA';
    
    const indexAtual = ordem.indexOf(atualKey);
    let proximoKey = null;

    if (dadosEventoAtual && dadosEventoAtual.premios) {
        for (let i = indexAtual + 1; i < ordem.length; i++) {
            const keyTeste = ordem[i];
            let keyDados = keyTeste.toLowerCase();
            if (keyTeste === 'FALTAUM') keyDados = 'falta_um';
            if (keyTeste === 'DUPLO BINGO') keyDados = 'segundo_bingo';
            
            if (parseFloat(dadosEventoAtual.premios[keyDados] || 0) > 0) {
                proximoKey = keyTeste;
                break;
            }
        }
    }

    if (proximoKey) {
        console.log(`🤖 Robô mudando prêmio para: ${proximoKey}`);
        await mudarPremio(proximoKey);
        await new Promise(r => setTimeout(r, 3000));
        toggleAutoSorteio(true);
    } else {
        console.log("🤖 Fim dos prêmios. Resetando...");
        alternarBotaoReset('finalizar');
        await new Promise(r => setTimeout(r, 3000));
        if (autoSorteioAtivo) pararAutoSorteio();
        // coloquei aqui
        jogoFoiFinalizadoComSucesso = true;
        jogoRoboFinalizadoComSucesso = true; 
        await resetarJogo(); 
    }
}

// =========================================================
// === FUNÇÕES GLOBAIS DE LOADING (NOVO) ===
// =========================================================
let ganhadoresPendentesCache = [];

function renderListaPendentes(lista) {
    const container = document.getElementById('lista-pendentes-contemplados');
    if (!container) return;

    container.innerHTML = '';

    if (!lista || lista.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-xs py-4 text-center italic col-span-3">Nenhuma cartela aguardando conferência.</div>';
        return;
    }

    container.className = "grid grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar";

    lista.forEach(item => {
        const btn = document.createElement('button');
        btn.className = "flex flex-col items-center justify-center p-2 rounded bg-blue-900/40 hover:bg-blue-600 text-white border border-blue-500/50 transition-all shadow-sm";
        btn.innerHTML = `
            <span class="font-black text-lg text-yellow-400 leading-none">${item.cartela}</span>
            <span class="text-[9px] font-bold bg-blue-700 px-1 mt-1 rounded uppercase">${item.premio}</span>
        `;
        btn.onclick = () => {
            document.getElementById('input-auditoria').value = item.cartela;
            validarCartelaAuditoria();
        };
        container.appendChild(btn);
    });
}

function preencherCartelaEValidar(cartela) {
    const input = document.getElementById('input-auditoria');
    input.value = cartela;
    validarCartelaAuditoria();
}

// Variáveis de controle (globais ou no escopo do arquivo)
let loopConferencia = null;
let tentativasIntegridade = 0;
let ultimaCartelaAuditada = "";
function renderGridConferencia(data) {
    const grid = document.getElementById('conf-grid');
    if (!grid) return;

    // 1. LIMPEZA INICIAL
    // Se for uma nova cartela, reseta contadores
    const inputAuditoria = document.getElementById('input-auditoria');
    const cartelaAtualId = inputAuditoria ? inputAuditoria.value : "desconhecida";

    if (cartelaAtualId !== ultimaCartelaAuditada) {
        tentativasIntegridade = 0;
        ultimaCartelaAuditada = cartelaAtualId;
    }

    // --- 2. VALIDAÇÃO DOS DADOS BRUTOS ---
    if (!data || !data.layout) {
        exibirMensagemValidacao(grid, "Buscando dados no servidor...");
        recarregarConferencia();
        return;
    }

    // Identifica o tipo de jogo
    let tipoJogo = data.layout.tipo;   // ttt
    if (!tipoJogo) {
       if (data.layout.superior || data.layout.central || data.layout.inferior) {
            tipoJogo = 90;
            MAX_BOLAS = 90;
        } else {
            // Caso contrário (mesmo se vier vazio ou zero), assumimos que é BINGO 75 (O seu padrão).
            tipoJogo = 75;
            MAX_BOLAS = 75;
        }
    }

    // Extrai os números recebidos
    let numerosDaCartela = [];
    if (tipoJogo === 75) {
        numerosDaCartela = data.layout?.lista || [];
    } else {
        numerosDaCartela = (data.layout?.superior || [])
                            .concat(data.layout?.central || [])
                            .concat(data.layout?.inferior || []);
    }

    // --- 3. A REGRA DE OURO (TOLERÂNCIA ZERO) ---
    const tamanhoEsperado = (tipoJogo === 90) ? 15 : 25;

    if (numerosDaCartela.length !== tamanhoEsperado) {
        console.warn(`⚠️ Pacote incompleto! Esperado: ${tamanhoEsperado}, Recebido: ${numerosDaCartela.length}. Rejeitando visualização.`);
        
        tentativasIntegridade++;
        
        // MOSTRA TELA DE "VALIDANDO" (Passa confiança ao invés de erro)
        grid.innerHTML = `
            <div class="flex flex-col items-center justify-center h-48 w-full border border-yellow-600 bg-gray-900 rounded-lg p-4 shadow-lg">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500 mb-3"></div>
                <h3 class="text-yellow-500 font-bold text-lg uppercase tracking-widest">Validando Integridade</h3>
                <p class="text-gray-400 text-xs mt-2 text-center">Conferindo hash de segurança da cartela...</p>
                <p class="text-gray-600 text-[10px] mt-1">Tentativa de validação: ${tentativasIntegridade}</p>
            </div>
        `;

        // Tenta buscar novamente em 500ms (Rápido o suficiente para não travar, lento o suficiente para a rede recuperar)
        recarregarConferencia();
        return; // ABORTA: Não desenha nada errado.
    }

    // --- 4. SE CHEGOU AQUI, A CARTELA ESTÁ 100% PERFEITA ---
    tentativasIntegridade = 0; // Sucesso, zera contador
    grid.innerHTML = ''; // Limpa o loading

    const bolas = (data.bolas || bolasSorteadasCache || []).map(String);
    const ultimaBola = A_Ultima_Bola;

    // >>> RENDERIZAÇÃO BINGO 75 (Perfeita)
    if (tipoJogo === 75) { 
        grid.className = "grid grid-cols-5 gap-1 bg-black p-2 rounded border border-gray-600 w-full max-w-[300px] mx-auto shadow-2xl";
        
        for (let linha = 0; linha < 5; linha++) {
            for (let coluna = 0; coluna < 5; coluna++) {
                
                // Índice Transposto (Mantido seu padrão)
                const index = (coluna * 5) + linha; 
                const num = numerosDaCartela[index]; // AQUI TEM CERTEZA QUE EXISTE

                const cell = document.createElement('div');
                const isFree = false; //(index === 12); 
                
                // Tratamento seguro do valor  zzz
                const valorDisplay = (num !== undefined && num !== null) ? num : '';
                
                let marcado = bolas.includes(String(valorDisplay));
                if (isFree && (valorDisplay == 0 || valorDisplay == '0' || valorDisplay == '')) marcado = true;

                const isLast = !isFree && (parseInt(valorDisplay) === ultimaBola);
                
                let cssClass = "h-10 w-full flex items-center justify-center font-bold text-sm rounded border transition-all duration-300 ";
                
                if (isFree) {
                    cell.textContent = "★"; 
                    cssClass += "bg-green-800 text-yellow-300 border-green-600 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]";
                } else {
                    cell.textContent = valorDisplay;

                    if (isLast) {
                        cssClass += "bg-orange-600 text-white border-white animate-pulse scale-110 z-20 shadow-[0_0_15px_rgba(255,100,0,0.8)]";
                    } 
                    else if (marcado) {
                        cssClass += "bg-yellow-500 text-black border-yellow-300 shadow-md transform scale-105";
                    } 
                    else {
                        cssClass += "bg-gray-800 text-gray-200 border-gray-600";
                    }
                }
                cell.className = cssClass;
                grid.appendChild(cell);
            }
        }
    } 
    // >>> RENDERIZAÇÃO BINGO 90 (Perfeita)
    else if (tipoJogo === 90) {
        grid.className = "flex flex-col gap-2 bg-black p-2 rounded border border-gray-600 w-full shadow-2xl";
        
        const linhas = [data.layout.superior, data.layout.central, data.layout.inferior];
        linhas.forEach(linha => {
            const row = document.createElement('div'); 
            row.className = "flex justify-between gap-1";
            linha.forEach(num => { 
                const cell = document.createElement('div');
                const isLast = (String(num) === String(ultimaBola));
                const marcado = bolas.includes(String(num));
                
                let cssClass = "w-full h-10 flex items-center justify-center font-bold text-lg rounded border transition-all duration-300 ";

                if (isLast) {
                    cssClass += "bg-orange-600 text-white border-white animate-pulse scale-110 z-20 shadow-lg";
                } else if (marcado) {
                    cssClass += "bg-yellow-500 text-black border-yellow-300 transform scale-105";
                } else {
                    cssClass += "bg-gray-800 text-gray-300 border-gray-600";
                }

                cell.className = cssClass;
                cell.textContent = num;
                row.appendChild(cell);
            });
            grid.appendChild(row);
        });
    }
}

// Função auxiliar para recarregar sem travar o navegador
function recarregarConferencia() {
    if (loopConferencia) clearTimeout(loopConferencia);
    loopConferencia = setTimeout(() => {
        console.log("🔄 Tentando buscar cartela novamente...");
        if (typeof validarCartelaAuditoria === 'function') {
            validarCartelaAuditoria();
        }
    }, 600); // 600ms de intervalo entre tentativas
}

function exibirMensagemValidacao(grid, msg) {
    grid.innerHTML = `<div class="text-yellow-500 text-xs p-4 text-center animate-pulse">${msg}</div>`;
}

function showLoading(mensagem = "Processando...") {
    const overlay = document.getElementById('loading-overlay');
    const msgEl = document.getElementById('loading-message');
    if (overlay && msgEl) {
        msgEl.textContent = mensagem;
        overlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    }
}


// =========================================================
// === 2. SISTEMA DE CONEXÃO & WEBSOCKET ===
// =========================================================
// --- SUA FUNÇÃO (Com leve proteção para não resetar o timer toa hora) ---
function gerenciarEstadoConexao(online) {
    const overlay = document.getElementById('overlay-conexao');
    const countdownSpan = document.getElementById('countdown-connection');
    
    if (online) {
        // VOLTOU! Esconde tudo e vida que segue
        if(overlay) overlay.classList.add('hidden');
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = null; // Limpa a referência
        
        // Atualiza a tela sem recarregar a página (Soft Update)
        carregarDadosIniciaisSilencioso(); 
    } else {
        // CAIU!
        if(overlay && overlay.classList.contains('hidden')) {
            // Só entra aqui se for a PRIMEIRA vez que cai (para não resetar o timer a cada loop)
            overlay.classList.remove('hidden');
            if (typeof modoRoboAtivo !== 'undefined' && modoRoboAtivo) pararModoRobo();
            
            let count = RECONNECT_DELAY / 1000;
            if(countdownSpan) countdownSpan.textContent = count;
            
            if (countdownInterval) clearInterval(countdownInterval);
            
            // Inicia a contagem visual
            countdownInterval = setInterval(() => {
                count--; 
                if(count <= 0) count = RECONNECT_DELAY / 1000;
                if(countdownSpan) countdownSpan.textContent = count;
            }, 1000);
        }
    }
}

// --- A NOVA FUNÇÃO DO BOTÃO (Manual) ---
function tentarReconexaoManual() {
    const btn = document.getElementById('btn-reconnect');
    const textoOriginal = btn.innerText;

    // 1. Feedback visual para o usuário não clicar 50 vezes
    btn.innerText = "⏳ Testando...";
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    console.log("👆 Tentativa manual iniciada...");

    // 2. Define a URL (Dinâmica, como fizemos antes)
    const urlBase = window.location.origin; // Pega https://seu-app.digitalocean...
    const url = `${urlBase}/api/estado_atual`; // Rota leve só para testar

    // 3. Tenta buscar
    fetch(url)
        .then(res => {
            if (res.ok) {
                console.log("✅ Conexão voltou!");
                // Chama sua função passando TRUE para esconder a tela vermelha
                gerenciarEstadoConexao(true);
            } else {
                throw new Error("Servidor respondeu com erro");
            }
        })
        .catch(err => {
            console.log("❌ Ainda sem conexão.");
            // Se falhar, reseta o botão para o usuário tentar de novo depois
        })
        .finally(() => {
            // Sempre restaura o botão (dando certo ou errado)
            btn.innerText = textoOriginal;
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        });
}

// =========================================================
// === CONEXÃO WEBSOCKET (MODO SILENCIOSO) ===
// =========================================================
function connectAdminWS() { // Use o nome que você já está chamando no final do arquivo
    if (socket) {
        // Se já existe e está conectando ou aberto, não faz nada
        if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) return;
        socket.close();
    }

    console.log(`🔌 [WS] Tentando conectar em: ${WS_URL}`);
    socket = new WebSocket(WS_URL);

    socket.onopen = function() {
        console.log("✅ [WS] Conectado!");
        // O "Locutor Rei" NÃO pede dados ao reconectar.
        // Ele confia no que já está na tela.
        // Apenas registramos a presença na sala.
        socket.send(JSON.stringify({ type: 'REGISTER_ADMIN', sala_id: currentSalaId }));
        
        // Remove aviso de desconexão se existir
        const overlay = document.getElementById('overlay-conexao');
        if(overlay) overlay.classList.add('hidden');
    };

    socket.onmessage = processarMensagemWS; // Usa a função Híbrida que criamos antes

    socket.onclose = function(e) {
        console.warn(`⚠️ [WS] Fechado (Cod: ${e.code}). Reconectando em 3s...`);
        
        // NÃO CHAMAMOS carregarConfigSorteExtraAdmin AQUI!
        // Apenas agendamos a reconexão do socket.
        
        if (!reconnectInterval) {
            reconnectInterval = setTimeout(() => {
                reconnectInterval = null;
                connectAdminWS();
            }, 3000);
        }
    };

    socket.onerror = function(err) {
        console.error("❌ [WS] Erro:", err);
        socket.close();
    };
}

function agendarReconexao() {
    if (reconnectInterval) clearTimeout(reconnectInterval);
    reconnectInterval = setTimeout(connectAdminWS, RECONNECT_DELAY);
}

async function carregarDadosIniciaisSilencioso() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/initial-data`);
        const data = await response.json();

        if (data.parametrosInfo) {
            aguardandoVideo = parseInt(data.parametrosInfo.aguardandoVideo) || 0;
            const elDelay = document.getElementById('config-atraso-video');
            if(elDelay) elDelay.value = aguardandoVideo; // Adicionei verificação de null aqui
            vozAtiva = data.parametrosInfo.voz_ativa !== undefined ? data.parametrosInfo.voz_ativa : true;
            enviarPortaSerial = data.parametrosInfo.enviar_porta_serial !== undefined ? data.parametrosInfo.enviar_porta_serial : false;
            buscarSorteExtra =  data.parametrosInfo.buscar_sorte_extra !== undefined ? data.parametrosInfo.buscar_sorte_extra : true;
            const chkExtra = document.getElementById('chk-buscar-sorte-extra');
            if (chkExtra) {
                chkExtra.checked = buscarSorteExtra;
            }

            sorteioAutomatizadoConfig = data.parametrosInfo.sorteio_automatizado !== undefined ? data.parametrosInfo.sorteio_automatizado : false;
            const chkSorteioAutomatizado = document.getElementById('config-sorteio-automatizado');
            if (chkSorteioAutomatizado) {
                chkSorteioAutomatizado.checked = sorteioAutomatizadoConfig;
            }

        }

        if (!dadosEventoAtual && data.rodadaData && data.rodadaData.length > 0) {
            const rodada = data.rodadaData[0];
            if (rodada.id_evento && rodada.id_evento !== "0") {
                const idEventoInt = parseInt(rodada.id_evento);
                console.log(`♻️ [RECUPERAÇÃO] Restaurando ID do evento após F5: ${rodada.id_evento}`);
                
                // --- CORREÇÃO AQUI ---
                // Criamos 'id' E 'id_evento' para garantir compatibilidade
                dadosEventoAtual = { 
                    id: idEventoInt,        // <--- O 'carregarConfig' busca por .id
                    id_evento: idEventoInt, // <--- Mantém para outras partes do sistema
                    descricao: 'Evento Recuperado' 
                };
                id_evento_ativo = idEventoInt;
            }
        }

        // Agora verificamos se existe id OU id_evento
        if (dadosEventoAtual && (dadosEventoAtual.id || dadosEventoAtual.id_evento)) {
             // Garante que o ID esteja setado corretamente caso tenha vindo só com id_evento
             
             if(!dadosEventoAtual.id) dadosEventoAtual.id = dadosEventoAtual.id_evento;
             await carregarConfigSorteExtraAdmin(dadosEventoAtual.id);
        }

        if (data.evento && parseInt(data.evento.tipo_sorteio) === 25) {
            MAX_BOLAS = 75;
        } else {
            MAX_BOLAS = 90;
        }

        // Verifica se o grid existe antes de contar
        const bolasNaTela = document.querySelectorAll('[id^="admin-ball-"]');
        const totalBolasNaTela = bolasNaTela.length;
        
        if (totalBolasNaTela !== MAX_BOLAS) {
            initGrid(); 
        }

        // Tenta pegar primeiro da Mesa, depois do Público
        let listaBolasInit = [];
        if (data.bolasMesaData && data.bolasMesaData.length > 0) {
            listaBolasInit = data.bolasMesaData[0].bolas_cantadas || [];
        } else if (data.bolasData && data.bolasData.length > 0) {
            listaBolasInit = data.bolasData[0].bolas_cantadas || [];
        }

        if(listaBolasInit.length > 0) {
             bolasSorteadasCache = listaBolasInit;
             updateGrid(bolasSorteadasCache);
        }

        if (dadosEventoAtual && (dadosEventoAtual.id || dadosEventoAtual.id_evento)) {
            const painel = document.getElementById('painel-evento-ativo');
            
            if (painel && painel.classList.contains('hidden')) {
                console.log("🔓 [FIX] Forçando exibição do Painel de Evento Ativo.");
                painel.classList.remove('hidden');
                
                // Se estivermos em modo "Mesa", talvez seja bom esconder a seleção de eventos
                const modalSelecao = document.getElementById('painel-selecao-eventos'); // Ajuste conforme seu ID
                if(modalSelecao) modalSelecao.classList.add('hidden');
            }
        }

    } catch(e) {
        console.error("Erro no carregamento silencioso:", e);
    }
}

// =========================================================
// === PROCESSADOR HÍBRIDO (75/90) COM RANKING E GANHADORES ===
// =========================================================
function processarMensagemWS(event) {
    try {
        const payload = JSON.parse(event.data);

        // 1. Ignora PING
        if (payload.type === 'PING') return;

        // 2. Comandos de Reset (Obedece sempre)
        if (payload.type === 'RESET_RODADA' || payload.type === 'LIMPAR_TUDO') {
            window.location.reload();
            return;
        }

        // 3. BLOCO UPDATE (Onde chega o Ranking)
        if (payload.type === 'UPDATE') {
            
            // --- PARTE A: AS BOLAS (BLOQUEADO PARA NÃO PISCAR) ---
            /* if (payload.bolasMesaData || payload.bolasData) {
                // Não atualizamos o grid aqui porque o Locutor já desenhou.
            }
            */

            // --- PARTE B: RANKING / TOP 10 (ATIVO!) ---
            if (payload.melhoresData) {
                let tipoPremioBuscado = "BINGO";
                if (payload.buscandoMesaData && payload.buscandoMesaData[0]) {
                    tipoPremioBuscado = payload.buscandoMesaData[0].buscando_o_premio;
                }
                
                // CHAMA A FUNÇÃO QUE DESENHA O RANKING NA TELA
                if (typeof renderRanking === 'function') {
                    renderRanking(payload.melhoresData, tipoPremioBuscado);
                }

                // --- DETECÇÃO DE GANHADORES (PARA PAUSAR O ROBÔ/LOCUTOR) ---
                verificarVitoriaPeloRanking(payload.melhoresData);
            }

            // --- PARTE C: STATUS DO PRÊMIO (TEXTO "BUSCANDO LINHA...") ---
            if (payload.buscandoMesaData && payload.buscandoMesaData.length > 0) {
                const dados = payload.buscandoMesaData[0];
                let premio = dados?.buscando_o_premio || '...';
                if (MAX_BOLAS === 75 && premio === 'QUADRA') premio = '4 CANTOS';
                
                const elTitulo = document.getElementById('premio-atual'); 
                if (elTitulo) elTitulo.textContent = premio;
            }
            if (payload.parametrosInfo) {
                if (!configuracaoServer || Object.keys(configuracaoServer).length === 0) {
                    configuracaoServer = payload.parametrosInfo;
                    if (configuracaoServer.sorteio_automatizado !== undefined) {
                        sorteioAutomatizadoConfig = configuracaoServer.sorteio_automatizado;
                    }
            
                    if (configuracaoServer.aguardandoVideo !== undefined) {
                        aguardandoVideo = parseInt(configuracaoServer.aguardandoVideo) || 0; 
                    }

                    if (configuracaoServer.voz_ativa !== undefined) {
                        vozAtiva = configuracaoServer.voz_ativa;
                    }

                    if (configuracaoServer.enviar_porta_serial !== undefined) {
                        enviarPortaSerial = configuracaoServer.enviar_porta_serial;
                    }

                    if (configuracaoServer.modo_sorteio) {
                        modoSorteio = configuracaoServer.modo_sorteio;
                        if (typeof aplicarVisualModoSorteio === 'function') {
                            aplicarVisualModoSorteio(modoSorteio);
                        }
                    }
            
                    const modal = document.getElementById('modal-config');
                    if (modal && modal.classList.contains('hidden') && typeof preencherModalConfig === 'function') {
                        preencherModalConfig(configuracaoServer);
                    }
                }
            }

        }

    } catch (e) {
        console.error("Erro no processamento do WS:", e);
    }
}

function verificarVitoriaPeloRanking(listaMelhores) {
    // 1. Definimos as paradas e termos de vitória conforme o tipo de jogo
    let paradasObrigatorias = [];
    let termosVitoria = [];

    if (!listaMelhores || listaMelhores.length === 0) {
        jaAlertouNestaBola = false;
        return;
    }

    if (MAX_BOLAS === 75) {
        paradasObrigatorias = ['QUADRA', 'LINHA', 'BINGO', 'DUPLO BINGO', '4 CANTOS', '4 CANTOS E LINHA'];
        termosVitoria = ['BINGO', 'LINHA', 'QUADRA', '4 CANTOS', '4 CANTOS E LINHA'];
    } else {
        paradasObrigatorias = ['QUADRA', 'LINHA', 'FALTA UM', 'BINGO', 'DUPLO BINGO'];
        termosVitoria = ['BINGO', 'LINHA', 'QUADRA', 'FALTA 1', 'FALTA UM', 'DUPLO BINGO'];
    }

    // 2. Filtramos os ganhadores reais vindos do servidor
    const ganhadoresEncontrados = listaMelhores.filter(item => {
        const statusPremio = (item.premio && item.premio !== "null") ? item.premio.toUpperCase() : "";
        // Verifica se o status enviado pelo server bate com nossos termos de vitória
        return termosVitoria.some(termo => statusPremio.includes(termo));
    });

    // 3. Se houver ganhadores e ainda não alertamos nesta bola
    if (ganhadoresEncontrados.length > 0 && !jaAlertouNestaBola) {
        
        // PARA O SORTEIO IMEDIATAMENTE (Modo Rei assume o controle)
        if (autoSorteioAtivo) {
            pararAutoSorteio();
        }
        
        // --- ALIMENTA A LISTA DE AUDITORIA LOCAL ---
        // Isso resolve o problema de a tela de conferência aparecer vazia
        cartelasPendentesAuditoria = ganhadoresEncontrados.map(g => ({
            cartela: String(g.cartela).trim(),
            nome: (g.nome === "null" || !g.nome) ? "Balcão" : g.nome,
            premio: g.premio
        }));

        console.log("🏆 Vitória detectada! Cartelas para conferência:", cartelasPendentesAuditoria);

        // Dispara o alerta visual para o locutor
        if (!modoRoboAtivo) {  
            customAlert("🏆 ALERTA DE PREMIAÇÃO! Verifique os ganhadores.");
        } else {                                  // <<< ajustando aquiiii
            if (!processandoVitoria) {
                processandoVitoria = true; 
                console.log("⏳ Aguardando sincronização visual dos terminais (4s)...");
                setTimeout(() => {
                    processandoVitoria = false; 
                    gerenciarVitoriaRobo(ganhadoresEncontrados);
                }, 4000);   // aqui esta o tempo
            }
        } 
        jaAlertouNestaBola = true;
    }
}


// =========================================================
// === 3. FUNÇÕES UI E MODAIS ===
// =========================================================
function customAlert(mensagem, titulo = "⚠️ Atenção", tempo = 0) {
    return new Promise((resolve) => {
        modalTitle.textContent = titulo;
        modalTitle.className = "text-xl text-yellow-500 mb-1 uppercase tracking-wide";
        modalMessage.innerText = mensagem; 
        modalActions.innerHTML = '';
        
        const btnOk = document.createElement('button');
        btnOk.className = "bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg";
        
        if (tempo > 0) {
            btnOk.textContent = `OK (${tempo}s)`;
        } else {
            btnOk.textContent = "OK";
        }

        let timerId = null;

        const fechar = () => {
            if (timerId) clearTimeout(timerId); 
            fecharCustomModal(); 
            resolve(); 
        };

        btnOk.onclick = fechar;
        
        modalActions.appendChild(btnOk);
        abrirCustomModal();
        btnOk.focus();

        if (tempo > 0) {
            timerId = setTimeout(fechar, tempo * 1000); 
        }
    });
}

function customConfirm(mensagem, titulo = "❓ Confirmação") {
    return new Promise((resolve) => {
        modalTitle.textContent = titulo;
        modalMessage.innerText = mensagem;
        modalActions.innerHTML = '';
        const btnCancel = document.createElement('button');
        btnCancel.className = "bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg";
        btnCancel.textContent = "Cancelar";
        btnCancel.onclick = () => { fecharCustomModal(); resolve(false); };
        const btnConfirm = document.createElement('button');
        btnConfirm.className = "bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg";
        btnConfirm.textContent = "Confirmar";
        btnConfirm.onclick = () => { fecharCustomModal(); resolve(true); };
        modalActions.appendChild(btnCancel);
        modalActions.appendChild(btnConfirm);
        abrirCustomModal();
        btnConfirm.focus();
    });
}

function abrirCustomModal() {
    modalOverlay.classList.remove('hidden');
    setTimeout(() => { modalOverlay.classList.add('modal-show'); modalBox.classList.add('modal-box-show'); }, 10);
}

function fecharCustomModal() {
    modalOverlay.classList.remove('modal-show'); modalBox.classList.remove('modal-box-show');
    setTimeout(() => { modalOverlay.classList.add('hidden'); }, 200);
}

// =========================================================
// === FUNÇÃO DE MENU LATERAL (ADICIONE NO ADMIN.JS) ===
// =========================================================
function toggleAdminMenu() {
    const menu = document.getElementById('admin-side-menu');
    const overlay = document.getElementById('admin-menu-overlay');
    
    if (!menu || !overlay) return;

    const isClosed = menu.classList.contains('-translate-x-full');
    
    if (isClosed) { 
        menu.classList.remove('-translate-x-full'); 
        overlay.classList.remove('hidden'); 
    } else { 
        menu.classList.add('-translate-x-full'); 
        overlay.classList.add('hidden'); 
    }
}

function alternarTelaCheia() {
    const btnText = document.getElementById('btn-fullscreen-text');
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => { btnText.textContent = "Sair de Tela Cheia"; });
    } else {
        if (document.exitFullscreen) { document.exitFullscreen().then(() => { btnText.textContent = "Entrar em Tela Cheia"; }); }
    }
    toggleAdminMenu();
}

function fecharModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

async function abrirModalEventos() {
    const contadorTexto = document.getElementById('contador-bolas').textContent;
    const numeroBolas = parseInt(contadorTexto.split('/')[0]); 
    if (numeroBolas > 0) {
        customAlert("⚠️ ATENÇÃO: Jogo em andamento.\nRESET o jogo antes de trocar de evento.");
        toggleAdminMenu(); return;
    }

    const modal = document.getElementById('modal-eventos');
    const container = document.getElementById('lista-eventos-container');
    
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
    }
    
    container.innerHTML = '<div class="flex flex-col items-center py-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mb-2"></div><span class="text-gray-400">Buscando agenda atualizada...</span></div>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/proximos_eventos?_t=${Date.now()}`);
        const eventos = await response.json();
        renderizarListaEventos(eventos);
    } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="text-center text-red-400 p-4"><p>Erro ao carregar eventos</p><button onclick="abrirModalEventos()" class="mt-2 bg-gray-700 px-3 py-1 rounded text-xs">Tentar Novamente</button></div>`;
    }
}

function renderizarListaEventos(eventos) {
    const container = document.getElementById('lista-eventos-container');
    container.innerHTML = '';
    if (!eventos || eventos.length === 0) { container.innerHTML = '<p class="text-center text-gray-500 py-4">Nenhum evento agendado.</p>'; return; }

    eventos.forEach(evt => {
        const isFinalizado = evt.status === 'finalizado';
        const card = document.createElement('div');
        card.className = `p-3 rounded border border-gray-700 flex justify-between items-center transition-all ${isFinalizado ? 'bg-gray-800 opacity-60' : 'bg-gray-700 hover:bg-gray-600 hover:border-green-500 cursor-pointer'}`;
        card.innerHTML = `
            <div>
                <h4 class="font-bold text-yellow-500 text-sm">${evt.descricao}</h4>
                <div class="text-xs text-gray-300 flex gap-2 mt-1">
                    <span>📅 ${evt.data || 'Data N/D'}</span>
                    <span>⏰ ${evt.hora || '--:--'}</span>
                    <span class="uppercase font-bold text-blue-300">[${evt.status}]</span>
                </div>
            </div>
            <button onclick="carregarEvento('${evt.id_evento}')" class="px-4 py-3 rounded text-xs font-bold ${isFinalizado ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-700 text-white hover:bg-green-600 shadow'}">
                ${isFinalizado ? 'ENCERRADO' : 'CARREGAR'}
            </button>
        `;
        container.appendChild(card);
    });
}

async function carregarParametrosDoBanco() {
    console.log("📡 [API] Buscando parâmetros oficiais do banco...");
    try {                                              
        const response = await fetch(`${API_BASE_URL}/api/admin/get_config`);
        if (!response.ok) throw new Error("Erro na resposta da rede");
        
        const dados = await response.json();
        
        // Atualiza a global e os tipos
        configuracaoServer = dados;
        if (dados.qtde_tope) qtdeTopeSorteExtra = parseInt(dados.qtde_tope);
        if (dados.aguardandoVideo) aguardandoVideo = parseInt(dados.aguardandoVideo);
        
        console.log("✅ [API] Parâmetros sincronizados com sucesso:", configuracaoServer);
        return dados;
    } catch (e) {
        console.error("❌ [API] Falha ao sincronizar parâmetros:", e);
        return null;
    }
}


async function abrirModalConfig() {
    toggleAdminMenu();
    const modal = document.getElementById('modal-config');
    
    // LOG DE DEPURAÇÃO
    console.log("🛠️ Abrindo Modal. Cache atual:", configuracaoServer);

    // SE O CACHE ESTIVER VAZIO, FORÇA A BUSCA NA ROTA NOVA
    //if (!configuracaoServer || Object.keys(configuracaoServer).length === 0) {
        const dadosRecuperados = await carregarParametrosDoBanco();
        if (dadosRecuperados) {
            configuracaoServer = dadosRecuperados;
        }
    //}

    modal.classList.remove('hidden');

    // Preenche o modal com o que temos (seja do cache ou da busca nova)
    if (typeof preencherModalConfig === 'function') {
        preencherModalConfig(configuracaoServer);
    }
}


function preencherModalConfig(params) {
    if (params.tempo_ganhador) document.getElementById('config-winner-time').value = params.tempo_ganhador;
    if (params.voz_ativa !== undefined) document.getElementById('config-voz-ativa').checked = params.voz_ativa;
    if (params.camera_ativa !== undefined) document.getElementById('config-camera-ativa').checked = params.camera_ativa;
    if (params.modo_sorteio) { 
        const radio = document.querySelector(`input[name="modo_sorteio"][value="${params.modo_sorteio}"]`); 
        if (radio) radio.checked = true; 
    }
    if (params.buscar_sorte_extra !== undefined) {
        const chkExtra = document.getElementById('chk-buscar-sorte-extra');
        if (chkExtra) chkExtra.checked = params.buscar_sorte_extra;
    }

    if (params.enviar_porta_serial !== undefined) {
        const chkSerial = document.getElementById('config-enviar-serial');
        if (chkSerial) chkSerial.checked = params.enviar_porta_serial;
    }

    if (params.sorteio_automatizado !== undefined) {
        const chkSorteioAutomatizado = document.getElementById('config-sorteio-automatizado');
        if (chkSorteioAutomatizado) {
            chkSorteioAutomatizado.checked = params.sorteio_automatizado;
        }
    }

    document.getElementById('config-nome-sala').value = params.nome_sala || 'LIVE THE BET';
    document.getElementById('config-url-padrao').value = params.url_padrao || '';
    document.getElementById('config-url-live').value = params.url_live || '';
    document.getElementById('config-url-mongo').value = params.url_mongo_vendas || '';
    document.getElementById('config-atraso-video').value = params.aguardandoVideo;
 
    if (params.tipo_sorteio) document.getElementById('config-tipo-sorteio').value = params.tipo_sorteio;
    const selectEntrada = document.getElementById('config-entrada-cartelas');
    if (params.tipo_entrada_de_cartelas && selectEntrada) selectEntrada.value = params.tipo_entrada_de_cartelas;
    if (params.sorteio_automatizado !== undefined) document.getElementById('config-sorteio-automatizado').checked = params.sorteio_automatizado;
    if (params.aviso_fim_das_vendas) {
        document.getElementById('config-aviso-fim-vendas').value = params.aviso_fim_das_vendas;
    }

    const radiosModo = document.querySelectorAll('input[name="modo_sorteio"]');
    
    radiosModo.forEach(radio => {
        // Remove listeners antigos para não duplicar (boa prática)
        radio.removeEventListener('change', toggleOpcaoAutomatizado);
        radio.removeEventListener('change', toggleOpcaoSerial);
        
        // Adiciona o evento para disparar AS DUAS funções ao mudar
        radio.addEventListener('change', () => {
            toggleOpcaoAutomatizado();
            toggleOpcaoSerial();
        });
    });
    toggleOpcaoAutomatizado();
    toggleOpcaoSerial();
}

function toggleOpcaoAutomatizado() {
    const radioAuto = document.querySelector('input[name="modo_sorteio"][value="auto"]');
    const container = document.getElementById('container-check-auto');
    if (radioAuto && radioAuto.checked) container.classList.remove('hidden');
    else container.classList.add('hidden');
}

function toggleOpcaoSerial() {
    // Verifica se o modo MANUAL está selecionado
    const radioManual = document.querySelector('input[name="modo_sorteio"][value="manual"]');
    // Pega o container azul que criamos
    const container = document.getElementById('container-check-serial');
    
    // Se existe e está marcado, mostra. Senão, esconde.
    if (radioManual && radioManual.checked) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

async function salvarConfiguracoes() {
    const winnerTime = document.getElementById('config-winner-time').value;
    const isVoz = document.getElementById('config-voz-ativa').checked;
    const checkSerial = document.getElementById('config-enviar-serial').checked;   
    const isCam = document.getElementById('config-camera-ativa').checked;
    const tempoVendas = document.getElementById('config-aviso-fim-vendas').value; 
    const buscarExtra = document.getElementById('chk-buscar-sorte-extra').checked;
    let modoSelecionado = 'auto';
    const radios = document.getElementsByName('modo_sorteio');
    for (const radio of radios) { if (radio.checked) { modoSelecionado = radio.value; break; } }

    const nomeSala = document.getElementById('config-nome-sala').value;
    const urlPadrao = document.getElementById('config-url-padrao').value;
    const urlLive = document.getElementById('config-url-live').value;
    const urlMongo = document.getElementById('config-url-mongo').value;
    const tipoSorteio = document.getElementById('config-tipo-sorteio').value;
    const tipoEntrada = document.getElementById('config-entrada-cartelas').value;
    const isSorteioAuto = document.getElementById('config-sorteio-automatizado').checked;
    const atrasoVideo = document.getElementById('config-atraso-video').value;

    let atrasoVideoInput = document.getElementById('config-atraso-video').value;
    let valorAtrasoFinal = parseInt(atrasoVideoInput) || 0;

    if (modoSelecionado !== 'manual') {
        valorAtrasoFinal = 0;
        document.getElementById('config-atraso-video').value = 0;
    }
   
    const payload = {
        tempo_ganhador: winnerTime, 
        modo_sorteio: modoSelecionado, 
        voz_ativa: isVoz, 
        camera_ativa: isCam,
        nome_sala: nomeSala, 
        url_padrao: urlPadrao, 
        url_live: urlLive, 
        url_mongo_vendas: urlMongo,
        tipo_sorteio: parseInt(tipoSorteio) || 25, 
        tipo_entrada_de_cartelas: parseInt(tipoEntrada) || 2,
        sorteio_automatizado: isSorteioAuto,
        aviso_fim_das_vendas: parseInt(tempoVendas) || 30,
        aguardandoVideo: valorAtrasoFinal,
        buscar_sorte_extra: buscarExtra,
        enviar_porta_serial: checkSerial  
    };  

    try {
        await fetch(`${API_BASE_URL}/api/admin/salvar_config`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
// aquiiii
        vozAtiva = isVoz; cameraAtiva = isCam; modoSorteio = modoSelecionado; enviarSerialValor = checkSerial 
        aplicarVisualModoSorteio(modoSorteio);
        aplicarVisibilidadeCamera(cameraAtiva);
        aguardandoVideo = valorAtrasoFinal;
        sorteio_automatizado =  isSorteioAuto;
        buscarSorteExtra = buscarExtra;

        fecharModal('modal-config');
        customAlert("Configurações salvas com sucesso!");
    } catch (e) { console.error(e); customAlert("Erro ao salvar no servidor."); }
}

// =========================================================
// === 4. SORTEIO & HARDWARE ===
// =========================================================
function toggleAutoSorteio(forceStart = false) {
    const btn = document.getElementById('btn-auto-toggle');
    const inputTempo = document.getElementById('input-tempo-auto');
    const btnManual = document.getElementById('btn-sortear');

    if (!forceStart && autoSorteioAtivo) {
        if (modoRoboAtivo) { pararModoRobo(); return; }
        pararAutoSorteio();
    } else {
        const segundos = parseInt(inputTempo.value);
        if (segundos < 4) { customAlert("Tempo mínimo é 4 segundos!"); return; }
        autoSorteioAtivo = true;
        btn.innerHTML = '<span>⏸️</span> PARAR AUTOMÁTICO';
        btn.className = 'w-full bg-red-900 hover:bg-red-700 text-white font-bold py-2 rounded border border-red-500 transition-colors flex items-center justify-center gap-2 animate-pulse';
        if (modoRoboAtivo) btn.classList.add('robo-unlock'); 
        inputTempo.disabled = true; btnManual.disabled = true;
        cicloSorteioAutomatico(segundos);
    }
}

function pararAutoSorteio() {
    autoSorteioAtivo = false;
    clearTimeout(autoSorteioInterval);
    clearInterval(progressInterval);
    document.getElementById('progress-auto').style.width = '0%';
    const btn = document.getElementById('btn-auto-toggle');
    const inputTempo = document.getElementById('input-tempo-auto');
    const btnManual = document.getElementById('btn-sortear');
    if (btn) {
        btn.innerHTML = '<span>▶️</span> INICIAR AUTOMÁTICO';
        btn.className = 'w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 rounded border border-gray-600 transition-colors flex items-center justify-center gap-2';
    }
    if (inputTempo) inputTempo.disabled = false;
    if (btnManual) btnManual.disabled = false;
}

async function cicloSorteioAutomatico(segundosTotal) {
    if (!autoSorteioAtivo) return;
    await sortearBola(); 
    const contadorTexto = document.getElementById('contador-bolas').textContent;
    if (contadorTexto.includes("90 / 90")) { pararAutoSorteio(); return; }
    if (autoSorteioAtivo) {
        atualizarBarraProgresso(segundosTotal);
        autoSorteioInterval = setTimeout(() => { cicloSorteioAutomatico(segundosTotal); }, segundosTotal * 1000);
    }
}

function atualizarBarraProgresso(totalSegundos) {
    const barra = document.getElementById('progress-auto');
    const start = Date.now();
    const end = start + (totalSegundos * 1000);
    if (progressInterval) clearInterval(progressInterval);
    progressInterval = setInterval(() => {
        const now = Date.now();
        const restante = end - now;
        if (restante <= 0) { barra.style.width = '100%'; clearInterval(progressInterval); }
        else { barra.style.width = `${100 - ((restante / (totalSegundos * 1000)) * 100)}%`; }
    }, 100);
}

// =========================================================
// === SORTEIO LOCUTOR REI (INDEPENDÊNCIA TOTAL) ===
// =========================================================

async function sortearBola() {

    // 1. Verificações Básicas
    if (isSorting) return;
    if (bolasSorteadasCache.length >= MAX_BOLAS) {
        customAlert("Fim de Jogo! O globo está vazio.");
        pararAutoSorteio();
        return;
    }

    isSorting = true;
    const btn = document.getElementById('btn-sortear');
    if(btn) { btn.disabled = true; btn.textContent = "PROCESSANDO..."; }

    // 2. SORTEIO LOCAL (Gera o número na memória do Admin)
    let numero = gerarNumeroUnicoLocal(); 
    
    if (!numero) {
        console.error("Erro fatal: Não consegui gerar número único.");
        isSorting = false;
        if(btn) { btn.disabled = false; btn.textContent = "SORTEAR BOLA 🎲"; }
        return;
    }
    A_Ultima_Bola = parseInt(numero);   // zzzz 
    console.log(`🎱 LOCUTOR SORTEOU: ${numero}`);
    jaAlertouNestaBola = false;
    // 3. ATUALIZA A TELA IMEDIATAMENTE (Não espera internet)
    bolasSorteadasCache.push(numero); // Adiciona na Matriz Local
    
    // Atualiza Grid Visual
    if(typeof updateGrid === 'function') updateGrid(bolasSorteadasCache);
    
    // Atualiza Contador
    const contador = document.getElementById('contador-bolas');
    if(contador) contador.textContent = bolasSorteadasCache.length;

    // Atualiza Bola Destaque
    if (bolaDestaque) bolaDestaque.textContent = numero;
    const elBola = document.getElementById(`admin-ball-${numero}`);
    if(elBola) {
        // Remove destaque anterior
        document.querySelectorAll('.admin-bola').forEach(b => b.classList.remove('animate-pulse', 'scale-110', 'z-10'));
        // Adiciona novo destaque
        elBola.classList.add('bg-green-600', 'text-white', 'animate-pulse', 'scale-110', 'z-10');
    }

    // Fala o número (Voz)
    if (vozAtiva && typeof falarTextoLocutor === 'function') falarTextoLocutor(String(numero));

    // 4. ENVIA PARA O SERVIDOR EM BACKGROUND (Fire and Forget)
    // Aqui nós avisamos o servidor para ele calcular o Ranking e validar Cartelas
    try {
        // Envia via POST (Sem travar o Admin)
        fetch(`${API_BASE_URL}/api/admin/sortear_mesa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                bola: numero, 
                id_evento: parseInt(id_evento_ativo) 
            })
        }).catch(e => console.warn("⚠️ Aviso: Envio ao servidor demorou, mas o jogo segue."));
        
        // Se tiver fila de envio serial, adiciona
        if (typeof matrizEnvio !== 'undefined') {
             matrizEnvio.push({ tipo: 'BOLA_CLIENTE', valor: numero, hora: Date.now() });
             if(typeof atualizarIndicadorFila === 'function') atualizarIndicadorFila(matrizEnvio.length);
        }

        // 🍀 GATILHO SORTE EXTRA (LOCAL)
         if (buscarSorteExtra) {
          if (sorteioExtraConfigAtivo && bolasSorteadasCache.length === qtdeTopeSorteExtra) {
            if (!jaValidouSorteExtraNestaRodada) {
                jaValidouSorteExtraNestaRodada = true;
                if (autoSorteioAtivo) pararAutoSorteio(); // Para o robô para processar o sorte extra
        
                console.log("🚨 [GATILHO LOCAL] Atingiu quantidade para Sorte Extra!");
        
                if (modoRoboAtivo) {
                    if (typeof dispararVerificacaoRobo === 'function') dispararVerificacaoRobo();
                } else {
                    if (typeof abrirModalValidacaoSorteExtra === 'function') abrirModalValidacaoSorteExtra();
                }
            }
          }
        }
     
    } catch (e) {
        console.error("Erro de comunicação (Ignorado pelo Locutor):", e);
    } finally {
        // Libera o botão imediatamente
        isSorting = false;
        if(btn) { btn.disabled = false; btn.textContent = "SORTEAR BOLA 🎲"; }
    }
}

// Função Auxiliar para gerar número sem repetir
function gerarNumeroUnicoLocal() {
    let tentativas = 0;
    let num;
    do {
        num = Math.floor(Math.random() * MAX_BOLAS) + 1;
        tentativas++;
        if (tentativas > 500) return null; // Segurança contra loop infinito
    } while (bolasSorteadasCache.includes(num));
    return num;
}

//  <<  Ajuste Sincronismo Vídeo
function iniciarTransmissao() {
    tempoInicioTransmissao = Date.now(); // Grava os milissegundos atuais
    // Pode enviar este valor para o banco de dados para os clientes saberem quando começou
}

async function inserirBolaManual() {
    //  <<  Ajuste Sincronismo Vídeo 
    if (tempoInicioTransmissao === 0) {
        customAlert("Inicie a transmissão primeiro!");
        return; 
    }

    const input = document.getElementById('input-bola-manual');
    const erroLabel = document.getElementById('erro-manual');
    let valor = parseInt(input.value);

    if (isNaN(valor) || valor < 1 || valor > MAX_BOLAS) { 
        erroLabel.textContent = `Digite entre 1 e ${MAX_BOLAS}`; 
        input.value = ""; 
        return; 
    }
    
    if (bolasSorteadasCache.includes(valor) || bolasCacheLocal.has(valor)) { 
        erroLabel.textContent = `Bola ${valor} já foi!`; 
        input.value = ""; 
        return; 
    }

    erroLabel.textContent = "";
    input.value = ''; 
    devolverFocoAoJogo();
    
    bolaDestaque.textContent = valor;
    if (vozAtiva) falarTextoLocutor(String(valor));

    if (enviarPortaSerial) {
        // 1. Converte para string e garante 2 dígitos (ex: 5 vira "05", 15 vira "15")
        let valorFormatado = String(valor).padStart(2, '0');
        // 2. Monta o comando (ex: "F05")
        let comandoFinal = `F${valorFormatado}`;
        // 3. Envia
        enviarComandoHardware(comandoFinal);
    }

    bolasCacheLocal.add(valor);
    bolasSorteadasCache.push(valor); // 1. Grava a bola na memória local
   
    jaAlertouNestaBola = false;
    
    if(typeof updateGrid === 'function') updateGrid(bolasSorteadasCache); // 2. Acende o painel numérico
    
    const contador = document.getElementById('contador-bolas');
    if(contador) contador.textContent = bolasSorteadasCache.length; // 3. Atualiza a contagem

    // 4. Dá o destaque (cor verde a piscar) na bola atual no seu ecrã
    const elBola = document.getElementById(`admin-ball-${valor}`);
    if(elBola) {
        document.querySelectorAll('.admin-bola').forEach(b => b.classList.remove('bg-green-600', 'text-white', 'animate-pulse', 'scale-110', 'z-10'));
        elBola.classList.add('bg-green-600', 'text-white', 'animate-pulse', 'scale-110', 'z-10');
    }

    console.log(`[DEBUG] Inserindo bola manual: ${valor}`);

    try {

        const payload = { 
            bola: valor,
           id_evento: parseInt(id_evento_ativo)
        };

        const response = await fetch(`${API_BASE_URL}/api/admin/sortear_mesa`, {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error("[DEBUG] Erro mesa:", data.error);
            erroLabel.textContent = data.error;
            bolasCacheLocal.delete(valor); 
            bolasSorteadasCache.pop();
            if(typeof updateGrid === 'function') updateGrid(bolasSorteadasCache);
            return;
        }

        console.log(`[DEBUG] Bola ${valor} aceita. Agendando para público.`);
        matrizEnvio.push({
            tipo: 'BOLA_CLIENTE',
            valor: valor,
            hora: Date.now()
        });
        if(typeof atualizarIndicadorFila === 'function') atualizarIndicadorFila(matrizEnvio.length);

        // 🍀 GATILHO SORTE EXTRA (LOCAL)
        if (buscarSorteExtra) {
            if (sorteioExtraConfigAtivo && bolasSorteadasCache.length === qtdeTopeSorteExtra) {
                if (!jaValidouSorteExtraNestaRodada) {
                    jaValidouSorteExtraNestaRodada = true;      
                    console.log("🚨 [GATILHO LOCAL] Atingiu quantidade para Sorte Extra!");
                    if (typeof abrirModalValidacaoSorteExtra === 'function') abrirModalValidacaoSorteExtra();
                    
                }
            }
        }


    } catch (e) {
        console.error("[DEBUG] Erro conexão manual:", e);
        erroLabel.textContent = "Erro ao conectar com servidor!";
        bolasCacheLocal.delete(valor);
        bolasSorteadasCache.pop();
        if(typeof updateGrid === 'function') updateGrid(bolasSorteadasCache);
    }
}

function aplicarVisibilidadeCamera(ativa) {
    const container = document.getElementById('camera-preview-container');
    if (ativa) container.classList.remove('hidden');
    else { container.classList.add('hidden'); if (localStream) toggleLocalCamera(); }
}

async function toggleLocalCamera() {
    const videoElement = document.getElementById('video-feed');
    const placeholder = document.getElementById('video-placeholder');
    const btn = document.getElementById('btn-local-cam');
    if (!localStream) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            localStream = stream; videoElement.srcObject = stream;
            videoElement.classList.remove('hidden'); placeholder.classList.add('hidden');
            btn.textContent = "DESLIGAR"; btn.classList.replace('text-green-400', 'text-red-400');
        } catch (err) { console.error(err); customAlert("Não foi possível acessar a câmera."); }
    } else {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null; videoElement.srcObject = null;
        videoElement.classList.add('hidden'); placeholder.classList.remove('hidden');
        btn.textContent = "LIGAR"; btn.classList.replace('text-red-400', 'text-green-400');
    }
}

function ajustarCamera() {
    const wrapper = document.getElementById('video-wrapper');
    const widthVal = document.getElementById('cam-width').value;
    const heightVal = document.getElementById('cam-height').value;
    wrapper.style.width = `${widthVal}%`; wrapper.style.height = `${heightVal}px`;
    document.getElementById('label-width').textContent = `${widthVal}%`; document.getElementById('label-height').textContent = `${heightVal}px`;
}

function falarTextoLocutor(texto) {
    if (!vozAtiva) return;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(texto);
        utter.lang = 'pt-BR'; utter.rate = 1.1;
        window.speechSynthesis.speak(utter);
    }
}

function iniciarRelogio() {
    const relogioElement = document.getElementById('relogio-digital');
    if (!relogioElement) return;
    setInterval(() => {
        const agora = new Date();
        relogioElement.textContent = `${String(agora.getDate()).padStart(2,'0')}/${String(agora.getMonth()+1).padStart(2,'0')}/${agora.getFullYear()} - ${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}`;
    }, 1000);
}

function devolverFocoAoJogo() {
    setTimeout(() => {
        if (modoSorteio === 'manual') { const i = document.getElementById('input-bola-manual'); if(i) i.focus(); } 
        else { const b = document.getElementById('btn-sortear'); if(b) b.focus(); }
    }, 100);
}

function aplicarVisualModoSorteio(modo) {
    const cd = document.getElementById('container-sorteio-digital');
    const cm = document.getElementById('container-entrada-manual');
    if (modo === 'manual') { cd.classList.add('hidden'); cm.classList.remove('hidden'); if (autoSorteioAtivo) pararAutoSorteio(); } 
    else { cd.classList.remove('hidden'); cm.classList.add('hidden'); }
}

async function carregarEvento(idEvento) {
    const confirmou = await customConfirm(`Deseja INICIAR este evento?\n\nIsso irá preparar a base de cartelas e iniciar o timer.`);
    if(!confirmou) return;
    
    fecharModal('modal-eventos');
    showLoading("🔄 Carregando base de cartelas...");

    console.log(`[DEBUG] Carregando evento ${idEvento}...`);

    try {
        const respPrep = await fetch(`${API_BASE_URL}/api/admin/preparar_evento`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id_evento: idEvento })
        });
        
        const dadosPrep = await respPrep.json();
        if (dadosPrep.error) throw new Error(dadosPrep.error);
        
        showLoading("🔒 Encerrando vendas...");

        await fetch(`${API_BASE_URL}/api/admin/fechar_vendas_evento`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id_evento: idEvento })
        });

    } catch(e) {
        console.error("[DEBUG] Erro carregarEvento:", e);
        customAlert("⛔ Erro crítico ao carregar cartelas: " + e.message);
        hideLoading();
        return; 
    } 

    hideLoading();
    iniciarTimerEspera(idEvento);
}

function iniciarTimerEspera(idEvento) {
    const modal = document.getElementById('modal-timer-vendas');
    const display = document.getElementById('timer-display');
    const progress = document.getElementById('timer-progress');
    
    let tempoTotal = 30; 
    if (configuracaoServer && configuracaoServer.aviso_fim_das_vendas) {
        tempoTotal = parseInt(configuracaoServer.aviso_fim_das_vendas);
    }
    
    let tempoRestante = tempoTotal;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex'); 

    const atualizarDisplay = () => {
        const min = Math.floor(tempoRestante / 60);
        const sec = tempoRestante % 60;
        display.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        const pct = (tempoRestante / tempoTotal) * 100;
        progress.style.width = `${pct}%`;
    };

    atualizarDisplay();

    vendasTimerInterval = setInterval(async () => {
        tempoRestante--;
        atualizarDisplay();

        if (tempoRestante < 0) {
            clearInterval(vendasTimerInterval);
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            // Agora o await funcionará corretamente
            try {
                await carregarConfigSorteExtraAdmin(idEvento);
            } catch (e) {
                console.error("Erro ao carregar config Sorte Extra:", e);
            }
            executarCarregamentoReal(idEvento);
        }
    }, 1000);

    window.eventoPendenteID = idEvento;
}

async function pularEsperaVendas() { 
    const confirmou = await customConfirm(`Tem certeza? Clientes comprando agora podem ficar sem cartela.`);
    
    if(confirmou) {
        clearInterval(vendasTimerInterval);
        
        const modal = document.getElementById('modal-timer-vendas');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        
        if (window.eventoPendenteID) {
            try {
                await carregarConfigSorteExtraAdmin();
            } catch (e) {
                console.error("Erro ao carregar config Sorte Extra:", e);
            }
            executarCarregamentoReal(window.eventoPendenteID);
        }
    }
}


async function executarCarregamentoReal(idEvento) {
    const menu = document.getElementById('admin-side-menu');
    const menuOverlay = document.getElementById('admin-menu-overlay');

    if (menu) menu.classList.add('-translate-x-full'); 
    if (menuOverlay) menuOverlay.classList.add('hidden'); 

    showLoading("Sincronizando últimas vendas e carregando jogo...");
    if (aguardandoVideo > 0 && !modoRoboAtivo) {
        await new Promise(r => setTimeout(r, aguardandoVideo));
    }

    try {
        console.log("[DEBUG] Resetando jogo para novo evento...");
        await fetch(`${API_BASE_URL}/api/admin/resetar`, { method: 'POST' });
        bolasSorteadasCache = [];
        ultimoTotalBolasProcessadas = -1;
        jaAlertouNestaBola = false;
        jaValidouSorteExtraNestaRodada = false;
        if (bolaDestaque) bolaDestaque.textContent = "--";
        updateGrid([]); // Limpa o painel visual

        const response = await fetch(`${API_BASE_URL}/api/admin/detalhes_evento?id_evento=${idEvento}`);
        const dados = await response.json();

        if (!response.ok || dados.error) { 
            const msgErro = dados.error || "Erro desconhecido ao carregar evento.";
            customAlert("⛔ " + msgErro); 
            const modalEventos = document.getElementById('modal-eventos');
            if(modalEventos) modalEventos.classList.remove('hidden');
            return; 
        }

        dadosEventoAtual = dados; 
        document.getElementById('painel-evento-ativo').classList.remove('hidden');

        id_evento_ativo = parseInt(idEvento);
        id_rodada_ativa = parseInt(idEvento);
        console.error("🎱 Evento Configurado: id_rodada_ativa:  ",id_rodada_ativa );

        const tipoCartela = parseInt(dados.tipo_sorteio || 25);
        if (tipoCartela === 25) {
            MAX_BOLAS = 75;
            console.log("🎱 Evento Configurado: BINGO 75");
        } else {
            MAX_BOLAS = 90;
            console.log("🎱 Evento Configurado: BINGO 90");
        }

        const labelQuadra = (MAX_BOLAS === 75) ? '4 Cantos' : 'Quadra';

        initGrid(); 

        document.getElementById('info-descricao').textContent = dados.descricao;
        document.getElementById('info-data-hora').textContent = `${dados.data_evento} ${dados.hora_evento}`;
        document.getElementById('info-inicial').textContent = dados.numero_inicial;
        document.getElementById('info-qtde').textContent = dados.qtde_vendida;
        document.getElementById('info-ultimo').textContent = dados.ultimo_cartao;
        document.getElementById('info-preco-un').textContent = parseFloat(dados.valor_venda||0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        document.getElementById('info-vendas').textContent = parseFloat(dados.total_vendas_reais||0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

        const containerPremios = document.getElementById('container-premios-lista');
        containerPremios.innerHTML = '';
        const premios = dados.premios;
        const listaPremios = [
            { key: 'quadra', label: labelQuadra },
            { key: 'linha', label: 'Linha', extra: premios.qtde_linhas > 1 ? `(${premios.qtde_linhas}x)` : '' },
            { key: 'falta_um', label: 'Falta 1' },
            { key: 'bingo', label: 'Bingo' },
            { key: 'segundo_bingo', label: '2º Bingo' },
            { key: 'acumulado', label: 'Acumulado', extra: premios.bola_tope > 0 ? `(Bola ${premios.bola_tope})` : '' }
        ];

        listaPremios.forEach(p => {
            const valor = parseFloat(premios[p.key] || 0);
            if (valor > 0) {
                const card = document.createElement('div');
                card.className = 'bg-gray-900 rounded p-1 border border-gray-700 text-center';
                card.innerHTML = `<span class="block text-[9px] text-gray-500 uppercase">${p.label} ${p.extra || ''}</span><span class="block text-sm font-bold text-yellow-400">${valor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</span>`;
                containerPremios.appendChild(card);
            }
        });
        document.getElementById('info-total-premios').textContent = `Total: ${parseFloat(premios.total||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}`;

        definirProximoPremioAutomatico();
        bolaDestaque.textContent = "--";

        if (modoSorteio === 'manual') {
            iniciarTransmissao(); 
            console.log("⏱️ [SYNC] Transmissão iniciada. Marco zero gravado (Modo Manual)!");
        } else {
            console.log("🤖 [SYNC] Sorteio Automático. Sincronia de vídeo ignorada (Via Verde ativa).");
        }
        
        if (sorteioAutomatizadoConfig && modoSorteio === 'auto') {
           iniciarModoRobo(); 
        }

    } catch (e) { 
        console.error("[DEBUG] Erro executarCarregamentoReal:", e); 
        customAlert("Erro ao carregar detalhes."); 
    } finally {
        hideLoading();
    }
}


async function definirProximoPremioAutomatico() {
    if (!dadosEventoAtual || !dadosEventoAtual.premios) return;
    const ordem = ['quadra', 'linha', 'falta_um', 'bingo', 'segundo_bingo'];
    let premioAlvo = '';
    for (const key of ordem) {
        if (parseFloat(dadosEventoAtual.premios[key] || 0) > 0) {
            if (key === 'quadra') premioAlvo = 'QUADRA'; 
            else if (key === 'linha') premioAlvo = 'LINHA'; 
            else if (key === 'falta_um') premioAlvo = 'FALTAUM';
            else if (key === 'bingo') premioAlvo = 'BINGO'; 
            else if (key === 'segundo_bingo') premioAlvo = 'DUPLO BINGO'; 
            break; 
        }
    }
    if (premioAlvo) await mudarPremio(premioAlvo);
}

// --- FUNÇÕES DE GRID E RANKING ---
function initGrid() {
    const gridContainer = document.getElementById('grid-bolas');
    if (!gridContainer) return;
    
    gridContainer.innerHTML = '';
    
    for (let i = 1; i <= MAX_BOLAS; i++) {
        const div = document.createElement('div');
        div.id = `admin-ball-${i}`;
        div.className = 'h-4 w-full flex items-center justify-center bg-gray-900/50 text-gray-700 rounded text-[11px] border border-gray-700';
        div.textContent = i;
        gridContainer.appendChild(div);
    }
    
    const contador = document.getElementById('contador-bolas');
    if (contador) contador.textContent = `0 / ${MAX_BOLAS}`;
}

function updateGrid(bolas) {
    document.querySelectorAll('[id^="admin-ball-"]').forEach(el => {
        el.className = 'h-4 w-full flex items-center justify-center bg-gray-900/50 text-gray-700 rounded text-[11px] border border-gray-700';
    });
    if (!bolas || bolas.length === 0) { contadorElement.textContent = `0 / 90`; renderHistorico([]); return; }
    const ultima = bolas[bolas.length - 1];
    bolas.forEach(num => {
        const el = document.getElementById(`admin-ball-${num}`);
        if (el) el.className = `h-4 w-full flex items-center justify-center font-semibold rounded border text-[12px] ${num===ultima ? 'bg-yellow-600 text-gray-200 border-yellow-400' : 'bg-green-700 text-green-200 border-green-500'}`;
    });
    contadorElement.textContent = `${bolas.length} / 90`;
    renderHistorico(bolas);
}

function renderHistorico(bolas) {
    const c = document.getElementById('historico-bolas'); if(!c) return; c.innerHTML = '';
    if (bolas.length === 0) { c.innerHTML = '<span class="text-gray-600 text-xl italic p-2">Aguardando...</span>'; return; }
    [...bolas].reverse().forEach((num, i) => {
        const div = document.createElement('div');
        div.className = `h-5 w-5 flex items-center justify-center rounded-full text-[10px] shadow-sm border ${i===0?'bg-yellow-800 text-gray-200 border-yellow-600 border-2':'bg-gray-800 text-gray-300 border-yellow-600'}`;
        div.textContent = num;
        c.appendChild(div);
    });
}

// --- FUNÇÃO DE SEGURANÇA DOS BOTÕES (ROBUSTA) ---
function gerenciarEstadoBotoes(estadoRaw) {
    if (!estadoRaw) return;

    // 1. Normalização: Converte para minúsculas e remove espaços extras
    // Ex: " Ativo " vira "ativo"
    const estado = String(estadoRaw).toLowerCase().trim();
    
    // DEBUG: Mostra no console do navegador (F12) o estado exato
    console.log(`🔒 Status da Rodada recebido: [${estado}]`);

    // Mapeamento dos botões
    const btnSortear = document.getElementById('btn-sortear');
    const btnAutoToggle = document.getElementById('btn-auto-toggle');
    const btnF1Buscar = document.getElementById('btn-f1-buscar');
    const btnAutoLegado = document.getElementById('btn-auto'); 
    const inputManual = document.getElementById('input-bola-manual');

    // === MODO BLOQUEIO (Travado) ===
    // Se estiver em vendas, intervalo ou finalizada, TRAVA TUDO.
    if (estado === 'aberta' || estado === 'intervalo' || estado === 'finalizada' || estado === 'fechada') {
        
        console.log(" -> 🛑 Modo Bloqueio Ativado");

        if (btnSortear) {
            btnSortear.disabled = true;
            btnSortear.classList.add('opacity-50', 'cursor-not-allowed');
            btnSortear.classList.remove('hover:scale-105', 'active:scale-95');
        }

        if (btnAutoToggle) {
            btnAutoToggle.disabled = true;
            btnAutoToggle.classList.add('opacity-50', 'cursor-not-allowed');
        }
        
        if (btnF1Buscar) {
            btnF1Buscar.disabled = true;
            btnF1Buscar.classList.add('opacity-50', 'cursor-not-allowed');
            btnF1Buscar.classList.remove('hover:scale-105', 'active:scale-95');
        }

        if (btnAutoLegado) btnAutoLegado.disabled = true;

        if (inputManual) {
            inputManual.disabled = true;
            inputManual.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-800');
            inputManual.classList.remove('bg-gray-800', 'focus:ring-2'); // Remove estilos de foco
            inputManual.value = ""; // Limpa para evitar confusão visual
        }

        // KILL SWITCH: Para o automático se estiver rodando
        if (typeof autoSorteioAtivo !== 'undefined' && autoSorteioAtivo) {
            if (typeof toggleAutoSorteio === 'function') {
                toggleAutoSorteio();
            }
        }

    } 
    // === MODO JOGO (Liberado) ===
    // ACEITA QUALQUER OUTRO ESTADO COMO "JOGO" (ativo, andamento, iniciado, etc.)
    // Essa lógica 'else' garante que se iniciar, libera!
    else {
        
        console.log(" -> ✅ Modo Jogo Liberado");

        if (btnSortear) {
            btnSortear.disabled = false;
            btnSortear.classList.remove('opacity-50', 'cursor-not-allowed');
            btnSortear.classList.add('hover:scale-105', 'active:scale-95');
        }

        if (btnAutoToggle) {
            btnAutoToggle.disabled = false;
            btnAutoToggle.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        if (btnF1Buscar) {
            btnF1Buscar.disabled = false;
            btnF1Buscar.classList.remove('opacity-50', 'cursor-not-allowed');
            btnF1Buscar.classList.add('hover:scale-105', 'active:scale-95');
        }
        
        if (btnAutoLegado) btnAutoLegado.disabled = false;
        
        if (inputManual) {
            inputManual.disabled = false;
            inputManual.classList.remove('opacity-50', 'cursor-not-allowed');
            inputManual.classList.add('bg-gray-800', 'focus:ring-2'); // Remove estilos de foco
        }
    }
}

// --- FUNÇÃO ROTEADORA (DECIDE QUAL VISUAL USAR) ---
function renderRanking(lista, tipo) {
    if (MAX_BOLAS === 75) {
        renderRanking75(lista, tipo);
    } else {
        renderRanking90(lista, tipo);
    }
}

// --- VISUAL EXCLUSIVO BINGO 90 BOLAS (CLÁSSICO) ---
function renderRanking90(lista, tipo) {
    const c = document.getElementById('ranking-lista'); 
    if(!c) return;
    
    document.getElementById('label-premio-ranking').textContent = tipo || "";
    c.innerHTML = '';
    
    if (!lista || lista.length === 0) { 
        c.innerHTML = '<div class="text-gray-600 text-center text-xs py-2">Calculando...</div>'; 
        return; 
    }
    
    lista.slice(0, 15).forEach((item, i) => {
        const status = (item.premio && item.premio !== "null") ? item.premio : "";
        const nums = item.numeros_faltantes || [];
        
        let htmlNums = nums.map(n => n<10?`0${n}`:n).join(' ');

        if (["LINHA"].includes(status) && item.posicao) {
            htmlNums = `<span class=" text-center text-[9px] bg-yellow-900/60 text-yellow-300 px-1.5 rounded border border-yellow-700 mr-1.5">${item.posicao}</span>` + htmlNums;
        }

        if (["BINGO","DUPLO BINGO"].includes(status)) {
            htmlNums = `<span class="text-green-400 font-black animate-pulse">${status}</span>`;
        } else if (status === "LINHA") {
            htmlNums = `<span class="text-center  text-yellow-400 font-bold animate-pulse">${status} <span class="text-xs">(${item.posicao || ''})</span></span>`;
        }
        
        const row = document.createElement('div');
        let cl = "grid grid-cols-6 gap-1 px-1 py-0.5 rounded border items-center mb-0.5 ";
        
        if (["BINGO","LINHA"].includes(status)) cl += "bg-green-900/40 border-green-500 shadow-lg scale-[1.02]";
        else if (status.includes("FALTA") || status.includes("QUADRA")) cl += "bg-red-900/60 border-red-500";
        else if (i===0) cl += "bg-gray-700 border-yellow-600";
        else cl += "bg-gray-800 border-gray-700";
        
        row.className = cl;
        row.innerHTML = `<div class="col-span-1 font-mono font-bold text-center text-yellow-500 text-[16px]">${item.cartela}</div><div class="col-span-3 text-[16px] font-mono flex items-center">${htmlNums}</div><div class="col-span-2 text-right truncate text-xs text-blue-500">${item.nome==="null"?'---':item.nome}</div>`;
        c.appendChild(row);
    });
}

// --- VISUAL EXCLUSIVO BINGO 75 BOLAS (PADRÕES) ---
function renderRanking75(lista, tipo) {
    const c = document.getElementById('ranking-lista'); 
    if(!c) return;

    let tituloDisplay = tipo || "";
    if (tituloDisplay === "QUADRA") tituloDisplay = "4 CANTOS";
    
    document.getElementById('label-premio-ranking').textContent = tituloDisplay;
    c.innerHTML = '';

    if (!lista || lista.length === 0) { 
        c.innerHTML = '<div class="text-gray-600 text-center text-xs py-2">Calculando Padrões...</div>'; 
        return; 
    }
    
    lista.slice(0, 15).forEach((item, i) => {
        let status = (item.premio && item.premio !== "null") ? item.premio : "";
        let posicao = item.posicao || "";

        if (status === "QUADRA") status = "4 CANTOS";
        if (posicao === "QUADRA") posicao = "4 CANTOS";
        
        const nums = item.numeros_faltantes || [];
        let htmlNums = nums.map(n => n<10?`0${n}`:n).join(' ');

        if (status === "BINGO" || status === "BATIDO!" || item.qtde === 0) {
             const textoVitoria = (status === "BINGO") ? "BINGO CHEIO" : (posicao || "BATIDO!");
             htmlNums = `<span class="text-green-400 font-black animate-pulse tracking-widest text-xs">${textoVitoria}</span>`;
        } 
        else {
            if (posicao) {
                const tag = `<span class="text-[9px] bg-blue-900/60 text-blue-200 px-1.5 rounded border border-blue-700 mr-1.5 uppercase font-bold">${posicao}</span>`;
                htmlNums = tag + htmlNums;
            }
        }

        const row = document.createElement('div');
        let cl = "grid grid-cols-6 gap-1 px-1 py-0.5 rounded border items-center mb-0.5 ";
        
        if (item.qtde === 0) {
            cl += "bg-green-900/40 border-green-500 shadow-lg scale-[1.02] z-10";
        } else if (item.qtde <= 1) {
            cl += "bg-red-900/40 border-red-500 animate-pulse"; 
        } else if (i === 0) {
            cl += "bg-gray-700 border-yellow-600";
        } else {
            cl += "bg-gray-800 border-gray-700";
        }
        
        row.className = cl;
        row.innerHTML = `<div class="col-span-1 text-center font-mono font-bold text-yellow-500 text-[16px]">${item.cartela}</div><div class="col-span-3 text-[16px] font-mono flex items-center overflow-hidden whitespace-nowrap">${htmlNums}</div><div class="col-span-2 text-right truncate text-xs text-blue-500">${item.nome==="null"?'---':item.nome}</div>`;
        c.appendChild(row);
    });
}

function renderListaGanhadores(data) {
    const c = document.getElementById('lista-ganhadores');
    if(!c) return;
    c.innerHTML = '';
    const count = document.getElementById('count-ganhadores');

    if (!data || data.length === 0) {
        c.innerHTML = '<span class="text-gray-600 text-center italic mt-2">Nenhum.</span>';
        if(count) count.textContent="0";
        return;
    }

    let total = 0;
    data.forEach(g => {
        const h = document.createElement('div');
        h.className = "text-green-400 font-bold uppercase border-b border-gray-700 -mt-2 mb-0.5 pt-1 text-[9px]";
        h.textContent = g.premio;
        c.appendChild(h);
        if(g.ganhadores) g.ganhadores.forEach(w => {
            total++;
            const r = document.createElement('div');
            r.className = "flex justify-between bg-gray-900 px-0.5 py-0.5 rounded mb-0 -mt-1 border border-gray-700";
            r.innerHTML = `<span class="text-yellow-500 font-mono text-xs">${w.cartela}</span><span class="text-white font-bold truncate w-24">${w.nome||'Cliente'}</span><span class="text-green-600 font-bold text-xs">${w.valor_rateio||''}</span>`;
            c.appendChild(r);
        });
    });
    
    if(count) count.textContent = total;
}

// =========================================================
// === 5. AUDITORIA & TROCA DE PRÊMIO (Manual e Auto) ===
// =========================================================
function abrirSessaoAuditoria(modoSilencioso = false) {
    const modal = document.getElementById('modal-conferencia');
    const input = document.getElementById('input-auditoria');
    const listaSessao = document.getElementById('lista-auditoria-session'); 

    if (modoRoboAtivo && !modoSilencioso) return;
    
    if (!modoSilencioso && autoSorteioAtivo) {
        toggleAutoSorteio(); 
    }
    
    houveGanhadorNaSessao = false;
    
    document.getElementById('auditoria-resultado').classList.add('hidden');
    document.getElementById('conf-grid').innerHTML = '';
    
    if (listaSessao) {
        listaSessao.innerHTML = '<span class="text-gray-600">Nenhum</span>';
    }
    
    renderListaPendentes(cartelasPendentesAuditoria);
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    if (modoRoboAtivo || modoSilencioso) {
        input.disabled = true;
    } else {
        input.value = '';
        input.disabled = false;
        setTimeout(() => input.focus(), 200);
    }
}
	
async function validarCartelaAuditoria() {
    const input = document.getElementById('input-auditoria');
    const cartela = input.value;
    const btnConfirmar = document.getElementById('btn-confirmar-ganhador');

    if(!cartela) return;
    
    try {
        let urlEndpoint = `${API_BASE_URL}/api/admin/validar_cartela`; 
        if (typeof MAX_BOLAS !== 'undefined' && MAX_BOLAS === 75) {
            urlEndpoint = `${API_BASE_URL}/api/admin/validar_cartela_75`;
        }
        
        const response = await fetch(urlEndpoint, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ cartela: cartela })
        });
        const data = await response.json();

        let msgExibicao = data.msg;
        const elStatus = document.getElementById('status-premio');
        const premioBuscado = elStatus ? elStatus.textContent.replace('Buscando: ', '').toUpperCase() : "";
        
        if (data.status_code === 'LOSS' && data.msg.includes("Faltam")) {
             if (premioBuscado.includes("LINHA")) {
                 msgExibicao = `❌ ${data.msg} para a LINHA.`;
             } else if (premioBuscado.includes("QUADRA") || premioBuscado.includes("CANTOS")) {
                 msgExibicao = `❌ ${data.msg} para a ${premioBuscado}.`;
             }
        }

        const resDiv = document.getElementById('auditoria-resultado');
        if(resDiv) resDiv.classList.remove('hidden');
        
        const elInfo = document.getElementById('conf-info');
        if(elInfo) elInfo.textContent = `${data.cartela_id || cartela} - ${data.ganhador || 'Desconhecido'}`;
        
        const msgLabel = document.getElementById('conf-msg');
        if(msgLabel) {
            if (data.status_code === 'WIN') {
                msgLabel.textContent = `✅ ${data.msg}`;
                msgLabel.className = "text-xl font-black text-green-400 animate-pulse";
                
                if (!modoRoboAtivo && btnConfirmar) {
                    btnConfirmar.classList.remove('hidden'); 
                    btnConfirmar.onclick = () => confirmarGanhadorAtual(); 
                    setTimeout(() => btnConfirmar.focus(), 100);
                }
            } else {
                msgLabel.textContent = msgExibicao; 
                if (data.status_code === 'NOT_SOLD') msgLabel.className = "text-xl font-black text-yellow-500";
                else msgLabel.className = "text-xl font-black text-red-400";
                if(btnConfirmar) btnConfirmar.classList.add('hidden');
            }
        }

        if(typeof renderGridConferencia === 'function') renderGridConferencia(data);

    } catch (e) { 
        console.error(e);
        customAlert("Erro de conexão ao validar."); 
    } finally {
        hideLoading(); 
    }
}

async function confirmarGanhadorAtual() {
    houveGanhadorNaSessao = true; 
    const input = document.getElementById('input-auditoria');
    const cartelaConfirmada = String(input.value).trim(); 

    if (!cartelaConfirmada) return;

    idsConfirmadosNestaRodada.add(cartelaConfirmada);

    cartelasPendentesAuditoria = cartelasPendentesAuditoria.filter(c => 
        String(c.cartela).trim() !== cartelaConfirmada
    );
    
    renderListaPendentes(cartelasPendentesAuditoria);

    const listaSessao = document.getElementById('lista-auditoria-session');
    if (listaSessao && (listaSessao.innerText.trim() === 'Nenhum' || listaSessao.children.length === 0)) {
        listaSessao.innerHTML = '';
    }
    
    if (listaSessao) {
        const tag = document.createElement('span');
        tag.className = "inline-block bg-green-900 text-green-300 px-2 py-1 rounded border border-green-700 text-xs font-bold mr-2 mb-1";
        tag.textContent = `Cartão: ${cartelaConfirmada}`;
        listaSessao.appendChild(tag);
    }

    input.value = ''; 
    document.getElementById('auditoria-resultado').classList.add('hidden');
    document.getElementById('conf-grid').innerHTML = '';
    
    try { await fetch(`${API_BASE_URL}/api/admin/limpar_conferencia`, { method: 'POST' }); } catch(e) {}

    if (!modoRoboAtivo) {
        input.disabled = false; 
        input.focus();
    }
}

async function encerrarSessaoConferencia(modoSilencioso = false) {
    document.getElementById('modal-conferencia').classList.add('hidden');
    document.getElementById('modal-conferencia').classList.remove('flex');
    devolverFocoAoJogo();
    
    try { await fetch(`${API_BASE_URL}/api/admin/atualizar_linhas_restantes`, { method: 'POST' }); } catch(e) {}
    try { await fetch(`${API_BASE_URL}/api/admin/limpar_conferencia`, { method: 'POST' }); } catch(e) {}

    if (!modoSilencioso && houveGanhadorNaSessao) {
        processarProximoPremio(); 
    }
}

async function processarProximoPremio() {
    let info = null;
    let dadosEvento = null;
    try {
        const resp = await fetch(`${API_BASE_URL}/api/initial-data`);
        const dados = await resp.json();
        info = dados.buscandoMesaData[0];
        if (typeof dadosEventoAtual !== 'undefined' && dadosEventoAtual) dadosEvento = dadosEventoAtual;
    } catch (e) { return; }

    if (!info) return;
   
    if (info.buscando_o_premio === 'LINHA' && info.buscando_a_linha && info.buscando_a_linha.length > 0) {
        return; 
    }
    const ordem = ['QUADRA', 'LINHA', 'FALTAUM', 'BINGO', 'DUPLO BINGO'];
    let atualKey = info.buscando_o_premio;
    if (atualKey === 'FALTA 1') atualKey = 'FALTAUM';
    if (atualKey === '3 LINHAS') atualKey = 'LINHA';
    
    const indexAtual = ordem.indexOf(atualKey);
    if (indexAtual === -1) return;

    let proximoKey = null;
    let dadosPremios = dadosEvento ? dadosEvento.premios : null;

    if (dadosPremios) {
        for (let i = indexAtual + 1; i < ordem.length; i++) {
            const keyTeste = ordem[i];
            let keyDados = keyTeste.toLowerCase();
            if (keyTeste === 'FALTAUM') keyDados = 'falta_um';
            if (keyTeste === 'DUPLO BINGO') keyDados = 'segundo_bingo';
            if (parseFloat(dadosPremios[keyDados] || 0) > 0) {
                proximoKey = keyTeste;
                break;
            }
        }
    } else {
        if (indexAtual + 1 < ordem.length) proximoKey = ordem[indexAtual + 1];
    }

    if (proximoKey) {
        setTimeout(async () => {
            // Removemos o 'if (confirm)' e deixamos apenas o Alert e a Ação
            // Adicionei um título "Próximo Prêmio" e 3 segundos para fechar sozinho (opcional)
            await customAlert(
                `Todas as linhas conferidas!\n\nAvançando prêmio para: ${proximoKey}`, 
                "Avanço Automático", 
                3
            );            
            await mudarPremio(proximoKey);
        }, 500);
    } else {
        setTimeout(async () => {
            alternarBotaoReset('finalizar');
            if (await customConfirm(`⚠️ Fim da sequência de prêmios!\n\nEste foi o último prêmio ativo.\nDeseja FINALIZAR o evento agora?`)) {
                resetarJogo();
            }
        }, 500);
    }
}


async function mudarPremio(tipo) {
    const elStatus = document.getElementById('status-premio');
    if (elStatus) elStatus.textContent = `Buscando: ${tipo} (Mesa)`;
    const elTitulo = document.getElementById('premio-atual'); 
    if (elTitulo) elTitulo.textContent = tipo;

    console.log(`[DEBUG] Mudando prêmio para: ${tipo}`);

    try {
        await fetch(`${API_BASE_URL}/api/admin/definir_premio_mesa`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ premio: tipo })
        });
        
        matrizEnvio.push({
            tipo: 'PREMIO_CLIENTE',
            valor: tipo,
            hora: Date.now()
        });
        atualizarIndicadorFila(matrizEnvio.length);
        
    } catch(e) {
        console.error("[DEBUG] Erro ao mudar prêmio:", e);
    }
}

// --- ATUALIZE A FUNÇÃO resetarJogo --- xxx
async function resetarJogo(force = false) {
    let msgConfirmacao = "TEM CERTEZA? Isso limpará a tela e encerrará o jogo atual.";
    
    const sucessoConfirmado = (jogoFoiFinalizadoComSucesso || jogoRoboFinalizadoComSucesso);

    // Se o jogo foi finalizado com sucesso (botão verde), muda a mensagem
    if (sucessoConfirmado && !modoRoboAtivo) {
        msgConfirmacao = "Deseja FINALIZAR este evento, pagar os prêmios e carregar o PRÓXIMO?";
    }

    if(!force && !modoRoboAtivo && !(await customConfirm(msgConfirmacao))) { 
        devolverFocoAoJogo(); return; 
    }
    
    showLoading("Processando encerramento...");

    if (autoSorteioAtivo) pararAutoSorteio();
    if (modoRoboAtivo && !sucessoConfirmado) pararModoRobo();

    try {
        // =======================================================
        // 🚀 PREPARAÇÃO DO PAYLOAD (DADOS PARA O SERVIDOR)
        // =======================================================
        const payload = {
            finalizar_sucesso: sucessoConfirmado,
            // Adiciona a lista de ganhadores do Extra (se houver)
            ganhadores_extra: (typeof cacheGanhadoresExtraFinal !== 'undefined') ? cacheGanhadoresExtraFinal : []
        };

        console.log("📤 Enviando encerramento:", payload);

        jogoFoiFinalizadoComSucesso = false;
        jogoRoboFinalizadoComSucesso = false;

        // Envia o payload completo
        await fetch(`${API_BASE_URL}/api/admin/resetar`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });
        
        // =======================================================
        // 🧹 RESET LOCAL DAS VARIÁVEIS
        // =======================================================
        bolasCacheLocal = new Set(); 
        bolasSorteadasCache = [];
        matrizEnvio = [];
        A_Ultima_Bola = 0;
        idsConfirmadosNestaRodada = new Set();
        ultimoTotalBolasProcessadas = -1; 
        jaAlertouNestaBola = false;

        // --- RESET ESPECÍFICO DO SORTE EXTRA ---
        cacheGanhadoresExtraFinal = []; // Limpa o cache para não duplicar no próximo
        modalExtraJaAberto = false;     // Destrava o modal para o próximo jogo
         
        // Reseta o estado do botão para o próximo jogo
        alternarBotaoReset('reiniciar'); 

        if(bolaDestaque) bolaDestaque.textContent = "--"; 
        initGrid();
        
        const elStatus = document.getElementById('status-premio');
        if(elStatus) elStatus.textContent = "Aguardando início...";
        
        const elContador = document.getElementById('contador-bolas');
        if(elContador) elContador.textContent = `0 / ${MAX_BOLAS}`;
        
        renderHistorico([]);
        renderRanking([], "");
        renderListaGanhadores([]); 
        cartelasPendentesAuditoria = [];

        const painelEvento = document.getElementById('painel-evento-ativo');
        if(painelEvento) painelEvento.classList.add('hidden');
        
        await new Promise(r => setTimeout(r, 800));
        if (!force) {
            // Se finalizou com sucesso, o backend já mudou a rodada e pagou os prêmios.
            if (sucessoConfirmado) {
                // 👉 AQUI ENTRA A SUA LÓGICA PERFEITA:
                if (modoRoboAtivo) {
                    iniciarTransicaoRobo();
                } else {
                    // Mensagem de sucesso mais detalhada
                    let msgSucesso = "Evento Finalizado com Sucesso!";
                    if(payload.ganhadores_extra.length > 0) {
                        msgSucesso += `\n\n✅ ${payload.ganhadores_extra.length} Prêmios Extras Processados/Pagos.`;
                    }
                    msgSucesso += "\nO próximo evento foi carregado.";
                
                    customAlert(msgSucesso, "Sucesso", 5); // 5 segundos
                    abrirModalEventos();
                }
            } else {
                abrirModalEventos();
            }
        } else {
            jogoRoboFinalizadoComSucesso = false;
            if (modoRoboAtivo) pararModoRobo(); 
            customAlert("Evento finalizado pelo Sorteio Automatizado.", "Sorteio Automatizado", 3);

           abrirModalEventos();
        }

    } catch (e) { 
        console.error("[DEBUG] Erro ao resetar:", e);
        customAlert("Erro ao resetar: " + e.message); 
    } finally {
        hideLoading();
    }
}


// --- ATUALIZE A FUNÇÃO alternarBotaoReset ---
function alternarBotaoReset(modo) {
    const btn = document.getElementById('resetar_Jogo');
    if (!btn) return;

    if (modo === 'finalizar') {
        // Marca que completou
        jogoFoiFinalizadoComSucesso = true; 

        btn.className = "bg-green-800 hover:bg-green-600 text-white px-4 py-1 rounded font-bold border border-green-500 text-sm flex items-center gap-1 transition-colors duration-300 shadow-lg animate-pulse";
        btn.innerHTML = "✅ FINALIZAR SORTEIO";
    } else {
        // Reseta a variável
        jogoFoiFinalizadoComSucesso = false; 
        btn.className = "bg-red-900 hover:bg-red-700 text-white px-4 py-1 rounded font-bold border border-red-500 text-sm flex items-center gap-1 transition-colors duration-300";
        btn.innerHTML = "⚠️ REINICIAR SORTEIO";
    }
}


// --- FUNÇÃO CORRIGIDA ---
//async function carregarConfigSorteExtraAdmin() {
    // [DEBUG 1] Verifica se a função foi chamada
    //console.log("🚀 carregarConfigSorteExtraAdmin CHAMADA!"); 

    // Pega ID do evento atual
    //if(!dadosEventoAtual || !dadosEventoAtual.id) {
        // [DEBUG 2] Se entrar aqui, é porque chamou cedo demais (antes do evento carregar)
        //console.warn("⚠️ Sorte Extra Abortado: 'dadosEventoAtual' está vazio ou null.");
        //return;
    //}


// 1. Agora aceita o 'idEventoBusca' como parâmetro!
async function carregarConfigSorteExtraAdmin(idEventoBusca) { 
    console.log("🚀 carregarConfigSorteExtraAdmin CHAMADA!"); 

    // 2. Tenta usar o ID passado, se não houver, tenta as globais
    const idParaBuscar = idEventoBusca || (typeof dadosEventoAtual !== 'undefined' && dadosEventoAtual ? dadosEventoAtual.id : null) || window.eventoPendenteID;

    if(!idParaBuscar) {
        console.warn("⚠️ Sorte Extra Abortado: ID do evento não encontrado.");
        return;
    }
    
    try {
        console.log(`🍀 Sorte Extra: Iniciando fetch para Evento ${idParaBuscar}...`);

        const resp = await fetch(`${API_BASE_URL}/api/cliente/config_sorte_extra/${idParaBuscar}`);
        
        if(resp.ok) {
            const cfg = await resp.json();
            // DICA DE OURO: Isto vai mostrar no painel F12 como os campos se chamam realmente
            console.log("📦 DADOS DO SORTE EXTRA RECEBIDOS:", cfg);   
         
            if(cfg.ativo) {
                sorteioExtraConfigAtivo = true;
                qtdeDezenasSorteExtra = parseInt(cfg.qtde_dezenas || 5);
                qtdeTopeSorteExtra  = parseInt(cfg.qtde_tope_sorte_extra || 10); 
                valorPremioMaximoExtra = parseFloat(cfg.premio_maximo) || 0;
                valorPremioIntermediario = parseFloat(cfg.premio_intermediario) || 0;
                valorPremioBase          = parseFloat(cfg.premio_base) || 0;
                valorBonusExtra          = parseFloat(cfg.preco_cupom) || 0;                
                
                // CORREÇÃO NO LOG: Usar a variável 'qtdeTopeSorteExtra'
                console.log(`✅ Sorte Extra ATIVO! Alerta na bola: ${qtdeTopeSorteExtra}`);
                
                // DICA: Atualize algum elemento visual no Admin para saber que carregou
                const divStatus = document.getElementById('status-sorte-extra');
                if(divStatus) divStatus.innerText = `EXTRA ON (Top ${qtdeTopeSorteExtra})`;
            } else {
                console.log("⚪ Sorte Extra está INATIVO neste evento.");
                sorteioExtraConfigAtivo = false;
            }
        }
    } catch(e) { 
        console.error("❌ Erro config extra:", e); 
    }
}


// Função para abrir o modal (Atualizada para 4 Faixas de Acertos)
function abrirModalValidacaoSorteExtra() {
    // 1. Injeta o HTML do modal se não existir

    if (!document.getElementById('modal-sorte-extra')) {  
        const jackpotFormatado = valorPremioMaximoExtra.toLocaleString('pt-BR', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
        const modalHTML = `
        <div id="modal-sorte-extra" class="fixed inset-0 bg-black/10 z-[60] hidden flex items-center justify-center backdrop-blur-sm">
            <div class="bg-gray-900 border-2 border-yellow-500/50 rounded-xl w-full max-w-7xl p-2 shadow-2xl relative flex flex-col max-h-[95vh]">
                
                <div class="flex justify-between items-center mb-1 border-b border-gray-700 pb-2">
                    <div>
                        <h2 class="text-xl font-black text-yellow-500 flex items-center gap-2">
                            🍀 CONFERÊNCIA SORTE EXTRA (TOP ${qtdeTopeSorteExtra || 10})
                        </h2>
                        <div class="flex items-center gap-3 -mb-2">
                            <p class="text-gray-400 text-sm">Validando acertos...</p>
                            <span id="badge-total-cupons" class="bg-gray-700 text-white text-xs px-4 py-1 rounded border border-gray-600">
                                Carregando...
                            </span>
                        </div>
                    </div>
                    <button onclick="fecharValidacaoAdmin()" class="text-gray-500 hover:text-white transition-colors">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div id="loading-extra" class="flex-1 flex flex-col items-center justify-center py-10 hidden">
                    <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-yellow-500 mb-4"></div>
                    <p class="text-yellow-500 animate-pulse font-bold">Auditando Cupons...</p>
                </div>

                <div id="resultados-extra" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar p-1">
                    
                    <div class="bg-gray-800/50 rounded-lg border border-green-500/30 flex flex-col h-[500px]">
                        <div class="bg-green-900/30 p-2 border-b border-green-500/30">
                            <h3 class="font-bold text-green-400 text-center uppercase tracking-wider text-sm">🏆 5 Acertos</h3>
                            <div class="bg-green-800 text-white text-center text-[12px] font-bold px-4 py-1 rounded-full shadow-md border border-green-400 w-fit mx-auto">
                                   JackPot - R$ ${jackpotFormatado}
                            </div>
                        </div> 
                        <div id="lista-acertos-5" class="flex-1 overflow-y-auto p-2 space-y-2"></div>
                    </div>

                    <div class="bg-gray-800/50 rounded-lg border border-blue-500/30 flex flex-col h-[500px]">
                        <div class="bg-blue-900/30 p-2 border-b border-blue-500/30">
                            <h3 class="font-bold text-blue-400 text-center uppercase tracking-wider text-sm">🥈 4 Acertos</h3>
                            <div class="text-[11px] text-center text-gray-300">Prêmio Intermediário</div>
                        </div>
                        <div id="lista-acertos-4" class="flex-1 overflow-y-auto p-2 space-y-2"></div>
                    </div>

                    <div class="bg-gray-800/50 rounded-lg border border-orange-500/30 flex flex-col h-[500px]">
                        <div class="bg-orange-900/30 p-2 border-b border-orange-500/30">
                            <h3 class="font-bold text-orange-400 text-center uppercase tracking-wider text-sm">🥉 3 Acertos</h3>
                            <div class="text-[11px] text-center text-gray-300">Prêmio Base</div>
                        </div>
                        <div id="lista-acertos-3" class="flex-1 overflow-y-auto p-2 space-y-2"></div>
                    </div>

                    <div class="bg-gray-800/50 rounded-lg border border-purple-500/30 flex flex-col h-[500px]">
                        <div class="bg-purple-900/30 p-2 border-b border-purple-500/30">
                            <h3 class="font-bold text-purple-400 text-center uppercase tracking-wider text-sm">✨ 2 Acertos</h3>
                            <div class="text-[11px] text-center text-gray-300">Bônus</div>
                        </div>
                        <div id="lista-acertos-2" class="flex-1 overflow-y-auto p-2 space-y-2"></div>
                    </div>

                </div>

                <div class="mt-2 pt-2 border-t border-gray-700 flex justify-between items-center bg-gray-900">
                    <div class="text-xs text-gray-500 hidden md:block">
                        * Clique no cartão para enviar para a TV.
                    </div>
                    <div class="flex gap-3 w-full md:w-auto justify-end">
                         <button id="btn-limpar-tv" onclick="limparTelaPublicaExtra()" class="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded font-bold border border-gray-500 shadow-lg flex items-center gap-2 text-sm">
                            🧹📺 Limpar TV
                         </button>
                         <button onclick="confirmarPagamentoSorteExtra()" class="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded font-bold shadow-lg flex items-center gap-2 transition-all text-sm">
                             ❌ Fechar
                          </button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // Abre o modal
    const modal = document.getElementById('modal-sorte-extra');
    if(modal) modal.classList.remove('hidden');
    
    // Busca os dados
    buscarGanhadoresExtra();
}

async function confirmarPagamentoSorteExtra() {
    // 1. Se não tiver ninguém pra pagar (lista vazia), apenas fecha.
    if (!cacheGanhadoresExtraFinal || cacheGanhadoresExtraFinal.length === 0) {
        fecharValidacaoAdmin();
        return;
    }

    // Feedback visual rápido no botão (opcional, só para não parecer travado)
    // Como o evento de clique vem do HTML, podemos tentar pegar o alvo, mas
    // para ser direto, vamos focar na ação.
    
    try {
        const payload = {
            id_evento: dadosEventoAtual.id,
            ganhadores: cacheGanhadoresExtraFinal
        };

        // 2. Dispara o pagamento (Processo Silencioso)
        const resp = await fetch(`${API_BASE_URL}/api/admin/pagar_ganhadores_imediato`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        const data = await resp.json();

        if (data.status === 'sucesso') {
            console.log(`✅ Pagamento Automático: ${data.pagos} ganhadores pagos.`);
            // Não mostramos alert de sucesso para não interromper o fluxo.
        } else {
            // Só avisamos se der ERRO, pois aí o operador precisa saber.
            console.error("Erro no pagamento automático:", data.error);
            customAlert("⚠️ Atenção: Ocorreu um erro ao registrar o pagamento financeiro dos ganhadores extra.\nVerifique o console.");
        }

    } catch (e) {
        console.error("Erro de comunicação no pagamento:", e);
        customAlert("⚠️ Erro de conexão ao tentar pagar prêmios.");
    } finally {
        // 3. INDEPENDENTE DO RESULTADO, FECHA A TELA
        // A ordem do usuário foi "Fechar", então fechamos.
        fecharValidacaoAdmin();
    }
}


function fecharValidacaoAdmin() {
    // 1. Dispara a limpeza da tela dos clientes
    limparTelaPublicaExtra();

    // 2. Fecha o modal do Admin imediatamente
    const modal = document.getElementById('modal-sorte-extra');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Função de Busca (Atualiza o contador )
async function buscarGanhadoresExtra() {
    const loading = document.getElementById('loading-extra');
    const content = document.getElementById('resultados-extra');
    const badgeTotal = document.getElementById('badge-total-cupons');
    
    // --- TENTATIVA DE RECUPERAR O ID DO EVENTO ---
    let idParaEnviar = 0;

    // 1. Tenta pegar de variável global (se existir)
    if (typeof eventoAtual !== 'undefined' && eventoAtual && eventoAtual.id) {
        idParaEnviar = eventoAtual.id;
    }
    // 2. Se falhar, tenta pegar de algum input hidden na tela (fallback comum)
    else {
        const inputId = document.getElementById('id_evento_ativo') || document.getElementById('current-event-id');
        if (inputId) idParaEnviar = inputId.value;
    }

    // Debug: Veja no console o que está sendo enviado
    console.log("📤 Enviando pedido de validação para Evento ID:", idParaEnviar);

    if(loading) loading.classList.remove('hidden');
    if(content) content.classList.add('hidden');
    if(badgeTotal) badgeTotal.textContent = "Auditando...";
    
    try {
        const resp = await fetch(`${API_BASE_URL}/api/admin/validar_sorte_extra`, { 
            method: 'POST',
            // OBRIGATÓRIO: Avisar que é JSON
            headers: { 
                'Content-Type': 'application/json' 
            },
            // OBRIGATÓRIO: Enviar o corpo da mensagem
            body: JSON.stringify({ 
                id_evento: parseInt(idParaEnviar) || 0 
            })
        });

        // Se o servidor devolver erro (ex: 400 ou 500)
        if (!resp.ok) {
            const erroTxt = await resp.text(); // Tenta ler o erro como texto
            console.error("❌ Erro do Servidor:", erroTxt);
            throw new Error(`Servidor recusou (Status ${resp.status})`);
        }

        const data = await resp.json();
        
        if (data.status === 'sucesso') {
            // Atualiza Badge
            if(badgeTotal) {
                badgeTotal.textContent = `${data.total_analisado || 0} checados`;
                badgeTotal.classList.remove('bg-gray-700');
                badgeTotal.classList.add('bg-blue-900', 'text-blue-100', 'border-blue-500');
            }

            // =======================================================
            // ✅ CORREÇÃO DOS IDs (Sincronizado com o novo HTML)
            // =======================================================

            // 1. Cinco Acertos (Máximo) - ID HTML: lista-acertos-5
            renderizarListaExtra('lista-acertos-5', data.ganhadores.acertos_5, '5_acertos'); 
            
            // 2. Quatro Acertos (Intermediário) - ID HTML: lista-acertos-4
            renderizarListaExtra('lista-acertos-4', data.ganhadores.acertos_4, '4_acertos');
            
            // 3. Três Acertos (Base) - ID HTML: lista-acertos-3
            renderizarListaExtra('lista-acertos-3', data.ganhadores.acertos_3, '3_acertos');

            // 4. Dois Acertos (Bônus) - ID HTML: lista-acertos-2
            renderizarListaExtra('lista-acertos-2', data.ganhadores.acertos_2, '2_acertos');

            // ======================================================== 
            // 🧠 NOVA LÓGICA: ACUMULAR PARA O FINAL (Tabela Resultados)
            // ========================================================
            
            cacheGanhadoresExtraFinal = []; // Limpa cache anterior para não duplicar

            // Helper atualizado: aceita o parâmetro 'ehValorFixo'
            const processarFaixa = (listaGanhadores, nomeFaixa, valorBase, ehValorFixo) => {
                if(!listaGanhadores || listaGanhadores.length === 0) return;

                const qtdGanhadores = listaGanhadores.length;
                let valorIndividual = 0;
                let valorTotalFaixaDisplay = 0;

                if (ehValorFixo) {
                    // CENÁRIO BÔNUS: Cada um ganha o valor cheio (Ex: R$ 5,00)
                    valorIndividual = valorBase;
                    valorTotalFaixaDisplay = valorBase * qtdGanhadores; // Apenas para registro total
                } else {
                    // CENÁRIO JACKPOT: O valor é dividido entre os ganhadores (Rateio)
                    valorIndividual = valorBase / qtdGanhadores;
                    valorTotalFaixaDisplay = valorBase;
                }

                listaGanhadores.forEach(g => {
                    // Formatações
                    const fmtIndividual = valorIndividual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const fmtTotalFaixa = valorTotalFaixaDisplay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                    cacheGanhadoresExtraFinal.push({
                        premio: nomeFaixa.toUpperCase(),
                        valor_total_premio: fmtTotalFaixa, // Quanto saiu do caixa da banca nessa faixa
                        cartela: g.id.toString(),
                        nome: g.nick,
                        valor_rateio: fmtIndividual, // O que vai aparecer pro cliente (e ser creditado)
                        valor_numerico: valorIndividual, // Float para o backend somar no saldo
                        dezenas_cupom: g.nums,
                        tipo_premiacao: "Sorte Extra"
                    });
                });
            };

            // === DEFINIÇÃO DOS VALORES ===
            // 1. JackPot (5 Acertos) -> RATEIO (Dividido)
            const v5 = valorPremioMaximoExtra; 
            
            // 2. Prêmios Intermediários -> RATEIO (Geralmente)
            const v4 = valorPremioIntermediario;
            const v3 = valorPremioBase;

            // 3. Bônus (2 Acertos) -> VALOR FIXO (Cada um ganha isso)
            const v2 = valorBonusExtra;

            // === PROCESSAMENTO ===
            // (Lista, Nome, ValorBase, ehValorFixo?)
            processarFaixa(data.ganhadores.acertos_5, "5 ACERTOS", v5, false); // false = Rateio
            processarFaixa(data.ganhadores.acertos_4, "4 ACERTOS", v4, false); // false = Rateio
            processarFaixa(data.ganhadores.acertos_3, "3 ACERTOS", v3, false); // false = Rateio
            
            // AQUI ESTÁ A MUDANÇA:
            processarFaixa(data.ganhadores.acertos_2, "2 ACERTOS", v2, true);  // true = Valor Fixo por cabeça

            console.log("📦 Cache Sorte Extra pronto para salvar:", cacheGanhadoresExtraFinal);

            
        } else if (data.status === 'aguardando') {
            customAlert(data.msg);
        }

    } catch(e) {
        console.error("Erro buscarGanhadoresExtra:", e);
        customAlert("Falha na validação. Verifique o console (F12).");
    } finally {
        if(loading) loading.classList.add('hidden');
        if(content) content.classList.remove('hidden');
    }
}


function renderizarListaExtra(elementId, lista, tipoCodigo) {
    const container = document.getElementById(elementId);
    
    // --- PROTEÇÃO CONTRA ERRO (CORREÇÃO DO BUG) ---
    if (!container) {
        console.warn(`⚠️ renderizarListaExtra: Elemento HTML '${elementId}' não encontrado na tela.`);
        return; // Sai da função sem quebrar o sistema
    }
    // ---------------------------------------------

    container.innerHTML = ''; // Limpa lista anterior

    if (!lista || lista.length === 0) {
        container.innerHTML = '<li class="text-gray-500 text-[11px] italic p-2 text-center">Aguardando...</li>';
        return;
    }

    lista.forEach(ganhador => {
        // Cria o elemento visual do ganhador
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-gray-700/50 p-1 mb-1 rounded cursor-pointer hover:bg-gray-600 border border-transparent hover:border-yellow-500 transition-all text-xs";
        
        div.innerHTML = `
            <div class="flex flex-col">
                <span class="text-[12px] font-bold text-white">Cupom: ${ganhador.id}</span>
                <span class="text-yellow-400 font-bold truncate max-w-[90px]">${ganhador.nick.toUpperCase()}</span>
            </div>
            <div class="text-[14px] text-gray-300 bg-gray-800 px-1 py-0.5 rounded ml-1">
                ${ganhador.nums.join('-')}
            </div>
        `;

        div.onclick = () => {
            // Chama a função que envia para o telão
            publicarGanhadorExtra(ganhador, tipoCodigo);
            
            // Feedback visual de clique (piscar)
            div.classList.add('bg-green-700');
            setTimeout(() => div.classList.remove('bg-green-700'), 200);
        };

        container.appendChild(div);
    });
}


async function publicarGanhadorExtra(dados, tipo) {
    const idRodada = id_evento_ativo //  (dadosEventoAtual && (dadosEventoAtual.id_evento || dadosEventoAtual.id)) || 0;

    const labelPremios = {
        '5_acertos': '🏆 JACKPOT (5 ACERTOS)',
        '4_acertos': '🥈 PRÊMIO (4 ACERTOS)',
        '3_acertos': '🥉 PRÊMIO (3 ACERTOS)',
        '2_acertos': '✨ BÔNUS (2 ACERTOS)'
    };

    // Ajustamos o payload para o padrão da tabela 'confere'
    const payload = {
        rodada: parseInt(idRodada),     // ID global da rodada atual
        cartao: dados.id,                  // Número do cupom
        ganhador: dados.nick,              // Nome/Nick do cliente
        numeros: dados.nums.join(' - '),   // Transforma [1,2,3] em "01 - 02 - 03"
        mensagem: labelPremios[tipo] || 'SORTE EXTRA!',
        tipo_conferencia: "SORTE_EXTRA"    // Identificador vital para a TV
    };

    console.log("🚀 Enviando Cupom para o Terminal:", payload);

    try {
        // Chamando a rota específica que criamos no server.py
        const response = await fetch(`${API_BASE_URL}/api/admin/atualizar_conferencia_extra`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            if (!modoRoboAtivo) { 
                customAlert(`🎟️ Cupom ${dados.id} (${dados.nick}) enviado para a TV!`);
            }
        } else {
            throw new Error("Falha na resposta do servidor");
        }
    } catch(e) { 
        console.error("❌ Erro ao publicar cupom:", e);
        if (!modoRoboAtivo) {
            customAlert("Erro ao enviar para o terminal.");
        }
    }
}

async function limparTelaPublicaExtra() {
    
    const idRodadaLimpeza = id_evento_ativo //xxx (dadosEventoAtual && (dadosEventoAtual.id_evento || dadosEventoAtual.id)) || 0;
    const btn = document.getElementById('btn-limpar-tv'); 
    const textoOriginal = btn ? btn.innerText : "🧹📺 Limpar TV";

    if(btn) {
        btn.disabled = true;
        btn.innerText = "⏳ Limpando...";
    }

    // Criamos o payload de "reset" no padrão da tabela confere
    const payloadLimpeza = {
        rodada: parseInt(idRodadaLimpeza),
        cartao: 0,
        numeros: "null",
        ganhador: "null",
        mensagem: "null",
        status: "vazio",
        tipo_conferencia: "BINGO_NORMAL" // Voltamos para o tipo padrão
    };

    try {
        // Chamamos a mesma rota de atualização de conferência
        const resp = await fetch(`${API_BASE_URL}/api/admin/atualizar_conferencia_extra`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payloadLimpeza)
        });

        if (!resp.ok) throw new Error("Falha na comunicação com o servidor");

        console.log("✅ TV limpa: Tabela 'confere' resetada para valores nulos.");

    } catch (e) {
        console.error("Erro ao limpar TV:", e);
        customAlert("Erro ao tentar limpar a tela: " + e.message);
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerText = textoOriginal;
        }
    }
}

// =========================================================
// === 6. INICIALIZAÇÃO ===
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(buscarNomeDaSalaBackend, 500);
    // 1. Config Local
    const savedMode = localStorage.getItem('admin_draw_mode');
    if (savedMode) {
        const radio = document.querySelector(`input[name="modo_sorteio"][value="${savedMode}"]`);
        if (radio) radio.checked = true;
        modoSorteio = savedMode;
        aplicarVisualModoSorteio(savedMode);
    }

    // 2. Listeners de Botões
    const btnF1 = document.getElementById('btn-f1-buscar');
    if(btnF1) btnF1.addEventListener('click', (e) => { e.preventDefault(); abrirSessaoAuditoria(); });

    // 3. Listeners de Inputs Manuais
    const inputManual = document.getElementById('input-bola-manual');
    if (inputManual) {
        // Clona para limpar listeners antigos
        const novoInput = inputManual.cloneNode(true);
        inputManual.parentNode.replaceChild(novoInput, inputManual);

        // --- NOVA LÓGICA: LIMITAR A 2 DÍGITOS (SHIFT LEFT) ---
        novoInput.addEventListener('input', function(e) {
            // 1. Remove qualquer coisa que não seja número
            let valorLimpo = this.value.replace(/\D/g, '');

            // 2. Lógica do Buffer Deslizante:
            // Se tiver mais de 2 dígitos, pega apenas os 2 últimos (corta a esquerda)
            if (valorLimpo.length > 2) {
                valorLimpo = valorLimpo.slice(-2);
            }

            // 3. Atualiza o valor no campo
            this.value = valorLimpo;
        });
        // -----------------------------------------------------

        // Mantém a lógica da tecla ENTER e do atalho '99'
        novoInput.addEventListener('keydown', function(event) {
            if (this.value === '99') { 
                event.preventDefault(); 
                this.value = ''; 
                abrirSessaoAuditoria(); 
                return; 
            }
            if (event.key === 'Enter') { 
                event.preventDefault(); 
                inserirBolaManual(); 
            }
        });
    }

    const inputAudit = document.getElementById('input-auditoria');
    if(inputAudit) {
        const novoAudit = inputAudit.cloneNode(true);
        inputAudit.parentNode.replaceChild(novoAudit, inputAudit);
        novoAudit.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation(); 
                validarCartelaAuditoria();
            }
            if (event.key === 'Escape') { 
                event.preventDefault(); 
                if(this.value) this.value = ''; 
            }
        });
    }    

    // 4. Listeners Globais
    if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']);

    document.addEventListener('keydown', function(event) {
        const modalAudit = document.getElementById('modal-conferencia');
        const isAuditOpen = modalAudit && !modalAudit.classList.contains('hidden');

        if (modoRoboAtivo) return; 
        if (isAuditOpen) return;
 
        if (event.key === 'F1') { event.preventDefault(); abrirSessaoAuditoria(); return; }
        if (event.key === 'Enter') {
            if (modoSorteio === 'auto' && !isSorting && !autoSorteioAtivo) {
                const tagAtiva = document.activeElement.tagName;
                if (tagAtiva !== 'INPUT' && tagAtiva !== 'TEXTAREA') { 
                    event.preventDefault(); 
                    sortearBola(); 
                }
            }
        }    
    });

    const modal = document.getElementById('modal-conferencia');
    if (modal && modal.parentNode !== document.body) document.body.appendChild(modal);

    iniciarRelogio();
    initGrid();
    connectAdminWS();
    devolverFocoAoJogo();
});


function obterPesoExtra(nomePremio) {
    // Garante que é string maiúscula
    const p = nomePremio ? nomePremio.toUpperCase().trim() : "";

    // 🧠 LÓGICA INTELIGENTE:
    // Procura por números (\d+) que aparecem antes da palavra "ACERTO"
    // Ex: "3 ACERTOS" -> acha o 3. "4 ACERTO" -> acha o 4.
    const encontrouNumero = p.match(/(\d+)\s*ACERTO/);

    if (encontrouNumero) {
        // Retorna o próprio número como peso (Ex: retorna 3)
        return parseInt(encontrouNumero[1]);
    }

    // Se não for prêmio de acerto (ex: Figuras), joga para o final da fila
    return 100; 
}

async function processarProximoDaFilaExtra() {
    // 1. Se a fila acabou, destrava e para.
    if (filaSorteExtra.length === 0) {
        processandoFilaExtra = false;
        console.log("🏁 [EXTRA] Fila de ganhadores finalizada.");
        if (premioPrincipalPendente) {
            console.log("🔓 [RETOMADA] Liberando Vitória Principal que estava pendente!");
            const ganhadoresGuardados = premioPrincipalPendente;
            premioPrincipalPendente = null; // Limpa a memória
        
            // Chama a função principal de novo, agora com o caminho livre!
            gerenciarVitoriaRobo(ganhadoresGuardados); 
        }
        return;
    }

    // 2. Avisa que está ocupado
    processandoFilaExtra = true;

    // 3. Pega o primeiro da fila (já ordenado) e remove ele da lista
    const ganhadorAtual = filaSorteExtra.shift();

    try {
        console.log(`▶️ [EXTRA] Processando: ${ganhadorAtual.nome} - ${ganhadorAtual.premio}`);
        // --- AQUI ACONTECE A MÁGICA ---
        // Aqui chamamos a função que valida/comprova no servidor (igual você faz no Bingo)
        // Isso vai fazer aparecer na TV do cliente.
        await validarGanhadorExtra(ganhadorAtual); 
        
    } catch (e) {
        console.error("Erro ao processar ganhador extra:", e);
    }

    let tempoEspera = tempoEsperaConferenciaRobo; // parseInt(document.getElementById('config-winner-time').value) || 5;

    console.log(`⏳ [EXTRA] Aguardando ${tempoEspera} seg para o próximo...`);

    // 5. Agenda o próximo ciclo
    setTimeout(() => {
        processarProximoDaFilaExtra();
    }, tempoEspera * 1000);
}


// --- AÇÃO DO ROBÔ: Efetiva a validação de UM ganhador ---
async function validarGanhadorExtra(ganhador) {
    console.log(`🤖 [ROBO] Enviando ordem de exibição para: ${ganhador.nome}`);

    // Monta o pacote igual ao que o botão manual enviaria
    const payload = { 
        ganhadores: [ganhador], // Envia como lista de um item só
        id_evento: ganhador.rodada || id_evento_ativo // Garante ter o ID
    };

    // Chama a rota que REALMENTE faz aparecer na TV e paga
    // (A mesma rota que usamos para consertar o pagamento antes)
    try {
        const response = await fetch('/api/admin/pagar_ganhadores_imediato', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`✅ [ROBO] Sucesso! ${ganhador.nome} validado.`);
        } else {
            console.error(`❌ [ROBO] Erro ao validar: ${data.erro}`);
        }
    } catch (err) {
        console.error("❌ [ROBO] Erro de conexão:", err);
    }
}

async function dispararVerificacaoRobo() {
    // 1. Identificação do ID do Evento
    let idParaEnvio = id_evento_ativo;
    if (!idParaEnvio && typeof dadosEventoAtual !== 'undefined' && dadosEventoAtual) {
        idParaEnvio = dadosEventoAtual.id || dadosEventoAtual.id_evento;
    }

    if (!idParaEnvio) {
        console.error("❌ [ROBO] Erro: ID do evento não encontrado.");
        if (modoRoboAtivo) toggleAutoSorteio(true); // Retoma para não travar o jogo
        return;
    }

    console.log(`🤖 [ROBO] Iniciando conferência do Sorte Extra para evento: ${idParaEnvio}`);

    try {
        // 2. Consulta a API CORRETA (Mesma usada pelo modo manual)
        const resp = await fetch(`${API_BASE_URL}/api/admin/validar_sorte_extra`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_evento: parseInt(idParaEnvio) || 0 })
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        if (data.status !== 'sucesso') {
            console.log("🤖 [ROBO] Processado, mas sem sucesso na conferência Extra.", data);
            if (modoRoboAtivo) toggleAutoSorteio(true);
            return;
        }

        // 3. Montagem do Cache de Pagamentos (Garante que TODOS, até os de 2 acertos, recebam o prêmio)
        cacheGanhadoresExtraFinal = [];
        
        const processarFaixa = (listaGanhadores, nomeFaixa, valorBase, ehValorFixo) => {
            if(!listaGanhadores || listaGanhadores.length === 0) return;
            const qtdGanhadores = listaGanhadores.length;
            let valorIndividual = ehValorFixo ? valorBase : (valorBase / qtdGanhadores);
            let valorTotalFaixaDisplay = ehValorFixo ? (valorBase * qtdGanhadores) : valorBase;

            listaGanhadores.forEach(g => {
                cacheGanhadoresExtraFinal.push({
                    premio: nomeFaixa.toUpperCase(),
                    valor_total_premio: valorTotalFaixaDisplay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                    cartela: g.id.toString(),
                    nome: g.nick,
                    valor_rateio: valorIndividual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                    valor_numerico: valorIndividual,
                    dezenas_cupom: g.nums,
                    tipo_premiacao: "Sorte Extra"
                });
            });
        };

        // Popula a memória com os pagamentos
        processarFaixa(data.ganhadores.acertos_5, "5 ACERTOS", valorPremioMaximoExtra, false);
        processarFaixa(data.ganhadores.acertos_4, "4 ACERTOS", valorPremioIntermediario, false);
        processarFaixa(data.ganhadores.acertos_3, "3 ACERTOS", valorPremioBase, false);
        processarFaixa(data.ganhadores.acertos_2, "2 ACERTOS", valorBonusExtra, true);

        // 4. Montagem da Fila VISUAL para a TV (SOMENTE 3, 4 e 5 acertos)
        let filaExibicao = [];
        const adicionarAFila = (lista, tipo) => {
            if (lista && lista.length > 0) {
                lista.forEach(g => filaExibicao.push({ dados: g, tipo: tipo }));
            }
        };

        // Adiciona de cima para baixo (para dar mais emoção se tiver um ganhador de 5)
        adicionarAFila(data.ganhadores.acertos_5, '5_acertos');
        adicionarAFila(data.ganhadores.acertos_4, '4_acertos');
        adicionarAFila(data.ganhadores.acertos_3, '3_acertos');

        // 5. Apresentação Sequencial na Tela (O Loop do Robô)
        if (filaExibicao.length > 0) {
            console.log(`🤖 [ROBO] 🎉 Apresentando ${filaExibicao.length} ganhadores do Sorte Extra (3+ acertos) na TV!`);
            let tempoEspera = tempoEsperaConferenciaRobo;     // parseInt(document.getElementById('config-winner-time').value) || 5;

            for (const item of filaExibicao) {
                // Envia para a TV
                await publicarGanhadorExtra(item.dados, item.tipo);
                
                // O Robô espera os segundos configurados antes de mostrar o próximo
                await new Promise(r => setTimeout(r, tempoEspera * 1000));
            }
        } else {
            console.log("🤖 [ROBO] Nenhum ganhador com 3 ou mais acertos para exibir na TV.");
        }

        // 6. Pagamento e Limpeza
        if (cacheGanhadoresExtraFinal.length > 0) {
            console.log(`🤖 [ROBO] Pagando ${cacheGanhadoresExtraFinal.length} cupons no total (incluindo Bônus de 2)...`);
            // Esta sua função já faz o POST de pagamento E limpa a tela da TV no final
            await confirmarPagamentoSorteExtra(); 
        } else {
            // Se ninguém ganhou nada, apenas garante que a TV é limpa
            await limparTelaPublicaExtra();
        }
   } catch (err) {
        console.error("❌ [ROBO] Erro na verificação do Sorte Extra:", err);
        await limparTelaPublicaExtra(); // Limpa a TV em caso de erro por segurança
    } finally {
        // 7. Retoma o Bingo Normal
        console.log("🤖 [ROBO] Verificação do Sorte Extra concluída. Retomando sorteio principal...");
        setTimeout(() => {
            if (modoRoboAtivo) toggleAutoSorteio(true);
        }, 3000); // 3 Segundos de fôlego antes de voltar a atirar bolas
    }
}

function buscarNomeDaSalaBackend() {
    // 1. Pega o ID da variável que você disse que já tem. 
    // (Substitua 'globalIdSala' pelo nome real da sua variável)
    let idParaBusca = typeof currentSalaId !== 'undefined' ? currentSalaId : null;

    // Fallback: Se a variável não existir, tenta pegar da URL (?sala=3)
    if (!idParaBusca) {
        const params = new URLSearchParams(window.location.search);
        idParaBusca = params.get('sala') || '1'; // Padrão 1 se não achar nada
    }
    console.log("🔍 Buscando nome para a sala ID:", idParaBusca);
                                                                     
    // 2. Monta a URL correta para o Nginx direcionar (ex: /sala3/api/get_nome_sala)
    const urlApi =`${API_BASE_URL}/api/get_nome_sala`;
    fetch(urlApi)
        .then(res => {
            if (!res.ok) throw new Error("Erro na resposta da API");
            return res.json();
        })
        .then(data => {
            if (data.nome) {
                // 3. Atualiza o Título
                const elTitulo = document.getElementById('titulo-sala');
                if (elTitulo) {
                    elTitulo.innerText = `🎛️ CENTRAL DE SORTEIO | ${data.nome.toUpperCase()}`;
                }
            }
        })
        .catch(err => console.error("Erro ao carregar nome da sala:", err));
}


// =========================================================
// === MÓDULO DE COMUNICAÇÃO SERIAL (HARDWARE) ===
// =========================================================
/**
 * Abre a porta serial com tratamento de erro e reconexão automática
 */
async function ativarSerial() {
    try {
        // 1. Verifica se já temos permissão de sessões anteriores
        const portasDisponiveis = await navigator.serial.getPorts();
        
        if (portasDisponiveis.length > 0) {
            // Pega a primeira porta disponível (geralmente é a correta)
            portaSerial = portasDisponiveis[0];
            console.log("🔄 Reconectando à porta autorizada anteriormente...");
        } else {
            // Se não tem, abre o popup para o usuário escolher
            portaSerial = await navigator.serial.requestPort();
        }

        // 2. Tenta abrir a porta
        await portaSerial.open({ baudRate: 9600 });
        
        console.log("✅ [HARDWARE] Serial conectada com sucesso!");
       
        // 3. Pega informações do dispositivo (Vendor ID) para "simular" o nome
        const info = portaSerial.getInfo();
        // Se tiver VendorID, usa ele (ex: 2341 é Arduino). Se não, usa "Genérico".
        const idDispositivo = info.usbVendorId ? `(ID: ${info.usbVendorId})` : "";
        
        // Feedback Visual (se o botão existir)
        const btn = document.getElementById('btn-debug-conectar');
        if(btn) {
            btn.textContent = "CONECTADO ✅";
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }

        const btnPrincipal = document.getElementById('btn-ligar-extratora');
        if (btnPrincipal) {
            // Muda a cor para verde e altera o texto
            btnPrincipal.className = "flex items-center gap-2 bg-green-700 text-white px-4 py-1 rounded-lg font-bold border border-green-500 shadow-lg cursor-default";
            // Remove a função de clique para não abrir de novo
            btnPrincipal.onclick = null; 
            btnPrincipal.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                EXTRATORA CONECTADA ${idDispositivo}
            `;
        }        

        customAlert("Extratora Conectada!");

    } catch (err) {
        console.error("❌ [HARDWARE] Erro ao conectar:", err);
        
        // Tratamento específico para o erro que você relatou
        if (err.message.includes("Failed to open serial port")) {
            customAlert("⚠️ A porta parece estar travada!\n\nDica: Desconecte o cabo USB e conecte novamente, ou feche outras abas do navegador.");
        } else {
            customAlert("Erro ao conectar serial: " + err.message);
        }
        
        portaSerial = null; // Reseta a variável para tentar de novo
    }
}

/**
 * Envia comando com Checksum para a CPU Local
 * @param {string} codigoComando - Ex: "F04"
 */
async function enviarComandoHardware(codigoComando) {
    // 1. Verifica se a porta está aberta
    if (!portaSerial || !portaSerial.writable) {
        console.warn(`⚠️ [HARDWARE] Falha: Tentando enviar '${codigoComando}' mas a serial está OFF.`);
        return false;
    }

    try {
        const s_limpa = String(codigoComando).trim();

        // --- Cálculo de Checksum (Lógica Python) ---
        let z = 85; // Valor inicial
        for (let i = 0; i < s_limpa.length; i++) {
            z += s_limpa.charCodeAt(i);
        }
        
        z = z % 256;
        const checksum = (255 - z + 1) % 256;

        // --- Montagem do Payload ---
        const encoder = new TextEncoder(); 
        const dataBytes = encoder.encode(s_limpa);
        
        // Buffer: Dados + 1 byte Checksum + 2 bytes (\r\n)
        const payload = new Uint8Array(dataBytes.length + 3);
        payload.set(dataBytes);
        payload[dataBytes.length] = checksum;
        payload[dataBytes.length + 1] = 13; // \r 
        payload[dataBytes.length + 2] = 10; // \n 

        // --- Envio ---
        const writer = portaSerial.writable.getWriter();
        await writer.write(payload);
        writer.releaseLock();

        console.log(`[%] 📤 [HARDWARE] Enviado: ${s_limpa} (Checksum: ${checksum})`);
        return true;

    } catch (e) {
        console.error(`[%] ❌ [HARDWARE] Erro de escrita: ${e.message}`);
        return false;
    } 
}


// Variável para não abrir vários timers ao mesmo tempo
let tentandoReconectar = false;

function exibirErroConexao() {
    // Se já estiver tentando, não faz nada para não encavalar
    if (tentandoReconectar) return;
    
    tentandoReconectar = true;
    const overlay = document.getElementById('overlay-conexao');
    if(overlay) overlay.classList.remove('hidden');

    iniciarCicloReconexao();
}

function iniciarCicloReconexao() {
    let segundos = 2; // Tempo entre tentativas
    const contadorSpan = document.getElementById('countdown-connection');
    
    // Atualiza o número na tela (2... 1...)
    if(contadorSpan) contadorSpan.innerText = segundos;

    const contagem = setInterval(() => {
        segundos--;
        if(contadorSpan) contadorSpan.innerText = segundos;

        if (segundos <= 0) {
            clearInterval(contagem);
            testarConexaoComServidor(); // Tenta falar com o servidor
        }
    }, 1000);
}

function testarConexaoComServidor() {
    // Tenta bater na rota mais leve do servidor apenas para ver se ele responde
    // Use a URL dinâmica que criamos antes
    const protocolo = window.location.protocol;
    const hostname = window.location.hostname;
    // Se estiver na DigitalOcean app platform, não use porta. Se for local, use :3001
    // Ajuste conforme sua configuração atual:
    const porta = (hostname.includes('digitalocean')) ? '' : ':3001'; 
    
    const urlTeste = `${protocolo}//${hostname}${porta}/api/estado_atual`;

    console.log("📡 Testando conexão com:", urlTeste);

    fetch(urlTeste)
    .then(response => {
        if (response.ok) {
            // SUCESSO! O servidor respondeu.
            console.log("✅ Conexão restabelecida!");
            ocultarErroConexao();
        } else {
            // Servidor respondeu com erro (ex: 500), mas respondeu.
            // Consideramos conectado ou tentamos de novo? Geralmente tentamos de novo.
            throw new Error("Servidor com erro interno");
        }
    })
    .catch(error => {
        // FALHA! Ainda sem internet ou servidor caiu.
        console.log("❌ Ainda desconectado...");
        iniciarCicloReconexao(); // Reinicia o contador de 2 segundos
    });
}


function ocultarErroConexao() {
    const overlay = document.getElementById('overlay-conexao');
    if(overlay) overlay.classList.add('hidden');
    
    tentandoReconectar = false;
    
    // Opcional: Forçar uma atualização dos dados imediatamente
    // buscarDadosDoJogo(); 
}

// Adicione isso no final do admin.js
window.addEventListener("beforeunload", async (event) => {
    if (portaSerial) {
        try {
            // Se estiver escrevendo, tenta liberar
            if (portaSerial.writable && portaSerial.writable.locked) {
               // Não conseguimos forçar o desbloqueio síncrono no unload,
               // mas podemos tentar fechar a porta.
            }
            await portaSerial.close();
            console.log("🔒 Porta serial fechada ao sair.");
        } catch (e) {
            console.error("Erro ao fechar porta na saída:", e);
        }
    }
});

// =========================================================
// === CONTROLE DE VISIBILIDADE DA EXTRATORA (SERIAL) ===
// =========================================================

function atualizarVisibilidadeExtratora() {
    const radioManual = document.querySelector('input[name="modo_sorteio"][value="manual"]');
    const btnExtratora = document.getElementById('btn-ligar-extratora');
    const painelDebug = document.getElementById('painel-debug-serial');

    if (radioManual && radioManual.checked) {
        // MODO MANUAL: Mostra o botão
        if(btnExtratora) btnExtratora.classList.remove('hidden');
    } else {
        // MODO DIGITAL: Esconde tudo
        if(btnExtratora) btnExtratora.classList.add('hidden');
        
        // Se o painel de debug estiver aberto, fecha ele também
        if(painelDebug && !painelDebug.classList.contains('hidden')) {
            painelDebug.classList.add('hidden');
        }
    }
}

// Adiciona os eventos aos Radio Buttons assim que a página carregar
window.addEventListener('DOMContentLoaded', () => {
    const radios = document.querySelectorAll('input[name="modo_sorteio"]');
    radios.forEach(radio => {
        radio.addEventListener('change', atualizarVisibilidadeExtratora);
    });

    // Chama uma vez para definir o estado inicial
    atualizarVisibilidadeExtratora();
});

// ==============================================================================
// 🤖 MOTOR DE TRANSIÇÃO AUTÓNOMA (MODO ROBÔ)
// ==============================================================================

let roboTransitionInterval = null;

// 1. FUNÇÃO PRINCIPAL: Busca o próximo evento e inicia a contagem
async function iniciarTransicaoRobo() {
    if (!modoRoboAtivo) return; // Segurança dupla

    const idAtual = id_evento_ativo || 0;
    console.log(`🤖 [ROBO-TRANSITION] Jogo finalizado! Buscando o próximo evento na fila...`);

    try {
        const resp = await fetch(`${API_BASE_URL}/api/admin/proximo_evento_robo?id_evento_atual=${idAtual}`);
        const data = await resp.json();
        jogoFoiFinalizadoComSucesso = false;  
        jogoRoboFinalizadoComSucesso = false;
        if (data.status !== 'ok') {
            console.log(`🤖 [ROBO-TRANSITION] Fim da linha: ${data.msg || data.erro}`);
            modoRoboAtivo = false;
            atualizarCheckboxRobo(false);
            customAlert("🏁 Fim do Expediente! Não há mais eventos agendados.");
            return;
        }

        console.log(`🤖 [ROBO-TRANSITION] Próximo Alvo: ${data.descricao} (ID: ${data.id_evento}). Inicia em ${data.segundos_restantes}s`);
        
        // Dispara o painel visual
        exibirPainelTransicaoRobo(data);

    } catch (e) {
        console.error("❌ Erro de comunicação na transição do Robô:", e);
        customAlert("Erro ao buscar próximo evento. Automação pausada.");
        modoRoboAtivo = false;
        atualizarCheckboxRobo(false);
    }
}

// 2. FUNÇÃO VISUAL: Cria e controla o cronómetro na tela xyx
function exibirPainelTransicaoRobo(dadosEvento) {
    let tempoRestante = dadosEvento.segundos_restantes;
    let id_proximo_evento = dadosEvento.id_evento;

// 👉 A SUA IDEIA AQUI: O Maestro avisa os terminais!
    console.log("📢 [ROBÔ] Disparando aviso de transição para todos os terminais...");
    fetch(`${API_BASE_URL}/api/admin/avisar_transicao_robo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempo_restante: tempoRestante })
    })
    .catch(e => console.error("❌ Erro ao avisar os terminais:", e));

    // Cria a UI dinâmica (assim não precisamos alterar o HTML)

    let painel = document.getElementById('robo-transition-panel');
    if (!painel) {
        painel = document.createElement('div');
        painel.id = 'robo-transition-panel';
        painel.className = "fixed inset-0 bg-black bg-opacity-90 z-[9999] flex flex-col items-center justify-center text-white backdrop-blur-sm transition-opacity";
        document.body.appendChild(painel);
    }
 
    const tempoVendas = dadosEvento.tempo_vendas_config;

    const atualizarTela = () => {
        const minutos = Math.floor(tempoRestante / 60).toString().padStart(2, '0');
        const segundos = (tempoRestante % 60).toString().padStart(2, '0');
        
        let statusTexto = "⏳ AGUARDANDO ABERTURA DE VENDAS...";
        let corTexto = "text-blue-400";
        let corBorda = "border-gray-700";

        if (tempoRestante <= tempoVendas) {
            statusTexto = `🔥 VENDAS ABERTAS! FECHANDO...`;
            corTexto = "text-red-500 font-bold animate-pulse";
            corBorda = "border-red-900 shadow-[0_0_30px_rgba(220,38,38,0.5)]";
        }

        painel.innerHTML = `
            <div class="bg-gray-900 border-2 ${corBorda} rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl transition-all duration-500">
                <h2 class="text-3xl font-black text-yellow-500 mb-2 flex items-center justify-center gap-2">
                    <span class="animate-spin-slow">⚙️</span> MODO AUTÓNOMO
                </h2>
                <p class="text-gray-300 text-lg mb-6">Preparando o próximo evento...</p>
                
                <div class="bg-gray-800 rounded-xl p-6 mb-8 border border-gray-700">
                    <h3 class="text-2xl font-bold text-white mb-2 truncate">${dadosEvento.descricao}</h3>
                    <p class="text-gray-400 mb-2">Iniciando em:</p>
                    <div class="text-7xl font-mono ${corTexto} tracking-widest mb-4 font-black">
                        ${minutos}:${segundos}
                    </div>
                    <div class="bg-gray-950 rounded-lg py-2">
                        <p class="${corTexto} text-sm uppercase tracking-wider">${statusTexto}</p>
                    </div>
                </div>

                <button onclick="cancelarTransicaoRobo()" class="bg-red-600 hover:bg-red-700 border-b-4 border-red-800 text-white font-black py-4 px-8 rounded-xl shadow-lg transition-all active:translate-y-1 active:border-b-0 w-full text-xl flex items-center justify-center gap-3">
                    <span class="text-2xl">🛑</span> CANCELAR AUTOMAÇÃO
                </button>
            </div>
        `;
    };

    atualizarTela(); // Desenha o ecrã no segundo 0

    // Limpa o timer antigo por segurança
    if (roboTransitionInterval) clearInterval(roboTransitionInterval);

    // O "Coração" do relógio
    let vendasFechadasPeloRobo = false;

    roboTransitionInterval = setInterval(() => {

        // 👉 GATILHO BLINDADO: Se chegou na hora (ou passou) E ainda não fechou...
        if (tempoRestante <= dadosEvento.tempo_vendas_config && !vendasFechadasPeloRobo) {
            
            vendasFechadasPeloRobo = true; // 2. Levanta a bandeira para NUNCA mais repetir!
            
            console.log(`🤖 [ROBÔ] Faltam ${tempoRestante}s. Trancando as vendas do evento ${dadosEvento.id_evento}!`);
    
            fetch(`${API_BASE_URL}/api/admin/fechar_vendas_evento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_evento: dadosEvento.id_evento })
            })
            .then(res => res.json())
            .then(data => console.log("🤖 [ROBÔ] Resposta do fechamento:", data))
            .catch(e => console.error("❌ Erro ao fechar vendas pelo robô:", e));
        }

        tempoRestante--;
        
        if (tempoRestante <= 0) {
            clearInterval(roboTransitionInterval);
            painel.classList.add('hidden'); // Esconde o painel
            
            console.log(`🤖 [ROBO-TRANSITION] Tempo esgotado! Carregando evento ${dadosEvento.id_evento}...`);
            
            // 👉 O GATILHO MESTRE: Arranca o próximo jogo!
            if (typeof executarCarregamentoReal === 'function') {
                executarCarregamentoReal(dadosEvento.id_evento);
                
                // Dá um tempinho para a tela desenhar as cartelas e solta o robô!
                setTimeout(() => {
                    if (modoRoboAtivo) toggleAutoSorteio(true);
                }, 3000);
            }
        } else {
            atualizarTela();
        }
    }, 1000);
    
    painel.classList.remove('hidden');
}

// 3. FUNÇÃO DE PÂNICO: Cancela tudo e devolve o controlo ao Locutor
window.cancelarTransicaoRobo = function() {
    if (roboTransitionInterval) clearInterval(roboTransitionInterval);
    
    const painel = document.getElementById('robo-transition-panel');
    if (painel) painel.classList.add('hidden');
    
    modoRoboAtivo = false;
    atualizarCheckboxRobo(false);
    
    console.log("🛑 Automação cancelada pelo utilizador.");
    customAlert("Modo Autónomo Cancelado. O controlo voltou para o modo manual.");
};

// Função auxiliar para desligar o botão visual do Robô, se existir
function atualizarCheckboxRobo(estado) {
    const chkRobo = document.getElementById('config-sorteio-automatizado');
    if (chkRobo) chkRobo.checked = estado;
}