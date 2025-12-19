// =========================================================
// === ADMIN.JS - SISTEMA COMPLETO V4 (FINAL) ===
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
let MAX_BOLAS = 90;

let cartelasPendentesAuditoria = [];
let idsConfirmadosNestaRodada = new Set()

let bolasEmTransito = new Set();
let aguardandoVideo = 0; // temporizaor de atraso

// --- MATRIZ DE SINCRONIA (BUFFER DE SAÍDA) ---
let matrizEnvio = []; 
let bolasCacheLocal = new Set();
let timerSincronia = setInterval(processarMatrizEnvio, 100);

let matrizAcoes = []; 

// --- VARIÁVEIS DO MODO ROBÔ ---
let modoRoboAtivo = false;       
let processandoVitoria = false;  

// Controle de Hardware/Config
let modoSorteio = 'auto'; 
let vozAtiva = true;   
let cameraAtiva = false;
let sorteioAutomatizadoConfig = false; 

// --- VARIÁVEIS DE CONEXÃO ---
let socket = null;
let reconnectInterval = null;
let countdownInterval = null;
let houveGanhadorNaSessao = false;
const RECONNECT_DELAY = 5000;
//const API_BASE_URL = ""; 
//const WS_URL = `ws://${window.location.host}/ws`; 


// =========================================================
// === 1. LÓGICA ATRASO DA GRAVAÇÃO ===
// =========================================================

async function processarMatrizEnvio() {
    // 1. Se a fila estiver vazia, encerra o ciclo atual
    if (matrizEnvio.length === 0) return;

    // 2. Pega o primeiro item da fila (FIFO - First In, First Out)
    // Apenas "olha" o item, não remove ainda.
    const item = matrizEnvio[0]; 
    
    // 3. Define qual é o atraso a ser respeitado nesta rodada
    // Se o modo for 'manual', usa a variável global aguardandoVideo.
    // Se for 'automático' ou 'digital', força zero para ser instantâneo.
    const delay = (modoSorteio === 'manual') ? (aguardandoVideo || 0) : 0;

    console.log(`Delay Configurado: ${delay}ms | Tempo Passado: ${Date.now() - item.hora}ms`);

    // 4. Verifica matemática do tempo: (Agora - HoraCriacao >= Delay)
    if (Date.now() - item.hora >= delay) {
        
        // --- HORA DA AÇÃO! ---
        
        // Remove o item da fila imediatamente para evitar processamento duplo
        matrizEnvio.shift(); 
        
        console.log(`📡 Sincronia Vídeo: Liberando [${item.tipo}] Valor: ${item.valor} após ${(Date.now() - item.hora)}ms`);

        try {
            // --- CASO 1: LIBERAR BOLA NA TELA DO CLIENTE ---
            if (item.tipo === 'BOLA_CLIENTE') {
                await fetch(`${API_BASE_URL}/api/admin/publicar_bola`, {
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify({ bola: item.valor })
                });
            } 
            
            else if (item.tipo === 'PREMIO_CLIENTE') {
                console.log(`📡 Sincronia: Atualizando Prêmio Público para ${item.valor}`);
                await fetch(`${API_BASE_URL}/api/admin/definir_premio_publico`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ premio: item.valor })
                });
            }    
        
            // --- CASO 3: LIMPAR TELA DE GANHADORES (Se necessário) ---
            // Usado quando o locutor confirma o ganhador e quer limpar a tela da TV após o delay
            else if (item.tipo === 'LIMPAR_PUBLICO') {
                await fetch(`${API_BASE_URL}/api/admin/limpar_conferencia_publica`, {
                    method: 'POST'
                });
            }

        } catch (e) {
            console.error(`❌ Erro crítico ao sincronizar [${item.tipo}]:`, e);
            // Nota: Não recolocamos na fila para não travar o fluxo do jogo.
            // O erro fica no log e o sistema segue para o próximo item.
        }
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
    //  temporizar
    customAlert("🤖 O Sorteio Automatizado foi iniciado!\n\nO sistema irá gerenciar bolas, ganhadores e prêmios sozinho.", "Modo Robô Ativo",5);
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
    if (processandoVitoria) return; 
    processandoVitoria = true;
    console.log("🤖 Robô detectou vitória!", ganhadores);

    if (autoSorteioAtivo) pararAutoSorteio();

    let tempoEspera = parseInt(document.getElementById('config-winner-time').value) || 20;
    
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
        pararModoRobo(); 
        await resetarJogo(true); 
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

    // --- AJUSTE: MUDANÇA PARA 5 COLUNAS (Grid Layout) ---
    container.className = "grid grid-cols-5 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar";

    lista.forEach(item => {
        const btn = document.createElement('button');
        // Estilo compacto para caber em 3 colunas
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


// SUBSTITUA A FUNÇÃO renderGridConferencia POR ESTA VERSÃO CORRIGIDA:

function renderGridConferencia(data) {
    const grid = document.getElementById('conf-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    // Converte bolas cantadas para Strings para facilitar comparação
    const bolas = (data.bolas || bolasSorteadasCache || []).map(String);
    
    // --- VARIÁVEIS DE DADOS CORRIGIDAS ---
    const tipoJogo = data.layout?.tipo || 90; // Pega o tipo do layout
    let numerosDaCartela = [];

    if (tipoJogo === 75) {
        // CORREÇÃO: Usa o campo 'lista' dentro de 'layout' que vem do backend 75
        numerosDaCartela = data.layout?.lista || [];
    } else {
        // MODO 90: Usa os campos separados
        numerosDaCartela = (data.layout?.superior || [])
                            .concat(data.layout?.central || [])
                            .concat(data.layout?.inferior || []);
    }
    // -------------------------------------


    // --- MODO BINGO 75 (Matriz 5x5) ---
    // A condição agora é baseada no tipo do layout
    if (tipoJogo === 75 && numerosDaCartela.length === 25) { 
        
        grid.className = "grid grid-cols-5 gap-1 bg-black p-2 rounded border border-gray-600 w-full max-w-[300px] mx-auto";
        
        // --- LÓGICA DE TRANSPOSIÇÃO CORRIGIDA ---
        for (let linha = 0; linha < 5; linha++) {
            for (let coluna = 0; coluna < 5; coluna++) {
                
                // Índice = (coluna * 5) + linha (Índices que você me passou)
                const index = (coluna * 5) + linha;
                const num = numerosDaCartela[index];
                
                const cell = document.createElement('div');

                // O free space é o índice 12, que geralmente é 0
                const isFree = (index === 12 && num === 0);
                let marcado = bolas.includes(String(num)) || isFree; 

                // Estilo da Célula
                let cssClass = "h-10 w-full flex items-center justify-center font-bold text-sm rounded border ";
                
                if (isFree) {
                    cssClass += "bg-green-600 text-white border-green-400"; // Estilo FREE
                    cell.textContent = "★";
                } else {
                    if (marcado) {
                        cssClass += "bg-yellow-500 text-black border-yellow-300 shadow-inner";
                    } else {
                        cssClass += "bg-gray-800 text-white border-gray-600";
                    }
                    cell.textContent = num;
                }
                
                cell.className = cssClass;
                grid.appendChild(cell);
            }
        }
    } 
    // --- MODO BINGO 90 (3 Linhas - MANTIDO NOVO) ---
    else if (tipoJogo === 90 && data.layout) {
        grid.className = "flex flex-col gap-2 bg-black p-2 rounded border border-gray-600";
        
        [data.layout.superior, data.layout.central, data.layout.inferior].forEach(linha => {
            const row = document.createElement('div'); 
            row.className = "flex justify-between gap-1";
            
            linha.forEach(num => { // Linha 240 (onde o erro ocorria)
                const cell = document.createElement('div');
                const marcado = bolas.includes(String(num));
                
                cell.className = `w-full h-9 flex items-center justify-center font-bold text-lg rounded border ${marcado ? "bg-yellow-500 text-black border-yellow-300" : "bg-gray-800 text-gray-300 border-gray-600"}`;
                cell.textContent = num;
                row.appendChild(cell);
            });
            grid.appendChild(row);
        });
    }
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
        // Pequeno delay para suavizar a saída
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    }
}


// =========================================================
// === 2. SISTEMA DE CONEXÃO & WEBSOCKET ===
// =========================================================

function gerenciarEstadoConexao(online) {
    const overlay = document.getElementById('overlay-conexao');
    const countdownSpan = document.getElementById('countdown-connection');
    if (online) {
        if(overlay) overlay.classList.add('hidden');
        if (countdownInterval) clearInterval(countdownInterval);
        carregarDadosIniciaisSilencioso();
    } else {
        if(overlay) overlay.classList.remove('hidden');
        if (modoRoboAtivo) pararModoRobo();
        
        let count = RECONNECT_DELAY / 1000;
        if(countdownSpan) countdownSpan.textContent = count;
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            count--; if(count < 0) count = RECONNECT_DELAY / 1000;
            if(countdownSpan) countdownSpan.textContent = count;
        }, 1000);
    }
}

function connectAdminWS() {
    if (socket) { socket.onclose = null; socket.close(); }
    try { socket = new WebSocket(WS_URL); } 
    catch (e) { agendarReconexao(); return; }
    
    socket.onopen = () => gerenciarEstadoConexao(true);
    socket.onmessage = (event) => processarMensagemWS(event);
    socket.onclose = (event) => { if (!event.wasClean) { gerenciarEstadoConexao(false); agendarReconexao(); } };
    socket.onerror = () => socket.close();
}

function agendarReconexao() {
    if (reconnectInterval) clearTimeout(reconnectInterval);
    reconnectInterval = setTimeout(connectAdminWS, RECONNECT_DELAY);
}

async function carregarDadosIniciaisSilencioso() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/initial-data`);
        const data = await response.json();

        // Se a API retornar parametrosInfo no initial-data:
        if (data.parametrosInfo) {
            aguardandoVideo = parseInt(data.parametrosInfo.aguardandoVideo) || 0;
            document.getElementById('config-atraso-video').value =aguardandoVideo; 
            vozAtiva = data.parametrosInfo.voz_ativa !== undefined ? data.parametrosInfo.voz_ativa : true;
        }
        
        // --- DETECTOR DE MODO ---
        if (data.evento && parseInt(data.evento.tipo_cartela) === 25) {
            MAX_BOLAS = 75;
            // console.log("🎱 Modo Bingo 75 ativado!"); // Opcional no silencioso
        } else {
            MAX_BOLAS = 90;
        }

        // --- CORREÇÃO VISUAL (O PULO DO GATO) ---
        // Verifica quantas bolas tem na tela agora. Se for diferente do novo MAX_BOLAS, redesenha.
        const totalBolasNaTela = document.querySelectorAll('[id^="admin-ball-"]').length;
        if (totalBolasNaTela !== MAX_BOLAS) {
            initGrid(); // Só recria o HTML se o tamanho mudou
        }
        // ----------------------------------------

        if(data.bolasData && data.bolasData[0]) {
             bolasSorteadasCache = data.bolasData[0].bolas_cantadas || [];
             updateGrid(bolasSorteadasCache);
        }
    } catch(e) {
        // Silencioso: não faz nada no erro
    }
}


// SUBSTITUA A FUNÇÃO processarMensagemWS POR ESTA:

function processarMensagemWS(event) {
    const payload = JSON.parse(event.data);
    
    if (payload.type === 'UPDATE') {
        
        // ============================================================
        // 1. GERENCIAMENTO DAS BOLAS (MESA vs PÚBLICO)
        // ============================================================
        let dadosBolas = [];

        // Prioridade: Se tiver dados da Mesa (Admin em Tempo Real), usa eles.
        if (payload.bolasMesaData && payload.bolasMesaData.length > 0) {
            dadosBolas = payload.bolasMesaData;
            // console.log("🛠️ Painel Admin: Usando dados da MESA");
        } else {
            // Senão, usa os dados públicos (com delay) como fallback
            dadosBolas = payload.bolasData || []; 
        }

        if (dadosBolas.length > 0) {
            const ultimoSorteio = dadosBolas[0]; // Pega o objeto mais recente
            
            // --- CORREÇÃO IMPORTANTE AQUI ---
            // Os números reais estão dentro de 'bolas_cantadas'
            const listaDeNumeros = ultimoSorteio.bolas_cantadas || [];
            
            // Atualiza cache local
            bolasSorteadasCache = listaDeNumeros; // Se sua variável for um Array
            // Se bolasSorteadasCache for um Set, use: new Set(listaDeNumeros);

            // Controle de Áudio/Alerta
            if (listaDeNumeros.length > ultimoTotalBolasProcessadas || listaDeNumeros.length === 0) {
                ultimoTotalBolasProcessadas = listaDeNumeros.length;
                jaAlertouNestaBola = false;
            }

            // Atualiza o Grid (Passando a lista de números limpa)
            if (typeof updateGrid === 'function') {
                updateGrid(listaDeNumeros);
            } else if (typeof atualizarGridVisual === 'function') {
                atualizarGridVisual(listaDeNumeros);
            }

            // Atualiza Bola Destaque (A bola grande)
            if (bolaDestaque) {
                // Preferência: Usar o campo explícito 'proxima_bola' se existir
                if (ultimoSorteio.proxima_bola && ultimoSorteio.proxima_bola !== "--") {
                    bolaDestaque.textContent = ultimoSorteio.proxima_bola;
                } else if (listaDeNumeros.length > 0) {
                    // Fallback: Pega a última do array
                    bolaDestaque.textContent = listaDeNumeros[listaDeNumeros.length - 1];
                }
            }
        }

        // ============================================================
        // 2. STATUS E PRÊMIO ("Buscando...")
        // ============================================================
        if (payload.buscandoMesaData && payload.buscandoMesaData.length > 0) {
            const dados = payload.buscandoMesaData[0];
            let premio = dados?.buscando_o_premio || '...';
            const linhas = dados?.buscando_a_linha || '';
            
            // Máscara Visual para Bingo 75
            if (typeof MAX_BOLAS !== 'undefined' && MAX_BOLAS === 75) {
               if (premio === 'QUADRA') premio = '4 CANTOS';
            }

            // Monta texto com linhas (Ex: LINHA (SUP,CEN))
            let textoCompleto = premio;
            if (linhas && (premio === 'LINHA' || premio === '3 LINHAS')) {
                textoCompleto += ` (${linhas})`;
            }

            // Atualiza UI
            const elStatus = document.getElementById('status-premio');
            if (elStatus) elStatus.textContent = `Buscando: ${textoCompleto}`;
    
            const elTitulo = document.getElementById('premio-atual'); 
            if (elTitulo) elTitulo.textContent = premio;
        }

        // ============================================================
        // 3. CONFIGURAÇÕES DO SERVIDOR
        // ============================================================
        if (payload.parametrosInfo) {
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

        // ============================================================
        // 4. LISTA DE GANHADORES
        // ============================================================
        // Prioriza a lista Live (Admin) se existir, senão usa a do Cliente
        if (payload.ganhadoresLive && payload.ganhadoresLive.length > 0) {
            if (typeof renderListaGanhadores === 'function') renderListaGanhadores(payload.ganhadoresLive);
        } else if (payload.ganhadoresData) {
            if (typeof renderListaGanhadores === 'function') renderListaGanhadores(payload.ganhadoresData);
        }
        // 5. Ranking e Lógica de Vitória (Mantido igual)

//----
if (payload.melhoresData) {
    let tipoPremioBuscado = "BINGO";
    if (payload.buscandoMesaData && payload.buscandoMesaData[0]) tipoPremioBuscado = payload.buscandoMesaData[0].buscando_o_premio;
    
    renderRanking(payload.melhoresData, tipoPremioBuscado);

    if (MAX_BOLAS === 75) {
        // --- BINGO 75 (PADRÕES) ---
        // Aqui NÃO incluímos 'FALTA 1' ou 'FALTA UM' para evitar spam na auditoria
        paradasObrigatorias = ['QUADRA', 'LINHA', 'BINGO', 'DUPLO BINGO', '4 CANTOS', '4 CANTOS E LINHA'];
        termosVitoria = ['BINGO', 'LINHA', 'QUADRA', '4 CANTOS', '4 CANTOS E LINHA'];
    
    } else {
        // --- BINGO 90 (CLÁSSICO) ---
        // Aqui mantemos 'FALTA UM' pois ele pode ser um prêmio pago
        paradasObrigatorias = ['QUADRA', 'LINHA', 'FALTA UM', 'BINGO', 'DUPLO BINGO'];
        termosVitoria = ['BINGO', 'LINHA', 'QUADRA', 'FALTA 1', 'FALTA UM', 'DUPLO BINGO'];
    }
    
    //const paradasObrigatorias = ['QUADRA', 'LINHA', 'FALTA UM', 'BINGO', 'DUPLO BINGO', '4 CANTOS', '4 CANTOS E LINHA'];
    const ganhadoresAtuais = payload.melhoresData.filter(item => {
        const status = (item.premio && item.premio !== "null") ? item.premio.toUpperCase() : "";
        return paradasObrigatorias.some(termo => status.includes(termo)); 
    });

    //const termosVitoria = ['BINGO', 'LINHA', 'QUADRA', '4 CANTOS', 'FALTA 1', 'FALTA UM'];

    const novosContemplados = payload.melhoresData.filter(item => {
        const status = (item.premio && item.premio !== "null") ? item.premio.toUpperCase() : "";
        return termosVitoria.some(termo => status.includes(termo));              
    });

    if (!modoRoboAtivo) {
        novosContemplados.forEach(novo => {
        const ID = String(novo.cartela).trim();
        if (!idsConfirmadosNestaRodada.has(ID) && 
            !cartelasPendentesAuditoria.some(c => String(c.cartela).trim() === ID)) {
               cartelasPendentesAuditoria.push({
                   cartela: ID, 
                   nome: novo.nome === "null" ? "Balcão" : novo.nome,
                   premio: novo.premio 
               });
            }
        });
    } else {
         cartelasPendentesAuditoria = [];
    }

            if (ganhadoresAtuais.length > 0) {
                if (modoRoboAtivo) {
                    if (!processandoVitoria) {
                        if (autoSorteioAtivo) pararAutoSorteio();
                        processandoVitoria = true; 
                        console.log("⏳ Aguardando sincronização visual dos terminais (3s)...");
                        setTimeout(() => {
                            processandoVitoria = false; 
                            gerenciarVitoriaRobo(ganhadoresAtuais);
                        }, 4000); 
                    }
                } else { 
                    if (autoSorteioAtivo) {
                        pararAutoSorteio();
                        customAlert("Alerta de Premiação! Sorteio pausado.");
                        jaAlertouNestaBola = true;
                    } else if (!jaAlertouNestaBola) {
                        customAlert("Alerta de Premiação!");
                        jaAlertouNestaBola = true;
                    }
                }
            }
        }
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
        btnOk.className = "bg-blue-600 hover:bg-blue-500 text-white font-bold py-1 px-6 rounded-lg shadow-lg";
        
        // Se tiver tempo, mostra no botão (opcional, visualmente útil)
        if (tempo > 0) {
            btnOk.textContent = `OK (${tempo}s)`;
        } else {
            btnOk.textContent = "OK";
        }

        let timerId = null;

        // Função unificada para fechar
        const fechar = () => {
            if (timerId) clearTimeout(timerId); // Cancela o timer se clicou antes
            fecharCustomModal(); 
            resolve(); 
        };

        btnOk.onclick = fechar;
        
        modalActions.appendChild(btnOk);
        abrirCustomModal();
        btnOk.focus();

        // Lógica do Temporizador
        if (tempo > 0) {
            timerId = setTimeout(fechar, tempo * 1000); // Converte segundos para ms
        }
    });
}


function customConfirm(mensagem, titulo = "❓ Confirmação") {
    return new Promise((resolve) => {
        modalTitle.textContent = titulo;
        modalMessage.innerText = mensagem;
        modalActions.innerHTML = '';
        const btnCancel = document.createElement('button');
        btnCancel.className = "bg-gray-600 hover:bg-gray-500 text-white font-bold py-1 px-4 rounded-lg";
        btnCancel.textContent = "Cancelar";
        btnCancel.onclick = () => { fecharCustomModal(); resolve(false); };
        const btnConfirm = document.createElement('button');
        btnConfirm.className = "bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-4 rounded-lg shadow-lg";
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
        // Abrir Menu
        menu.classList.remove('-translate-x-full'); 
        overlay.classList.remove('hidden'); 
    } else { 
        // Fechar Menu
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

// --- FUNÇÃO CORRIGIDA: ABRIR MODAL EVENTOS (COM NO-CACHE) ---
async function abrirModalEventos() {
    const contadorTexto = document.getElementById('contador-bolas').textContent;
    const numeroBolas = parseInt(contadorTexto.split('/')[0]); 
    if (numeroBolas > 0) {
        customAlert("⚠️ ATENÇÃO: Jogo em andamento.\nRESET o jogo antes de trocar de evento.");
        toggleAdminMenu(); return;
    }

    // Se o menu estiver aberto, fecha visualmente, mas mantém lógica
    // (Opcional: toggleAdminMenu() se quiser fechar o menu lateral ao abrir o modal)
    // toggleAdminMenu(); 

    const modal = document.getElementById('modal-eventos');
    const container = document.getElementById('lista-eventos-container');
    
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
    }
    
    container.innerHTML = '<div class="flex flex-col items-center py-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mb-2"></div><span class="text-gray-400">Buscando agenda atualizada...</span></div>';

    try {
        // --- CORREÇÃO AQUI: ADICIONADO TIMESTAMP PARA EVITAR CACHE ---
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

function abrirModalConfig() {
    toggleAdminMenu();
    const modal = document.getElementById('modal-config');
    modal.classList.remove('hidden');
    if (configuracaoServer) preencherModalConfig(configuracaoServer);
}

function preencherModalConfig(params) {
    if (params.tempo_ganhador) document.getElementById('config-winner-time').value = params.tempo_ganhador;
    if (params.voz_ativa !== undefined) document.getElementById('config-voz-ativa').checked = params.voz_ativa;
    if (params.camera_ativa !== undefined) document.getElementById('config-camera-ativa').checked = params.camera_ativa;
    if (params.modo_sorteio) { 
        const radio = document.querySelector(`input[name="modo_sorteio"][value="${params.modo_sorteio}"]`); 
        if (radio) radio.checked = true; 
    }
    document.getElementById('config-nome-sala').value = params.nome_sala || 'LIVE THE BET';
    document.getElementById('config-url-padrao').value = params.url_padrao || '';
    document.getElementById('config-url-live').value = params.url_live || '';
    document.getElementById('config-url-mongo').value = params.url_mongo_vendas || '';
    if (params.tipo_sorteio) document.getElementById('config-tipo-sorteio').value = params.tipo_sorteio;
    const selectEntrada = document.getElementById('config-entrada-cartelas');
    if (params.tipo_entrada_de_cartelas && selectEntrada) selectEntrada.value = params.tipo_entrada_de_cartelas;
    if (params.sorteio_automatizado !== undefined) document.getElementById('config-sorteio-automatizado').checked = params.sorteio_automatizado;
    if (params.aviso_fim_das_vendas) {
        document.getElementById('config-aviso-fim-vendas').value = params.aviso_fim_das_vendas;
    }
    toggleOpcaoAutomatizado();
}

function toggleOpcaoAutomatizado() {
    const radioAuto = document.querySelector('input[name="modo_sorteio"][value="auto"]');
    const container = document.getElementById('container-check-auto');
    if (radioAuto && radioAuto.checked) container.classList.remove('hidden');
    else container.classList.add('hidden');
}

async function salvarConfiguracoes() {
    const winnerTime = document.getElementById('config-winner-time').value;
    const isVoz = document.getElementById('config-voz-ativa').checked;
    const isCam = document.getElementById('config-camera-ativa').checked;
    const tempoVendas = document.getElementById('config-aviso-fim-vendas').value; 
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
// --- REGRA DE OURO: AJUSTE DO ATRASO DE VÍDEO ---
    let atrasoVideoInput = document.getElementById('config-atraso-video').value;
    let valorAtrasoFinal = parseInt(atrasoVideoInput) || 0;

    // Se o modo for diferente de manual, forçamos o atraso para 0
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
        tipo_sorteio: parseInt(tipoSorteio) || 15, 
        tipo_entrada_de_cartelas: parseInt(tipoEntrada) || 1,
        sorteio_automatizado: isSorteioAuto,
        aviso_fim_das_vendas: parseInt(tempoVendas) || 120,
        aguardandoVideo: valorAtrasoFinal // Envia o valor já tratado pela regra
    };  

    try {
        await fetch(`${API_BASE_URL}/api/admin/salvar_config`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
        
        vozAtiva = isVoz; cameraAtiva = isCam; modoSorteio = modoSelecionado;
        aplicarVisualModoSorteio(modoSorteio);
        aplicarVisibilidadeCamera(cameraAtiva);
        aguardandoVideo = valorAtrasoFinal;
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
        if (segundos < 3) { customAlert("Tempo mínimo é 3 segundos!"); return; }
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

async function sortearBola() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (isSorting) return;
    isSorting = true;
    const btn = document.getElementById('btn-sortear');
    if(btn) { btn.disabled = true; btn.textContent = "SORTEANDO..."; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sortear_mesa`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
        });
        const data = await response.json();
        if (data.error) { customAlert(data.error); pararAutoSorteio(); } 
        else {
            bolaDestaque.textContent = data.bola;
            const el = document.getElementById(`admin-ball-${data.bola}`);
            if(el) el.classList.add('bg-green-600', 'text-white');            
            falarTextoLocutor(`${data.bola}`);
        }
        // aquix
        matrizEnvio.push({
           tipo: 'BOLA_CLIENTE',
           valor: data.bola,
           hora: Date.now()
        });
        
    } catch (error) { console.error(error); } 
    finally { isSorting = false; if(btn) { btn.disabled = false; btn.textContent = "SORTEAR BOLA 🎲"; } }
}

// admin.js - Substitua a função inteira

async function inserirBolaManual() {
    const input = document.getElementById('input-bola-manual');
    const erroLabel = document.getElementById('erro-manual');
    let valor = parseInt(input.value);

    // 1. Validações Básicas
    if (isNaN(valor) || valor < 1 || valor > MAX_BOLAS) { 
        erroLabel.textContent = `Digite entre 1 e ${MAX_BOLAS}`; 
        input.value = ""; 
        return; 
    }
    
    // Verifica duplicidade no cache local (evita clique duplo)
    if (bolasSorteadasCache.includes(valor) || bolasCacheLocal.has(valor)) { 
        erroLabel.textContent = `Bola ${valor} já foi!`; 
        input.value = ""; 
        return; 
    }

    // 2. AÇÃO IMEDIATA (ADMIN)
    erroLabel.textContent = "";
    input.value = ''; 
    devolverFocoAoJogo();
    
    // Feedback visual local (Admin vê na hora)
    bolaDestaque.textContent = valor;
    if (vozAtiva) falarTextoLocutor(String(valor));
    
    // Adiciona ao cache local temporário
    bolasCacheLocal.add(valor);

    try {
        // --- AQUI ESTAVA O ERRO ---
        // Agora chamamos a rota ESPECÍFICA DA MESA (sem broadcast)
        const response = await fetch(`${API_BASE_URL}/api/admin/sortear_mesa`, {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ bola_manual: valor })
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error("Erro mesa:", data.error);
            erroLabel.textContent = data.error;
            bolasCacheLocal.delete(valor); // Libera para tentar de novo
            return;
        }

        // 3. AGENDAMENTO DO PÚBLICO (CLIENTES)
        // Só agora colocamos na fila para ser enviado ao público daqui a X segundos
        matrizEnvio.push({
            tipo: 'BOLA_CLIENTE',
            valor: valor,
            hora: Date.now()
        });
        
        console.log(`Bola ${valor} registrada na Mesa. Agendada para público.`);

    } catch (e) {
        console.error("Erro de conexão:", e);
        erroLabel.textContent = "Erro ao conectar com servidor!";
        bolasCacheLocal.delete(valor);
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


// SUBSTITUA A FUNÇÃO carregarEvento POR ESTA:

async function carregarEvento(idEvento) {
    const confirmou = await customConfirm(`Deseja INICIAR este evento?\n\nIsso irá preparar a base de cartelas e iniciar o timer.`);
    if(!confirmou) return;
    
    // Fecha o modal de lista para focar no loading
    fecharModal('modal-eventos');
    
    // 1. INICIA LOADING (Bloqueia a tela enquanto troca o arquivo)
    showLoading("🔄 Carregando base de cartelas...");

    try {
        // 2. PASSO CRUCIAL: Chama a preparação (Troca de Arquivo)
        const respPrep = await fetch(`${API_BASE_URL}/api/admin/preparar_evento`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id_evento: idEvento })
        });
        
        const dadosPrep = await respPrep.json();
        if (dadosPrep.error) {
            throw new Error(dadosPrep.error);
        }

        // 3. Atualiza mensagem do Loading
        showLoading("🔒 Encerrando vendas...");

        // 4. Fecha as vendas no servidor
        await fetch(`${API_BASE_URL}/api/admin/fechar_vendas_evento`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id_evento: idEvento })
        });

    } catch(e) {
        console.error("Erro ao preparar evento:", e);
        customAlert("⛔ Erro crítico ao carregar cartelas: " + e.message);
        hideLoading();
        return; // Para tudo se der erro na troca de arquivo
    } 

    // 5. Remove o Loading e Inicia o Timer Visual
    hideLoading();
    iniciarTimerEspera(idEvento);
}


// --- FUNÇÃO 2: GERENCIA O TIMER VISUAL ---
function iniciarTimerEspera(idEvento) {
    const modal = document.getElementById('modal-timer-vendas');
    const display = document.getElementById('timer-display');
    const progress = document.getElementById('timer-progress');
    
    // Pega o tempo configurado (ou usa 120s padrão)
    let tempoTotal = 120; 
    if (configuracaoServer && configuracaoServer.aviso_fim_das_vendas) {
        tempoTotal = parseInt(configuracaoServer.aviso_fim_das_vendas);
    }
    
    let tempoRestante = tempoTotal;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex'); // Garante flexbox

    // Função de atualização
    const atualizarDisplay = () => {
        const min = Math.floor(tempoRestante / 60);
        const sec = tempoRestante % 60;
        display.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        
        const pct = (tempoRestante / tempoTotal) * 100;
        progress.style.width = `${pct}%`;
    };

    atualizarDisplay();

    // Loop do Timer
    vendasTimerInterval = setInterval(() => {
        tempoRestante--;
        atualizarDisplay();

        if (tempoRestante < 0) {
            clearInterval(vendasTimerInterval);
            // FIM DO TEMPO: CARREGA O EVENTO REALMENTE
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            executarCarregamentoReal(idEvento);
        }
    }, 1000);

    // Salva ID no botão de pular para caso o admin queira forçar
    window.eventoPendenteID = idEvento;
}

// Função para o botão "Pular Espera"
async function pularEsperaVendas() { // <--- ADICIONE O 'async' AQUI
    const confirmou = await customConfirm(`Tem certeza? Clientes comprando agora podem ficar sem cartela.`);
    
    if(confirmou) {
        clearInterval(vendasTimerInterval);
        
        const modal = document.getElementById('modal-timer-vendas');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        
        if (window.eventoPendenteID) {
            executarCarregamentoReal(window.eventoPendenteID);
        }
    }
}


// SUBSTITUA A FUNÇÃO executarCarregamentoReal POR ESTA:

async function executarCarregamentoReal(idEvento) {
    // Força o fechamento do menu lateral
    const menu = document.getElementById('admin-side-menu');
    const menuOverlay = document.getElementById('admin-menu-overlay');
    if (menu) menu.classList.add('-translate-x-full'); 
    if (menuOverlay) menuOverlay.classList.add('hidden'); 

    // INICIA LOADING
    showLoading("Sincronizando últimas vendas e carregando jogo...");

    // Trava de segurança para início do jogo
    if (aguardandoVideo > 0 && !modoRoboAtivo) {
        await new Promise(r => setTimeout(r, aguardandoVideo));
    }

    try {
        await fetch(`${API_BASE_URL}/api/admin/resetar`, { method: 'POST' });
        
        // Agora busca os detalhes
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

        // --- CORREÇÃO AQUI: DETECTA O TIPO E AJUSTA O GRID ---
        const tipoCartela = parseInt(dados.tipo_cartela || 15);
        if (tipoCartela === 25) {
            MAX_BOLAS = 75;
            console.log("🎱 Evento Configurado: BINGO 75");
        } else {
            MAX_BOLAS = 90;
            console.log("🎱 Evento Configurado: BINGO 90");
        }
        
        const labelQuadra = (MAX_BOLAS === 75) ? '4 Cantos' : 'Quadra';

        // Força o redesenho do grid vazio com a quantidade correta (75 ou 90)
        initGrid(); 
        // -----------------------------------------------------

        document.getElementById('info-descricao').textContent = dados.descricao;
        document.getElementById('info-data-hora').textContent = `${dados.data_evento} ${dados.hora_evento}`;
        document.getElementById('info-inicial').textContent = dados.numero_inicial;
        document.getElementById('info-qtde').textContent = dados.qtde_vendida;
        document.getElementById('info-ultimo').textContent = dados.ultimo_cartao;
        document.getElementById('info-preco-un').textContent = parseFloat(dados.valor_venda||0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        document.getElementById('info-vendas').textContent = parseFloat(dados.total_vendas_reais||0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

        // Renderiza Prêmios
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
        
        // (O initGrid já foi chamado lá em cima, não precisa chamar de novo aqui)

        if (sorteioAutomatizadoConfig && modoSorteio === 'auto') {
           iniciarModoRobo(); 
        }

    } catch (e) { 
        console.error(e); 
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
    
    // Usa a variável MAX_BOLAS em vez do número fixo 90
    for (let i = 1; i <= MAX_BOLAS; i++) {
        const div = document.createElement('div');
        div.id = `admin-ball-${i}`;
        // Mantém seu estilo original
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


// SUBSTITUA A FUNÇÃO renderRanking INTEIRA POR ESTE BLOCO:

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
    
    lista.slice(0, 10).forEach((item, i) => {
        const status = (item.premio && item.premio !== "null") ? item.premio : "";
        const nums = item.numeros_faltantes || [];
        
        // HTML dos números
        let htmlNums = nums.map(n => n<10?`0${n}`:n).join(' ');

        // Visual de Linhas (Sup/Cen/Inf)
        if (["LINHA"].includes(status) && item.posicao) {
            htmlNums = `<span class=" text-center text-[9px] bg-yellow-900/60 text-yellow-300 px-1.5 rounded border border-yellow-700 mr-1.5">${item.posicao}</span>` + htmlNums;
        }

        // Etiquetas de Vitória
        if (["BINGO","DUPLO BINGO"].includes(status)) {
            htmlNums = `<span class="text-green-400 font-black animate-pulse">${status}</span>`;
        } else if (status === "LINHA") {
            htmlNums = `<span class="text-center  text-yellow-400 font-bold animate-pulse">${status} <span class="text-xs">(${item.posicao || ''})</span></span>`;
        }
        
        // Cores da Linha
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

    // Ajuste do Título do Ranking (Tradução Visual)
    let tituloDisplay = tipo || "";
    if (tituloDisplay === "QUADRA") tituloDisplay = "4 CANTOS";
    
    document.getElementById('label-premio-ranking').textContent = tituloDisplay;
    c.innerHTML = '';

    if (!lista || lista.length === 0) { 
        c.innerHTML = '<div class="text-gray-600 text-center text-xs py-2">Calculando Padrões...</div>'; 
        return; 
    }
    
    lista.slice(0, 10).forEach((item, i) => {
        let status = (item.premio && item.premio !== "null") ? item.premio : "";
        let posicao = item.posicao || "";

        // Máscara Visual (Tradução)
        if (status === "QUADRA") status = "4 CANTOS";
        if (posicao === "QUADRA") posicao = "4 CANTOS";
        
        const nums = item.numeros_faltantes || [];
        let htmlNums = nums.map(n => n<10?`0${n}`:n).join(' ');

        // --- LÓGICA VISUAL ESPECÍFICA PARA PADRÕES ---
        
        // Se já ganhou (BINGO ou PADRÃO BATIDO)
        if (status === "BINGO" || status === "BATIDO!" || item.qtde === 0) {
             // Se for padrão específico batido (ex: 4 Cantos), mostra o nome do padrão
             const textoVitoria = (status === "BINGO") ? "BINGO CHEIO" : (posicao || "BATIDO!");
             htmlNums = `<span class="text-green-400 font-black animate-pulse tracking-widest text-xs">${textoVitoria}</span>`;
        } 
        // Se falta pouco (Falta 1, Boa, etc)
        else {
            // Mostra qual padrão ele está perseguindo (Ex: "4 Cantos", "Linha 3")
            if (posicao) {
                // Tag Azulada para Padrões
                const tag = `<span class="text-[9px] bg-blue-900/60 text-blue-200 px-1.5 rounded border border-blue-700 mr-1.5 uppercase font-bold">${posicao}</span>`;
                htmlNums = tag + htmlNums;
            }
        }

        // Cores da Linha (Row Background)
        const row = document.createElement('div');
        let cl = "grid grid-cols-6 gap-1 px-1 py-0.5 rounded border items-center mb-0.5 ";
        
        // Prioridade de Cores
        if (item.qtde === 0) {
            // Ganhou
            cl += "bg-green-900/40 border-green-500 shadow-lg scale-[1.02] z-10";
        } else if (item.qtde <= 1) {
            // Por uma (Boa)
            cl += "bg-red-900/40 border-red-500 animate-pulse"; // Pulsa levemente para chamar atenção
        } else if (i === 0) {
            // Líder
            cl += "bg-gray-700 border-yellow-600";
        } else {
            // Resto
            cl += "bg-gray-800 border-gray-700";
        }
        
        row.className = cl;
        row.innerHTML = `<div class="col-span-1 text-center font-mono font-bold text-yellow-500 text-[16px]">${item.cartela}</div><div class="col-span-3 text-[16px] font-mono flex items-center overflow-hidden whitespace-nowrap">${htmlNums}</div><div class="col-span-2 text-right truncate text-xs text-blue-500">${item.nome==="null"?'---':item.nome}</div>`;
        c.appendChild(row);
    });
}


// SUBSTITUA A FUNÇÃO renderListaGanhadores POR ESTA:

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
    const listaSessao = document.getElementById('lista-auditoria-session'); // Referência da lista visual

    // Se estiver no modo Robô (automatizado), ignora a abertura manual
    if (modoRoboAtivo && !modoSilencioso) return;
    
    if (!modoSilencioso && autoSorteioAtivo) {
        toggleAutoSorteio(); 
    }
    
    houveGanhadorNaSessao = false;
    
    // --- LIMPEZA CRÍTICA PARA NOVA SESSÃO ---
    document.getElementById('auditoria-resultado').classList.add('hidden');
    document.getElementById('conf-grid').innerHTML = '';
    
    // Zera a lista visual de cartelas confirmadas "nesta sessão"
    if (listaSessao) {
        listaSessao.innerHTML = '<span class="text-gray-600">Nenhum</span>';
    }
    // ----------------------------------------
    
    // Renderiza os pendentes que ainda faltam validar (Array Global)
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
	
// SUBSTITUA A FUNÇÃO validarCartelaAuditoria POR ESTA:

async function validarCartelaAuditoria() {
    const input = document.getElementById('input-auditoria');
    const cartela = input.value;
    const btnConfirmar = document.getElementById('btn-confirmar-ganhador');

    if(!cartela) return;
    
    // --- ALTERAÇÃO: Removemos o bloqueio de tempo aqui ---
    // O Admin precisa ver o resultado NA HORA.
    // showLoading("Conferindo cartela..."); 
    
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

        // Lógica de Mensagem Contextualizada
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
        alert("Erro de conexão ao validar."); 
    } finally {
        hideLoading(); // Garante que o loading some
    }
}


// --- FUNÇÃO CORRIGIDA: CONFIRMAR GANHADOR (LISTA VISUAL) ---
async function confirmarGanhadorAtual() {
    houveGanhadorNaSessao = true; 
    const input = document.getElementById('input-auditoria');
    // Forçamos a conversão para String e limpamos espaços para garantir a exclusão
    const cartelaConfirmada = String(input.value).trim(); 

    if (!cartelaConfirmada) return;

    // 1. Registra na Blacklist para o WebSocket não reinserir a cartela
    idsConfirmadosNestaRodada.add(cartelaConfirmada);

    // 2. Remove estritamente esta cartela do array global de pendentes
    cartelasPendentesAuditoria = cartelasPendentesAuditoria.filter(c => 
        String(c.cartela).trim() !== cartelaConfirmada
    );
    
    // 3. Redesenha a lista de pendentes (agora com um item a menos)
    renderListaPendentes(cartelasPendentesAuditoria);

    // --- Limpeza Visual e Logística de Banco ---
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

    // No modo manual, se houve ganhador, tenta trocar o prêmio (AQUI ESTAVA O PROBLEMA)
    if (!modoSilencioso && houveGanhadorNaSessao) {
        processarProximoPremio(); 
    }
}

// SUBSTITUA A FUNÇÃO processarProximoPremio POR ESTA VERSÃO:
async function processarProximoPremio() {
    // ... (código inicial de busca de dados permanece igual) ...
    let info = null;
    let dadosEvento = null;
    try {
        const resp = await fetch(`${API_BASE_URL}/api/initial-data`);
        const dados = await resp.json();
        info = dados.buscandoMesaData[0];
        if (typeof dadosEventoAtual !== 'undefined' && dadosEventoAtual) dadosEvento = dadosEventoAtual;
    } catch (e) { return; }

    if (!info) return;
   
    // Se ainda está buscando linha e faltam linhas, não faz nada
    if (info.buscando_o_premio === 'LINHA' && info.buscando_a_linha && info.buscando_a_linha.length > 0) {
        return; 
    }
    // ... (resto da lógica de encontrar o próximo prêmio permanece igual) ...
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
            if (await customConfirm(`Todas as linhas conferidas!\n\nAvançar prêmio para: ${proximoKey}?`)) {
                // AQUI ENTRA A ANIMAÇÃO NA CHAMADA
                await mudarPremio(proximoKey);
            }
        }, 500);
    } else {
        // ... (lógica de fim de jogo) ...
        setTimeout(async () => {
            if (await customConfirm(`⚠️ Fim da sequência de prêmios!\n\nEste foi o último prêmio ativo.\nDeseja FINALIZAR o evento agora?`)) {
                resetarJogo();
            }
        }, 500);
    }
}



async function processarProximoPremio2() {
    let info = null;
    let dadosEvento = null;
    try {
        const resp = await fetch(`${API_BASE_URL}/api/initial-data`);
        const dados = await resp.json();
        info = dados.buscandoMesaData[0];
        // dadosEventoAtual é a variável global com os detalhes do evento carregado (com 'premios')
        if (typeof dadosEventoAtual !== 'undefined' && dadosEventoAtual) dadosEvento = dadosEventoAtual;
    } catch (e) { return; }

    if (!info) return;

    // --- CORREÇÃO CRÍTICA AQUI ---
    // Se o evento é de 1 Linha (qtde_linhas == 1) e o prêmio ativo era Linha,
    // e o usuário acabou de confirmar, consideramos a busca por LINHA como CONCLUÍDA.
    const qtdeLinhasEvento = parseInt(dadosEvento?.premios?.qtde_linhas || 0);

    if (info.buscando_o_premio === 'LINHA' && qtdeLinhasEvento === 1) {
        // Ignora qualquer lógica de 'linhas restantes' e força o avanço de índice.
        console.log("Sistema 1-Linha: Linha confirmada, forçando avanço para o próximo prêmio.");
        // A chave 'LINHA' será ignorada na busca abaixo.
    } else {
        // Se ainda está buscando linha e faltam linhas (sistema 3-linhas), não faz nada
        if (info.buscando_o_premio === 'LINHA' && info.buscando_a_linha && info.buscando_a_linha.length > 0) {
            return; 
        }
    }
    // ----------------------------

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
            
            // Verifica se o valor do prêmio é maior que zero
            if (parseFloat(dadosPremios[keyDados] || 0) > 0) {
                proximoKey = keyTeste;
                break;
            }
        }
    }

    if (proximoKey) {
        await customAlert(`Prêmio confirmado.\n\nAvançando prêmio para: ${proximoKey}`, 3); // Alerta por 3 segundos
        await mudarPremio(proximoKey);

    } else {
        setTimeout(async () => {
            if (await customConfirm(`⚠️ Fim da sequência de prêmios!\n\nEste foi o último prêmio ativo.\nDeseja FINALIZAR o evento agora?`)) {
                resetarJogo();
            }
        }, 500);
    }
}

async function mudarPremio(tipo) {
    // 1. Atualiza visualmente o Admin na hora (Feedback rápido)
    const elStatus = document.getElementById('status-premio');
    if (elStatus) elStatus.textContent = `Buscando: ${tipo} (Mesa)`;
    const elTitulo = document.getElementById('premio-atual'); 
    if (elTitulo) elTitulo.textContent = tipo;

    try {
        // 2. Chama a Rota da MESA (Imediata)
        await fetch(`${API_BASE_URL}/api/admin/definir_premio_mesa`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ premio: tipo })
        });
        
        // 3. Agenda a Rota PÚBLICA (Com Delay)
        // Se o atraso estiver configurado, vai para a fila.
        matrizEnvio.push({
            tipo: 'PREMIO_CLIENTE',
            valor: tipo,
            hora: Date.now()
        });
        
        console.log(`Prêmio alterado para ${tipo} na Mesa. Agendado para público.`);

    } catch(e) {
        console.error("Erro ao mudar prêmio:", e);
    }
}



// --- FUNÇÃO RESETAR CORRIGIDA (COM LOADING) ---

async function resetarJogo(force = false) {
    if(!force && !(await customConfirm("TEM CERTEZA? Isso limpará a tela e encerrará o jogo atual."))) { 
        devolverFocoAoJogo(); return; 
    } 
    
    // INICIA LOADING
    showLoading("Resetando sistema e limpando dados...");

    if (autoSorteioAtivo) pararAutoSorteio();
    if (modoRoboAtivo) pararModoRobo();

    try {
        await fetch(`${API_BASE_URL}/api/admin/resetar`, { method: 'POST' });
        
        // --- LIMPEZA DE CACHE (CRÍTICO PARA NÃO TRAVAR O PRÓXIMO JOGO) ---
        bolasCacheLocal = new Set(); 
        bolasSorteadasCache = [];
        matrizEnvio = []; 
        idsConfirmadosNestaRodada = new Set();
        ultimoTotalBolasProcessadas = -1; // Reseta contador de bolas
        jaAlertouNestaBola = false;
        // -----------------------------------------------------------------

        // Limpeza visual
        if(bolaDestaque) bolaDestaque.textContent = "--"; 
        initGrid();
        
        const elStatus = document.getElementById('status-premio');
        if(elStatus) elStatus.textContent = "Buscando: ...";
        
        const elContador = document.getElementById('contador-bolas');
        if(elContador) elContador.textContent = "0 / 90";
        
        renderHistorico([]);
        renderRanking([], "");
        renderListaGanhadores([]); // Limpa ganhadores da tela

        const painelEvento = document.getElementById('painel-evento-ativo');
        if(painelEvento) painelEvento.classList.add('hidden');
        
        // Aguarda um pouco para o usuário ver que limpou
        await new Promise(r => setTimeout(r, 800));

        if (!force) {
            abrirModalEventos();
        } else {
            customAlert("Evento finalizado pelo Sorteio Automatizado.","Sorteio Automatizado", 3);
            abrirModalEventos();
        }
    } catch (e) { 
        console.error(e);
        customAlert("Erro ao resetar."); 
    } finally {
        hideLoading();
    }
}

async function resetarJogo3(force = false) {
    if(!force && !(await customConfirm("TEM CERTEZA? Isso limpará a tela e encerrará o jogo atual."))) { 
        devolverFocoAoJogo(); return; 
    } 
    
    // INICIA LOADING
    showLoading("Resetando sistema e limpando dados...");

    if (autoSorteioAtivo) pararAutoSorteio();
    if (modoRoboAtivo) pararModoRobo();

    try {
        await fetch(`${API_BASE_URL}/api/admin/resetar`, { method: 'POST' });
        bolasCacheLocal = new Set(); 
        bolasSorteadasCache = [];
        matrizEnvio = []; 
        // Limpeza visual
        idsConfirmadosNestaRodada = new Set() 
        bolaDestaque.textContent = "--"; 
        initGrid();
        document.getElementById('status-premio').textContent = "Buscando: ...";
        document.getElementById('contador-bolas').textContent = "0 / 90";
        renderHistorico([]);
        // Limpa o ranking visualmente também
        renderRanking([], "");
        document.getElementById('painel-evento-ativo').classList.add('hidden');
        
        // Aguarda um pouco para o usuário ver que limpou
        await new Promise(r => setTimeout(r, 800));

        if (!force) {
            abrirModalEventos();
        } else {
            // temporizar 
            await customAlert("Evento finalizado pelo Sorteio Automatizado.","Sorteio Automatizado",3);
            abrirModalEventos();
        }
    } catch (e) { 
        customAlert("Erro ao resetar."); 
    } finally {
        // REMOVE LOADING (Sempre acontece)
        hideLoading();
    }
}

// --- FUNÇÃO RESETAR CORRIGIDA (COM LOADING) ---
async function resetarJogo2() {
    // 1. Pergunta de segurança 
    const confirmou = await customConfirm(`Tem certeza que deseja RESETAR o jogo? Isso apagará tudo!`);    
    if(!confirmou) return;

    try {
        const btn = document.getElementById('btn-resetar');
        if(btn) btn.disabled = true;

        // 2. Manda o Servidor limpar o Banco de Dados
        const response = await fetch(`${API_BASE_URL}/api/admin/resetar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        if (data.status) {
            customAlert("Jogo Resetado com Sucesso!");
            console.error("data '");

            // --- AQUI ESTÁ A SOLUÇÃO DA SUA PREOCUPAÇÃO ---
            // Forçamos o navegador a esquecer tudo o que aconteceu
            
            // 1. Limpa a memória de proteção contra duplo clique
            bolasCacheLocal = new Set(); 
            bolasSorteadasCache = [];
            
            // 2. Limpa a fila de atraso (se tiver bola esperando para ir pro público, cancela)
            matrizEnvio = []; 
            
            // 3. Limpa visualmente a tela do Admin na hora
            //renderizarBolasCantadas([]);
            //renderizarUltimasBolas([]);
            if(bolaDestaque) bolaDestaque.textContent = "--";
            //atualizarGridVisual([]);
            
            // 4. Limpa lista de ganhadores
            renderListaGanhadores([]);
            
        } else {
            customAlert("Erro ao resetar: " + (data.error || "Desconhecido"));
        }

    } catch (e) {
        console.error(e);   
        customAlert("Erro de conexão ao tentar resetar.");
    } finally {
        const btn = document.getElementById('btn-resetar');
        if(btn) btn.disabled = false;
    }
}


// =========================================================
// === 6. INICIALIZAÇÃO ===
// =========================================================

document.addEventListener('DOMContentLoaded', () => {
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
        const novoInput = inputManual.cloneNode(true);
        inputManual.parentNode.replaceChild(novoInput, inputManual);
        novoInput.addEventListener('keydown', function(event) {
            if (this.value === '99') { event.preventDefault(); this.value = ''; abrirSessaoAuditoria(); return; }
            if (event.key === 'Enter') { event.preventDefault(); inserirBolaManual(); }
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