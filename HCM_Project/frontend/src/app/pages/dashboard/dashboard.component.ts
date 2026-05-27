import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '@services/auth.service';
import { UserService } from '@services/user.service';
import { UserProfile } from '@models/user.model';
import { SpinnerComponent } from '@components/spinner/spinner.component';
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
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  private readonly users = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Administration entry is shown only to SUPER_ADMIN / TENANT_ADMIN. */
  readonly showAdmin = computed(() => this.auth.isAdmin());

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
  /** Leave the dashboard for the lazy-loaded Administration module. */
  goAdmin(): void {
    this.router.navigateByUrl('/administration');
  }
  /** True when one of a parent's children is the active view (keeps parent highlighted). */
  isChildActive(item: NavItem): boolean {
    return !!item.children?.some(c => c.label === this.activeNav());
  }

  logout(): void { this.auth.logout(); }
}
