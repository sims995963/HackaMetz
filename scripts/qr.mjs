/**
 * Affiche un QR code dans le terminal (à projeter ou à montrer aux participants).
 *
 *   npm run qr -- https://mon-tunnel.trycloudflare.com
 *   npm run qr                      (par défaut : l'adresse du serveur sur le réseau local)
 */
import { networkInterfaces } from 'node:os';
import { toString as qrToString } from 'qrcode';

function lanUrl(port) {
  const address = Object.values(networkInterfaces())
    .flat()
    .find((iface) => iface && iface.family === 'IPv4' && !iface.internal)?.address;
  return `http://${address ?? 'localhost'}:${port}`;
}

const url = process.argv[2] ?? lanUrl(process.env.PORT ?? 3001);

console.log(`\n  ${url}\n`);
console.log(await qrToString(url, { type: 'terminal', small: true }));
console.log('  Scanne pour ouvrir HackaMetz.\n');
