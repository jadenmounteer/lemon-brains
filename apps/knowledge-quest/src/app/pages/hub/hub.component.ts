import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SettingsService } from '../../services/settings.service';
import { CurriculumRegistry } from '@knowledge-quest/learning';

@Component({
  selector: 'kq-hub',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './hub.component.html',
  styleUrl: './hub.component.scss',
})
export class HubComponent {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly curriculumRegistry: CurriculumRegistry
  ) {}

  get curriculumLabel(): string {
    const id = this.settingsService.getCurrentSettings().curriculumId;
    return this.curriculumRegistry.get(id)?.label ?? id;
  }
}
