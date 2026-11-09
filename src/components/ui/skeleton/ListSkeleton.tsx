import { Skeleton, SkeletonGroup } from './Skeleton';

/** Заглушка списка: ставится вместо спиннера, пока строки не загружены. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonGroup className="w-full space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-2xl" />
      ))}
    </SkeletonGroup>
  );
}
