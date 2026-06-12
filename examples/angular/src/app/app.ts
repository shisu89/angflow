import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { HARNESS_ROUTES } from './app.routes';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);

  protected readonly routes = HARNESS_ROUTES;

  protected readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.replace(/^\//, '')),
      startWith(this.router.url.replace(/^\//, '')),
    ),
    { initialValue: 'overview' },
  );

  protected onChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.router.navigateByUrl('/' + value);
  }
}
