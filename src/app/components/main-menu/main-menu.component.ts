import {
  Component,
  EventEmitter,
  Output,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudioService } from '../../services/audio.service';
import { SettingsService, GameSettings } from '../../services/settings.service';
import { SpriteAnimationService } from '../../services/sprite-animation.service';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="main-menu">
      <div class="title-container">
        <h1 class="game-title">Lemon Brains</h1>
        <div #lemonadeContainer class="lemonade-container"></div>
      </div>
      <div class="description">
        Help the zombies quench their thirst for knowledge! Answer math
        questions correctly to serve them refreshing lemonade and keep them from
        reaching your stand.
      </div>

      <div class="settings-panel" [class.open]="showSettings">
        <h2>Game Settings</h2>
        <div class="settings-group">
          <h3>Question Types</h3>
          <div class="checkbox-group">
            <label>
              <input
                type="checkbox"
                [(ngModel)]="settings.questionTypes.addition"
                (change)="updateSettings()"
              />
              Addition
            </label>
            <label>
              <input
                type="checkbox"
                [(ngModel)]="settings.questionTypes.subtraction"
                (change)="updateSettings()"
              />
              Subtraction
            </label>
            <label>
              <input
                type="checkbox"
                [(ngModel)]="settings.questionTypes.multiplication"
                (change)="updateSettings()"
              />
              Multiplication
            </label>
            <label>
              <input
                type="checkbox"
                [(ngModel)]="settings.questionTypes.division"
                (change)="updateSettings()"
              />
              Division
            </label>
          </div>
        </div>

        <div class="settings-group">
          <h3>Number Ranges</h3>
          <p class="difficulty-description">
            Select which number ranges to include in questions:
          </p>
          <div class="checkbox-group">
            <label>
              <input
                type="checkbox"
                [(ngModel)]="settings.numberRanges.range0to5"
                (change)="updateSettings()"
              />
              <span class="difficulty-label">
                Numbers 0-5
                <small class="difficulty-hint">(Easy)</small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                [(ngModel)]="settings.numberRanges.range5to10"
                (change)="updateSettings()"
              />
              <span class="difficulty-label">
                Numbers 5-10
                <small class="difficulty-hint">(Medium)</small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                [(ngModel)]="settings.numberRanges.range10to20"
                (change)="updateSettings()"
              />
              <span class="difficulty-label">
                Numbers 10-20
                <small class="difficulty-hint">(Hard)</small>
              </span>
            </label>
          </div>
        </div>
      </div>

      <div class="button-group">
        <button class="settings-button" (click)="toggleSettings()">
          {{ showSettings ? 'Hide Settings' : 'Show Settings' }}
        </button>
        <button
          class="start-button"
          (click)="onStartGameClick()"
          [disabled]="!isValidSettings()"
        >
          Start Game
        </button>
      </div>
    </div>
  `,
  styleUrl: './main-menu.component.scss',
})
export class MainMenuComponent implements AfterViewInit {
  @Output() startGame = new EventEmitter<void>();
  @ViewChild('lemonadeContainer') lemonadeContainer!: ElementRef;
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

  ngAfterViewInit() {
    this.initLemonadeAnimation();
  }

  private initLemonadeAnimation() {
    const lemonadeConfig = {
      imageUrl: 'assets/sprites/lemonade.png',
      frameWidth: 128, // Width of one frame (256/2 columns)
      frameHeight: 128, // Height of one frame (384/3 rows)
      totalFrames: 6, // Total frames in sprite sheet
      fps: 4, // Slower animation speed
      displayWidth: 128, // Larger display size
      displayHeight: 128, // Keep it square
    };

    const canvas = this.spriteAnimationService.loadSprite(lemonadeConfig);
    canvas.classList.add('menu-lemonade');
    this.lemonadeContainer.nativeElement.appendChild(canvas);
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
