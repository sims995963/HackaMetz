import { useEffect, useRef, useState } from 'react';
import { Check, Copy, QrCode, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Chemin relatif à afficher, ex. /hackathons/ville-durable */
  path: string;
  title: string;
}

/**
 * QR code de la page du hackathon : à projeter au kickoff d'un hackathon sur place.
 * L'URL reprend l'origine courante (l'adresse réseau local quand on est servi par Express).
 */
export function QrDialog({ open, onClose, path, title }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${path}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!open || !canvas) return;
    // La bibliothèque n'est chargée qu'à la première ouverture du QR code.
    void import('qrcode').then(({ toCanvas }) =>
      toCanvas(canvas, url, {
        width: 280,
        margin: 1,
        color: { dark: '#0b1020', light: '#ffffff' },
      }),
    );
  }, [open, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible : l'URL reste affichée */
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-[min(92vw,24rem)] rounded-xl border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="flex w-full items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <QrCode className="size-5" /> Rejoindre {title}
          </h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X />
          </Button>
        </div>
        <canvas
          ref={canvasRef}
          className="rounded-lg bg-white p-2"
          aria-label={`QR code vers ${url}`}
        />
        <p className="break-all font-mono text-sm">{url}</p>
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <Check className="text-success" /> : <Copy />} Copier l’adresse
        </Button>
        <p className="text-xs text-muted-foreground">
          Les participants scannent, entrent un pseudo, et c’est parti. Sur place, l’adresse est
          celle du réseau local affichée au démarrage du serveur.
        </p>
      </div>
    </dialog>
  );
}
