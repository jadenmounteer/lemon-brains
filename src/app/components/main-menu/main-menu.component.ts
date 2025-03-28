import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudioService } from '../../services/audio.service';
import { SettingsService, GameSettings } from '../../services/settings.service';
import { SpriteAnimationService } from '../../services/sprite-animation.service';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './main-menu.component.html',
  styleUrl: './main-menu.component.scss',
})
export class MainMenuComponent {
  @Output() startGame = new EventEmitter<void>();
  settings: GameSettings;
  showSettings = false;
  isMusicPlaying = false;

  constructor(
    private settingsService: SettingsService,
    private audioService: AudioService,
    private spriteAnimationService: SpriteAnimationService
  ) {
    this.settings = this.settingsService.getCurrentSettings();
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
  }

  isValidSettings(): boolean {
    const hasQuestionType = Object.values(this.settings.questionTypes).some(
      (value) => value
    );
    const hasNumberRange = Object.values(this.settings.numberRanges).some(
      (value) => value
    );
    return hasQuestionType && hasNumberRange;
  }

  toggleMusic() {
    this.isMusicPlaying = this.audioService.toggle();
  }
}
