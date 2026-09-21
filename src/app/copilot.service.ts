import { Injectable, signal } from '@angular/core';
import { CopilotFact, CopilotSeverity } from './models';

@Injectable({ providedIn: 'root' })
export class CopilotService {
  readonly text = signal('');
  readonly headline = signal('Leyendo el tape…');
  readonly severity = signal<CopilotSeverity>('mid');
  readonly facts = signal<CopilotFact[]>([]);
  readonly streaming = signal(false);
  private source: EventSource | null = null;

  listen() {
    this.stop();
    this.text.set('');
    this.streaming.set(true);
    const source = new EventSource('/api/copilot/stream');
    this.source = source;
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data) as {
        type: string;
        text?: string;
        severity?: CopilotSeverity;
        facts?: CopilotFact[];
        headline?: string;
      };
      if (payload.type === 'meta') {
        this.severity.set(payload.severity ?? 'mid');
        this.facts.set(payload.facts ?? []);
        this.headline.set(payload.headline ?? this.headline());
      }
      if (payload.type === 'token' && payload.text) {
        this.text.update((value) => value + payload.text);
      }
      if (payload.type === 'end') {
        this.streaming.set(false);
        source.close();
      }
    };
    source.onerror = () => {
      this.streaming.set(false);
      source.close();
    };
  }

  stop() {
    this.source?.close();
    this.source = null;
  }
}
