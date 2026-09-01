import type { BuildKind } from '../../marketplace/catalog';
import type { BuildingSystem } from '../buildings/BuildingSystem';
import { bakeryKneadPoint } from '../buildings/layouts/BakeryLayout';
import { marketMerchantPoint } from '../buildings/layouts/MarketLayout';
import type { CivilianJob } from '../jobs/capacities';
import type { SubjectSystem } from '../subjects/SubjectSystem';

/** Job-specific work animations when subjects sticky-work inside civic buildings. */
export class WorkplaceSpectacle {
  constructor(
    private readonly subjects: SubjectSystem,
    private readonly buildings: BuildingSystem
  ) {}

  update(): void {
    for (const managed of this.subjects.listManaged()) {
      if (!managed.sprite.active || managed.moving || managed.interrupt) continue;
      const wp = managed.data.workplaceId;
      if (!wp) continue;
      const building = this.buildings.getById(wp);
      if (!building || building.hp <= 0) continue;

      const kind = building.kind as BuildKind;
      const job = managed.data.job;
      if (kind === 'bakery' && job === 'baker') {
        const pt = bakeryKneadPoint(building, managed.data.id);
        if (this.near(managed.sprite.x, managed.sprite.y, pt.x, pt.y, 22)) {
          this.subjects.playKneadAnim(managed.data.id);
        }
      } else if (kind === 'market' && job === 'merchant') {
        const pt = marketMerchantPoint(building, managed.data.id);
        if (this.near(managed.sprite.x, managed.sprite.y, pt.x, pt.y, 22)) {
          this.subjects.playMerchantAnim(managed.data.id);
        }
      } else if (kind === 'field' && job === 'farmer') {
        this.subjects.playWorkAnim(managed.data.id);
      }
    }
  }

  private near(ax: number, ay: number, bx: number, by: number, r: number): boolean {
    return Math.hypot(ax - bx, ay - by) <= r;
  }
}

export function workplaceAnchorFor(
  kind: BuildKind,
  job: CivilianJob | undefined,
  origin: { x: number; y: number },
  subjectId: string
): { x: number; y: number } | null {
  if (kind === 'bakery' && job === 'baker') {
    return bakeryKneadPoint(origin, subjectId);
  }
  if (kind === 'market' && job === 'merchant') {
    return marketMerchantPoint(origin, subjectId);
  }
  return null;
}
