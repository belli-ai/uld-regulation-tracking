import { CloudSun, RadioTower } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Props = {
  source: 'live' | 'mock';
};

export function WeatherSourceBadge({ source }: Props) {
  const isLive = source === 'live';
  const Icon = isLive ? RadioTower : CloudSun;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 font-mono text-xs font-semibold uppercase',
        isLive
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-400',
      )}
    >
      <Icon className="size-3.5" />
      {isLive ? 'LIVE weather' : 'MOCK weather'}
    </Badge>
  );
}
