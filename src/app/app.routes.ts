import { Routes } from '@angular/router';
import { LandingComponent } from './landing';
import { AdminComponent } from './admin';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'admin', component: AdminComponent },
  { path: '**', redirectTo: '' }
];
