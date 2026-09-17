import type { GatewayMessage } from './gateway';

/**
 * Le fil d'un salon d'équipe, en markdown lisible dans cinq ans : une ligne par message,
 * horodatée, sans mise en forme Discord. Les pièces jointes ne sont pas reprises.
 */
export function renderJournal(messages: GatewayMessage[]): string {
  const lines = [
    '# Journal du salon Discord',
    '',
    `Exporté le ${new Date().toISOString().slice(0, 10)} — ${messages.length} message${messages.length > 1 ? 's' : ''}.`,
    'Archivé à la demande de l’équipe, au moment du dépôt.',
    '',
  ];
  let currentDay = '';
  for (const message of messages) {
    const day = message.at.slice(0, 10);
    if (day !== currentDay) {
      currentDay = day;
      lines.push(`## ${day}`, '');
    }
    const time = message.at.slice(11, 16);
    const content = message.content.trim().replace(/\r?\n/g, '\n  ');
    if (!content) continue;
    lines.push(`- **${time}** ${message.authorName} — ${content}`);
  }
  lines.push('');
  return lines.join('\n');
}
