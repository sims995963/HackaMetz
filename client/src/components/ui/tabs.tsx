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

/** Onglets simples pilotés par l'état du parent. */
export function Tabs<T extends string>({ tabs, value, onChange, className }: Props<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex snap-x gap-1 overflow-x-auto border-b [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
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
              'relative -mb-px flex snap-start items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'text-foreground after:bg-brand after:opacity-100'
                : 'text-muted-foreground after:opacity-0 hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'rounded-full bg-muted px-1.5 font-mono text-[11px]',
                  active ? 'text-foreground' : 'text-muted-foreground',
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
