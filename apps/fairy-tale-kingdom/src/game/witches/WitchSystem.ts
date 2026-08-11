import Phaser from 'phaser';
import { PROP_KEYS } from '../art/assetManifest';
import { backstoryFromLifeLog } from '../thoughts/lifeLog';
import type { SubjectSystem } from '../subjects/SubjectSystem';
import type { EncampmentSystem } from '../war/EncampmentSystem';
import { KingdomEvents } from '../subjects/events';
import type { CurseKind } from '../subjects/types';
import { getSandboxRuntime } from '../sandboxRuntime';

const CURSES: NonNullable<CurseKind>[] = [
  'frog',
  'poison',
  'aged',
  'pig',
  'sickness',
];

/** Coven witches curse targets; restorations; hunters engage. */
export class WitchSystem {
  private accumMs = 0;
  private spawnAccumMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly subjects: SubjectSystem,
    private readonly encampments: EncampmentSystem
  ) {}

  update(deltaMs: number): void {
    const curseMult = getSandboxRuntime().sickness.witchCurse;
    this.accumMs += deltaMs * curseMult;
    this.spawnAccumMs += deltaMs * curseMult;
    if (curseMult <= 0) return;
    if (this.spawnAccumMs > 8000) {
      this.spawnAccumMs = 0;
      this.spawnFromCovens();
    }
    if (this.accumMs < 2000) return;
    this.accumMs = 0;
    this.tickWitches();
    this.tickRestorations();
    this.tickHunters();
  }

  private spawnFromCovens(): void {
    if (!getSandboxRuntime().war.kinds.coven) return;
    const covens = this.encampments
      .listCamps()
      .filter((c) => c.kind === 'coven');
    if (!covens.length) return;
    if (this.subjects.countRole('witch') >= 6) return;
    const chance = 0.4 * getSandboxRuntime().sickness.witchCurse;
    if (Math.random() > chance) return;
    const camp = covens[Math.floor(Math.random() * covens.length)]!;
    const spawned = this.subjects.spawnWitchNear(camp.x, camp.y);
    if (spawned) {
      this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
        message: 'A witch emerges from a coven!',
      });
    }
  }

  private tickWitches(): void {
    for (const w of this.subjects.listManaged()) {
      if (w.data.role !== 'witch') continue;
      if (!w.data.backstory) {
        w.data.backstory = backstoryFromLifeLog(w.data.lifeLog ?? []);
      }
      let goal = w.data.goal;
      if (!goal || goal.kind !== 'curse_target' || !goal.targetId) {
        const target = this.pickTarget(w.data.id);
        if (!target) {
          w.data.thought = 'The coven is quiet tonight…';
          continue;
        }
        const curse = CURSES[Math.floor(Math.random() * CURSES.length)]!;
        goal = {
          kind: 'curse_target',
          targetId: target.data.id,
          text: `${w.data.backstory} I curse ${target.data.name}.`,
        };
        w.data.goal = goal;
        w.data.thought = goal.text;
        (w as { pendingCurse?: CurseKind }).pendingCurse = curse;
      }
      const targetId = goal.targetId!;
      const target = this.subjects.getById(targetId);
      if (!target || target.data.curse) {
        w.data.goal = null;
        continue;
      }
      this.subjects.nudgeToward(
        w.data.id,
        target.sprite.x,
        target.sprite.y,
        36
      );
      const d = Phaser.Math.Distance.Between(
        w.sprite.x,
        w.sprite.y,
        target.sprite.x,
        target.sprite.y
      );
      if (d < 28) {
        const curse =
          (w as { pendingCurse?: CurseKind }).pendingCurse ?? 'sickness';
        this.applyCurse(target.data.id, curse);
        w.data.goal = null;
        w.data.thought = 'The curse is cast!';
        this.subjects.appendLifeLog(
          w.data.id,
          `Cursed ${target.data.name}`,
          'curse'
        );
      }
    }
  }

  private pickTarget(witchId: string) {
    const living = this.subjects
      .listManaged()
      .filter((s) => s.data.id !== witchId && s.data.role !== 'witch');
    if (!living.length) return null;
    const prefer = living.filter(
      (s) =>
        s.data.role === 'prince' ||
        s.data.role === 'princess' ||
        s.data.role === 'king' ||
        s.data.role === 'witch_hunter'
    );
    const pool = prefer.length ? prefer : living;
    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  applyCurse(targetId: string, curse: NonNullable<CurseKind>): void {
    const t = this.subjects.getById(targetId);
    if (!t) return;
    t.data.curse = curse;
    this.subjects.appendLifeLog(targetId, `Cursed (${curse})`, 'cursed');
    if (curse === 'frog') {
      t.data.cursedAsRole = t.data.role;
      this.subjects.transformRole(targetId, 'peasant', {
        temporaryPrincess: false,
      });
      t.data.thought = 'Ribbit… I was cursed into a frog!';
      t.sprite.setTint(0x44aa44);
    } else if (curse === 'pig') {
      t.sprite.setTint(0xcc8899);
      t.data.thought = 'I’ve been turned into a pig!';
    } else if (curse === 'poison') {
      t.data.sick = true;
      t.data.thought = 'The poison apple burns…';
    } else if (curse === 'aged') {
      t.data.body = 'gaunt';
      t.data.ageYears = Math.max(t.data.ageYears, 70);
      t.data.thought = 'Cursed to wither…';
    } else if (curse === 'sickness') {
      t.data.sick = true;
      t.data.thought = 'A witch’s plague…';
    }
    this.subjects.adjustHappiness(targetId, -20);
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${t.data.name} was cursed (${curse})!`,
    });
    this.subjects.notifyChanged();
  }

  private tickRestorations(): void {
    for (const s of this.subjects.listManaged()) {
      if (!s.data.curse) continue;
      if (s.data.curse === 'frog') {
        const princess = this.subjects
          .listManaged()
          .find((p) => p.data.role === 'princess');
        if (
          princess &&
          Phaser.Math.Distance.Between(
            princess.sprite.x,
            princess.sprite.y,
            s.sprite.x,
            s.sprite.y
          ) < 40
        ) {
          this.clearCurse(s.data.id);
        }
      }
      if (s.data.curse === 'poison' && s.data.role === 'princess') {
        const prince = this.subjects
          .listManaged()
          .find((p) => p.data.role === 'prince');
        if (
          prince &&
          Phaser.Math.Distance.Between(
            prince.sprite.x,
            prince.sprite.y,
            s.sprite.x,
            s.sprite.y
          ) < 40
        ) {
          this.clearCurse(s.data.id);
        }
      }
      if (
        (s.data.curse === 'sickness' || s.data.curse === 'pig') &&
        Math.random() < 0.04
      ) {
        this.clearCurse(s.data.id);
      }
    }
  }

  clearCurse(id: string): void {
    const s = this.subjects.getById(id);
    if (!s || !s.data.curse) return;
    const was = s.data.curse;
    s.data.curse = null;
    s.sprite.clearTint();
    if (was === 'frog' && s.data.cursedAsRole) {
      this.subjects.transformRole(id, s.data.cursedAsRole, {
        temporaryPrincess: false,
        married: s.data.married,
      });
      s.data.cursedAsRole = undefined;
    }
    if (was === 'poison' || was === 'sickness') s.data.sick = false;
    this.subjects.appendLifeLog(id, `Restored from ${was}`, 'restore');
    this.scene.game.events.emit(KingdomEvents.MARKET_TOAST, {
      message: `${s.data.name} was restored!`,
    });
    this.subjects.notifyChanged();
  }

  private tickHunters(): void {
    for (const h of this.subjects.listManaged()) {
      if (h.data.role !== 'witch_hunter') continue;
      const witch = this.subjects
        .listManaged()
        .filter((w) => w.data.role === 'witch')
        .sort(
          (a, b) =>
            Phaser.Math.Distance.Between(
              h.sprite.x,
              h.sprite.y,
              a.sprite.x,
              a.sprite.y
            ) -
            Phaser.Math.Distance.Between(
              h.sprite.x,
              h.sprite.y,
              b.sprite.x,
              b.sprite.y
            )
        )[0];
      if (!witch) continue;
      this.subjects.nudgeToward(h.data.id, witch.sprite.x, witch.sprite.y, 44);
      const d = Phaser.Math.Distance.Between(
        h.sprite.x,
        h.sprite.y,
        witch.sprite.x,
        witch.sprite.y
      );
      if (d < 30) {
        this.subjects.damageSubject(witch.data.id, 12);
        this.subjects.appendLifeLog(
          h.data.id,
          `Fought witch ${witch.data.name}`,
          'hunt'
        );
      }
    }
  }
}

void PROP_KEYS;
