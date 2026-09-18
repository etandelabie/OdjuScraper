const net = require('net');
const dgram = require('dgram');

// Testons avec un des serveurs Hytale (port 5520)
const HOST = 'play.hytale.com'; // Ou remplacez par un serveur que vous connaissez
const PORT = 5520;

console.log(`[TEST] Tentative de connexion à ${HOST}:${PORT}...`);

// 1. Test TCP Basique (pour voir si le port est ouvert)
const client = new net.Socket();
client.setTimeout(5000);

client.connect(PORT, HOST, function() {
    console.log('[TCP] Connecté avec succès ! Le port est ouvert.');
    
    // Tentons d'envoyer un packet magique type "Server List Ping" de Minecraft Java (0xFE)
    client.write(Buffer.from([0xFE, 0x01]));
});

client.on('data', function(data) {
    console.log('[TCP] Réponse reçue du serveur :', data.toString('utf8'));
    client.destroy();
});

client.on('error', function(err) {
    console.log('[TCP] Erreur de connexion TCP :', err.message);
});

client.on('timeout', function() {
    console.log('[TCP] Timeout TCP - Le serveur ne répond pas sur ce port ou bloque la connexion.');
    client.destroy();
});

// 2. Test UDP Basique (type Minecraft Bedrock / RakNet)
const udpClient = dgram.createSocket('udp4');
// Packet Unconnected Ping classique RakNet
const raknetPing = Buffer.from('01000000000000000000ffff00fefefefefdfdfdfd12345678', 'hex');

udpClient.on('message', (msg, rinfo) => {
    console.log(`[UDP] Réponse UDP reçue : ${msg.toString('utf8')} depuis ${rinfo.address}:${rinfo.port}`);
    udpClient.close();
});

udpClient.send(raknetPing, PORT, HOST, (err) => {
    if (err) console.log('[UDP] Erreur envoi UDP :', err);
    else console.log('[UDP] Packet envoyé, attente de réponse...');
});

// Timeout UDP
setTimeout(() => {
    console.log('[UDP] Timeout UDP - Aucune réponse.');
    udpClient.close();
}, 5000);
