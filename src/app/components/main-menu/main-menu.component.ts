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
  templateUrl: './main-menu.component.html',
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
