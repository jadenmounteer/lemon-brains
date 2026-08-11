import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameComponent } from './components/game/game.component';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, GameComponent],
  template: `<app-game (exitGame)="goToKnowledgeQuest()"></app-game>`,
  styles: [],
})
export class AppComponent {
  goToKnowledgeQuest() {
    window.location.href = environment.hostUrl;
  }
}
