import { Routes } from '@angular/router';
import { HubComponent } from './pages/hub/hub.component';
import { ConfigureComponent } from './pages/configure/configure.component';
import { GamesComponent } from './pages/games/games.component';

export const routes: Routes = [
  { path: '', component: HubComponent },
  { path: 'configure', component: ConfigureComponent },
  { path: 'games', component: GamesComponent },
  { path: '**', redirectTo: '' },
];
