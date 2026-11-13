import {describe,it,expect} from 'vitest';
import {recordDemoSiteVisit,summarizeSiteVisits} from '../../src/lib/site-visits';
describe('local site visit counting',()=>{
 it('initializes and counts once per account/day',()=>{const ledger=recordDemoSiteVisit(undefined,'member','2026-11-14');expect(recordDemoSiteVisit(ledger,'member','2026-11-14')).toBe(ledger);expect(summarizeSiteVisits(ledger,'2026-11-14')).toEqual({date:'2026-11-14',today:1,peak:1,total:1});});
 it('counts accounts independently and retains the largest day',()=>{let ledger=recordDemoSiteVisit(undefined,'a','2026-11-14');ledger=recordDemoSiteVisit(ledger,'b','2026-11-14');ledger=recordDemoSiteVisit(ledger,'a','2026-11-15');expect(summarizeSiteVisits(ledger,'2026-11-15')).toEqual({date:'2026-11-15',today:1,peak:2,total:3});});
 it('shows zero today while preserving earlier records',()=>{const ledger=recordDemoSiteVisit(undefined,'a','2026-11-14');expect(summarizeSiteVisits(ledger,'2026-11-15')).toMatchObject({today:0,peak:1,total:1});});
 it('does not mutate the previous ledger or backdate an account receipt',()=>{const ledger=recordDemoSiteVisit(undefined,'a','2026-11-14');expect(recordDemoSiteVisit(ledger,'a','2026-11-13')).toBe(ledger);const next=recordDemoSiteVisit(ledger,'a','2026-11-15');expect(ledger.receipts.a).toBe('2026-11-14');expect(next.receipts.a).toBe('2026-11-15');});
});
