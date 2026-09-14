import type { NextFunction, Request, Response } from 'express';
import { getCompanyBySlug } from '../lib/companies.js';

/**
 * Resolves the `:slug` URL param to a company and attaches it as
 * `req.company` for every downstream handler — the single choke point that
 * makes every route company-aware without each one repeating the lookup.
 * Mounted ahead of all five routers in index.ts.
 */
export function resolveTenant(req: Request, res: Response, next: NextFunction): void {
  const slug = req.params.slug;
  const company = getCompanyBySlug(slug);
  if (!company) {
    res.status(404).json({ error: `No company found for "${slug}"` });
    return;
  }
  req.company = company;
  next();
}
