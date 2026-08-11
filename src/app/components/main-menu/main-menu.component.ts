import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudioService } from '../../services/audio.service';
import { SettingsService } from '../../services/settings.service';
import { SpriteAnimationService } from '../../services/sprite-animation.service';
import { AppSettings } from '../../learning/models/app-settings';
import { CurriculumRegistry } from '../../learning/curriculum-registry.service';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './main-menu.component.html',
  styleUrl: './main-menu.component.scss',
})
export class MainMenuComponent {
  @Output() startGame = new EventEmitter<void>();
  settings: AppSettings;
  showSettings = false;
  isMusicPlaying = false;

  constructor(
    private settingsService: SettingsService,
    private audioService: AudioService,
    private spriteAnimationService: SpriteAnimationService,
    private curriculumRegistry: CurriculumRegistry
  ) {
    this.settings = this.settingsService.getCurrentSettings();
  }

  get currentCurriculumLabel(): string {
    return (
      this.curriculumRegistry.get(this.settings.curriculumId)?.label ??
      this.settings.curriculumId
    );
  }

  onStartGameClick() {
    if (this.isValidSettings()) {
      this.startGame.emit();
    }
  }

  toggleSettings() {
    this.showSettings = !this.showSettings;
  }

  updateSettings() {
    this.settingsService.updateSettings(this.settings);
    this.settings = this.settingsService.getCurrentSettings();
  }

  isValidSettings(): boolean {
    return this.curriculumRegistry.isConfigured(this.settings);
  }

  toggleMusic() {
    this.isMusicPlaying = this.audioService.toggle();
  }
}
