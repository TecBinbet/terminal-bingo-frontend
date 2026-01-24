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

// --- CONTROLE SORTE EXTRA ---
let sorteioExtraConfigAtivo = false;    // Se o evento atual tem Sorte Extra
let qtdeDezenasSorteExtra = 3;          // Padrão (será atualizado pela config)
let jaValidouSorteExtraNestaRodada = false; // Trava para não abrir o modal 20x

let jogoFoiFinalizadoComSucesso = false;

let bolasProcessadasAdmin = new Set(); 
let ultimaBolaExibidaAdmin = null;
let estadoRodadaAtual = null;

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
    if (matrizEnvio.length === 0) return;

    const item = matrizEnvio[0]; 
    
    // Se o modo for 'manual', usa o delay configurado. Senão, é zero. aquixx 
    const delay = (modoSorteio === 'manual') ? (aguardandoVideo || 0) : 0;

    // Log para verificar se o delay está correto
    // console.log(`[DEBUG] Matriz: Aguardando ${delay}ms | Atual: ${Date.now() - item.hora}ms`);

    if (Date.now() - item.hora >= delay) {
        matrizEnvio.shift(); // Remove da fila
        
        console.log(`[DEBUG] 🚀 Enviando para o PÚBLICO: [${item.tipo}] Valor: ${item.valor}`);

        try {
            if (item.tipo === 'BOLA_CLIENTE') {
                await fetch(`${API_BASE_URL}/api/admin/publicar_bola`, {
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'}, 
                    body: JSON.stringify({ bola: item.valor })
                });
            } 
            else if (item.tipo === 'PREMIO_CLIENTE') {
                console.log(`[DEBUG] 🏆 Atualizando prêmio público para: ${item.valor}`);
                await fetch(`${API_BASE_URL}/api/admin/definir_premio_publico`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ premio: item.valor })
                });
            }    
            else if (item.tipo === 'LIMPAR_PUBLICO') {
                console.log(`[DEBUG] 🧹 Limpando tela pública`);
                await fetch(`${API_BASE_URL}/api/admin/limpar_conferencia_publica`, { method: 'POST' });
            }

        } catch (e) {
            console.error(`[DEBUG] ❌ Erro ao enviar [${item.tipo}]:`, e);
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
        alternarBotaoReset('finalizar');
        await new Promise(r => setTimeout(r, 3000));
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

function renderGridConferencia(data) {
    const grid = document.getElementById('conf-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // 1. Proteção Básica: Se não tem layout, para aqui.
    if (!data || !data.layout) {
        grid.innerHTML = '<span class="text-red-400 text-xs p-2">Dados da cartela indisponíveis.</span>';
        return;
    }
    
    const bolas = (data.bolas || bolasSorteadasCache || []).map(String);

    let tipoJogo = data.layout.tipo;
    if (!tipoJogo) {
        if (data.layout.lista && data.layout.lista.length > 0) tipoJogo = 75;
        else tipoJogo = 90;
    }

    let numerosDaCartela = [];
    if (tipoJogo === 75) {
        numerosDaCartela = data.layout?.lista || [];
    } else {
        numerosDaCartela = (data.layout?.superior || [])
                            .concat(data.layout?.central || [])
                            .concat(data.layout?.inferior || []);
    }

    const ultimaBola = bolas.length > 0 ? bolas[0] : null;

    console.error("ultimaBola               :",ultimaBola); 
    if (tipoJogo === 75 && numerosDaCartela.length === 25) { 
        grid.className = "grid grid-cols-5 gap-1 bg-black p-2 rounded border border-gray-600 w-full max-w-[300px] mx-auto";
        for (let linha = 0; linha < 5; linha++) {
            for (let coluna = 0; coluna < 5; coluna++) {
                const index = (coluna * 5) + linha;
                const num = numerosDaCartela[index];
                const cell = document.createElement('div');
                const isFree = (index === 12 && num === 0);
                
                let marcado = bolas.includes(String(num)) || isFree; 
                
                const isLast = (Number(num) === Number(ultimaBola));  
                let cssClass = "h-10 w-full flex items-center justify-center font-bold text-sm rounded border ";
                
                //if (isFree) {
                //    cssClass += "bg-green-600 text-white border-green-400";
                //    cell.textContent = "★";
                cell.textContent = num;

                if (isLast) {
                    // DESTAQUE DA ÚLTIMA BOLA (Ex: Laranja + Piscando)
                    cssClass += "bg-orange-600 text-white border-white animate-pulse scale-105 shadow-lg z-10";
                } 
                else if (marcado) {
                    // Marcado Normal (Amarelo)
                    cssClass += "bg-yellow-500 text-black border-yellow-300 shadow-inner";
                } 
                else {
                    // Não Marcado (Cinza)
                    cssClass += "bg-gray-800 text-white border-gray-600";
                }                
                cell.className = cssClass;
                grid.appendChild(cell);
            }
        }
    } 
    else if (tipoJogo === 90 && data.layout) {
        grid.className = "flex flex-col gap-2 bg-black p-2 rounded border border-gray-600";
        
        [data.layout.superior, data.layout.central, data.layout.inferior].forEach(linha => {
            const row = document.createElement('div'); 
            row.className = "flex justify-between gap-1";
            
            linha.forEach(num => { 
                const cell = document.createElement('div');
                const marcado = bolas.includes(String(num));
                
               // AQUI TAMBÉM: Verifica última bola no Bingo 90
                const isLast = (Number(num) === Number(ultimaBola));
                
                let cssClass = "w-full h-9 flex items-center justify-center font-bold text-lg rounded border ";

                if (isLast) {
                     cssClass += "bg-orange-600 text-white border-white animate-pulse scale-105 shadow-lg z-10";
                } else if (marcado) {
                     cssClass += "bg-yellow-500 text-black border-yellow-300";
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

        if (data.parametrosInfo) {
            aguardandoVideo = parseInt(data.parametrosInfo.aguardandoVideo) || 0;
            document.getElementById('config-atraso-video').value =aguardandoVideo; 
            vozAtiva = data.parametrosInfo.voz_ativa !== undefined ? data.parametrosInfo.voz_ativa : true;
        }


        // =============================================================
        // 🛠️ CORREÇÃO: PREENCHER O ID DO EVENTO PARA O SORTE EXTRA
        // =============================================================
        // Se a variável global estiver vazia, tentamos preencher com os dados da rodada
        if (!dadosEventoAtual && data.rodadaData && data.rodadaData.length > 0) {
            const rodada = data.rodadaData[0];
            if (rodada.id_evento && rodada.id_evento !== "0") {
                console.log(`♻️ [RECUPERAÇÃO] Restaurando ID do evento após F5: ${rodada.id_evento}`);
                
                // Cria o objeto global apenas com o ID (o suficiente para o Sorte Extra funcionar)
                dadosEventoAtual = { 
                    id_evento: rodada.id_evento,
                    descricao: 'Evento Recuperado' 
                };
            }
        }
        // =============================================================

        // Agora sim chamamos a função, pois dadosEventoAtual já existe
        if (dadosEventoAtual && dadosEventoAtual.id_evento) {
             carregarConfigSorteExtraAdmin();
        }
        
        if (data.evento && parseInt(data.evento.tipo_cartela) === 25) {
            MAX_BOLAS = 75;
        } else {
            MAX_BOLAS = 90;
        }

        const totalBolasNaTela = document.querySelectorAll('[id^="admin-ball-"]').length;
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
    } catch(e) {}
}

function processarMensagemWS(event) {
    const payload = JSON.parse(event.data);
    
    if (payload.type === 'UPDATE') {        
        let dadosBolas = [];
        if (payload.bolasMesaData && payload.bolasMesaData.length > 0) {
            dadosBolas = payload.bolasMesaData;
        } else {
            dadosBolas = payload.bolasData || []; 
        }

        if (dadosBolas.length > 0) {
            const ultimoSorteio = dadosBolas[0];
            const listaDeNumeros = ultimoSorteio.bolas_cantadas || [];
            
            bolasSorteadasCache = listaDeNumeros; 

            if (listaDeNumeros.length > ultimoTotalBolasProcessadas || listaDeNumeros.length === 0) {
                ultimoTotalBolasProcessadas = listaDeNumeros.length;
                jaAlertouNestaBola = false;
            }

            if (typeof updateGrid === 'function') {
                updateGrid(listaDeNumeros);
            }

            if (bolaDestaque) {
                if (ultimoSorteio.proxima_bola && ultimoSorteio.proxima_bola !== "--") {
                    bolaDestaque.textContent = ultimoSorteio.proxima_bola;
                } else if (listaDeNumeros.length > 0) {
                    bolaDestaque.textContent = listaDeNumeros[listaDeNumeros.length - 1];
                }
            }

            // O Alerta
            if (sorteioExtraConfigAtivo && 
               listaDeNumeros.length === qtdeDezenasSorteExtra && 
               !jaValidouSorteExtraNestaRodada) {
        
               console.log("🚨 [DEBUG] CONDIÇÃO ATINGIDA! ABRINDO MODAL...");
               jaValidouSorteExtraNestaRodada = true; 
               abrirModalValidacaoSorteExtra();
           }
        } else {
           jaValidouSorteExtraNestaRodada = false; 
        }

        if (payload.rodadaData && payload.rodadaData.length > 0) {
            const estado = payload.rodadaData[0].estado;
            
            // Chama a função de segurança que criamos
            if (typeof gerenciarEstadoBotoes === 'function') {
                gerenciarEstadoBotoes(estado);
            }
        }

        if (payload.buscandoMesaData && payload.buscandoMesaData.length > 0) {
            const dados = payload.buscandoMesaData[0];
            let premio = dados?.buscando_o_premio || '...';
            const linhas = dados?.buscando_a_linha || '';
            
            if (typeof MAX_BOLAS !== 'undefined' && MAX_BOLAS === 75) {
               if (premio === 'QUADRA') premio = '4 CANTOS';
            }

            let textoCompleto = premio;
            if (linhas && (premio === 'LINHA' || premio === '3 LINHAS')) {
                textoCompleto += ` (${linhas})`;
            }

            const elStatus = document.getElementById('status-premio');
            if (elStatus) elStatus.textContent = `Buscando: ${textoCompleto}`;
    
            const elTitulo = document.getElementById('premio-atual'); 
            if (elTitulo) elTitulo.textContent = premio;
        }

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

        if (payload.ganhadoresLive && payload.ganhadoresLive.length > 0) {
            if (typeof renderListaGanhadores === 'function') renderListaGanhadores(payload.ganhadoresLive);
        } else if (payload.ganhadoresData) {
            if (typeof renderListaGanhadores === 'function') renderListaGanhadores(payload.ganhadoresData);
        }

if (payload.melhoresData) {
   let tipoPremioBuscado = "BINGO";
   if (payload.buscandoMesaData && payload.buscandoMesaData[0]) tipoPremioBuscado = payload.buscandoMesaData[0].buscando_o_premio;
    
    renderRanking(payload.melhoresData, tipoPremioBuscado);

    if (MAX_BOLAS === 75) {
        paradasObrigatorias = ['QUADRA', 'LINHA', 'BINGO', 'DUPLO BINGO', '4 CANTOS', '4 CANTOS E LINHA'];
        termosVitoria = ['BINGO', 'LINHA', 'QUADRA', '4 CANTOS', '4 CANTOS E LINHA'];
    } else {
        paradasObrigatorias = ['QUADRA', 'LINHA', 'FALTA UM', 'BINGO', 'DUPLO BINGO'];
        termosVitoria = ['BINGO', 'LINHA', 'QUADRA', 'FALTA 1', 'FALTA UM', 'DUPLO BINGO'];
    }
    
    const ganhadoresAtuais = payload.melhoresData.filter(item => {
        const status = (item.premio && item.premio !== "null") ? item.premio.toUpperCase() : "";
        return paradasObrigatorias.some(termo => status.includes(termo)); 
    });

    const novosContemplados = payload.melhoresData.filter(item => {
        const status = (item.premio && item.premio !== "null") ? item.premio.toUpperCase() : "";
        return termosVitoria.some(termo => status.includes(termo));              
    });

    // Buscar Sorte Extra
    const bolasMesa = bolasSorteadasCache; // Array das bolas [15, 42, 63...]
    
    // Verificamos se atingiu a quantidade X
    if (sorteioExtraConfigAtivo && bolasMesa.length === qtdeDezenasSorteExtra) {
        
        if (!jaValidouSorteExtraNestaRodada) {
            jaValidouSorteExtraNestaRodada = true; // Trava para não abrir 1000 vezes
            
            // TOCA UM SOM DE ALERTA (Opcional)
            const audio = new Audio('/sons/alert.mp3'); // Se tiver
            audio.play().catch(e=>{});

            // ABRE O MODAL AUTOMATICAMENTE
            abrirModalValidacaoSorteExtra();
        }
    }
    
    // Se resetar o jogo (0 bolas), reseta a trava
    if (bolasMesa.length === 0) {
        jaValidouSorteExtraNestaRodada = false;
    }
// sorte extra

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
        tipo_sorteio: parseInt(tipoSorteio) || 15, 
        tipo_entrada_de_cartelas: parseInt(tipoEntrada) || 1,
        sorteio_automatizado: isSorteioAuto,
        aviso_fim_das_vendas: parseInt(tempoVendas) || 120,
        aguardandoVideo: valorAtrasoFinal 
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
    
    // DEBUG: Início do sorteio
    console.log("[DEBUG] Solicitando sorteio de bola...");

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sortear_mesa`, { 
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
        });
        const data = await response.json();
        
        console.log("[DEBUG] Bola sorteada na Mesa:", data);

        if (data.error) { customAlert(data.error); pararAutoSorteio(); } 
        else {
            bolaDestaque.textContent = data.bola;
            const el = document.getElementById(`admin-ball-${data.bola}`);
            if(el) el.classList.add('bg-green-600', 'text-white');            
            falarTextoLocutor(`${data.bola}`);
        }
        
        // ENVIO PARA FILA
        console.log(`[DEBUG] Agendando bola ${data.bola} para o público`);
        matrizEnvio.push({
           tipo: 'BOLA_CLIENTE',
           valor: data.bola,
           hora: Date.now()
        });
        
    } catch (error) { console.error("[DEBUG] Erro sortearBola:", error); } 
    finally { isSorting = false; if(btn) { btn.disabled = false; btn.textContent = "SORTEAR BOLA 🎲"; } }
}

async function inserirBolaManual() {
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
    
    bolasCacheLocal.add(valor);

    console.log(`[DEBUG] Inserindo bola manual: ${valor}`);

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sortear_mesa`, {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ bola_manual: valor })
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error("[DEBUG] Erro mesa:", data.error);
            erroLabel.textContent = data.error;
            bolasCacheLocal.delete(valor); 
            return;
        }

        console.log(`[DEBUG] Bola ${valor} aceita. Agendando para público.`);
        matrizEnvio.push({
            tipo: 'BOLA_CLIENTE',
            valor: valor,
            hora: Date.now()
        });

    } catch (e) {
        console.error("[DEBUG] Erro conexão manual:", e);
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
    
    let tempoTotal = 120; 
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

    vendasTimerInterval = setInterval(() => {
        tempoRestante--;
        atualizarDisplay();

        if (tempoRestante < 0) {
            clearInterval(vendasTimerInterval);
            modal.classList.add('hidden');
            modal.classList.remove('flex');
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

        const tipoCartela = parseInt(dados.tipo_cartela || 15);
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
        alert("Erro de conexão ao validar."); 
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
        
    } catch(e) {
        console.error("[DEBUG] Erro ao mudar prêmio:", e);
    }
}

// --- ATUALIZE A FUNÇÃO resetarJogo ---
async function resetarJogo(force = false) {
    let msgConfirmacao = "TEM CERTEZA? Isso limpará a tela e encerrará o jogo atual.";
    
    // Se o jogo foi finalizado com sucesso (botão verde), muda a mensagem
    if (jogoFoiFinalizadoComSucesso) {
        msgConfirmacao = "Deseja FINALIZAR este evento e carregar o PRÓXIMO da agenda?";
    }

    if(!force && !(await customConfirm(msgConfirmacao))) { 
        devolverFocoAoJogo(); return; 
    } 
    
    showLoading("Processando...");

    if (autoSorteioAtivo) pararAutoSorteio();
    if (modoRoboAtivo) pararModoRobo();

    try {
        // Envia o flag 'finalizar_sucesso' baseada na nossa variável
        await fetch(`${API_BASE_URL}/api/admin/resetar`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ finalizar_sucesso: jogoFoiFinalizadoComSucesso }) 
        });
        
        // Reset local das variáveis
        bolasCacheLocal = new Set(); 
        bolasSorteadasCache = [];
        matrizEnvio = [];
        idsConfirmadosNestaRodada = new Set();
        ultimoTotalBolasProcessadas = -1; 
        jaAlertouNestaBola = false;
        
        // Reseta o estado do botão para o próximo jogo
        alternarBotaoReset('reiniciar'); 

        if(bolaDestaque) bolaDestaque.textContent = "--"; 
        initGrid();
        
        const elStatus = document.getElementById('status-premio');
        if(elStatus) elStatus.textContent = "Buscando: ...";
        
        const elContador = document.getElementById('contador-bolas');
        if(elContador) elContador.textContent = "0 / 90";
        
        renderHistorico([]);
        renderRanking([], "");
        renderListaGanhadores([]); 
        cartelasPendentesAuditoria = [];

        const painelEvento = document.getElementById('painel-evento-ativo');
        if(painelEvento) painelEvento.classList.add('hidden');
        
        await new Promise(r => setTimeout(r, 800));

        if (!force) {
            // Se finalizou com sucesso, o backend já mudou a rodada.
            // Podemos apenas alertar ou abrir o modal para conferir.
            if (jogoFoiFinalizadoComSucesso) {
                customAlert("Evento Finalizado! O sistema carregou o próximo evento no painel.");
                // Opcional: abrirModalEventos(); se quiser conferir
            } else {
                abrirModalEventos();
            }
        } else {
            customAlert("Evento finalizado pelo Sorteio Automatizado.", "Sorteio Automatizado", 3);
            abrirModalEventos();
        }

    } catch (e) { 
        console.error("[DEBUG] Erro ao resetar:", e);
        customAlert("Erro ao resetar."); 
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


// Adicione esta chamada no seu 'carregarDadosIniciaisSilencioso' ou quando carregar evento
async function carregarConfigSorteExtraAdmin() {
    // Pega ID do evento atual (precisa estar disponível no scopo global ou DOM)
    if(!dadosEventoAtual || !dadosEventoAtual.id) return;
    
    try {
        const resp = await fetch(`${API_BASE_URL}/api/cliente/config_sorte_extra/${dadosEventoAtual.id}`);
        if(resp.ok) {
            const cfg = await resp.json();
            if(cfg.ativo) {
                sorteioExtraConfigAtivo = true;
                qtdeDezenasSorteExtra = cfg.qtde_dezenas || 3;
                console.log(`🍀 Sorte Extra Ativo: Alerta na bola ${qtdeDezenasSorteExtra}`);
                
                // Atualiza UI se quiser mostrar um label "Sorte Extra: ON"
            }
        }
    } catch(e) { console.error("Erro config extra", e); }
}

async function carregarConfigSorteExtraAdmin() {
    console.log("🐛 [DEBUG] Tentando carregar config Sorte Extra...");

    if (!dadosEventoAtual || !dadosEventoAtual.id_evento) {
        console.log("🐛 [DEBUG] Abortado: Sem dadosEventoAtual ou ID.");
        return;
    }
    
    try {
        const url = `${API_BASE_URL}/api/cliente/config_sorte_extra/${dadosEventoAtual.id_evento}`;
        //console.log(`🐛 [DEBUG] Fetch URL: ${url}`);

        const resp = await fetch(url);
        if (resp.ok) {
            const cfg = await resp.json();
            console.log("🐛 [DEBUG] Config Recebida:", cfg);

            if (cfg.ativo) {
                sorteioExtraConfigAtivo = true;
                qtdeDezenasSorteExtra = cfg.qtde_dezenas || 3;
                //console.log(`✅ [DEBUG] Sorte Extra ATIVADO. Alerta na bola: ${qtdeDezenasSorteExtra}`);
                
                // Atualiza visualmente (opcional)
                const elInfo = document.getElementById('info-extra-status');
                if(elInfo) elInfo.innerHTML = `<span class="bg-yellow-600 text-white text-xs px-2 py-1 rounded">Sorte Extra ON (${qtdeDezenasSorteExtra})</span>`;
            } else {
                //console.log("⛔ [DEBUG] Sorte Extra está DESATIVADO nesta config.");
                sorteioExtraConfigAtivo = false;
            }
        } else {
            //console.log("🐛 [DEBUG] Erro no fetch (status):", resp.status);
            sorteioExtraConfigAtivo = false;
        }
    } catch (e) {
        //console.warn("🐛 [DEBUG] Erro Exception:", e);
        sorteioExtraConfigAtivo = false;
    }
}


// Função para abrir o modal (Com o espaço para o contador)
function abrirModalValidacaoSorteExtra() {
    // 1. Injeta o HTML do modal se não existir
    if (!document.getElementById('modal-sorte-extra')) {
        const modalHTML = `
        <div id="modal-sorte-extra" class="fixed inset-0 bg-black/90 z-[60] hidden flex items-center justify-center backdrop-blur-sm">
            <div class="bg-gray-900 border-2 border-yellow-500/50 rounded-xl w-full max-w-5xl p-4 shadow-2xl relative flex flex-col max-h-[90vh]">
                
                <div class="flex justify-between items-center mb-1 border-b border-gray-700 pb-4">
                    <div>
                        <h2 class="text-1xl font-black text-yellow-500 flex items-center gap-2">
                            🍀 CONFERÊNCIA SORTE EXTRA
                        </h2>
                        <div class="flex items-center gap-3 -mb-2">
                            <p class="text-gray-400 text-sm">Validando ganhadores...</p>
                            <span id="badge-total-cupons" class="bg-gray-700 text-white text-xs px-4 py-1 rounded border border-gray-600">
                                Carregando...
                            </span>
                        </div>
                    </div>
                    <button onclick="document.getElementById('modal-sorte-extra').classList.add('hidden')" class="text-gray-500 hover:text-white transition-colors">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div id="loading-extra" class="flex-1 flex flex-col items-center justify-center py-10 hidden">
                    <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-yellow-500 mb-4"></div>
                    <p class="text-yellow-500 animate-pulse font-bold">Auditando Cupons...</p>
                </div>

                <div id="resultados-extra" class="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar p-2">
                    
                    <div class="bg-gray-800/50 rounded-lg border border-green-500/30 flex flex-col h-96">
                        <div class="bg-green-900/30 p-1 border-b border-green-500/30">
                            <h3 class="font-bold text-green-400 text-center uppercase tracking-wider">🏆 Sequência Exata</h3>
                            <div class="text-[12px] text-center text-gray-300">Prêmio Máximo</div>
                        </div>
                        <div id="lista-seq" class="flex-1 overflow-y-auto p-2 space-y-2"></div>
                    </div>

                    <div class="bg-gray-800/50 rounded-lg border border-blue-500/30 flex flex-col h-96">
                        <div class="bg-blue-900/30 p-1 border-b border-blue-500/30">
                            <h3 class="font-bold text-blue-400 text-center uppercase tracking-wider">🎲 Ordem Aleatória</h3>
                            <div class="text-[12px] text-center text-gray-300">Prêmio Intermediário</div>
                        </div>
                        <div id="lista-ale" class="flex-1 overflow-y-auto p-2 space-y-2"></div>
                    </div>

                    <div class="bg-gray-800/50 rounded-lg border border-orange-500/30 flex flex-col h-96">
                        <div class="bg-orange-900/30 p-1 border-b border-orange-500/30">
                            <h3 class="font-bold text-orange-400 text-center uppercase tracking-wider">🎱 Acertou 1ª Bola</h3>
                            <div class="text-[12px] text-center text-gray-300">Prêmio Base</div>
                        </div>
                        <div id="lista-prim" class="flex-1 overflow-y-auto p-2 space-y-2"></div>
                    </div>
                </div>

                <div class="mt-2 pt-2 border-t border-gray-700 flex justify-between items-center bg-gray-900">
                    <div class="text-xs text-gray-500">
                        * Clique no cartão do ganhador para enviá-lo para a TV.
                    </div>
                    <div class="flex gap-3">
                         <button onclick="limparTelaPublicaExtra()" class="bg-gray-700 hover:bg-gray-600 text-gray-200 px-4 py-2 rounded font-bold border border-gray-500 shadow-lg flex items-center gap-2">
                            🧹 Limpar TV
                         </button>
                         <button onclick="document.getElementById('modal-sorte-extra').classList.add('hidden')" class="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded font-bold shadow-lg">
                            Fechar
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

// Função de Busca (Atualiza o contador)
async function buscarGanhadoresExtra() {
    const loading = document.getElementById('loading-extra');
    const content = document.getElementById('resultados-extra');
    const badgeTotal = document.getElementById('badge-total-cupons'); // Elemento do contador
    
    if(loading) loading.classList.remove('hidden');
    if(content) content.classList.add('hidden');
    if(badgeTotal) badgeTotal.textContent = "Auditando...";
    
    try {
        const resp = await fetch(`${API_BASE_URL}/api/admin/validar_sorte_extra`, { method: 'POST' });
        const data = await resp.json();
        
        if (data.status === 'sucesso') {
            // ATUALIZA O CONTADOR VISUALMENTE
            if(badgeTotal) {
                badgeTotal.textContent = `${data.total_analisado || 0} cupons analisados`;
                badgeTotal.classList.remove('bg-gray-700');
                badgeTotal.classList.add('bg-blue-900', 'text-blue-100', 'border-blue-500','text-[14px]');
            }

            renderizarListaExtra('lista-seq', data.ganhadores.sequencia, 'seq');
            renderizarListaExtra('lista-ale', data.ganhadores.aleatorio, 'ale');
            renderizarListaExtra('lista-prim', data.ganhadores.primeira, 'prim');

        } else if (data.status === 'aguardando') {
            alert(data.msg);
            document.getElementById('modal-sorte-extra').classList.add('hidden');
        }
    } catch(e) {
        console.error(e);
        alert("Erro ao conectar com servidor de validação.");
    } finally {
        if(loading) loading.classList.add('hidden');
        if(content) content.classList.remove('hidden');
    }
}


function renderizarListaExtra(elementId, lista, tipo) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';
    
    if (lista.length === 0) {
        container.innerHTML = '<p class="text-gray-500 italic text-sm text-center mt-4">Nenhum ganhador.</p>';
        return;
    }

    lista.forEach(g => {
        const div = document.createElement('div');
        div.className = "p-1 bg-gray-900 rounded border border-gray-700 hover:bg-gray-700 cursor-pointer flex justify-between items-center transition-colors";
        div.innerHTML = `
            <div>
                <span class="text-sm block font-bold text-gray-400">Cupom: ${g.id}</span>
                <span class="text-lg text-white -mt-2" >${g.nick}</span>
            </div>
            <div class="text-right">
                <span class="text-lg font-mono font-bold text-yellow-500">${g.nums.join('-')}</span>
            </div>
        `;
        // Ao clicar, envia para o terminal
        div.onclick = () => publicarGanhadorExtra(g, tipo);
        container.appendChild(div);
    });
}

async function publicarGanhadorExtra(dados, tipo) {
    const labelPremios = {
        'seq': 'PRÊMIO MÁXIMO (SEQUÊNCIA)',
        'ale': 'PRÊMIO INTERMEDIÁRIO',
        'prim': 'PRÊMIO BASE (1ª BOLA)'
    };

    const payload = {
        id: dados.id,
        nick: dados.nick,
        nums: dados.nums,
        premio_titulo: labelPremios[tipo],
        tipo_codigo: tipo
    };

    try {
        await fetch(`${API_BASE_URL}/api/admin/publicar_cupom_terminal`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ cupom: payload })
        });
        
        // Feedback visual
        customAlert(`Cupom #${dados.id} enviado para o telão!`);
    } catch(e) { console.error(e); }
}

async function limparTelaPublicaExtra() {
    await fetch(`${API_BASE_URL}/api/admin/publicar_cupom_terminal`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ cupom: null }) // Null limpa
    });
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