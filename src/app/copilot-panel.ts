import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CopilotFact, CopilotSeverity } from './models';

@Component({
  selector: 'desk-copilot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="panel">
      <header>
        <p>Copilot operativo</p>
        <b [attr.data-sev]="severity()">{{ severity() === 'high' ? 'ALERTA' : severity() === 'mid' ? 'WATCH' : 'OK' }}</b>
      </header>
      <h2>{{ headline() }}</h2>
      <p class="stream">{{ text() }}<span class="caret" [class.on]="streaming()">▌</span></p>
      <ul>
        @for (fact of facts(); track fact.label) {
          <li>
            <span>{{ fact.label }}</span>
            <strong>{{ fact.value }}</strong>
          </li>
        }
      </ul>
      <button type="button" (click)="reread.emit()" [disabled]="streaming()">
        {{ streaming() ? 'Leyendo la mesa…' : 'Releer las últimas 2 horas' }}
      </button>
    </aside>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .panel {
      display: grid;
      align-content: start;
      gap: 0.85rem;
      height: 100%;
      padding: 1rem 1.05rem 1.1rem;
      border: 1px solid var(--line);
      background: linear-gradient(180deg, #101826, #0c121c);
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    header p {
      margin: 0;
      color: var(--muted);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-size: 0.68rem;
    }
    b {
      font-size: 0.68rem;
      letter-spacing: 0.12em;
    }
    b[data-sev='high'] {
      color: var(--down);
    }
    b[data-sev='mid'] {
      color: var(--warn);
    }
    b[data-sev='ok'] {
      color: var(--up);
    }
    h2 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 500;
      line-height: 1.25;
    }
    .stream {
      min-height: 8.5rem;
      margin: 0;
      color: #d5deea;
      font-size: 0.92rem;
      line-height: 1.55;
    }
    .caret {
      color: var(--accent);
      opacity: 0;
    }
    .caret.on {
      opacity: 1;
      animation: blink 0.9s steps(1) infinite;
    }
    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 0.35rem;
    }
    li {
      display: flex;
      justify-content: space-between;
      color: var(--muted);
      font-size: 0.78rem;
    }
    li strong {
      color: var(--ink);
      font-family: 'IBM Plex Mono', monospace;
    }
    button {
      margin-top: 0.4rem;
      border: 1px solid var(--accent);
      background: transparent;
      color: var(--ink);
      padding: 0.7rem 0.8rem;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.55;
      cursor: wait;
    }
    @keyframes blink {
      50% {
        opacity: 0;
      }
    }
  `,
})
export class CopilotPanel {
  readonly text = input('');
  readonly headline = input('Leyendo el tape…');
  readonly severity = input<CopilotSeverity>('mid');
  readonly facts = input<CopilotFact[]>([]);
  readonly streaming = input(false);
  readonly reread = output<void>();
}
