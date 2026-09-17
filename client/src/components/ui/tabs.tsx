import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface Props<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Onglets en pilules, dans une piste discrète : l'onglet actif est une surface,
 * pas un simple trait. Défile horizontalement sans barre visible sur mobile.
 */
export function Tabs<T extends string>({ tabs, value, onChange, className }: Props<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex w-fit max-w-full snap-x gap-1 overflow-x-auto rounded-full bg-muted/60 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex h-9 snap-start items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-card text-foreground shadow-soft'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 font-mono text-[11px]',
                  active ? 'bg-muted text-foreground' : 'text-muted-foreground',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
