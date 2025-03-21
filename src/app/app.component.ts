import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainMenuComponent } from './components/main-menu/main-menu.component';
import { GameComponent } from './components/game/game.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MainMenuComponent, GameComponent],
  template: `
    <app-main-menu
      *ngIf="!isGameView"
      (startGame)="startGame()"
    ></app-main-menu>
    <app-game *ngIf="isGameView" (exitGame)="exitGame()"></app-game>
  `,
  styles: [],
})
export class AppComponent {
  isGameView = false;

  startGame() {
    this.isGameView = true;
  }

  exitGame() {
    this.isGameView = false;
  }
}
