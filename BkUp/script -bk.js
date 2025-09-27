const API_BASE_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

const backendVersionElement = document.getElementById('backend-version');
const frontendVersionElement = document.getElementById('frontend-version');
const loader = document.getElementById('loader');

const numberGrid = document.getElementById('number-grid');
const prizeInfoContainer = document.getElementById('prize-info');
const prizeValuesContainer = document.getElementById('prize-values');

const lastRoundElement = document.getElementById('last-round');
const lastOrderElement = document.getElementById('last-order');
const lastBall1 = document.getElementById('last-ball-1');
const lastBall2 = document.getElementById('last-ball-2');
const lastBall3 = document.getElementById('last-ball-3');

const conferencePanelContainer = document.getElementById('conference-panel-container');
const cardNumberElement = document.getElementById('card-number');
const winnerNameElement = document.getElementById('winner-name');
const cardGridElement = document.getElementById('card-grid');

const cartelaInicialInput = document.getElementById('cartela-inicial');
const cartelaFinalInput = document.getElementById('cartela-final');
const resultadoSomaSpan = document.getElementById('resultado-soma');
const adicionarCartelasBtn = document.getElementById('adicionar-cartelas');
const faixasAdicionadasDiv = document.getElementById('faixas-adicionadas');
const totalCartelasSpan = document.getElementById('total-cartelas');
const validationMessage = document.getElementById('validation-message');

const loadedCardsList = document.getElementById('loaded-cards-list');

let ws = null;
let reconnectInterval = null;

let cartelaRanges = [];
let loadedCards = [];
let isFetchingCards = false;
let bingoWinners = new Set();

let minCartelas = 0;
let maxCartelas = 0;
let buscando_o_premio = '';
let buscando_a_linha = '';

let ultimaBolaCantada = null;

function setupCartelasEmJogo(maxCardNumber) {
    function validarECalcular() {
        const valorInicial = parseInt(cartelaInicialInput.value, 10);
        const valorFinal = parseInt(cartelaFinalInput.value, 10);

        if (valorInicial > 0 && valorFinal >= valorInicial) {
            const resultado = (valorFinal - valorInicial) + 1;
            resultadoSomaSpan.textContent = resultado;
            adicionarCartelasBtn.classList.remove('hidden');
        } else {
            resultadoSomaSpan.textContent = '0';
            adicionarCartelasBtn.classList.add('hidden');
        }
    }

    const corrigirValor = (event) => {
        let value = parseInt(event.target.value, 10);
        if (value > maxCardNumber) {
            event.target.value = maxCardNumber;
        }
        validarECalcular();
    };

    cartelaInicialInput.addEventListener('input', corrigirValor);
    cartelaFinalInput.addEventListener('input', corrigirValor);
    cartelaInicialInput.addEventListener('input', validarECalcular);
    cartelaFinalInput.addEventListener('input', validarECalcular);

    adicionarCartelasBtn.addEventListener('click', () => {
        const valorInicial = parseInt(cartelaInicialInput.value, 10);
        const valorFinal = parseInt(cartelaFinalInput.value, 10);
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

        const novaSoma = parseInt(totalCartelasSpan.textContent) + ((valorFinal - valorInicial) + 1);

        if (novaSoma > maxCartelas) {
            validationMessage.textContent = `Erro: O total de cartelas (${novaSoma}) excede o máximo permitido (${maxCartelas}).`;
            validationMessage.classList.remove('hidden');
            return;
        }

        cartelaRanges.push(novaFaixa);
        displayCartelaRanges();
        fetchAndProcessCards();
        cartelaInicialInput.value = '';
        cartelaFinalInput.value = '';
        validarECalcular();
    });
}

function displayCartelaRanges() {
    faixasAdicionadasDiv.innerHTML = '';
    let total = 0;

    cartelaRanges.forEach((faixa, index) => {
        const numCartelas = (faixa.final - faixa.inicial) + 1;
        total += numCartelas;

        const div = document.createElement('div');
        div.className = 'flex items-center justify-between w-full p-2 bg-gray-600 rounded-lg text-white font-medium';
        div.innerHTML = `
            <span>Faixa ${index + 1}: ${faixa.inicial} - ${faixa.final}</span>
            <button class="remover-faixa px-2 py-1 bg-red-500 rounded-md" data-index="${index}">Remover</button>
        `;
        faixasAdicionadasDiv.appendChild(div);
    });

    totalCartelasSpan.textContent = total;
    checkTotalCards();

    document.querySelectorAll('.remover-faixa').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);

            const numCartelasRemovidas = (cartelaRanges[index].final - cartelaRanges[index].inicial) + 1;
            const novoTotal = parseInt(totalCartelasSpan.textContent) - numCartelasRemovidas;

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

function checkTotalCards() {
    const total = parseInt(totalCartelasSpan.textContent);
    validationMessage.textContent = '';
    validationMessage.classList.add('hidden');

    if (total > 0 && total < minCartelas) {
        validationMessage.textContent = `Atenção: A quantidade de cartelas (${total}) está abaixo do mínimo exigido (${minCartelas}).`;
        validationMessage.classList.remove('hidden');
    }
}

async function fetchAndProcessCards() {
    if (isFetchingCards) return;
    isFetchingCards = true;

    const total = parseInt(totalCartelasSpan.textContent);

    if (total < minCartelas || total > maxCartelas) {
        if (cartelaRanges.length > 0) {
            validationMessage.textContent = `Erro: O total de cartelas (${total}) está fora do intervalo permitido (${minCartelas} - ${maxCartelas}). O processamento foi interrompido.`;
            validationMessage.classList.remove('hidden');
        }
        loadedCards = [];
        displayLoadedCards([]);
        isFetchingCards = false;
        return;
    } else {
        validationMessage.classList.add('hidden');
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
            validationMessage.textContent = 'Nenhuma cartela encontrada na faixa selecionada. Por favor, verifique os números e tente novamente.';
            validationMessage.classList.remove('hidden');
            loadedCards = [];
            displayLoadedCards([]);
            isFetchingCards = false;
            return;
        }

        const initialData = await fetchDataFromCollections();
        const premioBuscadoAPI = initialData.buscandoData[0]?.buscando_o_premio || '';
        const premioBuscadoNormalized = premioBuscadoAPI.replace(/\s+/g, '').trim();

        processCards(cards, initialData.bolasData[0]?.bolas_cantadas || [], premioBuscadoNormalized, initialData.buscandoData[0]?.buscando_a_linha || '');
        
        validationMessage.classList.add('hidden');
    } catch (error) {
        console.error("Erro ao buscar e processar cartelas:", error);
        validationMessage.textContent = `Erro ao carregar cartelas. Detalhes: ${error.message}. Verifique a conexão com o servidor e tente novamente.`;
        validationMessage.classList.remove('hidden');
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
                    premioEncontradoLinha = 'QUADRA';
                } else if (premioBuscado.includes('LINHA') && line.count === 5) {
                    premioEncontradoLinha = 'LINHA';
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
            } else if (premioBuscado.includes('TRIPLO BINGO') && count.geral === 15) {
                premioEncontrado = 'TRIPLO BINGO';
            } else if (premioBuscado.includes('BINGO') && count.geral === 15) {
                premioEncontrado = 'BINGO';
            } else if (premioBuscado.includes('FALTAUM') && count.geral === 14) {
                premioEncontrado = 'FALTA 1';
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
                premioEncontrado = 'QUADRA';
            } else if (normalizedPremioBuscado.includes('LINHA') && count === 5) {
                premioEncontrado = 'LINHA';
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
            } else if (normalizedPremioBuscado.includes('TRIPLO BINGO') && count === 15) {
                premioEncontrado = 'TRIPLO BINGO';
            } else if (normalizedPremioBuscado.includes('BINGO') && count === 15) {
                premioEncontrado = 'BINGO';
            } else if (normalizedPremioBuscado.includes('FALTAUM') && count === 14) {
                premioEncontrado = 'FALTA 1';
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
    
    loadedCardsList.innerHTML = '';
    
    const isLinePrize = buscando_o_premio.includes('QUADRA') || buscando_o_premio.includes('LINHA');
    const isMultiLinePrize = isLinePrize && !!buscando_a_linha;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'flex justify-between w-full p-2 bg-gray-800 rounded-t-lg text-white font-bold mb-1';
    
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
    loadedCardsList.appendChild(headerDiv);

    const fragment = document.createDocumentFragment();
    const cardsToDisplay = loadedCards.filter(card => card.premioEncontrado || card.missingNumbers.length > 0);

    if (cardsToDisplay.length === 0) {
        const p = document.createElement('p');
        p.className = 'text-white text-center';
        p.textContent = 'Nenhuma cartela carregada ou com números faltantes.';
        fragment.appendChild(p);
    } else {
        cardsToDisplay.forEach(card => {
            const formattedCardNumber = String(card.cartao).padStart(5, '0');
            
            const cardDiv = document.createElement('div');
            cardDiv.className = 'flex w-full p-2 bg-gray-600 rounded-lg text-white font-medium mb-1';
            cardDiv.setAttribute('data-card-number', card.cartao);
            
            if (isLinePrize) {
                cardDiv.setAttribute('data-line-id', card.linhaId);
            }

            const cardLabelHtml = isLinePrize
                ? `<div class="w-1/4 flex gap-1"><span class="w-1/2 p-2 bg-gray-700 rounded-lg text-center font-bold">${formattedCardNumber}</span><span class="w-1/2 p-2 bg-gray-700 rounded-lg text-center font-bold">${card.linhaId}</span></div>`
                : `<div class="w-1/4 p-2 bg-gray-700 rounded-lg text-center font-bold"><span>${formattedCardNumber}</span></div>`;

            cardDiv.innerHTML = cardLabelHtml;

            const numbersContainer = document.createElement('div');
            numbersContainer.className = 'w-3/4 ml-2 p-2 bg-gray-700 rounded-lg flex flex-wrap gap-2 justify-start';

            if (card.premioEncontrado) {
                const premioTexto = card.premioEncontrado === 'DUPLO BINGO' ? 'DUPLO BINGO' : card.premioEncontrado;
                const premioSpan = document.createElement('span');
                premioSpan.className = 'text-lg text-green-400 font-bold w-full text-center';
                premioSpan.textContent = premioTexto;
                numbersContainer.appendChild(premioSpan);
                numbersContainer.classList.add('items-center', 'justify-center');
            } else {
                const missingNumbers = card.missingNumbers || [];
                
                missingNumbers.forEach(num => {
                    const numberSpan = document.createElement('span');
                    
                    let bgColorClass = 'bg-gray-600';
                    const isMissingOne = missingNumbers.length === 1 && (buscando_o_premio.includes('FALTAUM') || buscando_o_premio.includes('FALTA 1'));
                    if (isMissingOne) {
                        bgColorClass = 'bg-green-500';
                    }
                    
                    const numberClass = `p-1 rounded-lg text-white font-bold ${bgColorClass} text-base w-12 h-12 flex items-center justify-center flex-shrink-0`;
                    numberSpan.className = numberClass;
                    numberSpan.textContent = num;
                    numbersContainer.appendChild(numberSpan);
                });
            }

            cardDiv.appendChild(numbersContainer);
            fragment.appendChild(cardDiv);
        });
    }

    loadedCardsList.appendChild(fragment);
}

function showMessage(message, type = 'error') {
    const colorClass = type === 'error' ? 'text-red-500' : 'text-blue-500';
    loader.innerHTML = `<span class="text-xl font-medium ${colorClass}">${message}</span>`;
    loader.style.display = 'flex';
}

function createNumberPanel() {
    for (let i = 1; i <= 90; i++) {
        const numberDiv = document.createElement('div');
        numberDiv.id = `ball-${i}`;
        numberDiv.textContent = i;
        numberDiv.className = 'flex items-center justify-center h-8 w-8 text-sm font-medium rounded-full bg-gray-300 text-gray-800 transition-colors duration-300';
        numberGrid.appendChild(numberDiv);
    }
}

function clearPanels() {
    updateNumericPanel([]);
    loadedCardsList.innerHTML = `<p class="text-white text-center">Nenhuma cartela carregada.</p>`;
    prizeValuesContainer.innerHTML = '';
    conferencePanelContainer.classList.remove('flex');
    conferencePanelContainer.classList.add('hidden');
    cardNumberElement.textContent = 'Aguardando...';
    winnerNameElement.textContent = 'Aguardando...';
    cardGridElement.innerHTML = '';
    lastRoundElement.textContent = '...';
    lastOrderElement.textContent = '...';
    lastBall1.textContent = '';
    lastBall2.textContent = '';
    lastBall3.textContent = '';
    lastBall1.classList.remove('bg-red-500', 'bg-green-500', 'text-white');
    lastBall2.classList.remove('bg-red-500', 'bg-green-500', 'text-white');
    lastBall3.classList.remove('bg-red-500', 'bg-green-500', 'text-white');
    lastBall1.classList.add('bg-gray-300', 'text-gray-800');
    lastBall2.classList.add('bg-gray-300', 'text-gray-800');
    lastBall3.classList.add('bg-gray-300', 'text-gray-800');
}

function updateNumericPanel(bolasCantadas) {
    document.querySelectorAll('#number-grid > div').forEach(div => {
        div.classList.remove('bg-green-500', 'bg-red-500', 'text-white');
        div.classList.add('bg-gray-300', 'text-gray-800');
    });

    if (Array.isArray(bolasCantadas) && bolasCantadas.length > 0) {
        bolasCantadas.forEach(bola => {
            const numberDiv = document.getElementById(`ball-${bola}`);
            if (numberDiv) {
                numberDiv.classList.remove('bg-gray-300', 'text-gray-800');
                numberDiv.classList.add('bg-green-500', 'text-white');
            }
        });
        const lastBall = bolasCantadas[bolasCantadas.length - 1];
        const lastBallDiv = document.getElementById(`ball-${lastBall}`);
        if (lastBallDiv) {
            lastBallDiv.classList.remove('bg-green-500');
            lastBallDiv.classList.add('bg-red-500');
        }
    }
}

function displayLastThree(bolasData) {
    lastRoundElement.textContent = '...';
    lastOrderElement.textContent = '...';
    lastBall1.textContent = '';
    lastBall2.textContent = '';
    lastBall3.textContent = '';

    if (bolasData && typeof bolasData === 'object' && Array.isArray(bolasData.bolas_cantadas)) {
        const bolasCantadas = bolasData.bolas_cantadas;
        const lastThree = bolasCantadas.slice(-3).reverse();

        lastRoundElement.textContent = bolasData.rodada || 'N/A';
        lastOrderElement.textContent = bolasData.ordem === 0 || bolasData.ordem ? bolasData.ordem : '0';

        const balls = [lastBall1, lastBall2, lastBall3];
        for (let i = 0; i < 3; i++) {
            if (lastThree[i]) {
                balls[i].textContent = lastThree[i];
                balls[i].classList.remove('bg-gray-300', 'text-gray-800');
                if (i === 0) {
                    balls[i].classList.add('bg-red-500', 'text-white');
                } else {
                    balls[i].classList.add('bg-green-500', 'text-white');
                }
            } else {
                balls[i].classList.add('bg-gray-300', 'text-gray-800');
            }
        }
    } else {
        lastOrderElement.textContent = '0';
    }
}

function displayPrizeInfo(buscandoData) {
    prizeInfoContainer.innerHTML = '';
    const prizeItem = document.createElement('span');
    prizeItem.className = 'text-3xl text-white font-semibold';
    const buscandoValue = buscandoData && buscandoData.length > 0 ? buscandoData[0].buscando_o_premio : null;
    
    if (!buscandoValue || buscandoValue.toString().trim().toLowerCase() === 'null' || buscandoValue.trim() === '') {
        prizeItem.innerHTML = '. . .';
    } else {
        prizeItem.innerHTML = buscandoValue;
    }
    prizeInfoContainer.appendChild(prizeItem);
}

function displayPrizeValues(premioData, topeData = null) {
    prizeValuesContainer.innerHTML = '';
    
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
            prizeValuesContainer.appendChild(defaultMessage);
            return;
        }

        const prizeOrder = ['QUADRA', 'LINHA', '3 LINHAS', 'FALTA 1', 'BINGO', 'DUPLO BINGO', 'TRIPLO BINGO', 'SUPER BINGO', 'ACUMULADO'];

        validPrizes.sort((a, b) => {
            const indexA = prizeOrder.indexOf(a.tipo_premio);
            const indexB = prizeOrder.indexOf(b.tipo_premio);
            
            const aIsValid = indexA > -1;
            const bIsValid = indexB > -1;

            if (aIsValid && !bIsValid) return -1;
            if (!aIsValid && bIsValid) return 1;
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
            prizeValuesContainer.appendChild(prizeItem);
        });
    } else {
        const defaultMessage = document.createElement('span');
        defaultMessage.className = 'text-lg text-white';
        defaultMessage.textContent = 'Nenhum prêmio cadastrado.';
        prizeValuesContainer.appendChild(defaultMessage);
    }
}

function updateCardHighlighting(bolasCantadas) {
    const lastBall = bolasCantadas[bolasCantadas.length - 1];
    const cardNumbersDivs = cardGridElement.querySelectorAll('.card-number-item');
    cardNumbersDivs.forEach(div => {
        const numeroNaCartela = parseInt(div.textContent, 10);
        div.classList.remove('bg-red-500', 'bg-green-500', 'text-white', 'bg-gray-300', 'text-gray-800');
        if (bolasCantadas.includes(numeroNaCartela)) {
            if (numeroNaCartela === lastBall) {
                div.classList.add('bg-red-500', 'text-white');
            } else {
                div.classList.add('bg-green-500', 'text-white');
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
        for (let i = 0; i < 15; i++) {
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
            winnerNameElement.textContent = nomeDoGanhador || 'Aguardando...';
            displayCardGrid(numerosDaCartela, bolasCantadas);
        } else {
            conferencePanelContainer.classList.remove('flex');
            conferencePanelContainer.classList.add('hidden');
            cardNumberElement.textContent = 'Aguardando...';
            winnerNameElement.textContent = 'Aguardando...';
            displayCardGrid(null, bolasCantadas);
        }
    } else {
        conferencePanelContainer.classList.remove('flex');
        conferencePanelContainer.classList.add('hidden');
        cardNumberElement.textContent = 'Aguardando...';
        winnerNameElement.textContent = 'Aguardando...';
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
    
    updateNumericPanel(bolasCantadas);
    displayLastThree(bolasData?.[0]);
    displayConferencePanel(confereData, bolasCantadas);
    
    const rodadaState = rodadaData && rodadaData.length > 0 ? rodadaData[0].estado.trim() : null;
    if (rodadaState === 'intervalo') {
        clearPanels();
        cartelaRanges = [];
        loadedCards = [];
        bingoWinners.clear();
        ultimaBolaCantada = null;
        buscando_o_premio = '';
        buscando_a_linha = '';
        displayCartelaRanges();
        displayPrizeInfo([{ buscando_o_premio: null }]);
        return;
    }
    
    displayPrizeInfo(buscandoData);
    displayPrizeValues(premioData, topeData);
    checkTotalCards();
}

async function init() {
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

        loader.style.display = 'none';
        renderMainContent(initialData);
        connectWebSocket();
    } catch (error) {
        console.error('Erro ao iniciar a aplicação:', error);
        showMessage('Não foi possível conectar ao servidor. Verifique se o backend está em execução.', 'error');
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

document.addEventListener('DOMContentLoaded', init);