import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { CrApiService } from '../../api/cr-api.service';
import { SessionService } from '../../session/session.service';
import { details, users } from '../../api/fixtures';
import { CrDetail, CrStatus, ReqUser } from '../../models/cr.models';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser, id: string): Promise<ComponentFixture<CrDetailComponent>> {
	TestBed.configureTestingModule({
		imports: [CrDetailComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	const fixture = TestBed.createComponent(CrDetailComponent);
	fixture.componentRef.setInput('id', id);
	fixture.detectChanges(); // ngOnChanges -> load()
	await flush(); // let the mock API resolve
	fixture.detectChanges(); // render the loaded state
	return fixture;
}

describe('CrDetailComponent', () => {
	it('loads and renders the change request title', async () => {
		const fixture = await render(users.approver, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
	});

	it('does not offer actions for a read-only viewer on a pending CR', async () => {
		const fixture = await render(users.viewer, 'CR-1'); // viewer: cr_r_o only; CR-1 is PENDING_APPROVAL
		expect(fixture.componentInstance.canApprove).toBe(false);
		expect(fixture.componentInstance.canReject).toBe(false);
		expect(fixture.nativeElement.querySelector('.cr-actions__approve')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	});

	it.each(['cr_a_u', 'cr_a_w', 'cr_a_o'])('offers decisions for a pending CR with %s', async (policy) => {
		const fixture = await render({ ...users.viewer, policies: ['cr_r_o', policy] }, 'CR-1');
		expect(fixture.componentInstance.canReject).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__approve').disabled).toBe(false);
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).not.toBeNull();
	});

	it.each(['cr_r_o', 'cr_x_o', 'cr_a', 'cr_a_other'])('does not treat %s as approval permission', async (policy) => {
		const fixture = await render({ ...users.viewer, policies: [policy] }, 'CR-1');
		expect(fixture.nativeElement.querySelector('.cr-actions__approve')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	});

	it.each<CrStatus>(['DRAFT', 'SUBMITTED', 'APPROVED', 'APPLIED', 'REJECTED', 'CANCELLED'])(
		'does not offer decisions for %s even to an approver',
		async (status) => {
			const fixture = await render(users.approver, 'CR-1');
			fixture.componentInstance.detail.status = status;
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('.cr-actions__approve')).toBeNull();
			expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
		},
	);

	it('removes decisions if the current user belongs to another organization', async () => {
		const fixture = await render(users.approver, 'CR-1');
		TestBed.inject(SessionService).user = users.otherOrg;
		fixture.detectChanges();
		expect(fixture.componentInstance.canApprove).toBe(false);
		expect(fixture.nativeElement.querySelector('.cr-actions__approve')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	});

	describe('preview and load states', () => {
		const latencyMs = 50;

		beforeEach(async () => {
			TestBed.configureTestingModule({
				imports: [CrDetailComponent],
				providers: [{ provide: SessionService, useValue: { user: users.approver } }],
			});
			await TestBed.compileComponents();
		});

		function renderPending(
			user: ReqUser = users.approver,
			id = 'CR-1',
			customDetail?: CrDetail,
			failNext = false,
		): ComponentFixture<CrDetailComponent> {
			TestBed.overrideProvider(SessionService, { useValue: { user } });
			const api = TestBed.inject(CrApiService);
			api.latencyMs = latencyMs;
			api.failNext = failNext;
			if (customDetail) {
				jest
					.spyOn(api, 'getChangeRequest')
					.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve(customDetail), api.latencyMs)));
			}
			const fixture = TestBed.createComponent(CrDetailComponent);
			fixture.componentRef.setInput('id', id);
			fixture.detectChanges();
			return fixture;
		}

		it('renders added, removed, changed and unchanged rows with before and after values', fakeAsync(() => {
			const unchanged = { sku: 'KEEP', description: 'Unchanged item', quantity: 1, unitPrice: 5 };
			const detail: CrDetail = {
				...details['CR-1'],
				baselineLineItems: [
					unchanged,
					{ sku: 'EDIT', description: 'Old description', quantity: 2, unitPrice: 10 },
					{ sku: 'REMOVE', description: 'Removed item', quantity: 3, unitPrice: 20 },
				],
				proposedLineItems: [
					{ ...unchanged },
					{ sku: 'EDIT', description: 'New description', quantity: 4, unitPrice: 12.5 },
					{ sku: 'ADD', description: 'Added item', quantity: 5, unitPrice: 30 },
				],
			};
			const fixture = renderPending(users.approver, 'CR-1', detail);
			tick(latencyMs);
			fixture.detectChanges();
			const element = fixture.nativeElement as HTMLElement;
			const rows = Array.from(element.querySelectorAll('.cr-diff__row'));
			expect(rows.map((row) => row.getAttribute('data-kind'))).toEqual(['unchanged', 'changed', 'removed', 'added']);
			expect(rows[1].querySelectorAll('td')[2].textContent).toContain('Old description');
			expect(rows[1].querySelectorAll('td')[2].textContent).toContain('2 × USD 10.00');
			expect(rows[1].querySelectorAll('td')[3].textContent).toContain('New description');
			expect(rows[1].querySelectorAll('td')[3].textContent).toContain('4 × USD 12.50');
			expect(rows[2].querySelectorAll('td')[3].textContent?.trim()).toBe('—');
			expect(rows[3].querySelectorAll('td')[2].textContent?.trim()).toBe('—');
			expect(rows[2].textContent).toContain('Removed item');
			expect(rows[3].textContent).toContain('Added item');
		}));

		it('makes the description-only supplier change visible in CR-2', fakeAsync(() => {
			const fixture = renderPending(users.approver, 'CR-2');
			tick(latencyMs);
			fixture.detectChanges();
			const element = fixture.nativeElement as HTMLElement;
			expect(element.querySelector('.cr-diff__row')?.getAttribute('data-kind')).toBe('changed');
			expect(Array.from(element.querySelectorAll('.cr-diff__description')).map((node) => node.textContent?.trim())).toEqual([
				'Widget B',
				'Widget B (new supplier)',
			]);
		}));

		it.each([
			{
				label: 'positive decimal',
				currency: 'EUR',
				baselineTotal: 8000.25,
				newTotal: 8500.75,
				delta: 500.5,
				expected: ['EUR 8,000.25', 'EUR 8,500.75', 'EUR 500.50'],
			},
			{
				label: 'zero',
				currency: 'USD',
				baselineTotal: 3000,
				newTotal: 3000,
				delta: 0,
				expected: ['USD 3,000.00', 'USD 3,000.00', 'USD 0.00'],
			},
			{
				label: 'negative decimal',
				currency: 'BHD',
				baselineTotal: 1200.55,
				newTotal: 900.25,
				delta: -300.3,
				expected: ['BHD 1,200.55', 'BHD 900.25', 'BHD -300.30'],
			},
		])('formats the API totals and $label delta with their currency', (scenario) => {
			fakeAsync(() => {
				const fixture = renderPending(users.approver, 'CR-1', { ...details['CR-1'], ...scenario });
				tick(latencyMs);
				fixture.detectChanges();
				const totals = fixture.nativeElement.querySelector('.cr-detail__totals').textContent;
				expect(totals).toContain(scenario.expected[0]);
				expect(totals).toContain(scenario.expected[1]);
				expect(fixture.nativeElement.querySelector('.cr-detail__delta').textContent).toContain(scenario.expected[2]);
			})();
		});

		it('orders timeline entries by actual time, preserves equal-time order and leaves the API array unchanged', fakeAsync(() => {
			const audit = [
				{ action: 'LAST', byUserId: 'mona', at: '2026-03-31T22:00:00.000Z', note: 'Ready for review' },
				{ action: 'EQUAL-FIRST', byUserId: 'alice', at: '2026-04-01T00:00:00.000+03:00' },
				{ action: 'FIRST', byUserId: 'alice', at: '2026-03-31T20:00:00.000Z' },
				{ action: 'EQUAL-SECOND', byUserId: 'amy', at: '2026-03-31T21:00:00.000Z' },
				{ action: 'MIDDLE', byUserId: 'amy', at: '2026-04-01T00:15:00.000+03:00' },
			];
			const snapshot = audit.map((entry) => ({ ...entry }));
			const fixture = renderPending(users.approver, 'CR-1', { ...details['CR-1'], audit });
			tick(latencyMs);
			fixture.detectChanges();
			const element = fixture.nativeElement as HTMLElement;
			expect(Array.from(element.querySelectorAll('.cr-timeline__action')).map((node) => node.textContent)).toEqual([
				'FIRST',
				'EQUAL-FIRST',
				'EQUAL-SECOND',
				'MIDDLE',
				'LAST',
			]);
			expect(element.querySelector('.cr-timeline__entry:last-child')?.textContent).toContain('mona');
			expect(element.querySelector('.cr-timeline__entry:last-child')?.textContent).toContain('2026-03-31T22:00:00.000Z');
			expect(element.querySelector('.cr-timeline__note')?.textContent).toBe('Ready for review');
			expect(fixture.componentInstance.timeline).not.toBe(audit);
			expect(audit).toEqual(snapshot);
		}));

		it('shows useful empty messages for an empty diff and timeline', fakeAsync(() => {
			const fixture = renderPending(users.approver, 'CR-1', {
				...details['CR-1'],
				baselineLineItems: [],
				proposedLineItems: [],
				audit: [],
				baselineTotal: 0,
				newTotal: 0,
				delta: 0,
			});
			tick(latencyMs);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('.cr-diff__empty')).not.toBeNull();
			expect(fixture.nativeElement.querySelector('.cr-timeline__empty')).not.toBeNull();
			expect(fixture.nativeElement.querySelectorAll('.cr-diff__row').length).toBe(0);
			expect(fixture.nativeElement.querySelectorAll('.cr-timeline__entry').length).toBe(0);
		}));

		it('shows the selection prompt without requesting an empty ID', fakeAsync(() => {
			const api = TestBed.inject(CrApiService);
			const request = jest.spyOn(api, 'getChangeRequest');
			const fixture = TestBed.createComponent(CrDetailComponent);
			fixture.componentRef.setInput('id', '');
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('.cr-detail__empty')).not.toBeNull();
			expect(fixture.nativeElement.querySelector('.cr-detail__loading')).toBeNull();
			expect(request).not.toHaveBeenCalled();
		}));

		it('shows loading until a delayed request resolves', fakeAsync(() => {
			const fixture = renderPending();
			expect(fixture.nativeElement.querySelector('.cr-detail__loading')).not.toBeNull();
			expect(fixture.nativeElement.querySelector('.cr-detail__header')).toBeNull();
			tick(latencyMs - 1);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('.cr-detail__loading')).not.toBeNull();
			tick(1);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('.cr-detail__loading')).toBeNull();
			expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
		}));

		it('shows a network error and reloads after Retry', fakeAsync(() => {
			const fixture = renderPending(users.approver, 'CR-1', undefined, true);
			tick(latencyMs);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('.cr-detail__error').textContent).toContain('Network error');
			expect(fixture.nativeElement.querySelector('.cr-detail__header')).toBeNull();
			fixture.nativeElement.querySelector('.cr-detail__error button').click();
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('.cr-detail__loading')).not.toBeNull();
			tick(latencyMs);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('.cr-detail__error')).toBeNull();
			expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
		}));

		it('does not expose a request from a different organization', fakeAsync(() => {
			const fixture = renderPending(users.viewer, 'CR-9');
			tick(latencyMs);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('.cr-detail__error').textContent).toContain('Not found');
			expect(fixture.nativeElement.querySelector('.cr-detail__header')).toBeNull();
			expect(fixture.nativeElement.querySelector('.cr-actions__approve')).toBeNull();
		}));

		it('reloads when the selected ID changes', fakeAsync(() => {
			const fixture = renderPending();
			tick(latencyMs);
			fixture.detectChanges();
			fixture.componentRef.setInput('id', 'CR-2');
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('.cr-detail__loading')).not.toBeNull();
			expect(fixture.nativeElement.querySelector('.cr-detail__header')).toBeNull();
			tick(latencyMs);
			fixture.detectChanges();
			expect(fixture.componentInstance.detail?.id).toBe('CR-2');
			expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Replace SKU-B supplier');
		}));

		it.each(['CR-1', 'missing-request'])('ignores the late result for %s after a newer selection loads', (oldId) => {
			fakeAsync(() => {
				const fixture = renderPending(users.approver, oldId);
				TestBed.inject(CrApiService).latencyMs = 10;
				fixture.componentRef.setInput('id', 'CR-2');
				fixture.detectChanges();
				tick(10);
				fixture.detectChanges();
				expect(fixture.componentInstance.detail?.id).toBe('CR-2');
				tick(latencyMs - 10);
				fixture.detectChanges();
				expect(fixture.componentInstance.detail?.id).toBe('CR-2');
				expect(fixture.nativeElement.querySelector('.cr-detail__error')).toBeNull();
			})();
		});

		it('ignores a response after the component is destroyed', fakeAsync(() => {
			const fixture = renderPending();
			fixture.destroy();
			tick(latencyMs);
			expect(fixture.componentInstance.state.status).toBe('loading');
			expect(fixture.componentInstance.detail).toBeNull();
		}));
	});
});
