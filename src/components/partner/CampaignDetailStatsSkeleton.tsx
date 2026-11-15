import { PARTNER_STATS } from '../../constants/partner';
import { Skeleton, SkeletonGroup } from '../ui/skeleton';

/** Заглушка раскрытой кампании: пока грузятся графики и пока едут данные. */
export function CampaignDetailStatsSkeleton() {
  return (
    <SkeletonGroup className="space-y-3 pt-2">
      <div className="grid grid-cols-3 gap-2">
        <Skeleton variant="card" count={PARTNER_STATS.SKELETON_COUNT} className="h-16 rounded-xl" />
      </div>
      <Skeleton variant="card" className="h-52 rounded-xl" />
    </SkeletonGroup>
  );
}
