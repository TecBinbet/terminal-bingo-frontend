import express from 'express';
import { MongoClient, ServerApiVersion } from 'mongodb';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Versão da aplicação
const VERSION = "1.0.60";

// --- NOVAS VARIÁVEIS PARA MODO HÍBRIDO ---
const LOCAL_PATH = path.resolve("c:/chefemesa/json");
const isLocalMode = fs.existsSync(LOCAL_PATH);
const MONGO_URI = "mongodb+srv://rivaldosp:TecBin24@tecbinon.3zsz7md.mongodb.net/";
const DB_NAME = "dados_do_sorteio";

// Configurações do servidor
const intervalo_busca_local = 1   // segundos
const app = express();
const port = process.env.sPORT || 3001;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

let db;
let clients = new Set();
let localData = {}; // Variável para armazenar dados em memória no modo local

// Função para converter strings numéricas em inteiros
function parseNumericFields(data) {
    if (!data) return {};
    const numericFields = [
        'série_em_jogo', 'minimo_de_cartelas', 'máximo_de_cartelas',
        'total_cartelas_em_jogo', 'preco_da_serie', 'premio_quadra',
        'premio_linha', 'premio_bingo', 'valor', 'cartao', 'rodada', 'ordem',
        'numero_da_bola'
    ];
    const parsedData = {};
    for (const key in data) {
        if (numericFields.includes(key) && !isNaN(data[key])) {
            parsedData[key] = parseInt(data[key], 10);
        } else {
            parsedData[key] = data[key];
        }
    }
    return parsedData;
}

// --- NOVA FUNÇÃO: LÊ DADOS DOS ARQUIVOS JSON LOCAIS ---
async function fetchDataFromLocalFiles() {
    try {
        const bolasData = JSON.parse(fs.readFileSync(path.join(LOCAL_PATH, 'bolas.json'), 'utf8'));
        const buscandoData = JSON.parse(fs.readFileSync(path.join(LOCAL_PATH, 'buscando.json'), 'utf8'));
        const premioRawData = JSON.parse(fs.readFileSync(path.join(LOCAL_PATH, 'premio.json'), 'utf8'));
        const rodadaData = JSON.parse(fs.readFileSync(path.join(LOCAL_PATH, 'rodada.json'), 'utf8'));
        const confereData = JSON.parse(fs.readFileSync(path.join(LOCAL_PATH, 'confere.json'), 'utf8'));
        const cartelasData = JSON.parse(fs.readFileSync(path.join(LOCAL_PATH, 'cartelas.json'), 'utf8'));

        // console.log("Conteúdo da tabela 'buscando' (local):", buscandoData);
        
        let premioData = [];
        let premioInfo = {};
        let topeData = [];

        if (premioRawData && premioRawData.length > 0) {
            const premioDoc = premioRawData[0];
            premioInfo = premioDoc;

            if (premioDoc.bola_tope_sb || premioDoc.bola_tope_ac) {
                topeData.push({
                    bola_tope_sb: premioDoc.bola_tope_sb || null,
                    bola_tope_ac: premioDoc.bola_tope_ac || null
                });
            }

            if (typeof premioDoc.premio_linha === 'number') {
                let tipoPremioLinha = 'LINHA';
                if (premioDoc.qtde_linha && premioDoc.qtde_linha > 1) {
                    tipoPremioLinha = `${premioDoc.qtde_linha} LINHAS`;
                }
                premioData.push({ tipo_premio: tipoPremioLinha, valor: `R$ ${premioDoc.premio_linha.toLocaleString('pt-BR')}` });
            }

            if (typeof premioDoc.premio_bingo === 'number') {
                premioData.push({ tipo_premio: 'BINGO', valor: `R$ ${premioDoc.premio_bingo.toLocaleString('pt-BR')}` });
            }
            if (typeof premioDoc.premio_quadra === 'number') {
                premioData.push({ tipo_premio: 'QUADRA', valor: `R$ ${premioDoc.premio_quadra.toLocaleString('pt-BR')}` });
            }
            if (typeof premioDoc.premio_falta_Um === 'number') {
                premioData.push({ tipo_premio: 'FALTA 1', valor: `R$ ${premioDoc.premio_falta_Um.toLocaleString('pt-BR')}` });
            }
            if (typeof premioDoc.premio_duplo_bingo === 'number') {
                premioData.push({ tipo_premio: 'DUPLO BINGO', valor: `R$ ${premioDoc.premio_duplo_bingo.toLocaleString('pt-BR')}` });
            }
            if (typeof premioDoc.premio_triplo_bingo === 'number') {
                premioData.push({ tipo_premio: 'TRIPLO BINGO', valor: `R$ ${premioDoc.premio_triplo_bingo.toLocaleString('pt-BR')}` });
            }
            if (typeof premioDoc.premio_super_bingo === 'number') {
                premioData.push({ tipo_premio: 'SUPER BINGO', valor: `R$ ${premioDoc.premio_super_bingo.toLocaleString('pt-BR')}` });
            }
            if (typeof premioDoc.premio_acumulado === 'number') {
                premioData.push({ tipo_premio: 'ACUMULADO', valor: `R$ ${premioDoc.premio_acumulado.toLocaleString('pt-BR')}` });
            }
        }
        
        const maxCardNumber = cartelasData.length > 0 ? Math.max(...cartelasData.map(c => c.cartao)) : 0;
        
//        console.log(`Arquivo da Série em Jogo > (local): ${maxCardNumber}`);

        return {
            bolasData,
            buscandoData,
            premioData,
            premioInfo,
            rodadaData,
            confereData,
            maxCardNumber,
            topeData
        };
    } catch (error) {
        console.error("Erro ao ler dados dos arquivos locais:", error);
        return {
            bolasData: [],
            buscandoData: [],
            premioData: [],
            premioInfo: {},
            rodadaData: [],
            confereData: [],
            maxCardNumber: 0,
            topeData: []
        };
    }
}


async function fetchDataFromCollections() {
    try {
        const [
            bolasData,
            buscandoData,
            premioRawData,
            rodadaData,
            confereData,
            maxCardResult
        ] = await Promise.all([
            db.collection('bolas').find({}).toArray(),
            db.collection('buscando').find({}).toArray(),
            db.collection('premio').find({}).toArray(),
            db.collection('rodada').find({}).toArray(),
            db.collection('confere').find({}).toArray(),
            db.collection('cartelas').find({}, { projection: { cartao: 1, _id: 0 } }).sort({ cartao: -1 }).limit(1).toArray()
        ]);
        
     //   console.log("Conteúdo da tabela 'buscando':", buscandoData);
        
        let premioData = [];
        let premioInfo = {};
        let topeData = [];

        if (premioRawData && premioRawData.length > 0) {
            const premioDoc = premioRawData[0];
            premioInfo = premioDoc;

            if (premioDoc.bola_tope_sb || premioDoc.bola_tope_ac) {
                topeData.push({
                    bola_tope_sb: premioDoc.bola_tope_sb || null,
                    bola_tope_ac: premioDoc.bola_tope_ac || null
                });
            }

            if (typeof premioDoc.premio_linha === 'number') {
                let tipoPremioLinha = 'LINHA';
                if (premioDoc.qtde_linha && premioDoc.qtde_linha > 1) {
                    tipoPremioLinha = `${premioDoc.qtde_linha} LINHAS`;
                }
                premioData.push({ tipo_premio: tipoPremioLinha, valor: `R$ ${premioDoc.premio_linha.toLocaleString('pt-BR')}` });
            }

            if (typeof premioDoc.premio_bingo === 'number') {
                premioData.push({ tipo_premio: 'BINGO', valor: `R$ ${premioDoc.premio_bingo.toLocaleString('pt-BR')}` });
            }
            if (typeof premioDoc.premio_quadra === 'number') {
                premioData.push({ tipo_premio: 'QUADRA', valor: `R$ ${premioDoc.premio_quadra.toLocaleString('pt-BR')}` });
            }
            if (typeof premioDoc.premio_falta_Um === 'number') {
                premioData.push({ tipo_premio: 'FALTA 1', valor: `R$ ${premioDoc.premio_falta_Um.toLocaleString('pt-BR')}` });
            }
            if (typeof premioDoc.premio_duplo_bingo === 'number') {
                premioData.push({ tipo_premio: 'DUPLO BINGO', valor: `R$ ${premioDoc.premio_duplo_bingo.toLocaleString('pt-BR')}` });
            }
            if (typeof premioDoc.premio_triplo_bingo === 'number') {
                premioData.push({ tipo_premio: 'TRIPLO BINGO', valor: `R$ ${premioDoc.premio_triplo_bingo.toLocaleString('pt-BR')}` });
            }
            if (typeof premioDoc.premio_super_bingo === 'number') {
                premioData.push({ tipo_premio: 'SUPER BINGO', valor: `R$ ${premioDoc.premio_super_bingo.toLocaleString('pt-BR')}` });
            }
            if (typeof premioDoc.premio_acumulado === 'number') {
                premioData.push({ tipo_premio: 'ACUMULADO', valor: `R$ ${premioDoc.premio_acumulado.toLocaleString('pt-BR')}` });
            }
        }
        
        const maxCardNumber = maxCardResult.length > 0 ? maxCardResult[0].cartao : 0;
        
      //  console.log(`Valor máximo de cartelas aceito: ${maxCardNumber}`);

        return {
            bolasData,
            buscandoData,
            premioData,
            premioInfo,
            rodadaData,
            confereData,
            maxCardNumber,
            topeData
        };
    } catch (error) {
        console.error("Erro ao buscar dados das coleções:", error);
        return {
            bolasData: [],
            buscandoData: [],
            premioData: [],
            premioInfo: {},
            rodadaData: [],
            confereData: [],
            maxCardNumber: 0,
            topeData: []
        };
    }
}

// Monitora as alterações em coleções específicas e transmite atualizações
async function watchCollections() {
    if (isLocalMode) {
        // --- NOVO: SIMULA MONITORAMENTO DE COLEÇÕES LOCAIS ---
        setInterval(async () => {
   //         console.log("Verificando alterações em arquivos locais...");
            const newData = await fetchDataFromLocalFiles();
            // Compara com os dados anteriores e só transmite se houver mudança
            if (JSON.stringify(newData) !== JSON.stringify(localData)) {
                const agora = new Date();
                const horaFormatada = agora.toLocaleTimeString('pt-BR');
                console.log(`   Atualizando... (${horaFormatada})`);
                localData = newData; // Atualiza os dados em memória
                broadcast(localData);
            }
        }, intervalo_busca_local * 1000); // Verifica a cada (intervalo_busca_local x 1000) segundos
    } else {
        const collectionsToWatch = ['bolas', 'buscando', 'premio', 'rodada', 'confere'];
        collectionsToWatch.forEach(collectionName => {
            const collection = db.collection(collectionName);
            const changeStream = collection.watch();
            changeStream.on('change', async (change) => {
                console.log(`Alteração detectada na coleção: ${collectionName}`);
                const allData = await fetchDataFromCollections();
                broadcast(allData);
            });
        });
    }
}

// Função para transmitir dados a todos os clientes WebSocket
function broadcast(data) {
    const message = JSON.stringify({
        type: 'UPDATE',
        ...data
    });
    for (const client of clients) {
        if (client.readyState === 1) { // 1 = OPEN
            client.send(message);
        }
    }
}

// --- NOVAS FUNÇÕES: GRAVA DADOS EM ARQUIVOS LOCAIS OU NO MONGO ---
async function updatePrizes(busca, premioInfo) {
    if (isLocalMode) {
        fs.writeFileSync(path.join(LOCAL_PATH, 'buscando.json'), JSON.stringify([busca], null, 2));
        fs.writeFileSync(path.join(LOCAL_PATH, 'premio.json'), JSON.stringify([premioInfo], null, 2));
    } else {
        await db.collection('buscando').deleteMany({});
        if (busca) {
            await db.collection('buscando').insertOne(busca);
        }
        await db.collection('premio').deleteMany({});
        if (premioInfo) {
            await db.collection('premio').insertOne(premioInfo);
        }
    }
}

async function addDefaultPrizes(req, res) {
    const defaultBusca = {
        buscando_o_premio: 'BINGO',
        qtde_linha: null,
        buscando_a_linha: null
    };
    const defaultPremioInfo = {
        premio_quadra: 50,
        premio_linha: 100,
        premio_bingo: 500,
        premio_falta_Um: 200,
        premio_duplo_bingo: 0,
        premio_triplo_bingo: 0,
        premio_super_bingo: 0,
        premio_acumulado: 0,
        bola_tope_sb: 0,
        bola_tope_ac: 0,
        minimo_de_cartelas: 0,
        maximo_de_cartelas: 99999
    };
    try {
        await updatePrizes(defaultBusca, defaultPremioInfo);
        res.status(200).json({ message: 'Dados de prêmios padrão adicionados com sucesso!' });
    } catch (error) {
        console.error("Erro ao adicionar prêmios padrão:", error);
        res.status(500).json({ error: "Erro ao adicionar dados de prêmios padrão." });
    }
}

// NOVO ENDPOINT: para definir o prêmio em jogo
async function setCurrentPrize(req, res) {
    const { premio, qtdeLinha, linhas } = req.query;

    if (!premio) {
        return res.status(400).json({ error: "Parâmetro 'premio' é obrigatório." });
    }

    const busca = {
        buscando_o_premio: premio,
        qtde_linha: qtdeLinha ? parseInt(qtdeLinha, 10) : null,
        buscando_a_linha: linhas || null
    };

    try {
        if (isLocalMode) {
            fs.writeFileSync(path.join(LOCAL_PATH, 'buscando.json'), JSON.stringify([busca], null, 2));
        } else {
            await db.collection('buscando').deleteMany({});
            await db.collection('buscando').insertOne(busca);
        }
        res.status(200).json({ message: `Prêmio em jogo atualizado para: ${premio}` });
    } catch (error) {
        console.error("Erro ao definir o prêmio:", error);
        res.status(500).json({ error: "Erro ao atualizar o prêmio em jogo." });
    }
}

// Endpoints HTTP
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        version: VERSION,
        database: isLocalMode ? 'local_files' : (db ? 'connected' : 'disconnected')
    });
});

app.get('/api/initial-data', async (req, res) => {
    console.log("Servindo dados iniciais...");
    try {
        const data = isLocalMode ? await fetchDataFromLocalFiles() : await fetchDataFromCollections();
        res.json(data);
    } catch (error) {
        console.error("Erro no endpoint /api/initial-data:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

app.get('/api/version', (req, res) => {
    res.json({ version: VERSION });
});

// Endpoint para buscar as cartelas
app.post('/api/cartelas', async (req, res) => {
    const { ranges } = req.body;
    if (!ranges || !Array.isArray(ranges) || ranges.length === 0) {
        return res.status(400).json({ error: "Ranges de cartelas inválidos." });
    }

    console.log("Recebido pedido para buscar cartelas nas faixas:", ranges);

    try {
        if (isLocalMode) {
            const cartelasData = JSON.parse(fs.readFileSync(path.join(LOCAL_PATH, 'cartelas.json'), 'utf8'));
            const cartelas = cartelasData.filter(cartela => 
                ranges.some(range => cartela.cartao >= range.inicial && cartela.cartao <= range.final)
            );
            console.log(`Encontradas ${cartelas.length} cartelas (local).`);
            res.json(cartelas);
        } else {
            const query = {
                $or: ranges.map(range => ({
                    cartao: { $gte: range.inicial, $lte: range.final }
                }))
            };
            
            console.log("Consulta do MongoDB:", JSON.stringify(query));
            const cartelas = await db.collection('cartelas').find(query).toArray();
            console.log(`Encontradas ${cartelas.length} cartelas.`);
            res.json(cartelas);
        }
    } catch (error) {
        console.error("Erro ao buscar cartelas:", error);
        res.status(500).json({ error: "Erro ao buscar cartelas no banco de dados." });
    }
});

// ROTA PARA ADICIONAR DADOS PADRÃO DE PRÊMIOS
app.post('/api/add-default-prizes', addDefaultPrizes);
app.get('/api/add-default-prizes', addDefaultPrizes);

// ROTA PARA DEFINIR O PRÊMIO EM JOGO
app.get('/api/set-current-prize', setCurrentPrize);


async function connectToMongoAndStartServer() {
    if (!isLocalMode) {
        try {
            const client = await MongoClient.connect(MONGO_URI, {
                serverApi: {
                    version: ServerApiVersion.v1,
                    strict: true,
                    deprecationErrors: true,
                }
            });
            db = client.db(DB_NAME);
            console.log("Conectado ao MongoDB!");
        } catch (error) {
            console.error("Falha ao conectar com o MongoDB:", error);
            process.exit(1);
        }
    } else {
        console.log("Iniciando em modo LOCAL. Conexão com MongoDB ignorada.");
    }
    
    server.listen(port, () => {
        console.log(`Servidor rodando na porta ${port}`);
        console.log(`Modo de operação: ${isLocalMode ? 'LOCAL' : 'ONLINE'}`);
    });

    wss.on('connection', (ws) => {
        console.log('Cliente WebSocket conectado.');
        clients.add(ws);
        const dataPromise = isLocalMode ? fetchDataFromLocalFiles() : fetchDataFromCollections();
        dataPromise.then(data => {
            ws.send(JSON.stringify({
                type: 'UPDATE',
                ...data
            }));
        });
        ws.on('close', () => {
            console.log('Cliente WebSocket desconectado.');
            clients.delete(ws);
        });
        ws.on('error', (error) => {
            console.error('Erro no WebSocket:', error);
        });
    });
    
    await watchCollections();
}

connectToMongoAndStartServer();