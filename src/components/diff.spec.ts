import { computeDiff } from './diff.util';
import { LineItem } from '../models/cr.models';

const base: LineItem[] = [
	{ sku: 'SKU-A', description: 'Widget A', quantity: 10, unitPrice: 500 },
	{ sku: 'SKU-B', description: 'Widget B', quantity: 30, unitPrice: 100 },
];

describe('computeDiff', () => {
	it('detects a removed sku', () => {
		expect(computeDiff(base, [base[0]]).find((r) => r.sku === 'SKU-B')?.kind).toBe('removed');
	});

	it('detects an added sku', () => {
		const rows = computeDiff(base, [...base, { sku: 'SKU-C', description: 'C', quantity: 1, unitPrice: 5 }]);
		expect(rows.find((r) => r.sku === 'SKU-C')?.kind).toBe('added');
	});

	it('detects a quantity-only change as changed', () => {
		const rows = computeDiff(base, [{ ...base[0], quantity: 11 }, base[1]]);
		expect(rows.find((r) => r.sku === 'SKU-A')?.kind).toBe('changed');
	});

	it('detects a unit-price-only change as changed', () => {
		const rows = computeDiff(base, [{ ...base[0], unitPrice: 550 }, base[1]]);
		expect(rows.find((r) => r.sku === 'SKU-A')?.kind).toBe('changed');
	});

	it('detects a description-only change as changed', () => {
		const rows = computeDiff(base, [{ ...base[0], description: 'Updated Widget A' }, base[1]]);
		expect(rows.find((r) => r.sku === 'SKU-A')?.kind).toBe('changed');
	});

	it('marks equal copies as unchanged', () => {
		const proposed = base.map((item) => ({ ...item }));
		expect(computeDiff(base, proposed).map((row) => row.kind)).toEqual(['unchanged', 'unchanged']);
	});

	it('keeps both an added and a removed item in the same diff', () => {
		const added = { sku: 'SKU-C', description: 'Widget C', quantity: 1, unitPrice: 5 };
		expect(computeDiff(base, [base[0], added])).toEqual([
			{ sku: 'SKU-A', kind: 'unchanged', baseline: base[0], proposed: base[0] },
			{ sku: 'SKU-B', kind: 'removed', baseline: base[1] },
			{ sku: 'SKU-C', kind: 'added', proposed: added },
		]);
	});

	it('handles empty baseline and proposed lists', () => {
		expect(computeDiff([], [])).toEqual([]);
		expect(computeDiff([], base).map((row) => row.kind)).toEqual(['added', 'added']);
		expect(computeDiff(base, []).map((row) => row.kind)).toEqual(['removed', 'removed']);
	});

	it('preserves before and after values without modifying the inputs', () => {
		const baseline = base.map((item) => ({ ...item }));
		const proposed = [{ ...base[0], quantity: 11, unitPrice: 550, description: 'Updated Widget A' }, { ...base[1] }];
		const baselineSnapshot = baseline.map((item) => ({ ...item }));
		const proposedSnapshot = proposed.map((item) => ({ ...item }));

		expect(computeDiff(baseline, proposed)[0]).toEqual({
			sku: 'SKU-A',
			kind: 'changed',
			baseline: baselineSnapshot[0],
			proposed: proposedSnapshot[0],
		});
		expect(baseline).toEqual(baselineSnapshot);
		expect(proposed).toEqual(proposedSnapshot);
	});
});
