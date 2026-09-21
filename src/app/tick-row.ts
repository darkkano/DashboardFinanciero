import { DecimalPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Tick } from './models';

@Component({
  selector: 'tr[desk-tick]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DatePipe],
  host: {
    '[class.fresh]': 'fresh()',
  },
  template: `
    <td class="mono">{{ tick().id }}</td>
    <td class="muted">{{ tick().ts | date: 'HH:mm:ss' }}</td>
    <td>{{ tick().type }}</td>
    <td class="corridor">{{ tick().from }}→{{ tick().to }}</td>
    <td class="mono">{{ tick().amountSrc | number: '1.0-0' }} {{ tick().from }}</td>
    <td>{{ tick().city }}</td>
    <td>
      <span class="st" [attr.data-st]="tick().status">{{ statusLabel() }}</span>
    </td>
    <td class="mono">{{ tick().slaMin }}m</td>
    <td>{{ tick().operator }}</td>
    <td class="muted">{{ tick().channel }}</td>
  `,
  styles: `
    :host {
      display: table-row;
      contain: layout paint;
    }
    :host.fresh td {
      animation: flash 0.85s ease;
    }
    td {
      padding: 0.42rem 0.55rem;
      border-bottom: 1px solid var(--line);
      font-size: 0.78rem;
      white-space: nowrap;
    }
    .mono {
      font-family: 'IBM Plex Mono', monospace;
    }
    .muted {
      color: var(--muted);
    }
    .corridor {
      color: var(--accent);
    }
    .st {
      padding: 0.12rem 0.4rem;
      border-radius: 999px;
      font-size: 0.68rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .st[data-st='liberada'] {
      background: rgba(62, 224, 162, 0.14);
      color: var(--up);
    }
    .st[data-st='en_cola'] {
      background: rgba(245, 193, 92, 0.16);
      color: var(--warn);
    }
    .st[data-st='compliance'] {
      background: rgba(110, 168, 254, 0.16);
      color: var(--accent);
    }
    .st[data-st='rechazada'] {
      background: rgba(255, 107, 107, 0.14);
      color: var(--down);
    }
    @keyframes flash {
      from {
        background: rgba(62, 224, 162, 0.22);
      }
      to {
        background: transparent;
      }
    }
  `,
})
export class TickRow {
  readonly tick = input.required<Tick>();
  readonly fresh = input(false);

  statusLabel() {
    return this.tick().status.split('_').join(' ');
  }
}
