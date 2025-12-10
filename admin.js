// =========================================================
// === ADMIN.JS - SISTEMA ROBUSTO DE BINGO ===
// =========================================================

// --- REFERÊNCIAS DE UI GERAIS ---
const modalOverlay = document.getElementById('custom-modal-overlay');
const modalBox = document.getElementById('custom-modal-box');
const modalTitle = document.getElementById('custom-modal-title');
const modalMessage = document.getElementById('custom-modal-message');
const modalActions = document.getElementById('custom-modal-actions');

// --- REFERÊNCIAS DO BINGO ---
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

// Controle de Hardware
let modoSorteio = 'auto'; 
let vozAtiva = true;   
let cameraAtiva = false;

// --- VARIÁVEIS DE CONEXÃO (CRÍTICO) ---
let socket = null;
let reconnectInterval = null;
let countdownInterval = null;
let houveGanhadorNaSessao = false;

const RECONNECT_DELAY = 5000; // 5 Segundos entre tentativas

// =========================================================
// === 1. SISTEMA DE CONEXÃO ROBUSTO (NOVO) ===
// =========================================================

function gerenciarEstadoConexao(online) {
    const overlay = document.getElementById('overlay-conexao');
    const countdownSpan = document.getElementById('countdown-connection');
    
    if (online) {
        // --- ONLINE ---
        if(overlay) overlay.classList.add('hidden');
        if (countdownInterval) clearInterval(countdownInterval);
        console.log("🟢 Sistema Online e Conectado.");
        
        // Ressincroniza dados ao voltar (evita estado fantasma)
        carregarDadosIniciaisSilencioso();

    } else {
        // --- OFFLINE ---
        if(overlay) overlay.classList.remove('hidden');
        console.warn("🔴 Sistema Offline ou Desconectado.");
        
        // Inicia contagem visual regressiva para o usuário não ficar ansioso
        let count = RECONNECT_DELAY / 1000;
        if(countdownSpan) countdownSpan.textContent = count;
        
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            count--;
            if(count < 0) count = RECONNECT_DELAY / 1000;
            if(countdownSpan) countdownSpan.textContent = count;
        }, 1000);
    }
}

function connectAdminWS() {
    // Se já existe conexão, fecha antes de abrir nova (evita duplicação)
    if (socket) {
        socket.onclose = null; // Remove listener para não gerar loop infinito manual
        socket.close();
    }

    try {
        socket = new WebSocket(WS_URL);
    } catch (e) {
        console.error("Erro ao tentar criar WebSocket:", e);
        agendarReconexao();
        return;
    }
    
    socket.onopen = () => {
        gerenciarEstadoConexao(true); // Oculta o banner vermelho
    };

    socket.onmessage = (event) => {
        processarMensagemWS(event);
    };

    socket.onclose = (event) => {
        // Se o fechamento não foi limpo (cabo desconectado, server caiu)
        if (!event.wasClean) {
            gerenciarEstadoConexao(false); // Mostra banner vermelho
            agendarReconexao();
        }
    };

    socket.onerror = (error) => {
        console.error("Erro no WebSocket:", error);
        socket.close(); // Força o onclose para disparar a reconexão
    };
}

function agendarReconexao() {
    if (reconnectInterval) clearTimeout(reconnectInterval);
    reconnectInterval = setTimeout(() => {
        console.log("🔄 Tentando reconectar...");
        connectAdminWS();
    }, RECONNECT_DELAY);
}

// Escuta eventos do navegador (Cabo de rede puxado / Wifi caiu)
window.addEventListener('offline', () => {
    gerenciarEstadoConexao(false);
    if(socket) socket.close();
});

window.addEventListener('online', () => {
    // Ao voltar a rede, tenta reconectar o WS imediatamente
    console.log("Rede detectada, reconectando WS...");
    connectAdminWS();
});

// Função auxiliar para atualizar dados quando a conexão volta
async function carregarDadosIniciaisSilencioso() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/initial-data`);
        const data = await response.json();
        // Atualiza cache local silenciosamente
        if(data.bolasData && data.bolasData[0]) {
             bolasSorteadasCache = data.bolasData[0].bolas_cantadas || [];
             updateGrid(bolasSorteadasCache);
        }
        // Se quiser atualizar prêmio também:
        if(data.buscandoData && data.buscandoData[0]) {
             // Atualiza label visual
             const info = data.buscandoData[0];
             let texto = info.buscando_o_premio;
             if(info.buscando_a_linha) texto += ` (${info.buscando_a_linha})`;
             document.getElementById('status-premio').textContent = `Buscando: ${texto}`;
        }
    } catch(e) { console.log("Erro ao ressincronizar:", e); }
}

// Processamento separado das mensagens (para organização)
// Processamento separado das mensagens (para organização)
function processarMensagemWS(event) {
    const payload = JSON.parse(event.data);
    
    if (payload.type === 'UPDATE') {
        
        // 1. Bolas (COM CONTROLE DE SPAM)
        if (payload.bolasData) {
            const bolas = payload.bolasData[0]?.bolas_cantadas || [];
            bolasSorteadasCache = bolas;
            
            // Se a quantidade de bolas mudou (novo sorteio), resetamos a trava do alerta
            if (bolas.length !== ultimoTotalBolasProcessadas) {
                ultimoTotalBolasProcessadas = bolas.length;
                jaAlertouNestaBola = false; // <--- LIBERA O ALERTA PARA A NOVA BOLA
            }

            updateGrid(bolas);
            if (bolas.length > 0) bolaDestaque.textContent = bolas[bolas.length - 1];
        }

        // 2. Status Prêmio
        if(payload.buscandoData) {
            const dados = payload.buscandoData[0];
            const premio = dados?.buscando_o_premio || '...';
            const linhas = dados?.buscando_a_linha || '';
            
            let textoExibicao = premio;
            if (linhas && (premio === 'LINHA' || premio === '3 LINHAS')) {
                textoExibicao += ` (${linhas})`;
            }
            document.getElementById('status-premio').textContent = `Buscando: ${textoExibicao}`;
        }

        // 3. Parâmetros
        if (payload.parametrosInfo) {
            configuracaoServer = payload.parametrosInfo;
            if (configuracaoServer.modo_sorteio) {
                modoSorteio = configuracaoServer.modo_sorteio;
                aplicarVisualModoSorteio(modoSorteio);
            }
            if (configuracaoServer.voz_ativa !== undefined) vozAtiva = configuracaoServer.voz_ativa;
            if (configuracaoServer.camera_ativa !== undefined) {
                cameraAtiva = configuracaoServer.camera_ativa;
                aplicarVisibilidadeCamera(cameraAtiva);
            }
            const modal = document.getElementById('modal-config');
            if (modal && modal.classList.contains('hidden')) preencherModalConfig(configuracaoServer);
        }

        // 4. Lista Ganhadores
        if (payload.ganhadoresData) {
            renderListaGanhadores(payload.ganhadoresData);
        }

        // 5. Ranking e Lógica de Alerta (INTELIGENTE)
        if (payload.melhoresData) {
            let tipoPremioBuscado = "BINGO";
            if (payload.buscandoData && payload.buscandoData[0]) {
                tipoPremioBuscado = payload.buscandoData[0].buscando_o_premio;
            }
            
            renderRanking(payload.melhoresData, tipoPremioBuscado);

            // --- LÓGICA DE DETECÇÃO ---
            const paradasObrigatorias = ['QUADRA', 'LINHA', 'FALTA UM', 'BINGO', 'DUPLO BINGO'];
            
            const situacaoCritica = payload.melhoresData.some(item => {
                const status = (item.premio && item.premio !== "null") ? item.premio : "";
                return paradasObrigatorias.includes(status);
            });

            // --- LÓGICA DE ALERTA COM TRAVA ---
            if (situacaoCritica) {
                
                // CASO 1: MODO AUTOMÁTICO (Sempre para e avisa, segurança máxima)
                if (autoSorteioAtivo) {
                    console.warn("⚠️ Estado Crítico detectado! Parando sorteio automático.");
                    pararAutoSorteio();
                    customAlert("Alerta de Premiação! Sorteio automático pausado.");
                    jaAlertouNestaBola = true; // Marca como avisado
                } 
                // CASO 2: MODO MANUAL (Só avisa se ainda não avisou nesta bola)
                else if (!jaAlertouNestaBola) {
                    customAlert("Alerta de Premiação ou Falta 1!");
                    jaAlertouNestaBola = true; // <--- TRAVA O ALERTA ATÉ SAIR OUTRA BOLA
                }
            }
        }
    }
}


// =========================================================
// === 2. UTILITÁRIOS DE INTERFACE (ALERTS, MODAIS) ===
// =========================================================

function customAlert(mensagem, titulo = "⚠️ Atenção") {
    return new Promise((resolve) => {
        modalTitle.textContent = titulo;
        modalTitle.className = "text-xl text-yellow-500 mb-1 uppercase tracking-wide";
        modalMessage.textContent = mensagem;
        modalActions.innerHTML = '';
        const btnOk = document.createElement('button');
        btnOk.className = "bg-blue-600 hover:bg-blue-500 text-white font-bold py-1 px-6 rounded-lg shadow-lg transition-transform active:scale-95";
        btnOk.textContent = "OK";
        btnOk.onclick = () => {
            fecharCustomModal();
            resolve();
        };
        modalActions.appendChild(btnOk);
        abrirCustomModal();
        btnOk.focus();
    });
}

function customConfirm(mensagem, titulo = "❓ Confirmação") {
    return new Promise((resolve) => {
        modalTitle.textContent = titulo;
        modalTitle.className = "text-lg font-black text-blue-400 mb-1 uppercase tracking-wide";
        modalMessage.textContent = mensagem;
        modalActions.innerHTML = '';

        const btnCancel = document.createElement('button');
        btnCancel.className = "bg-gray-600 hover:bg-gray-500 text-white font-bold py-1 px-4 rounded-lg transition-transform active:scale-95";
        btnCancel.textContent = "Cancelar";
        btnCancel.onclick = () => {
            fecharCustomModal();
            resolve(false);
        };

        const btnConfirm = document.createElement('button');
        btnConfirm.className = "bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-4 rounded-lg shadow-lg transition-transform active:scale-95";
        btnConfirm.textContent = "Confirmar";
        btnConfirm.onclick = () => {
            fecharCustomModal();
            resolve(true);
        };

        modalActions.appendChild(btnCancel);
        modalActions.appendChild(btnConfirm);
        abrirCustomModal();
        btnConfirm.focus();
    });
}

function abrirCustomModal() {
    modalOverlay.classList.remove('hidden');
    setTimeout(() => {
        modalOverlay.classList.add('modal-show');
        modalBox.classList.add('modal-box-show');
    }, 10);
}

function fecharCustomModal() {
    modalOverlay.classList.remove('modal-show');
    modalBox.classList.remove('modal-box-show');
    setTimeout(() => {
        modalOverlay.classList.add('hidden');
    }, 200);
}

// =========================================================
// === 3. LÓGICA DO JOGO E GRID ===
// =========================================================

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
        el.className = 'h-4 w-full flex items-center justify-center bg-gray-900/50 text-gray-700  rounded text-[11px] border border-gray-700';
    });

    if (!bolas || bolas.length === 0) {
        contadorElement.textContent = `0 / 90`;
        renderHistorico([]);
        return;
    }

    const ultimaBola = bolas[bolas.length - 1]; 
    bolas.forEach(num => {
        const el = document.getElementById(`admin-ball-${num}`);
        if (el) {
            if (num === ultimaBola) {
                el.className = 'h-4 w-full flex items-center justify-center bg-yellow-600 text-gray-200 font-semibold rounded border border-yellow-400 text-[12px]';
            } else {
                el.className = 'h-4 w-full flex items-center justify-center bg-green-700 text-green-200 font-semibold rounded border border-green-500 text-[12px]';
            }
        }
    });

    contadorElement.textContent = `${bolas.length} / 90`;
    renderHistorico(bolas);
}

function renderHistorico(bolas) {
    const container = document.getElementById('historico-bolas');
    if (!container) return;
    container.innerHTML = '';

    if (bolas.length === 0) {
        container.innerHTML = '<span class="text-gray-600 text-xl italic p-2">Aguardando sorteio...</span>';
        return;
    }
    // Mostra a última sorteada primeiro
    const bolasInvertidas = [...bolas].reverse(); 

    bolasInvertidas.forEach((num, index) => {
        const div = document.createElement('div');
        let classeBase = "h-5 w-5 flex items-center justify-center rounded-full text-[10px] shadow-sm border ";
        if (index === 0) { 
            div.className = classeBase + "bg-yellow-800 text-gray-200 border-yellow-600 border-2";
        } else {
            div.className = classeBase + "bg-gray-800 text-gray-300 border-yellow-600";
        }
        div.textContent = num;
        container.appendChild(div);
    });
}

// =========================================================
// === RENDERIZAÇÃO DO RANKING (TOP 10) ===
// =========================================================

function renderRanking(listaMelhores, tipoPremio) {
    const container = document.getElementById('ranking-lista');
    const labelPremio = document.getElementById('label-premio-ranking');
    
    if (!container) return;

    if (labelPremio) labelPremio.textContent = tipoPremio || "";
    container.innerHTML = '';

    if (!listaMelhores || listaMelhores.length === 0) {
        container.innerHTML = '<div class="text-gray-600 text-center text-xs py-2">Calculando...</div>';
        return;
    }
    
    const top10 = listaMelhores.slice(0, 10);
    // Recupeara lista de ganhadores visualmente já processada, se houver, ou buscamos do DOM se necessário.
    // Mas aqui vamos confiar no filtro do Backend se você implementou, ou filtrar aqui:
    // Filtro JS (Opcional se o Backend já não filtrasse):
    // const listaSemGanhadores = top10.filter(...) 

    top10.forEach((item, index) => {
        
        // 1. Sufixo de Posição (S/C/I)
        let sufixoHTML = "";
        if (item.posicao && item.posicao !== "null") {
            const pos = item.posicao.toUpperCase();
            if (pos.startsWith('S')) sufixoHTML = "<span class='text-[10px] text-blue-300 ml-1 font-normal'>(SUP)</span>";
            else if (pos.startsWith('C')) sufixoHTML = "<span class='text-[10px] text-blue-300 ml-1 font-normal'>(CEN)</span>";
            else if (pos.startsWith('I')) sufixoHTML = "<span class='text-[10px] text-blue-300 ml-1 font-normal'>(INF)</span>";
        }

        // 2. Tratamento da Mensagem de Alerta (O campo 'premio' agora traz 'QUADRA', 'FALTA UM'...)
        const statusTexto = (item.premio && item.premio !== "null") ? item.premio : "";
        
        const listaNumeros = item.numeros || []; // Backend agora manda 'numeros'
        const qtdeFaltam = listaNumeros.length;

        // Monta o HTML dos números
        let htmlNumeros = "";
        
        // Formata os números (05 10...)
        const numerosString = listaNumeros.map(n => n < 10 ? `0${n}` : n).join(' ');

        // --- LÓGICA DE EXIBIÇÃO SOLICITADA ---
        if (statusTexto === "BINGO" || statusTexto === "DUPLO BINGO") {
            htmlNumeros = `<span class="text-green-400 font-black tracking-widest animate-pulse">${statusTexto}</span>`;
        } 
        else if (statusTexto === "LINHA") {
            htmlNumeros = `<span class="text-yellow-400 font-bold tracking-wider animate-pulse">${statusTexto}</span>`;
        }
        else if (statusTexto === "QUADRA" || statusTexto === "FALTA UM") {
            // "apresenta o termo a frente da bola faltante" -> [NUMERO] [TERMO]
            htmlNumeros = `<span>${numerosString}</span> <span class="text-[10px] text-yellow-300 bg-yellow-900/50 px-1 rounded ml-1 border border-yellow-700 font-bold">${statusTexto}</span>`;
        } 
        else {
            // Normal
            htmlNumeros = numerosString || (qtdeFaltam === 0 ? "..." : "");
        }

        // 3. Estilização da Linha
        const isBoa = (qtdeFaltam === 1 && !statusTexto.includes("BINGO")) || statusTexto === "QUADRA" || statusTexto === "FALTA UM";
        const isGanhou = statusTexto.includes("BINGO") || statusTexto === "LINHA";
        const isLider = index === 0;

        let divClass = "grid grid-cols-6 gap-1 px-1 py-0.5 rounded border items-center mb-0.5 ";
        let textNomeClass = "col-span-2 truncate text-xs ";
        let badgeClass = `col-span-3 text-left font-mono font-bold text-[14px] px-1 py-0 rounded border whitespace-nowrap overflow-hidden text-ellipsis flex items-center `;

        if (isGanhou) {
            divClass += "bg-green-900/40 border-green-500 shadow-lg scale-[1.02] origin-left transition-transform";
            textNomeClass += "text-white font-bold";
            badgeClass += "bg-green-800 text-white border-green-400 justify-center";
        } else if (isBoa) {
            divClass += "bg-red-900/60 border-red-500"; // Removi o animate-pulse da ROW toda pra não ficar muito caótico
            textNomeClass += "text-white font-bold";
            badgeClass += "bg-red-600 text-white border-red-400";
        } else if (isLider) {
            divClass += "bg-gray-700 border-yellow-600";
            textNomeClass += "text-yellow-100";
            badgeClass += "bg-gray-900 text-yellow-400 border-yellow-600";
        } else {
            divClass += "bg-gray-800 border-gray-700";
            textNomeClass += "text-gray-400";
            badgeClass += "bg-gray-900 text-gray-300 border-gray-600";
        }

        // 4. Monta HTML Final
        const row = document.createElement('div');
        row.className = divClass;
        
        row.innerHTML = `
             <div class="col-span-1 flex items-center gap-1 leading-none">
                <span class="font-mono font-bold text-yellow-500 text-[16px]">${item.cartela}</span>
                ${sufixoHTML}
            </div>
            
            <div class="${badgeClass}">
                ${htmlNumeros}
            </div>

            <div class="text-blue-500 text-right ${textNomeClass}" title="${item.nome}">
                ${item.nome === "null" ? '---' : item.nome}
            </div>
        `;

        container.appendChild(row);
    });
}


// =========================================================
// === 4. SORTEIO (MANUAL E AUTOMÁTICO) ===
// =========================================================

function toggleAutoSorteio() {
    const btn = document.getElementById('btn-auto-toggle');
    const inputTempo = document.getElementById('input-tempo-auto');
    const btnManual = document.getElementById('btn-sortear');

    if (autoSorteioAtivo) {
        pararAutoSorteio();
        btn.innerHTML = '<span>▶️</span> INICIAR AUTOMÁTICO';
        btn.className = 'w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 rounded border border-gray-600 transition-colors flex items-center justify-center gap-2';
        inputTempo.disabled = false;
        btnManual.disabled = false;
    } else {
        const segundos = parseInt(inputTempo.value);
        if (segundos < 3) {
            customAlert("Tempo mínimo é 3 segundos!");
            return;
        }

        autoSorteioAtivo = true;
        btn.innerHTML = '<span>⏸️</span> PARAR AUTOMÁTICO';
        btn.className = 'w-full bg-red-900 hover:bg-red-700 text-white font-bold py-2 rounded border border-red-500 transition-colors flex items-center justify-center gap-2 animate-pulse';
        inputTempo.disabled = true;
        btnManual.disabled = true;
        
        cicloSorteioAutomatico(segundos);
    }
}

function pararAutoSorteio() {
    autoSorteioAtivo = false;
    clearTimeout(autoSorteioInterval);
    clearInterval(progressInterval);
    document.getElementById('progress-auto').style.width = '0%';

    // --- ATUALIZAÇÃO VISUAL DO BOTÃO (CSS) ---
    const btn = document.getElementById('btn-auto-toggle');
    const inputTempo = document.getElementById('input-tempo-auto');
    const btnManual = document.getElementById('btn-sortear');

    if (btn) {
        btn.innerHTML = '<span>▶️</span> INICIAR AUTOMÁTICO';
        // Volta para o cinza/neutro
        btn.className = 'w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 rounded border border-gray-600 transition-colors flex items-center justify-center gap-2';
    }

    if (inputTempo) inputTempo.disabled = false;
    if (btnManual) btnManual.disabled = false;
}

async function cicloSorteioAutomatico(segundosTotal) {
    if (!autoSorteioAtivo) return;

    await sortearBola(); 

    const contadorTexto = document.getElementById('contador-bolas').textContent;
    if (contadorTexto.includes("90 / 90")) {
        pararAutoSorteio();
        customAlert("Fim de jogo! Sorteio automático parado.");
        return;
    }

    tempoRestante = segundosTotal;
    atualizarBarraProgresso(segundosTotal);

    autoSorteioInterval = setTimeout(() => {
        cicloSorteioAutomatico(segundosTotal);
    }, segundosTotal * 1000);
}

function atualizarBarraProgresso(totalSegundos) {
    const barra = document.getElementById('progress-auto');
    const start = Date.now();
    const end = start + (totalSegundos * 1000);

    if (progressInterval) clearInterval(progressInterval);

    progressInterval = setInterval(() => {
        const now = Date.now();
        const restante = end - now;
        const porcentagem = 100 - ((restante / (totalSegundos * 1000)) * 100);

        if (restante <= 0) {
            barra.style.width = '100%';
            clearInterval(progressInterval);
        } else {
            barra.style.width = `${porcentagem}%`;
        }
    }, 100);
}

async function sortearBola() {
    // Impede sorteio se estiver offline (segurança adicional)
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        customAlert("Sem conexão com o servidor. Aguarde a reconexão.");
        return;
    }

    if (isSorting) return;
    isSorting = true;
    
    const btn = document.getElementById('btn-sortear');
    if(btn) {
        btn.disabled = true;
        btn.textContent = "SORTEANDO...";
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sortear`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const data = await response.json();

        if (data.error) {
            customAlert(data.error);
        } else {
            bolaDestaque.textContent = data.bola;
            const el = document.getElementById(`admin-ball-${data.bola}`);
            if(el) el.classList.add('bg-green-600', 'text-white');            
            falarTextoLocutor(`${data.bola}`);
        }
    } catch (error) {
        console.error(error);
        // Não alerta aqui pois o sistema de overlay já deve ter pego a queda
    } finally {
        isSorting = false;
        if(btn) {
            btn.disabled = false;
            btn.textContent = "SORTEAR BOLA 🎲";
        }
    }
}

async function inserirBolaManual() {
    const input = document.getElementById('input-bola-manual');
    const erroLabel = document.getElementById('erro-manual');
    const valor = parseInt(input.value);

    if (isNaN(valor) || valor < 1 || valor > 90) {
        erroLabel.textContent = "Digite entre 1 e 90";
        input.value = ""; input.focus(); return;
    }
    if (bolasSorteadasCache.includes(valor)) {
        erroLabel.textContent = `Bola ${valor} já sorteada!`;
        if((await customConfirm(`Bola ${valor} já sorteada!`))) {
            input.value = "";
        } 
        input.value = ""; devolverFocoAoJogo(); return;
    }
    erroLabel.textContent = "";

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/sortear`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ bola_manual: valor })
        });
        const data = await response.json();
        if (data.error) {
            erroLabel.textContent = data.error;
            input.value = ""; input.focus();
        } else {
            input.value = '';
            devolverFocoAoJogo();
            bolaDestaque.textContent = data.bola;
            falarTextoLocutor(`${data.bola}`);
        }
    } catch (e) { customAlert("Erro de conexão"); }
}

// =========================================================
// === 5. CÂMERA, VOZ E OUTROS RECURSOS ===
// =========================================================

function aplicarVisibilidadeCamera(ativa) {
    const container = document.getElementById('camera-preview-container');
    if (ativa) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        if (typeof localStream !== 'undefined' && localStream) {
            toggleLocalCamera();
        }
    }
}

async function toggleLocalCamera() {
    const videoElement = document.getElementById('video-feed');
    const placeholder = document.getElementById('video-placeholder');
    const btn = document.getElementById('btn-local-cam');

    if (!localStream) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "environment" } 
            });
            localStream = stream;
            videoElement.srcObject = stream;
            videoElement.classList.remove('hidden');
            placeholder.classList.add('hidden');
            btn.textContent = "DESLIGAR";
            btn.classList.replace('text-green-400', 'text-red-400');
        } catch (err) {
            console.error(err);
            customAlert("Não foi possível acessar a câmera.");
        }
    } else {
        const tracks = localStream.getTracks();
        tracks.forEach(track => track.stop());
        localStream = null;
        videoElement.srcObject = null;
        videoElement.classList.add('hidden');
        placeholder.classList.remove('hidden');
        btn.textContent = "LIGAR";
        btn.classList.replace('text-red-400', 'text-green-400');
    }
}

function ajustarCamera() {
    const wrapper = document.getElementById('video-wrapper');
    const widthVal = document.getElementById('cam-width').value;
    const heightVal = document.getElementById('cam-height').value;
    wrapper.style.width = `${widthVal}%`;
    wrapper.style.height = `${heightVal}px`;
    document.getElementById('label-width').textContent = `${widthVal}%`;
    document.getElementById('label-height').textContent = `${heightVal}px`;
}

function falarTextoLocutor(texto) {
    if (!vozAtiva) return;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance();
        utter.text = texto;
        utter.lang = 'pt-BR';
        utter.volume = 1;
        utter.rate = 1.1;
        
        const vozes = window.speechSynthesis.getVoices();
        const vozMelhor = vozes.find(v => v.lang === 'pt-BR' && (v.name.includes('Google') || v.name.includes('Microsoft')));
        if (vozMelhor) utter.voice = vozMelhor;

        window.speechSynthesis.speak(utter);
    }
}

// =========================================================
// === 6. AUDITORIA E VALIDAÇÃO (F1, 99) ===
// =========================================================

function abrirSessaoAuditoria() {
    const modal = document.getElementById('modal-conferencia');
    const input = document.getElementById('input-auditoria');

   if (autoSorteioAtivo) {
        toggleAutoSorteio(); 
        console.log("Sorteio Automático pausado para conferência.");
    }
    
    houveGanhadorNaSessao = false;
    document.getElementById('auditoria-resultado').classList.add('hidden');
    document.getElementById('conf-grid').innerHTML = '';
    document.getElementById('lista-auditoria-session').innerHTML = '<span class="text-gray-600">Nenhum</span>';
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // --- CORREÇÃO ERRO 3: FORÇA REABILITAÇÃO DO INPUT ---
    input.value = '';
    input.disabled = false; // Garante que não esteja travado de uma tentativa anterior
    // ----------------------------------------------------

    setTimeout(() => input.focus(), 200);
}


async function validarCartelaAuditoria() {
    const input = document.getElementById('input-auditoria');
    const cartela = input.value;
    if(!cartela) return;
    input.disabled = true;
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/validar_cartela`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cartela: cartela })
        });
        const data = await response.json();

        const resDiv = document.getElementById('auditoria-resultado');
        resDiv.classList.remove('hidden');
        document.getElementById('conf-info').textContent = `${data.cartela_id} - ${data.ganhador}`;
        const msgLabel = document.getElementById('conf-msg');
        const btnConfirmar = document.getElementById('btn-confirmar-ganhador');
        if (data.status_code === 'WIN') {
            msgLabel.textContent = `✅ ${data.msg}`;
            msgLabel.className = "text-xl font-black text-green-400 animate-pulse";
            btnConfirmar.classList.remove('hidden'); 
            btnConfirmar.onclick = () => confirmarGanhadorAtual(cartela); 
            setTimeout(() => btnConfirmar.focus(), 100); 
        } else {
            msgLabel.textContent = `❌ ${data.msg}`;
            msgLabel.className = "text-xl font-black text-red-400";
            btnConfirmar.classList.add('hidden');
            setTimeout(() => { input.disabled = false; input.focus(); input.select(); }, 500);
        }

        const grid = document.getElementById('conf-grid');
        grid.innerHTML = '';
        if (data.layout) {
            const bolas = (data.bolas || window.bolasSorteadasCache || []).map(String);
            [data.layout.superior, data.layout.central, data.layout.inferior].forEach(linha => {
                const row = document.createElement('div');
                row.className = "flex justify-between gap-1 mb-1";
                linha.forEach(num => {
                    const cell = document.createElement('div');
                    const marcado = bolas.includes(String(num));
                    cell.className = "w-full h-8 flex items-center justify-center font-bold text-lg rounded border " + 
                                     (marcado ? "bg-yellow-600 text-white border-yellow-400" : "bg-gray-700 text-gray-300 border-gray-400");
                    cell.textContent = num;
                    row.appendChild(cell);
                });
                grid.appendChild(row);
            });
        }
    } catch (e) { customAlert("Erro conexão"); } finally {
        if(document.getElementById('btn-confirmar-ganhador').classList.contains('hidden')) {
             input.disabled = false; input.focus();
        }
    }
}

// --- ATUALIZE ESTA FUNÇÃO ---
async function confirmarGanhadorAtual(cartela) {
    houveGanhadorNaSessao = true; 
    
    // 1. Atualiza lista local (Admin)
    const lista = document.getElementById('lista-auditoria-session');
    if (lista.innerText.includes('Nenhum')) lista.innerHTML = '';
    const tag = document.createElement('span');
    tag.className = "bg-green-900 text-green-300 px-2 py-1 rounded border border-green-700";
    tag.textContent = `${cartela}`;
    lista.appendChild(tag);
    
    // 2. Limpa o Modal Admin
    document.getElementById('auditoria-resultado').classList.add('hidden');
    document.getElementById('conf-grid').innerHTML = '';
    
    // 3. LIMPA O TELÃO (CHAMA A NOVA ROTA)
    try {
        await fetch(`${API_BASE_URL}/api/admin/limpar_conferencia`, { method: 'POST' });
    } catch(e) { console.error("Erro ao limpar telão", e); }

    // 4. Reseta input
    const input = document.getElementById('input-auditoria');
    input.value = ''; input.disabled = false; input.focus();
}

// --- ATUALIZE ESTA FUNÇÃO ---
async function encerrarSessaoConferencia() {
    document.getElementById('modal-conferencia').classList.add('hidden');
    document.getElementById('modal-conferencia').classList.remove('flex');
    devolverFocoAoJogo();

    // Sincroniza linhas
    try { await fetch(`${API_BASE_URL}/api/admin/atualizar_linhas_restantes`, { method: 'POST' }); } catch(e) {}

    // LIMPA O TELÃO AO SAIR (GARANTIA)
    try {
        await fetch(`${API_BASE_URL}/api/admin/limpar_conferencia`, { method: 'POST' });
    } catch(e) { console.error("Erro ao limpar telão", e); }

    if (houveGanhadorNaSessao) {
        await processarProximoPremio();
    }
}


// --- FUNÇÃO CORRIGIDA: LÓGICA DE TROCA DE PRÊMIO ---
async function processarProximoPremio() {
    
    // 1. Obtém o estado REAL do banco de dados (Mais seguro que ler o HTML)
    let info = null;
    let dadosEvento = null;

    try {
        // Pega dados do estado atual (quem estamos buscando)
        const resp = await fetch(`${API_BASE_URL}/api/initial-data`);
        const dados = await resp.json();
        info = dados.buscandoData[0];
        
        // Pega dados do evento (para saber quais prêmios existem e seus valores)
        // Tenta usar cache local se existir, senão usa o que veio no initial-data (se tiver) ou busca de novo
        if (typeof dadosEventoAtual !== 'undefined' && dadosEventoAtual) {
            dadosEvento = dadosEventoAtual;
        } 
    } catch (e) { 
        console.log("Erro check status", e); 
        return; 
    }

    if (!info) return;

    // 2. VERIFICAÇÃO CRÍTICA DE LINHAS
    // Se o prêmio é LINHA e o campo 'buscando_a_linha' no banco NÃO está vazio,
    // significa que ainda falta bater alguma linha (Sup, Cen ou Inf).
    // Nesse caso, PARE. Não avance para Bingo ainda.
    if (info.buscando_o_premio === 'LINHA' && info.buscando_a_linha && info.buscando_a_linha.length > 0) {
        return; 
    }

    // 3. Descobre índice atual baseado no BANCO (e não na tela)
    const ordem = ['QUADRA', 'LINHA', 'FALTAUM', 'BINGO', 'DUPLO BINGO'];
    
    let atualKey = info.buscando_o_premio; // Ex: "LINHA" (sem o sufixo SUP)
    
    // Normalizações
    if (atualKey === 'FALTA 1') atualKey = 'FALTAUM';
    if (atualKey === '3 LINHAS') atualKey = 'LINHA';
    
    const indexAtual = ordem.indexOf(atualKey);
    
    // Se não achou na lista (ex: prêmio manual), aborta
    if (indexAtual === -1) {
        console.warn("Prêmio atual não está na sequência lógica:", atualKey);
        return;
    }

    // 4. Procura o PRÓXIMO prêmio ativo
    let proximoKey = null;
    let dadosPremios = dadosEvento ? dadosEvento.premios : null;

    if (dadosPremios) {
        // Varre a lista a partir do próximo item
        for (let i = indexAtual + 1; i < ordem.length; i++) {
            const keyTeste = ordem[i];
            
            // Converte nome da lista para chave do objeto de dados (Ex: FALTAUM -> falta_um)
            let keyDados = keyTeste.toLowerCase();
            if (keyTeste === 'FALTAUM') keyDados = 'falta_um';
            if (keyTeste === 'DUPLO BINGO') keyDados = 'segundo_bingo';
            
            // Verifica se o prêmio tem valor configurado (> 0)
            const valor = parseFloat(dadosPremios[keyDados] || 0);
            if (valor > 0) {
                proximoKey = keyTeste;
                break; // Achou o próximo válido!
            }
        }
    } else {
        // Fallback se não tiver dados do evento: pega o imediatamente seguinte
        if (indexAtual + 1 < ordem.length) {
            proximoKey = ordem[indexAtual + 1];
        }
    }

    // 5. Executa a Troca
    if (proximoKey) {
        // Pequeno delay para garantir que o usuário viu a mensagem de validação antes do confirm
        setTimeout(async () => {
            if (await customConfirm(`Todas as linhas conferidas!\n\nAvançar prêmio para: ${proximoKey}?`)) {
                await mudarPremio(proximoKey);
            }
        }, 500);
    } else {
        setTimeout(async () => {
            if (await customConfirm(`⚠️ Fim da sequência de prêmios!\n\nEste foi o último prêmio ativo.\nDeseja FINALIZAR o evento agora?`)) {
                resetarJogo();
            }
        }, 500);
    }
}


async function mudarPremio(tipo) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/definir_premio`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ premio: tipo })
        });
        document.getElementById('status-premio').textContent = `Buscando: ${tipo}`;
    } catch (e) { customAlert("Erro ao mudar prêmio"); }
}

// =========================================================
// === 7. GESTÃO DE EVENTOS E UI (MENU, TELA CHEIA) ===
// =========================================================

function toggleAdminMenu() {
    const menu = document.getElementById('admin-side-menu');
    const overlay = document.getElementById('admin-menu-overlay');
    const isClosed = menu.classList.contains('-translate-x-full');
    if (isClosed) { menu.classList.remove('-translate-x-full'); overlay.classList.remove('hidden'); }
    else { menu.classList.add('-translate-x-full'); overlay.classList.add('hidden'); }
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

    toggleAdminMenu();
    const modal = document.getElementById('modal-eventos');
    const container = document.getElementById('lista-eventos-container');
    modal.classList.remove('hidden');
    container.innerHTML = '<div class="flex flex-col items-center py-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mb-2"></div><span class="text-gray-400">Buscando agenda...</span></div>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/proximos_eventos`);
        const eventos = await response.json();
        renderizarListaEventos(eventos);
    } catch (error) {
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

async function carregarEvento(idEvento) {
    const confirmou = await customConfirm(`Deseja carregar os dados do Evento ID: ${idEvento}?`);
    if(!confirmou) return;
    fecharModal('modal-eventos');
    try {
        await fetch(`${API_BASE_URL}/api/admin/resetar`, { method: 'POST' });
        const response = await fetch(`${API_BASE_URL}/api/admin/detalhes_evento?id_evento=${idEvento}`);
        const dados = await response.json();
        if (dados.error) { customAlert("Erro: " + dados.error); return; }

        dadosEventoAtual = dados; 
        document.getElementById('painel-evento-ativo').classList.remove('hidden');
        document.getElementById('info-descricao').textContent = dados.descricao;
        document.getElementById('info-data-hora').textContent = `${dados.data_evento} ${dados.hora_evento}`;
        document.getElementById('info-inicial').textContent = dados.numero_inicial;
        document.getElementById('info-qtde').textContent = dados.qtde_vendida;
        document.getElementById('info-ultimo').textContent = dados.ultimo_cartao;
        
        const valorUnit = parseFloat(dados.valor_venda || 0);
        const valorTotal = parseFloat(dados.total_vendas_reais || 0);
        document.getElementById('info-preco-un').textContent = valorUnit.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
        document.getElementById('info-vendas').textContent = valorTotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

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
    } catch (e) { console.error(e); customAlert("Erro ao carregar detalhes."); }
}

async function definirProximoPremioAutomatico() {
    if (!dadosEventoAtual || !dadosEventoAtual.premios) return;
    const ordem = ['quadra', 'linha', 'falta_um', 'bingo', 'segundo_bingo'];
    let premioAlvo = '';
    for (const key of ordem) {
        const val = parseFloat(dadosEventoAtual.premios[key] || 0);
        if (val > 0) {
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

function abrirModalConfig() {
    toggleAdminMenu();
    const modal = document.getElementById('modal-config');
    modal.classList.remove('hidden');
    let valorFinal = 20;
    if (configuracaoServer && configuracaoServer.tempo_ganhador) valorFinal = configuracaoServer.tempo_ganhador;
    else { const saved = localStorage.getItem('winner_display_time'); if(saved) valorFinal = saved; }
    document.getElementById('config-winner-time').value = valorFinal;
}

async function salvarConfiguracoes() {
    const winnerTime = document.getElementById('config-winner-time').value;
    const isVoz = document.getElementById('config-voz-ativa').checked;
    const isCam = document.getElementById('config-camera-ativa').checked;
    let modoSelecionado = 'auto';
    const radios = document.getElementsByName('modo_sorteio');
    for (const radio of radios) { if (radio.checked) { modoSelecionado = radio.value; break; } }

    try {
        await fetch(`${API_BASE_URL}/api/admin/salvar_config`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ tempo_ganhador: winnerTime, modo_sorteio: modoSelecionado, voz_ativa: isVoz, camera_ativa: isCam })
        });
        vozAtiva = isVoz; cameraAtiva = isCam; modoSorteio = modoSelecionado;
        aplicarVisualModoSorteio(modoSorteio); aplicarVisibilidadeCamera(cameraAtiva);
        fecharModal('modal-config');
    } catch (e) { customAlert("Erro ao salvar no servidor."); }
}

async function resetarJogo() {
    if(!(await customConfirm("TEM CERTEZA? Isso limpará a tela e encerrará o jogo atual."))) { devolverFocoAoJogo(); return; } 
    if (autoSorteioAtivo) toggleAutoSorteio();
    try {
        await fetch(`${API_BASE_URL}/api/admin/resetar`, { method: 'POST' });
        bolaDestaque.textContent = "--"; initGrid();
        document.getElementById('status-premio').textContent = "Buscando: ...";
        document.getElementById('contador-bolas').textContent = "0 / 90";
        renderHistorico([]);
        document.getElementById('painel-evento-ativo').classList.add('hidden');
        const modal = document.getElementById('modal-eventos');
        const container = document.getElementById('lista-eventos-container');
        modal.classList.remove('hidden'); 
        container.innerHTML = '<div class="flex flex-col items-center py-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mb-2"></div><span class="text-gray-400">Buscando agenda...</span></div>';
        try { const response = await fetch(`${API_BASE_URL}/api/proximos_eventos`); const eventos = await response.json(); renderizarListaEventos(eventos); } catch (err) { container.innerHTML = `<p class="text-center text-red-400">Erro: ${err.message}</p>`; }
    } catch (e) { customAlert("Erro ao resetar sistema."); }
}

function renderListaGanhadores(ganhadoresData) {
    const container = document.getElementById('lista-ganhadores');
    const contador = document.getElementById('count-ganhadores');
    if (!container) return;
    container.innerHTML = '';
    if (!ganhadoresData || ganhadoresData.length === 0) {
        container.innerHTML = '<span class="text-gray-600 text-center italic mt-2">Nenhum ganhador ainda.</span>';
        if(contador) contador.textContent = "0";
        return;
    }
    let totalGanhadores = 0;
    ganhadoresData.forEach(grupo => {
        const header = document.createElement('div');
        header.className = "text-green-400 font-bold uppercase border-b border-gray-700 -mt-2 mb-0.5 pt-1 text-[9px]";
        header.textContent = grupo.premio;
        container.appendChild(header);
        if (grupo.ganhadores && Array.isArray(grupo.ganhadores)) {
            grupo.ganhadores.forEach(g => {
                totalGanhadores++;
                const row = document.createElement('div');
                row.className = "flex justify-between items-center bg-gray-900 p-0.5 rounded mb-0.5 border border-gray-700";
                row.innerHTML = `
                     <div class="flex items-center gap-2 overflow-hidden">
                           <span class="text-yellow-500 font-mono text-xs">${g.cartela}</span>                           
                           <span class="text-white font-bold truncate w-24" title="${g.nome}">${g.nome || 'Cliente'}</span> 
                     </div>
                     <span class="text-green-600 font-bold text-xs whitespace-nowrap">${g.valor_rateio || 'R$ 0'}</span>
                `;                
                container.appendChild(row);
            });
        }
    });
    if(contador) contador.textContent = totalGanhadores;
}

function iniciarRelogio() {
    const relogioElement = document.getElementById('relogio-digital');
    if (!relogioElement) return;
    function atualizar() {
        const agora = new Date();
        const dia = String(agora.getDate()).padStart(2, '0');
        const mes = String(agora.getMonth() + 1).padStart(2, '0'); 
        const ano = agora.getFullYear();
        const horas = String(agora.getHours()).padStart(2, '0');
        const minutos = String(agora.getMinutes()).padStart(2, '0');
        relogioElement.textContent = `${dia}/${mes}/${ano} - ${horas}:${minutos}`;
    }
    atualizar(); setInterval(atualizar, 1000);
}

function devolverFocoAoJogo() {
    setTimeout(() => {
        if (modoSorteio === 'manual') {
            const inputManual = document.getElementById('input-bola-manual');
            if (inputManual) inputManual.focus();
        } else {
            const btnSortear = document.getElementById('btn-sortear');
            if (btnSortear) btnSortear.focus();
        }
    }, 100);
}

function aplicarVisualModoSorteio(modo) {
    const containerDigital = document.getElementById('container-sorteio-digital');
    const containerManual = document.getElementById('container-entrada-manual');
    if (modo === 'manual') {
        containerDigital.classList.add('hidden');
        containerManual.classList.remove('hidden');
        if (autoSorteioAtivo) pararAutoSorteio();
    } else {
        containerDigital.classList.remove('hidden');
        containerManual.classList.add('hidden');
    }
}

function preencherModalConfig(params) {
    if (params.tempo_ganhador) document.getElementById('config-winner-time').value = params.tempo_ganhador;
    if (params.voz_ativa !== undefined) document.getElementById('config-voz-ativa').checked = params.voz_ativa;
    if (params.camera_ativa !== undefined) document.getElementById('config-camera-ativa').checked = params.camera_ativa;
    if (params.modo_sorteio) { const radio = document.querySelector(`input[name="modo_sorteio"][value="${params.modo_sorteio}"]`); if (radio) radio.checked = true; }
}

// =========================================================
// === 8. INICIALIZAÇÃO ===
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

    // 2. Listeners
    const btnF1 = document.getElementById('btn-f1-buscar');
    if(btnF1) btnF1.addEventListener('click', (e) => { e.preventDefault(); abrirSessaoAuditoria(); });

    const inputCheck = document.getElementById('input-cartela-check');
    if (inputCheck) {
        const novoCheck = inputCheck.cloneNode(true);
        inputCheck.parentNode.replaceChild(novoCheck, inputCheck);
        novoCheck.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') { event.preventDefault(); validarCartela(); }
            if (event.key === 'Escape') { event.preventDefault(); if (this.value.length > 0) this.value = ''; else { this.blur(); devolverFocoAoJogo(); } }
        });
    }

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
        inputAudit.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation(); // <--- CRÍTICO: Impede que o Enter suba para o sorteio global
                validarCartelaAuditoria();
            }
            if (event.key === 'Escape') { 
                event.preventDefault(); 
                if(this.value) this.value = ''; 
                // Se estiver vazio e der ESC, a função de fechar modal será chamada via botão ou clique fora
            }
        });
    }    

    if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']);

    document.addEventListener('keydown', function(event) {
        // 1. Verifica se o Modal de Conferência está aberto
        const modalAudit = document.getElementById('modal-conferencia');
        const isAuditOpen = modalAudit && !modalAudit.classList.contains('hidden');

        // SE O MODAL ESTIVER ABERTO, O ENTER GLOBAL É IGNORADO
        if (isAuditOpen) {
            return; 
        }
 
        if (event.key === 'F1') { event.preventDefault(); abrirSessaoAuditoria(); return; }
        if (event.key === 'Enter') {
            // Se estiver no modo AUTO e não estiver sorteando
            // E o modal NÃO estiver aberto (redundância de segurança)
            if (modoSorteio === 'auto' && !isSorting && !autoSorteioAtivo) {
                const tagAtiva = document.activeElement.tagName;
                // Só sorteia se o foco NÃO estiver em um input
                if (tagAtiva !== 'INPUT' && tagAtiva !== 'TEXTAREA') { 
                    event.preventDefault(); 
                    sortearBola(); 
                }
            }
        }    });

    const modal = document.getElementById('modal-conferencia');
    if (modal && modal.parentNode !== document.body) document.body.appendChild(modal);

    iniciarRelogio();
    initGrid();
    
    // --- CONEXÃO INICIAL ---
    connectAdminWS();
    devolverFocoAoJogo();
});