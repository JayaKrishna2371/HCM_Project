import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { UserProfile } from '../../core/models/user.model';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { VmwareComponent } from '../vmware/vmware.component';

interface FlyoutItem { label: string; icon: string; }
interface NavItem { label: string; icon: string; children?: FlyoutItem[]; }
interface KpiCard { label: string; value: number | string; icon: string; tone: 'blue' | 'violet' | 'teal' | 'amber'; }
interface ResourceSlice { label: string; pct: number; color: string; }
interface AlertItem { text: string; when: string; severity: 'high' | 'medium' | 'low'; }
interface DeploymentItem { name: string; status: 'Success' | 'Running' | 'Failed'; when: string; }
interface DonutSeg { dasharray: string; dashoffset: string; color: string; }
interface LinePoint { x: number; y: number; }
interface GridLine { y: number; label: string; }
interface XTick { x: number; label: string; }

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, SpinnerComponent, VmwareComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ============ Icon sprite (hidden) ============ -->
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <defs>
        <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
        <symbol id="i-cloud" viewBox="0 0 24 24"><path d="M7 18a4 4 0 1 1 .6-7.9A6 6 0 0 1 19 12.5 4 4 0 0 1 18 20H7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
        <symbol id="i-cubes" viewBox="0 0 24 24"><path d="M12 3 4 7v10l8 4 8-4V7z M4 7l8 4 8-4 M12 11v10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
        <symbol id="i-cart" viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.6" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17" cy="20" r="1.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 4h2l2.5 12h11L21 8H6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
        <symbol id="i-clipboard" viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 4h6v3H9z M9 11h6 M9 15h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
        <symbol id="i-pipeline" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="6" r="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="18" r="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6 8v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8 M12 14v2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
        <symbol id="i-dollar" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 6v12 M9 9c0-1.5 1.3-2 3-2s3 .8 3 2-1.3 2-3 2-3 .8-3 2 1.3 2 3 2 3-.5 3-2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
        <symbol id="i-puzzle" viewBox="0 0 24 24"><path d="M9 3h4a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v4h-2a2 2 0 1 0 0 4h2v4a2 2 0 0 1-2 2h-4v-2a2 2 0 1 0-4 0v2H5a2 2 0 0 1-2-2v-4h2a2 2 0 1 0 0-4H3V9a2 2 0 0 1 2-2h2V5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
        <symbol id="i-people" viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 20c.5-3 3-5 6-5s5.5 2 6 5 M14 20c.4-2 2-3.5 3.5-3.5S20.6 18 21 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
        <symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
        <symbol id="i-monitor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 21h8 M12 17v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>
        <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/><rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.7"/></symbol>
        <symbol id="i-warn" viewBox="0 0 24 24"><path d="M12 3 2 21h20L12 3z M12 10v5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/><circle cx="12" cy="18" r="0.7" fill="currentColor"/></symbol>
        <symbol id="i-deploy" viewBox="0 0 24 24"><path d="M3 7h13l5 5v5H3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="8" cy="17" r="2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17" cy="17" r="2" fill="none" stroke="currentColor" stroke-width="1.7"/></symbol>
        <symbol id="i-aihub" viewBox="0 0 24 24"><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z M18 14l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol>
        <symbol id="i-flow" viewBox="0 0 24 24"><rect x="3" y="4" width="6" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="15" y="4" width="6" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="9" y="15" width="6" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 9v3h12V9 M12 12v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
        <symbol id="i-token" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v10 M9 9.5h4.5a1.5 1.5 0 0 1 0 3H9h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
        <symbol id="i-eval" viewBox="0 0 24 24"><path d="M9 11l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol>
        <symbol id="i-vmware" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="14" width="11" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="6.5" cy="8" r="0.7" fill="currentColor"/></symbol>
        <symbol id="i-openstack" viewBox="0 0 24 24"><path d="M4 8h16 M4 16h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/></symbol>
        <symbol id="i-aws" viewBox="0 0 24 24"><path d="M5 14c4 2.5 10 2.5 14 0 M6 9.5c0-1.4 1.6-2.5 4-2.5s4 1.1 4 2.5v3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M18 16.5c1-.8 1.6-2 1.6-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></symbol>
        <symbol id="i-azure" viewBox="0 0 24 24"><path d="M9 4 3 18h4l5-9z M11 9l5 9H8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></symbol>
        <symbol id="i-gcp" viewBox="0 0 24 24"><path d="M7 17a4 4 0 1 1 .6-7.9A6 6 0 0 1 19 11.5 4 4 0 0 1 18 19H8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 13l2 2 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></symbol>

        <!-- Hatch pattern for the "Containers" slice -->
        <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#1d2240" stroke-width="2.5"/>
        </pattern>
      </defs>
    </svg>

    <div class="layout">
      <!-- ============ Topbar ============ -->
      <header class="topbar">
        <div class="topbar__left">
          <button class="icon-btn" type="button" aria-label="Toggle menu" (click)="toggleSidebar()">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/>
            </svg>
          </button>
          <span class="brand">HYBRID CLOUD PORTAL</span>
        </div>

        <div class="topbar__search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/>
          </svg>
          <input type="search" placeholder="Search..." aria-label="Search" />
        </div>

        <div class="topbar__right">
          <button class="icon-btn" type="button" aria-label="Notifications">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" stroke-linejoin="round"/>
              <path d="M10 21a2 2 0 0 0 4 0" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="icon-btn" type="button" aria-label="Help">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="9"/>
              <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.5-1 1.2-1 2.2" stroke-linecap="round"/>
              <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none"/>
            </svg>
          </button>

          <button class="user-menu" type="button" (click)="logout()" [title]="profile()?.email ?? 'Sign out'">
            <span class="avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" stroke-linecap="round"/>
              </svg>
            </span>
            <span class="user-name">{{ displayName() }}</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </header>

      <!-- ============ Sidebar ============ -->
      <aside class="sidebar" [class.is-collapsed]="sidebarCollapsed()">
        <nav class="nav">
          @for (item of nav; track item.label) {
            @if (item.children) {
              <!-- Item with a floating submenu (Clouds, AI Hub) -->
              <div class="nav-flyout">
                <a class="nav-item"
                   [class.is-active]="activeNav() === item.label || isChildActive(item)"
                   [class.is-open]="openFlyout() === item.label"
                   (click)="toggleFlyout(item.label, $event)"
                   role="button" tabindex="0"
                   aria-haspopup="true" [attr.aria-expanded]="openFlyout() === item.label">
                  <svg class="nav-item__icon" width="20" height="20"><use [attr.href]="'#i-' + item.icon"></use></svg>
                  <span class="nav-item__label">{{ item.label }}</span>
                  <svg class="nav-item__caret" viewBox="0 0 24 24" width="14" height="14"
                       fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </a>

                @if (openFlyout() === item.label) {
                  <div class="flyout" role="menu">
                    @for (sub of item.children; track sub.label) {
                      <a class="flyout__item"
                         [class.is-active]="activeNav() === sub.label"
                         (click)="selectChild(sub.label)"
                         role="menuitem" tabindex="0">
                        <svg class="flyout__icon" width="18" height="18"><use [attr.href]="'#i-' + sub.icon"></use></svg>
                        <span>{{ sub.label }}</span>
                      </a>
                    }
                  </div>
                }
              </div>
            } @else {
              <a class="nav-item"
                 [class.is-active]="item.label === activeNav()"
                 (click)="setActive(item.label)"
                 role="button" tabindex="0">
                <svg class="nav-item__icon" width="20" height="20"><use [attr.href]="'#i-' + item.icon"></use></svg>
                <span class="nav-item__label">{{ item.label }}</span>
              </a>
            }
          }
        </nav>
      </aside>

      <!-- Click-away backdrop for any open flyout -->
      @if (openFlyout()) {
        <div class="flyout-backdrop" (click)="openFlyout.set(null)"></div>
      }

      <!-- ============ Main ============ -->
      <main class="main">
        @if (loading()) {
          <div class="state">
            <app-spinner [size]="28" />
            <p>Loading dashboard…</p>
          </div>
        } @else if (error()) {
          <div class="state state--error">
            <h2>We couldn't load your dashboard.</h2>
            <p>{{ error() }}</p>
          </div>
        } @else if (activeNav() === 'VMware') {
          <app-vmware />
        } @else if (activeNav() === 'Dashboard') {
          <h1 class="page-title">Dashboard</h1>

          <!-- KPI row -->
          <section class="kpis">
            @for (kpi of kpis; track kpi.label) {
              <article class="kpi" [attr.data-tone]="kpi.tone">
                <span class="kpi__icon-wrap">
                  <svg class="kpi__icon" width="22" height="22"><use [attr.href]="'#i-' + kpi.icon"></use></svg>
                </span>
                <div class="kpi__body">
                  <span class="kpi__label">{{ kpi.label }}</span>
                  <span class="kpi__value">{{ kpi.value }}</span>
                  <a class="kpi__link" role="button" tabindex="0">View all</a>
                </div>
              </article>
            }
          </section>

          <!-- Resource Summary + Cost Overview -->
          <section class="row">
            <article class="card">
              <h3 class="card__title">Resource Summary</h3>
              <div class="resource">
                <svg class="donut" viewBox="0 0 160 160" aria-hidden="true">
                  <circle cx="80" cy="80" r="60" fill="transparent" stroke="#eef0f5" stroke-width="22"/>
                  @for (seg of donutSegs(); track $index) {
                    <circle cx="80" cy="80" r="60" fill="transparent"
                            [attr.stroke]="seg.color"
                            stroke-width="22"
                            [attr.stroke-dasharray]="seg.dasharray"
                            [attr.stroke-dashoffset]="seg.dashoffset"
                            transform="rotate(-90 80 80)"
                            stroke-linecap="butt"/>
                  }
                </svg>

                <ul class="legend">
                  @for (s of resourceSlices; track s.label) {
                    <li>
                      <span class="legend__dot" [style.background]="s.color"></span>
                      <span>{{ s.label }} ({{ s.pct }}%)</span>
                    </li>
                  }
                </ul>
              </div>
              <div class="resource__total">
                <span class="muted">Total Resources</span>
                <strong>0</strong>
              </div>
            </article>

            <article class="card">
              <h3 class="card__title">Cost Overview (This Month)</h3>
              <div class="cost__amount">$ 0</div>
              <div class="cost__delta">0% vs last month</div>

              <svg class="cost__chart" [attr.viewBox]="'0 0 ' + chartW + ' ' + chartH" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stop-color="#2563eb" stop-opacity="0.22"/>
                    <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
                  </linearGradient>
                </defs>
                @for (g of gridLines(); track g.y) {
                  <line [attr.x1]="chartPadL" [attr.y1]="g.y" [attr.x2]="chartW - chartPadR" [attr.y2]="g.y"
                        stroke="#eef0f5" stroke-width="1"/>
                  <text [attr.x]="chartPadL - 6" [attr.y]="g.y + 4" text-anchor="end" fill="#94a3b8" font-size="11">{{ g.label }}</text>
                }
                <polygon [attr.points]="areaPoints()" fill="url(#costFill)" />
                <polyline [attr.points]="linePoints()" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
                @for (pt of lineCoords(); track $index) {
                  <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5" fill="#fff" stroke="#2563eb" stroke-width="2"/>
                }
                @for (t of xTicks(); track t.label) {
                  <text [attr.x]="t.x" [attr.y]="chartH - 8" text-anchor="middle" fill="#94a3b8" font-size="11">{{ t.label }}</text>
                }
              </svg>
            </article>
          </section>

          <!-- Alerts + Recent Deployments -->
          <section class="row">
            <article class="card">
              <h3 class="card__title">Alerts</h3>
              <ul class="list">
                @for (a of alerts; track a.text) {
                  <li class="list__row" [attr.data-severity]="a.severity">
                    <svg class="list__icon list__icon--warn" width="18" height="18"><use href="#i-warn"></use></svg>
                    <span class="list__text">{{ a.text }}</span>
                    <span class="list__meta">{{ a.when }}</span>
                  </li>
                } @empty {
                  <li class="list__empty">No alerts.</li>
                }
              </ul>
              <a class="card__footer" role="button" tabindex="0">View all alerts</a>
            </article>

            <article class="card">
              <h3 class="card__title">Recent Deployments</h3>
              <ul class="list">
                @for (d of deployments; track d.name) {
                  <li class="list__row list__row--4">
                    <svg class="list__icon" width="18" height="18"><use href="#i-deploy"></use></svg>
                    <span class="list__text">{{ d.name }}</span>
                    <span class="status" [attr.data-status]="d.status">{{ d.status }}</span>
                    <span class="list__meta">{{ d.when }}</span>
                  </li>
                } @empty {
                  <li class="list__empty">No recent deployments.</li>
                }
              </ul>
              <a class="card__footer" role="button" tabindex="0">View all deployments</a>
            </article>
          </section>
        } @else {
          <div class="state">
            <h2>{{ activeNav() }}</h2>
            <p>This module is coming soon.</p>
          </div>
        }
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block; min-height: 100vh;
        background: #f6f8fc;
        color: #1e293b;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;

        /* Color tokens */
        --c-primary: #2563eb;
        --c-primary-soft: #eff5ff;
        --c-success: #15803d;
        --c-success-soft: #ecfdf3;
        --c-info: #0284c7;
        --c-info-soft: #e0f2fe;
        --c-warn: #b45309;
        --c-warn-soft: #fef3c7;
        --c-danger: #b91c1c;
        --c-danger-soft: #fee2e2;
        --c-violet: #7c3aed;
        --c-violet-soft: #f3eeff;
        --c-teal: #0d9488;
        --c-teal-soft: #ddf7f3;
        --c-amber: #d97706;
        --c-amber-soft: #fef3c7;

        /* Neutrals (Slate scale) */
        --c-ink-1: #0f172a;
        --c-ink-2: #334155;
        --c-ink-3: #64748b;
        --c-ink-4: #94a3b8;
        --c-bg-2: #f1f5f9;
        --c-border: #e2e8f0;
        --c-border-soft: #eef2f7;

        /* Elevation */
        --shadow-1: 0 1px 2px rgba(15, 23, 42, 0.04);
        --shadow-2: 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.05);
        --shadow-3: 0 2px 4px rgba(15, 23, 42, 0.04), 0 12px 32px rgba(15, 23, 42, 0.08);

        /* Spacing scale */
        --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px;
        --s-5: 20px; --s-6: 24px; --s-7: 32px;

        /* Radii */
        --r-sm: 6px; --r-md: 8px; --r-lg: 12px; --r-xl: 14px;
      }

      .layout {
        display: grid;
        grid-template-columns: 240px 1fr;
        grid-template-rows: 64px 1fr;
        grid-template-areas:
          'topbar topbar'
          'sidebar main';
        min-height: 100vh;
      }

      /* ============ Topbar ============ */
      .topbar {
        grid-area: topbar;
        display: flex; align-items: center; gap: var(--s-4);
        padding: 0 var(--s-5);
        background: #ffffff;
        border-bottom: 1px solid var(--c-border);
        position: sticky; top: 0; z-index: 5;
      }
      .topbar__left { display: flex; align-items: center; gap: var(--s-3); min-width: 240px; }
      .brand {
        font-weight: 700; letter-spacing: 0.06em; font-size: 0.875rem;
        background: linear-gradient(90deg, var(--c-primary) 0%, #0284c7 100%);
        -webkit-background-clip: text; background-clip: text;
        -webkit-text-fill-color: transparent; color: transparent;
      }
      .icon-btn {
        background: none; border: none; cursor: pointer; color: var(--c-ink-3);
        width: 36px; height: 36px; border-radius: var(--r-md);
        display: inline-flex; align-items: center; justify-content: center;
        transition: background .15s ease, color .15s ease;
      }
      .icon-btn:hover { background: var(--c-bg-2); color: var(--c-ink-1); }

      .topbar__search {
        flex: 1; max-width: 480px;
        display: flex; align-items: center; gap: var(--s-2);
        background: var(--c-bg-2); border: 1px solid transparent;
        border-radius: var(--r-md); padding: 8px 12px;
        color: var(--c-ink-4);
        margin: 0 auto;
        transition: background .15s ease, border-color .15s ease, box-shadow .15s ease;
      }
      .topbar__search:focus-within {
        background: #fff; border-color: var(--c-primary);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
      }
      .topbar__search input {
        flex: 1; border: none; background: transparent; outline: none;
        font-size: 0.875rem; color: var(--c-ink-1);
      }
      .topbar__search input::placeholder { color: var(--c-ink-4); }

      .topbar__right { display: flex; align-items: center; gap: var(--s-1); margin-left: auto; }

      .user-menu {
        display: inline-flex; align-items: center; gap: var(--s-2);
        background: transparent; border: none; cursor: pointer;
        padding: 4px 10px 4px 4px; border-radius: 999px;
        color: var(--c-ink-1);
        transition: background .15s ease;
      }
      .user-menu:hover { background: var(--c-bg-2); }
      .avatar {
        width: 32px; height: 32px; border-radius: 50%;
        background: linear-gradient(135deg, var(--c-primary) 0%, #0284c7 100%);
        color: #ffffff;
        display: inline-flex; align-items: center; justify-content: center;
        box-shadow: 0 0 0 2px #fff, 0 1px 4px rgba(37, 99, 235, 0.30);
      }
      .user-name { font-size: 0.875rem; font-weight: 600; letter-spacing: -0.005em; }

      /* ============ Sidebar ============ */
      .sidebar {
        grid-area: sidebar;
        background: #ffffff;
        border-right: 1px solid var(--c-border);
        padding: var(--s-4) var(--s-3);
        /* visible (not auto) so the AI Hub flyout can overflow to the right
           without being clipped. The nav list fits without scrolling. */
        overflow: visible;
      }
      .sidebar.is-collapsed { display: none; }
      .nav { display: flex; flex-direction: column; gap: 2px; }
      .nav-item {
        display: flex; align-items: center; gap: var(--s-3);
        padding: 9px 12px; border-radius: var(--r-md);
        font-size: 0.875rem; color: var(--c-ink-2);
        cursor: pointer; user-select: none;
        font-weight: 500;
        transition: background .15s ease, color .15s ease;
        position: relative;
      }
      .nav-item:hover { background: var(--c-bg-2); color: var(--c-ink-1); }
      .nav-item.is-active {
        background: var(--c-primary-soft);
        color: var(--c-primary);
        font-weight: 600;
      }
      .nav-item.is-active::before {
        content: ""; position: absolute; left: -12px; top: 8px; bottom: 8px; width: 3px;
        background: var(--c-primary); border-radius: 0 3px 3px 0;
      }
      .nav-item__icon { color: inherit; opacity: 0.95; }

      /* ---- AI Hub flyout ---- */
      .nav-flyout { position: relative; }
      .nav-item__caret {
        margin-left: auto; transition: transform .18s ease; opacity: 0.7;
      }
      .nav-item.is-open .nav-item__caret { transform: rotate(90deg); }

      .flyout {
        position: absolute;
        top: 0; left: calc(100% + 10px);
        min-width: 200px;
        background: #fff;
        border: 1px solid var(--c-border);
        border-radius: var(--r-lg);
        box-shadow: var(--shadow-3);
        padding: var(--s-2);
        z-index: 30;
        display: flex; flex-direction: column; gap: 2px;
        animation: flyout-in .14s ease both;
      }
      .flyout::before {
        /* little arrow pointing back at the AI Hub item */
        content: ""; position: absolute; left: -5px; top: 16px;
        width: 10px; height: 10px; background: #fff;
        border-left: 1px solid var(--c-border);
        border-bottom: 1px solid var(--c-border);
        transform: rotate(45deg);
      }
      @keyframes flyout-in {
        from { opacity: 0; transform: translateX(-6px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      .flyout__item {
        display: flex; align-items: center; gap: var(--s-3);
        padding: 9px 12px; border-radius: var(--r-md);
        font-size: 0.875rem; color: var(--c-ink-2); font-weight: 500;
        cursor: pointer; user-select: none; white-space: nowrap;
        transition: background .15s ease, color .15s ease;
      }
      .flyout__item:hover { background: var(--c-bg-2); color: var(--c-ink-1); }
      .flyout__item.is-active { background: var(--c-primary-soft); color: var(--c-primary); }
      .flyout__icon { color: inherit; flex-shrink: 0; }

      .flyout-backdrop {
        position: fixed; inset: 0; z-index: 20; background: transparent;
      }

      /* ============ Main ============ */
      .main {
        grid-area: main;
        padding: var(--s-6) var(--s-7) var(--s-7);
        overflow-x: hidden;
      }
      .page-title {
        margin: 4px 0 var(--s-5);
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--c-ink-1);
        letter-spacing: -0.018em;
        line-height: 1.2;
      }

      .state {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 80px 0; gap: var(--s-3); color: var(--c-ink-3);
      }
      .state--error h2 { color: var(--c-ink-1); margin: 0; }

      /* ============ KPI row ============ */
      .kpis {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--s-4);
        margin-bottom: var(--s-4);
      }
      .kpi {
        background: #fff;
        border: 1px solid var(--c-border);
        border-radius: var(--r-xl);
        padding: var(--s-4) var(--s-5);
        display: flex; align-items: flex-start; gap: var(--s-4);
        box-shadow: var(--shadow-1);
        position: relative; overflow: hidden;
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
      }
      .kpi:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-3);
        border-color: #cbd5e1;
      }
      .kpi[data-tone='blue']   { --tone-base: var(--c-primary);  --tone-soft: var(--c-primary-soft); }
      .kpi[data-tone='violet'] { --tone-base: var(--c-violet);   --tone-soft: var(--c-violet-soft);  }
      .kpi[data-tone='teal']   { --tone-base: var(--c-teal);     --tone-soft: var(--c-teal-soft);    }
      .kpi[data-tone='amber']  { --tone-base: var(--c-amber);    --tone-soft: var(--c-amber-soft);   }

      .kpi__icon-wrap {
        width: 44px; height: 44px; border-radius: var(--r-lg); flex-shrink: 0;
        display: inline-flex; align-items: center; justify-content: center;
        background: var(--tone-soft, var(--c-primary-soft));
        color: var(--tone-base, var(--c-primary));
      }
      .kpi__icon { color: inherit; }
      .kpi__body { display: flex; flex-direction: column; flex: 1; min-width: 0; }
      .kpi__label {
        font-size: 0.75rem; color: var(--c-ink-3); font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.05em;
      }
      .kpi__value {
        font-size: 1.875rem; font-weight: 700; color: var(--c-ink-1);
        line-height: 1.1; letter-spacing: -0.02em;
        margin-top: 2px;
      }
      .kpi__link {
        margin-top: var(--s-2); font-size: 0.75rem;
        color: var(--tone-base, var(--c-primary));
        cursor: pointer; align-self: flex-start; font-weight: 600;
        text-decoration: none;
      }
      .kpi__link:hover { text-decoration: underline; }

      /* ============ Card / Row ============ */
      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--s-4);
        margin-bottom: var(--s-4);
      }
      .card {
        background: #fff;
        border: 1px solid var(--c-border);
        border-radius: var(--r-xl);
        padding: var(--s-5) var(--s-6);
        box-shadow: var(--shadow-1);
        transition: box-shadow .18s ease;
      }
      .card:hover { box-shadow: var(--shadow-2); }
      .card__title {
        margin: 0 0 var(--s-4);
        font-size: 0.9375rem; font-weight: 600;
        color: var(--c-ink-1); letter-spacing: -0.005em;
      }
      .card__footer {
        display: block; text-align: right; margin-top: var(--s-3);
        padding-top: var(--s-3); border-top: 1px solid var(--c-border-soft);
        font-size: 0.8125rem; color: var(--c-primary);
        cursor: pointer; font-weight: 600; text-decoration: none;
      }
      .card__footer:hover { text-decoration: underline; }

      /* ============ Resource Summary ============ */
      .resource { display: grid; grid-template-columns: 170px 1fr; gap: var(--s-5); align-items: center; }
      .donut { width: 160px; height: 160px; }
      .legend {
        list-style: none; margin: 0; padding: 0;
        display: flex; flex-direction: column; gap: var(--s-3);
        font-size: 0.875rem; color: var(--c-ink-2);
      }
      .legend li { display: flex; align-items: center; gap: var(--s-3); }
      .legend__dot {
        width: 10px; height: 10px; border-radius: 50%;
        border: none;
        flex-shrink: 0;
      }
      .resource__total {
        display: flex; align-items: baseline; gap: var(--s-3);
        margin-top: var(--s-4);
        padding-top: var(--s-4);
        border-top: 1px solid var(--c-border-soft);
      }
      .resource__total strong {
        font-size: 1.5rem; font-weight: 700; color: var(--c-ink-1);
        letter-spacing: -0.02em;
      }
      .muted {
        color: var(--c-ink-3); font-size: 0.75rem;
        text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;
      }

      /* ============ Cost Overview ============ */
      .cost__amount {
        font-size: 1.875rem; font-weight: 700;
        color: var(--c-ink-1);
        letter-spacing: -0.02em;
        margin-top: var(--s-1);
      }
      .cost__delta {
        font-size: 0.8125rem; color: var(--c-success);
        margin: var(--s-1) 0 var(--s-3); font-weight: 600;
      }
      .cost__chart { width: 100%; height: 160px; }

      /* ============ Lists ============ */
      .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      .list__row {
        display: grid;
        grid-template-columns: 28px 1fr auto;
        align-items: center;
        gap: var(--s-3);
        padding: var(--s-3) 0;
        border-bottom: 1px solid var(--c-border-soft);
        font-size: 0.875rem;
      }
      .list__row--4 { grid-template-columns: 28px 1fr auto auto; }
      .list__row:last-child { border-bottom: none; }
      .list__icon {
        color: var(--c-ink-3);
        display: inline-flex; align-items: center; justify-content: center;
        width: 28px; height: 28px;
      }
      .list__icon--warn {
        color: var(--c-warn); background: var(--c-warn-soft); border-radius: var(--r-md);
      }
      .list__row[data-severity='high'] .list__icon--warn {
        color: var(--c-danger); background: var(--c-danger-soft);
      }
      .list__text { color: var(--c-ink-1); font-weight: 500; }
      .list__meta {
        color: var(--c-ink-3); font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
      }
      .list__empty {
        padding: 18px 0; text-align: center; color: var(--c-ink-4);
        font-size: 0.85rem;
      }

      .status {
        font-size: 0.6875rem; padding: 3px 8px; border-radius: var(--r-sm);
        font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase;
        display: inline-flex; align-items: center; gap: 6px;
        border: 1px solid;
      }
      .status::before {
        content: ""; width: 6px; height: 6px; border-radius: 50%;
        background: currentColor;
      }
      .status[data-status='Success'] {
        color: var(--c-success); background: var(--c-success-soft);
        border-color: rgba(21, 128, 61, 0.18);
      }
      .status[data-status='Running'] {
        color: var(--c-info); background: var(--c-info-soft);
        border-color: rgba(2, 132, 199, 0.18);
      }
      .status[data-status='Failed']  {
        color: var(--c-danger); background: var(--c-danger-soft);
        border-color: rgba(185, 28, 28, 0.18);
      }

      /* ============ Responsive ============ */
      @media (max-width: 1100px) {
        .kpis { grid-template-columns: repeat(2, 1fr); }
        .row { grid-template-columns: 1fr; }
      }
      @media (max-width: 760px) {
        .layout { grid-template-columns: 1fr; grid-template-areas: 'topbar' 'main'; }
        .sidebar { display: none; }
        .topbar__search { display: none; }
        .topbar__left { min-width: 0; }
        .kpis { grid-template-columns: 1fr 1fr; }
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly users = inject(UserService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly profile = signal<UserProfile | null>(null);

  readonly sidebarCollapsed = signal(false);
  readonly activeNav = signal('Dashboard');
  /** Label of the nav item whose flyout is currently open, or null. */
  readonly openFlyout = signal<string | null>(null);

  readonly displayName = computed(() => {
    const p = this.profile();
    if (!p) return 'Admin';
    return p.given_name ?? p.name ?? 'Admin';
  });

  readonly nav: NavItem[] = [
    { label: 'Dashboard',      icon: 'home' },
    { label: 'Clouds',         icon: 'cloud', children: [
      { label: 'VMware',    icon: 'vmware' },
      { label: 'OpenStack', icon: 'openstack' },
      { label: 'AWS',       icon: 'aws' },
      { label: 'MS Azure',  icon: 'azure' },
      { label: 'GCP',       icon: 'gcp' },
    ] },
    { label: 'Clusters',       icon: 'cubes' },
    { label: 'Self Service',   icon: 'cart' },
    { label: 'App Blueprints', icon: 'clipboard' },
    { label: 'Pipelines',      icon: 'pipeline' },
    { label: 'FinOps',         icon: 'dollar' },
    { label: 'Integrations',   icon: 'puzzle' },
    { label: 'Access Control', icon: 'people' },
    { label: 'AI Hub',         icon: 'aihub', children: [
      { label: 'N8N Automation', icon: 'flow' },
      { label: 'Token Factory',  icon: 'token' },
      { label: 'AI Eval',        icon: 'eval' },
    ] },
    { label: 'Settings',       icon: 'gear' },
  ];

  // All values start at zero — populated once cloud environments are integrated.
  readonly kpis: KpiCard[] = [
    { label: 'Total Clouds',   value: 0, icon: 'cloud',   tone: 'blue'   },
    { label: 'Total Clusters', value: 0, icon: 'cubes',   tone: 'violet' },
    { label: 'Total VMs',      value: 0, icon: 'monitor', tone: 'teal'   },
    { label: 'Total Apps',     value: 0, icon: 'grid',    tone: 'amber'  },
  ];

  readonly resourceSlices: ResourceSlice[] = [
    { label: 'VMs',        pct: 0, color: '#3b82f6' },
    { label: 'Containers', pct: 0, color: '#14b8a6' },
    { label: 'Storage',    pct: 0, color: '#8b5cf6' },
    { label: 'Others',     pct: 0, color: '#f59e0b' },
  ];

  readonly alerts: AlertItem[] = [];

  readonly deployments: DeploymentItem[] = [];

  /** Donut segments computed once from resourceSlices. */
  readonly donutSegs = computed<DonutSeg[]>(() => {
    const r = 60;
    const C = 2 * Math.PI * r;
    let offset = 0;
    return this.resourceSlices.map((s) => {
      const len = (s.pct / 100) * C;
      const seg: DonutSeg = {
        dasharray: `${len} ${C - len}`,
        dashoffset: `${-offset}`,
        color: s.color,
      };
      offset += len;
      return seg;
    });
  });

  // ====== Cost chart geometry ======
  readonly chartW = 520;
  readonly chartH = 160;
  readonly chartPadL = 36;
  readonly chartPadR = 12;
  readonly chartPadT = 14;
  readonly chartPadB = 28;

  // Zeroed until cost data is integrated.
  private readonly costSeries = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  private readonly maxCost = 16;

  readonly lineCoords = computed<LinePoint[]>(() => {
    const innerW = this.chartW - this.chartPadL - this.chartPadR;
    const innerH = this.chartH - this.chartPadT - this.chartPadB;
    const dx = innerW / (this.costSeries.length - 1);
    return this.costSeries.map((v, i) => ({
      x: this.chartPadL + i * dx,
      y: this.chartPadT + innerH - (v / this.maxCost) * innerH,
    }));
  });

  readonly linePoints = computed(() =>
    this.lineCoords().map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  );

  /** Polygon points for the area-under-the-line gradient fill. */
  readonly areaPoints = computed(() => {
    const coords = this.lineCoords();
    if (coords.length === 0) return '';
    const baseY = this.chartH - this.chartPadB;
    const left = coords[0];
    const right = coords[coords.length - 1];
    const linePts = coords.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return `${left.x.toFixed(1)},${baseY} ${linePts} ${right.x.toFixed(1)},${baseY}`;
  });

  readonly gridLines = computed<GridLine[]>(() => {
    const innerH = this.chartH - this.chartPadT - this.chartPadB;
    return [0, 5, 10, 15].map(v => ({
      y: this.chartPadT + innerH - (v / this.maxCost) * innerH,
      label: v === 0 ? '0' : `${v}K`,
    }));
  });

  readonly xTicks = computed<XTick[]>(() => {
    const innerW = this.chartW - this.chartPadL - this.chartPadR;
    const labels = ['May 1', 'May 8', 'May 15', 'May 22', 'May 29'];
    return labels.map((label, i) => ({
      x: this.chartPadL + (i * innerW) / (labels.length - 1),
      label,
    }));
  });

  ngOnInit(): void {
    this.users.getMyProfile().subscribe({
      next: (p) => { this.profile.set(p); this.loading.set(false); },
      error: (err) => {
        this.error.set(err?.error?.detail ?? err.message ?? 'Unable to load profile');
        this.loading.set(false);
      },
    });
  }

  setActive(label: string): void {
    this.activeNav.set(label);
    this.openFlyout.set(null);
  }
  toggleSidebar(): void { this.sidebarCollapsed.update(v => !v); }

  /** Open/close a nav item's floating submenu (Clouds, AI Hub). */
  toggleFlyout(label: string, event: Event): void {
    event.stopPropagation();
    this.openFlyout.update(v => (v === label ? null : label));
  }
  /** Pick a submenu entry — becomes the active view and closes the flyout. */
  selectChild(label: string): void {
    this.activeNav.set(label);
    this.openFlyout.set(null);
  }
  /** True when one of a parent's children is the active view (keeps parent highlighted). */
  isChildActive(item: NavItem): boolean {
    return !!item.children?.some(c => c.label === this.activeNav());
  }

  logout(): void { this.auth.logout(); }
}
