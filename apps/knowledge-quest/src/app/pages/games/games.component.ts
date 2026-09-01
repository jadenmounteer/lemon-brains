import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurriculumRegistry } from '@knowledge-quest/learning';
import { encodeLaunchSettings } from '@knowledge-quest/storage';
import { environment } from '../../../environments/environment';
import { SettingsService } from '../../services/settings.service';

interface GameCard {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  url?: string;
}

@Component({
  selector: 'kq-games',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './games.component.html',
  styleUrl: './games.component.scss',
})
export class GamesComponent {
  readonly games: GameCard[] = [
    {
      id: 'lemon-brains',
      title: 'Lemon Brains',
      description: 'Defend the lemonade stand by answering questions.',
      enabled: true,
      url: environment.gameUrls.lemonBrains,
    },
    {
      id: 'pirate-sim',
      title: 'Pirate Sim',
      description: 'Coming soon — sail and learn on the high seas.',
      enabled: false,
    },
    {
      id: 'fairy-tale-kingdom',
      title: 'Fairy Tale Kingdom',
      description:
        'Watch a living fairy-tale kingdom grow — answer questions for gold, hire subjects, and defend your keep.',
      enabled: true,
      url: environment.gameUrls.fairyTaleKingdom,
    },
  ];

  constructor(
    private readonly settingsService: SettingsService,
    private readonly curriculumRegistry: CurriculumRegistry
  ) {}

  get canPlay(): boolean {
    return this.curriculumRegistry.isConfigured(
      this.settingsService.getCurrentSettings()
    );
  }

  async launch(game: GameCard): Promise<void> {
    if (!game.enabled || !game.url || !this.canPlay) {
      return;
    }
    const current = this.settingsService.getCurrentSettings();
    await this.settingsService.updateSettings(current);
    const separator = game.url.includes('?') ? '&' : '?';
    const settingsParam = encodeLaunchSettings(current);
    window.location.href = `${game.url}${separator}game=${encodeURIComponent(game.id)}&kqSettings=${settingsParam}`;
  }
}
