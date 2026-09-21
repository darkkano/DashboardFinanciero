import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CopilotPanel } from './copilot-panel';
import { CopilotService } from './copilot.service';
import { FeedService } from './feed.service';
import { TickRow } from './tick-row';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, TickRow, CopilotPanel],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly feed = inject(FeedService);
  readonly copilot = inject(CopilotService);

  constructor() {
    this.feed.connect();
    this.copilot.listen();
    window.setInterval(() => {
      if (!this.copilot.streaming()) {
        this.copilot.listen();
      }
    }, 28000);
  }
}
