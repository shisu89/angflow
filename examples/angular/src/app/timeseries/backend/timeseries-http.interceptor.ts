import { inject } from '@angular/core';
import { HttpErrorResponse, HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { concatMap, delay, of, throwError } from 'rxjs';
import { InMemoryTimeseriesBackend, CsvParseError } from './in-memory-timeseries-backend';
import type {
  UploadRequestBody,
  PatchRequestBody,
  BackendErrorBody,
} from './timeseries-backend.types';

/**
 * Catches /api/timeseries/** requests and serves them from an in-memory store.
 * Simulates 200–400ms latency so loading states are observable.
 *
 * Swap this out for real HTTP by deleting the interceptor registration from
 * the timeseries route providers — the node/provider layer uses HttpClient
 * exactly as it would against a real backend.
 */
export const timeseriesHttpInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/timeseries')) {
    return next(req);
  }

  const backend = inject(InMemoryTimeseriesBackend);
  const latency = 200 + Math.random() * 200;

  // Routing: split on /, find the id segment if any.
  //   POST   /api/timeseries
  //   GET    /api/timeseries
  //   GET    /api/timeseries/:id
  //   PATCH  /api/timeseries/:id
  //   DELETE /api/timeseries/:id
  const url = req.url.split('?')[0];
  const parts = url.split('/').filter(Boolean);
  // parts === ['api', 'timeseries']         → collection
  //        === ['api', 'timeseries', 'abc'] → item
  const id = parts.length >= 3 ? parts[2] : undefined;

  try {
    if (!id && req.method === 'POST') {
      const body = req.body as UploadRequestBody;
      if (!body || typeof body.csv !== 'string' || typeof body.label !== 'string') {
        return errorResponse(400, { error: 'label and csv are required' }, latency);
      }
      const meta = backend.upload(body);
      return okResponse(meta, latency);
    }

    if (!id && req.method === 'GET') {
      return okResponse(backend.list(), latency);
    }

    if (id && req.method === 'GET') {
      const payload = backend.get(id);
      if (!payload) return errorResponse(404, { error: `Dataset ${id} not found` }, latency);
      return okResponse(payload, latency);
    }

    if (id && req.method === 'PATCH') {
      const body = req.body as PatchRequestBody;
      const updated = backend.patch(id, body ?? {});
      if (!updated) return errorResponse(404, { error: `Dataset ${id} not found` }, latency);
      return okResponse(updated, latency);
    }

    if (id && req.method === 'DELETE') {
      const existed = backend.delete(id);
      if (!existed) return errorResponse(404, { error: `Dataset ${id} not found` }, latency);
      return of(new HttpResponse({ status: 204, url: req.url })).pipe(delay(latency));
    }

    return errorResponse(
      405,
      { error: `Method ${req.method} not allowed on ${url}` },
      latency,
    );
  } catch (e) {
    if (e instanceof CsvParseError) {
      return errorResponse(
        400,
        { error: e.message, row: e.row, column: e.column },
        latency,
      );
    }
    return errorResponse(500, { error: (e as Error).message }, latency);
  }
};

function okResponse<T>(body: T, latency: number) {
  return of(new HttpResponse({ status: 200, body, url: '' })).pipe(delay(latency));
}

function errorResponse(status: number, body: BackendErrorBody, latency: number) {
  // Delay the error the same way a real server would take to respond.
  return of(null).pipe(
    delay(latency),
    concatMap(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status,
            statusText: statusText(status),
            error: body,
            url: '',
          }),
      ),
    ),
  );
}

function statusText(status: number): string {
  switch (status) {
    case 200: return 'OK';
    case 204: return 'No Content';
    case 400: return 'Bad Request';
    case 404: return 'Not Found';
    case 405: return 'Method Not Allowed';
    case 500: return 'Internal Server Error';
    default: return '';
  }
}
