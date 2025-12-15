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
// === 1. LÓGICA DO ROBÔ (AUTOMATIZAÇÃO) ===
// =========================================================

async function iniciarModoRobo() {
    if (modoRoboAtivo) return;
    modoRoboAtivo = true;
    bloquearInterface(true);
    console.log("🤖 MODO ROBÔ INICIADO");
    // aquix temporizar
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
    try {
        const resp = await fetch(`${API_BASE_URL}/api/initial-data`);
        const data = await resp.json();
        info = data.buscandoData[0];
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
        if(data.bolasData && data.bolasData[0]) {
             bolasSorteadasCache = data.bolasData[0].bolas_cantadas || [];
             updateGrid(bolasSorteadasCache);
        }
    } catch(e) {}
}

function processarMensagemWS(event) {
    const payload = JSON.parse(event.data);
    
    if (payload.type === 'UPDATE') {
        
        // 1. Bolas
        if (payload.bolasData) {
            const bolas = payload.bolasData[0]?.bolas_cantadas || [];
            bolasSorteadasCache = bolas;
            if (bolas.length !== ultimoTotalBolasProcessadas) {
                ultimoTotalBolasProcessadas = bolas.length;
                jaAlertouNestaBola = false;
            }
            updateGrid(bolas);
            if (bolas.length > 0) bolaDestaque.textContent = bolas[bolas.length - 1];
        }

        // 2. Status
        if(payload.buscandoData) {
            const dados = payload.buscandoData[0];
            const premio = dados?.buscando_o_premio || '...';
            const linhas = dados?.buscando_a_linha || '';
            let texto = premio;
            if (linhas && (premio === 'LINHA' || premio === '3 LINHAS')) texto += ` (${linhas})`;
            document.getElementById('status-premio').textContent = `Buscando: ${texto}`;
        }

        // 3. Configurações
        if (payload.parametrosInfo) {
            configuracaoServer = payload.parametrosInfo;
            if (configuracaoServer.sorteio_automatizado !== undefined) sorteioAutomatizadoConfig = configuracaoServer.sorteio_automatizado;
            if (configuracaoServer.modo_sorteio) {
                modoSorteio = configuracaoServer.modo_sorteio;
                aplicarVisualModoSorteio(modoSorteio);
            }
            const modal = document.getElementById('modal-config');
            if (modal && modal.classList.contains('hidden')) preencherModalConfig(configuracaoServer);
        }

        // 4. Lista Ganhadores (Prioridade Live)
        if (payload.ganhadoresLive && payload.ganhadoresLive.length > 0) {
            // console.error("passo 1"); // Debug opcional
            renderListaGanhadores(payload.ganhadoresLive);
        } else if (payload.ganhadoresData && payload.ganhadoresLive === undefined) {
            // console.error("passo 2"); // Debug opcional
            renderListaGanhadores(payload.ganhadoresData);
        }

        // 5. Ranking e Lógica de Vitória
        if (payload.melhoresData) {
            let tipoPremioBuscado = "BINGO";
            if (payload.buscandoData && payload.buscandoData[0]) tipoPremioBuscado = payload.buscandoData[0].buscando_o_premio;
            
            renderRanking(payload.melhoresData, tipoPremioBuscado);

            const paradasObrigatorias = ['QUADRA', 'LINHA', 'FALTA UM', 'BINGO', 'DUPLO BINGO'];
            const ganhadoresAtuais = payload.melhoresData.filter(item => {
                const status = (item.premio && item.premio !== "null") ? item.premio : "";
                return paradasObrigatorias.includes(status);
            });

            if (ganhadoresAtuais.length > 0) {
                if (modoRoboAtivo) {
                    // --- MODO ROBÔ COM TEMPORIZADOR ---
                    if (!processandoVitoria) {
                        if (autoSorteioAtivo) pararAutoSorteio();
                        processandoVitoria = true; // Trava imediata
                        console.log("⏳ Aguardando sincronização visual dos terminais (3s)...");
                        
                        setTimeout(() => {
                            processandoVitoria = false; // Destrava para executar
                            gerenciarVitoriaRobo(ganhadoresAtuais);
                        }, 3000); 
                    }
                } else { 
                    // --- MODO MANUAL/AUTO PADRÃO ---
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
            <button onclick="carregarEvento('${evt.id_evento}')" class="px-3 py-1.5 rounded text-xs font-bold ${isFinalizado ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-700 text-white hover:bg-green-600 shadow'}">
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

    const payload = {
        tempo_ganhador: winnerTime, modo_sorteio: modoSelecionado, voz_ativa: isVoz, camera_ativa: isCam,
        nome_sala: nomeSala, url_padrao: urlPadrao, url_live: urlLive, url_mongo_vendas: urlMongo,
        tipo_sorteio: parseInt(tipoSorteio) || 15, tipo_entrada_de_cartelas: parseInt(tipoEntrada) || 1,
        sorteio_automatizado: isSorteioAuto,aviso_fim_das_vendas: parseInt(tempoVendas) || 120
    };
    

    try {
        await fetch(`${API_BASE_URL}/api/admin/salvar_config`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        });
        
        vozAtiva = isVoz; cameraAtiva = isCam; modoSorteio = modoSelecionado;
        aplicarVisualModoSorteio(modoSorteio); aplicarVisibilidadeCamera(cameraAtiva);
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
        const response = await fetch(`${API_BASE_URL}/api/admin/sortear`, { 
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
    } catch (error) { console.error(error); } 
    finally { isSorting = false; if(btn) { btn.disabled = false; btn.textContent = "SORTEAR BOLA 🎲"; } }
}

async function inserirBolaManual() {
    const input = document.getElementById('input-bola-manual');
    const erroLabel = document.getElementById('erro-manual');
    const valor = parseInt(input.value);
    if (isNaN(valor) || valor < 1 || valor > 90) { erroLabel.textContent = "Digite entre 1 e 90"; input.value = ""; input.focus(); return; }
    if (bolasSorteadasCache.includes(valor)) { erroLabel.textContent = `Bola ${valor} já foi!`; input.value = ""; return; }
    erroLabel.textContent = "";
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sortear`, {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ bola_manual: valor })
        });
        const data = await response.json();
        if (data.error) { erroLabel.textContent = data.error; input.value = ""; input.focus(); } 
        else { input.value = ''; devolverFocoAoJogo(); bolaDestaque.textContent = data.bola; falarTextoLocutor(`${data.bola}`); }
    } catch (e) { customAlert("Erro de conexão"); }
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


// --- FUNÇÃO 1: INÍCIO DO PROCESSO (CLIQUE NO BOTÃO CARREGAR) ---
async function carregarEvento(idEvento) {
    const confirmou = await customConfirm(`Deseja INICIAR este evento?\n\nIsso irá BLOQUEAR novas vendas e iniciar o temporizador de segurança.`);
    if(!confirmou) return;
    
    fecharModal('modal-eventos');
    
    // 1. Muda status para FINALIZADO no banco (Trava Vendas)
    showLoading("Encerrando vendas no sistema...");
    try {
        await fetch(`${API_BASE_URL}/api/admin/fechar_vendas_evento`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id_evento: idEvento })
        });
    } catch(e) {
        console.error("Erro ao fechar vendas", e);
        // Continua mesmo com erro, mas avisa? Ou para? Vamos continuar por segurança operacional.
    } finally {
        hideLoading();
    }

    // 2. Inicia o Cronômetro de Espera
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


// --- FUNÇÃO 3: O CARREGAMENTO REAL (ANTIGA carregarEvento) ---
async function executarCarregamentoReal(idEvento) {
    // Força o fechamento do menu lateral
    const menu = document.getElementById('admin-side-menu');
    const menuOverlay = document.getElementById('admin-menu-overlay');
    if (menu) menu.classList.add('-translate-x-full'); 
    if (menuOverlay) menuOverlay.classList.add('hidden'); 

    // INICIA LOADING (Aqui o sistema busca os dados REAIS, incluindo as últimas vendas)
    showLoading("Sincronizando últimas vendas e carregando jogo...");

    try {
        await fetch(`${API_BASE_URL}/api/admin/resetar`, { method: 'POST' });
        
        // Agora busca os detalhes (que já devem incluir as vendas feitas durante o timer)
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
        // ... (Preenche campos da tela igual antes) ...
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
            { key: 'quadra', label: 'Quadra' },
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
        initGrid();
        // aquix
        if (sorteioAutomatizadoConfig && modoSorteio === 'auto') {
        //    const iniciarRobo = await customConfirm("⚙️ Deseja iniciar o modo ROBÔ agora?");
            //if (iniciarRobo) iniciarModoRobo();
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
    gridContainer.innerHTML = '';
    for (let i = 1; i <= 90; i++) {
        const div = document.createElement('div');
        div.id = `admin-ball-${i}`;
        div.className = 'h-4 w-full flex items-center justify-center bg-gray-900/50 text-gray-700 rounded text-[11px] border border-gray-700';
        div.textContent = i;
        gridContainer.appendChild(div);
    }
    renderHistorico([]);
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

// --- FUNÇÃO renderRanking CORRIGIDA (MOSTRA POSIÇÃO DA LINHA) ---
function renderRanking(lista, tipo) {
    const c = document.getElementById('ranking-lista'); if(!c) return;
    document.getElementById('label-premio-ranking').textContent = tipo || "";
    c.innerHTML = '';
    if (!lista || lista.length === 0) { c.innerHTML = '<div class="text-gray-600 text-center text-xs py-2">Calculando...</div>'; return; }
    
    lista.slice(0, 10).forEach((item, i) => {
        const status = (item.premio && item.premio !== "null") ? item.premio : "";
        const nums = item.numeros_faltantes || [];
        
        // Monta o HTML dos números
        let htmlNums = nums.map(n => n<10?`0${n}`:n).join(' ');

        // === CORREÇÃO AQUI: INSERE A POSIÇÃO (Sup/Cen/Inf) ===
        if (["QUADRA", "LINHA"].includes(status) && item.posicao) {
            // Cria uma pequena tag amarela antes dos números
            const tagPosicao = `<span class="text-[9px] bg-yellow-900/60 text-yellow-300 px-1.5 rounded border border-yellow-700 mr-1.5">${item.posicao}</span>`;
            htmlNums = tagPosicao + htmlNums;
        }
        // =====================================================

        if (["BINGO","DUPLO BINGO"].includes(status)) htmlNums = `<span class="text-green-400 font-black animate-pulse">${status}</span>`;
        else if (status === "LINHA") htmlNums = `<span class="text-yellow-400 font-bold animate-pulse">${status} <span class="text-xs">(${item.posicao || ''})</span></span>`;
        else if (["QUADRA","FALTA UM"].includes(status)) htmlNums = `<span>${htmlNums}</span> <span class="text-[10px] text-yellow-300 bg-yellow-900/50 px-1 ml-1 border border-yellow-700">${status}</span>`;
        
        const row = document.createElement('div');
        let cl = "grid grid-cols-6 gap-1 px-1 py-0.5 rounded border items-center mb-0.5 ";
        if (["BINGO","LINHA"].includes(status)) cl += "bg-green-900/40 border-green-500 shadow-lg scale-[1.02]";
        else if (status.includes("FALTA") || status.includes("QUADRA")) cl += "bg-red-900/60 border-red-500";
        else if (i===0) cl += "bg-gray-700 border-yellow-600";
        else cl += "bg-gray-800 border-gray-700";
        
        row.className = cl;
        // Ajustei o col-span dos números para 3 para caber a tag de posição
        row.innerHTML = `<div class="col-span-1 font-mono font-bold text-yellow-500 text-[16px]">${item.cartela}</div><div class="col-span-3 text-[16px] font-mono flex items-center">${htmlNums}</div><div class="col-span-2 text-right truncate text-xs text-blue-500">${item.nome==="null"?'---':item.nome}</div>`;
        c.appendChild(row);
    });
}

function renderListaGanhadores(data) {
    const c = document.getElementById('lista-ganhadores'); if(!c) return; c.innerHTML = '';
    const count = document.getElementById('count-ganhadores');

    if (!data || data.length === 0) { c.innerHTML = '<span class="text-gray-600 text-center italic mt-2">Nenhum.</span>'; if(count) count.textContent="0"; return; }
    let total = 0;
    data.forEach(g => {
        const h = document.createElement('div'); h.className = "text-green-400 font-bold uppercase border-b border-gray-700 -mt-2 mb-0.5 pt-1 text-[9px]"; h.textContent = g.premio; c.appendChild(h);
        if(g.ganhadores) g.ganhadores.forEach(w => {
            total++;
            const r = document.createElement('div'); r.className = "flex justify-between bg-gray-900 px-0.5 py-0.5 rounded mb-0 -mt-1 border border-gray-700";
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

    if (!modoSilencioso && autoSorteioAtivo) {
        toggleAutoSorteio(); 
    }
    
    houveGanhadorNaSessao = false;
    document.getElementById('auditoria-resultado').classList.add('hidden');
    document.getElementById('conf-grid').innerHTML = '';
    document.getElementById('lista-auditoria-session').innerHTML = '<span class="text-gray-600">Nenhum</span>';
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    if (modoSilencioso) {
        input.disabled = true;
    } else {
        input.value = '';
        input.disabled = false;
        setTimeout(() => input.focus(), 200);
    }
}

// --- FUNÇÃO CORRIGIDA: VALIDAR CARTELA (COM LOADING) ---
async function validarCartelaAuditoria() {
    const input = document.getElementById('input-auditoria');
    const cartela = input.value;
    const btnConfirmar = document.getElementById('btn-confirmar-ganhador');

    if(!cartela) return;
    
    // 1. INICIA LOADING
    showLoading("Conferindo cartela...");

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/validar_cartela`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cartela: cartela })
        });
        const data = await response.json();

        const resDiv = document.getElementById('auditoria-resultado');
        resDiv.classList.remove('hidden');
        document.getElementById('conf-info').textContent = `${data.cartela_id || cartela} - ${data.ganhador || 'Desconhecido'}`;
        const msgLabel = document.getElementById('conf-msg');
        
        if (data.status_code === 'WIN') {
            msgLabel.textContent = `✅ ${data.msg}`;
            msgLabel.className = "text-xl font-black text-green-400 animate-pulse";
            
            if (!modoRoboAtivo) {
                btnConfirmar.classList.remove('hidden'); 
                btnConfirmar.onclick = () => confirmarGanhadorAtual(); 
                setTimeout(() => btnConfirmar.focus(), 100);
            } else {
                btnConfirmar.classList.add('hidden');
            }
        } else {
            msgLabel.textContent = `❌ ${data.msg}`;
            if (data.status_code === 'NOT_SOLD') msgLabel.className = "text-xl font-black text-yellow-500";
            else msgLabel.className = "text-xl font-black text-red-400";
            btnConfirmar.classList.add('hidden');
        }

        const grid = document.getElementById('conf-grid');
        grid.innerHTML = '';
        if (data.layout) {
            const bolas = (data.bolas || bolasSorteadasCache || []).map(String);
            [data.layout.superior, data.layout.central, data.layout.inferior].forEach(linha => {
                const row = document.createElement('div'); row.className = "flex justify-between gap-1 mb-1";
                linha.forEach(num => {
                    const cell = document.createElement('div');
                    const marcado = bolas.includes(String(num));
                    cell.className = `w-full h-8 flex items-center justify-center font-bold text-lg rounded border ${marcado ? "bg-yellow-600 text-white border-yellow-400" : "bg-gray-700 text-gray-300 border-gray-400"}`;
                    cell.textContent = num;
                    row.appendChild(cell);
                });
                grid.appendChild(row);
            });
        }
    } catch (e) { 
        console.error(e);
        customAlert("Erro de conexão ao validar."); 
    } finally {
        // 2. REMOVE LOADING (SEMPRE)
        hideLoading();
    }
}


// --- FUNÇÃO CORRIGIDA: CONFIRMAR GANHADOR (LISTA VISUAL) ---
async function confirmarGanhadorAtual() {
    houveGanhadorNaSessao = true; 
    const input = document.getElementById('input-auditoria');
    
    // 1. Captura o valor ANTES de limpar o input
    const cartelaConfirmada = input.value; 

    // 2. Atualiza lista visual
    const lista = document.getElementById('lista-auditoria-session');
    
    // Se a lista tiver apenas o placeholder "Nenhum", limpa ela
    if (lista.innerText.trim() === 'Nenhum' || lista.children.length === 0) {
        lista.innerHTML = '';
    }
    
    const tag = document.createElement('span');
    // Estilo ajustado para espaçamento
    tag.className = "inline-block bg-green-900 text-green-300 px-2 py-1 rounded border border-green-700 text-xs font-bold mr-2 mb-1";
    tag.textContent = `Cartão: ${cartelaConfirmada}`;
    lista.appendChild(tag);
    
    // 3. Limpa a área de resultado
    document.getElementById('auditoria-resultado').classList.add('hidden');
    document.getElementById('conf-grid').innerHTML = '';
    document.getElementById('btn-confirmar-ganhador').classList.add('hidden'); // Esconde botão por segurança
    
    try { await fetch(`${API_BASE_URL}/api/admin/limpar_conferencia`, { method: 'POST' }); } catch(e) {}

    // 4. Prepara para a próxima conferência (Se manual)
    if (!modoRoboAtivo) {
        input.value = ''; 
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

// === FUNÇÃO MANUAL DE TROCA DE PRÊMIO (RECUPERADA) ===
async function processarProximoPremio() {
    // ... (código inicial de busca de dados permanece igual) ...
    let info = null;
    let dadosEvento = null;
    try {
        const resp = await fetch(`${API_BASE_URL}/api/initial-data`);
        const dados = await resp.json();
        info = dados.buscandoData[0];
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

// --- FUNÇÃO mudarPremio CORRIGIDA (COM LOADING) ---
async function mudarPremio(tipo) {
    // INICIA LOADING
    showLoading(`Alterando prêmio para ${tipo}...`);
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/definir_premio`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ premio: tipo })
        });
        
        // Atualiza visualmente na hora
        const elStatus = document.getElementById('status-premio');
        if (elStatus) elStatus.textContent = `Buscando: ${tipo}`;
        
        // Aguarda um pouco para a animação ser notada
        await new Promise(r => setTimeout(r, 500));

    } catch (e) { 
        console.error("Erro mudarPremio:", e);
        customAlert("Erro ao mudar prêmio no servidor."); 
    } finally {
         // REMOVE LOADING
        hideLoading();
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
        
        // Limpeza visual
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