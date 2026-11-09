import { useEffect, useState } from 'react';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';

// Быстрые переходы не должны мигать заглушкой: до этого порога экран просто пуст.
const SHOW_AFTER_MS = 400;

export default function PageLoader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return <div className="min-h-viewport" aria-busy="true" />;

  return (
    <div className="mx-auto min-h-viewport w-full max-w-[600px] px-4 pt-6" aria-busy="true">
      <PageSkeleton>
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </PageSkeleton>
    </div>
  );
}
