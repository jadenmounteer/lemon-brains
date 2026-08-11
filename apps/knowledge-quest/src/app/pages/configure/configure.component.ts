import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppSettings, CurriculumRegistry } from '@knowledge-quest/learning';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'kq-configure',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './configure.component.html',
  styleUrl: './configure.component.scss',
})
export class ConfigureComponent {
  settings: AppSettings;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly curriculumRegistry: CurriculumRegistry
  ) {
    this.settings = this.settingsService.getCurrentSettings();
  }

  get isValid(): boolean {
    return this.curriculumRegistry.isConfigured(this.settings);
  }

  async updateSettings(): Promise<void> {
    await this.settingsService.updateSettings(this.settings);
    this.settings = this.settingsService.getCurrentSettings();
  }
}
