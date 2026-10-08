import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { CrListComponent } from './cr-list.component';
import { CrApiService } from '../../api/cr-api.service';
import { SessionService } from '../../session/session.service';
import { summaries, users } from '../../api/fixtures';
import { CrStatus, ReqUser } from '../../models/cr.models';

const latencyMs = 50;
const statuses: CrStatus[] = ['DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'APPLIED', 'REJECTED', 'CANCELLED'];

function render(user: ReqUser = users.approver, failNext = false): ComponentFixture<CrListComponent> {
	TestBed.overrideProvider(SessionService, { useValue: { user } });
	const api = TestBed.inject(CrApiService);
	api.latencyMs = latencyMs;
	api.failNext = failNext;
	const fixture = TestBed.createComponent(CrListComponent);
	fixture.detectChanges();
	return fixture;
}

function chooseStatus(fixture: ComponentFixture<CrListComponent>, status: CrStatus | 'ALL'): void {
	const element = fixture.nativeElement as HTMLElement;
	const select = element.querySelector('select') as HTMLSelectElement;
	select.value = status;
	select.dispatchEvent(new Event('change'));
	fixture.detectChanges();
}

describe('CrListComponent additional coverage', () => {
	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [CrListComponent],
			providers: [{ provide: SessionService, useValue: { user: users.approver } }],
		});
		await TestBed.compileComponents();
	});

	it('shows loading until the delayed request finishes', fakeAsync(() => {
		const fixture = render();
		expect(fixture.nativeElement.querySelector('.cr-list__loading')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__table')).toBeNull();
		tick(latencyMs - 1);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-list__loading')).not.toBeNull();
		tick(1);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-list__loading')).toBeNull();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3);
	}));

	it('renders only requests from the current user organization', fakeAsync(() => {
		const fixture = render(users.otherOrg);
		tick(latencyMs);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(1);
		expect(fixture.nativeElement.querySelector('.cr-list__row').textContent).toContain('CR-9');
		expect(fixture.componentInstance.visibleRows.every((row) => row.orgCode === 'org-beta')).toBe(true);
	}));

	it('shows a network error and loads the requests after retry', fakeAsync(() => {
		const fixture = render(users.approver, true);
		tick(latencyMs);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-list__error').textContent).toContain('Network error');
		expect(fixture.nativeElement.querySelector('.cr-list__table')).toBeNull();
		fixture.nativeElement.querySelector('.cr-list__error button').click();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-list__loading')).not.toBeNull();
		tick(latencyMs);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-list__error')).toBeNull();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3);
	}));

	it.each(statuses)('filters the list to %s through the status control', (status) => {
		fakeAsync(() => {
			const fixture = render();
			tick(latencyMs);
			fixture.componentInstance.state = {
				status: 'loaded',
				data: statuses.map((value, index) => ({ ...summaries[0], id: `CR-${index}`, status: value })),
			};
			chooseStatus(fixture, status);
			expect(fixture.componentInstance.visibleRows.map((row) => row.status)).toEqual([status]);
			expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(1);
			expect(fixture.nativeElement.querySelector('.cr-status').textContent).toBe(status);
		})();
	});

	it('shows no matches and restores every request when ALL is selected', fakeAsync(() => {
		const fixture = render();
		tick(latencyMs);
		fixture.detectChanges();
		const apiCall = jest.spyOn(TestBed.inject(CrApiService), 'listChangeRequests');
		chooseStatus(fixture, 'REJECTED');
		expect(fixture.nativeElement.querySelector('.cr-list__no-matches').textContent).toContain('No change requests match');
		expect(fixture.nativeElement.querySelector('.cr-list__empty')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-list__table')).toBeNull();
		chooseStatus(fixture, 'ALL');
		expect(fixture.nativeElement.querySelector('.cr-list__no-matches')).toBeNull();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3);
		expect(apiCall).not.toHaveBeenCalled();
	}));

	it('formats the delta with its currency and emits one selection from the native button', fakeAsync(() => {
		const fixture = render();
		tick(latencyMs);
		fixture.detectChanges();
		const selected = jest.fn();
		fixture.componentInstance.select.subscribe(selected);
		const element = fixture.nativeElement as HTMLElement;
		const button = element.querySelector('.cr-list__select') as HTMLButtonElement;
		expect(button.type).toBe('button');
		expect(element.querySelector('.cr-list__row')?.textContent).toContain('USD 500.00');
		button.click();
		expect(selected).toHaveBeenCalledTimes(1);
		expect(selected).toHaveBeenCalledWith('CR-1');
	}));

	it('ignores an older organization response after a newer load finishes', fakeAsync(() => {
		const fixture = render();
		TestBed.inject(SessionService).user = users.otherOrg;
		TestBed.inject(CrApiService).latencyMs = 10;
		void fixture.componentInstance.load();
		tick(10);
		fixture.detectChanges();
		expect(fixture.componentInstance.visibleRows.map((row) => row.id)).toEqual(['CR-9']);
		tick(latencyMs - 10);
		fixture.detectChanges();
		expect(fixture.componentInstance.visibleRows.map((row) => row.id)).toEqual(['CR-9']);
	}));

	it('ignores a response arriving after the component is destroyed', fakeAsync(() => {
		const fixture = render();
		fixture.destroy();
		tick(latencyMs);
		expect(fixture.componentInstance.state.status).toBe('loading');
	}));
});
