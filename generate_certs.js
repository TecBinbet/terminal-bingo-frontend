// generate_certs.js (V3 - Corrigido para gerar certificado X.509 válido)

import fs from 'fs/promises';
import selfsigned from 'selfsigned';

async function generateCerts() {
    console.log('Gerando certificados autoassinados (key.pem e cert.pem)...');
    
    // Configurações do certificado. O altNames é vital para o IP do celular funcionar.
    const IP_LOCAL = '192.168.1.147'; // <--- VERIFIQUE E MANTENHA O SEU IP CORRETO AQUI
    
    const attrs = [{ name: 'commonName', value: IP_LOCAL }];
    
    const pems = selfsigned.generate(attrs, { 
        days: 365, 
        keySize: 2048,
        // O IP e localhost são incluídos para que o navegador não reclame tanto
        altNames: [IP_LOCAL, 'localhost']
    });

    try {
        await fs.writeFile('key.pem', pems.private);
        await fs.writeFile('cert.pem', pems.cert);
        console.log('✅ Certificados key.pem e cert.pem gerados com sucesso!');
        console.log('\nPróximo Passo: npx http-server -S -C cert.pem -K key.pem --port 8080');
    } catch (error) {
        console.error('❌ Erro ao salvar os arquivos de certificado:', error);
    }
}

generateCerts();