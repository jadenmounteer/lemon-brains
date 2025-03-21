import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { GameComponent } from './components/game/game.component';
import { FullscreenService } from './services/fullscreen.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, GameComponent],
  template: `<router-outlet></router-outlet>`,
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  constructor(private fullscreenService: FullscreenService) {}

  ngOnInit() {
    // Enable full-screen mode on app start
    this.fullscreenService.enableFullscreen();
  }
}
