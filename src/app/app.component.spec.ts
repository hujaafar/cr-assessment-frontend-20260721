import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { CrApiService } from '../api/cr-api.service';

function render(): ComponentFixture<AppComponent> {
	const fixture = TestBed.createComponent(AppComponent);
	fixture.detectChanges();
	tick(0);
	fixture.detectChanges();
	return fixture;
}

function choose(fixture: ComponentFixture<AppComponent>, selector: string, value: string): void {
	const element = fixture.nativeElement as HTMLElement;
	const select = element.querySelector(selector) as HTMLSelectElement;
	select.value = value;
	select.dispatchEvent(new Event('change'));
	fixture.detectChanges();
}

function selectRequest(fixture: ComponentFixture<AppComponent>, id: string): void {
	const element = fixture.nativeElement as HTMLElement;
	const button = Array.from(element.querySelectorAll<HTMLButtonElement>('.cr-list__select')).find(
		(node) => node.textContent?.trim() === id,
	);
	expect(button).toBeDefined();
	button.click();
	fixture.detectChanges();
}

describe('AppComponent integration', () => {
	beforeEach(async () => {
		TestBed.configureTestingModule({ imports: [AppComponent] });
		await TestBed.compileComponents();
	});

	it('loads the selected request when its list button is clicked', fakeAsync(() => {
		const fixture = render();
		selectRequest(fixture, 'CR-2');
		tick(0);
		fixture.detectChanges();
		expect(fixture.componentInstance.selectedId).toBe('CR-2');
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Replace SKU-B supplier');
	}));

	it.each(['approve', 'reject'])('refreshes the list after %s and preserves the active filter', (action) => {
		fakeAsync(() => {
			const fixture = render();
			choose(fixture, '.cr-list__filter', 'PENDING_APPROVAL');
			expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(1);
			if (action === 'reject') {
				const reason = fixture.nativeElement.querySelector('.cr-actions__reason') as HTMLTextAreaElement;
				reason.value = 'The proposal needs a correction.';
				reason.dispatchEvent(new Event('input'));
				fixture.detectChanges();
			}
			const selector = action === 'approve' ? '.cr-actions__approve' : '.cr-actions__reject-btn';
			fixture.nativeElement.querySelector(selector).click();
			tick(0);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('.cr-list__filter').value).toBe('PENDING_APPROVAL');
			expect(fixture.nativeElement.querySelector('.cr-list__no-matches')).not.toBeNull();
			const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
			expect(fixture.nativeElement.querySelector('.cr-detail__header .cr-status').textContent).toBe(status);
			choose(fixture, '.cr-list__filter', 'ALL');
			const element = fixture.nativeElement as HTMLElement;
			const row = Array.from(element.querySelectorAll('.cr-list__row')).find((node) => node.textContent?.includes('CR-1'));
			expect(row?.querySelector('.cr-status')?.textContent).toBe(status);
		})();
	});

	it('clears selection on a viewer switch and offers no decisions after selection', fakeAsync(() => {
		const fixture = render();
		choose(fixture, '.app-user', 'viewer');
		expect(fixture.componentInstance.selectedId).toBeNull();
		tick(0);
		fixture.detectChanges();
		tick(0);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.app-selection-empty')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('app-cr-detail')).toBeNull();
		selectRequest(fixture, 'CR-1');
		tick(0);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
		expect(fixture.nativeElement.querySelector('.cr-actions__approve')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	}));

	it('shows only the other organization and ignores the previous delayed selection', fakeAsync(() => {
		const fixture = render();
		choose(fixture, '.app-delay', '1000');
		selectRequest(fixture, 'CR-2');
		expect(fixture.nativeElement.querySelector('.cr-detail__loading')).not.toBeNull();
		choose(fixture, '.app-user', 'otherOrg');
		tick(0);
		fixture.detectChanges();
		tick(1000);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(1);
		expect(fixture.nativeElement.querySelector('.cr-list__row').textContent).toContain('CR-9');
		expect(fixture.nativeElement.querySelector('app-cr-detail')).toBeNull();
		expect(fixture.nativeElement.querySelector('.app-selection-empty')).not.toBeNull();
		selectRequest(fixture, 'CR-9');
		tick(1000);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Beta org change');
	}));

	it('does not refresh the new user list from a delayed decision in the destroyed pane', fakeAsync(() => {
		const fixture = render();
		const listRequest = jest.spyOn(TestBed.inject(CrApiService), 'listChangeRequests');
		choose(fixture, '.app-delay', '1000');
		fixture.nativeElement.querySelector('.cr-actions__approve').click();
		fixture.detectChanges();
		choose(fixture, '.app-user', 'viewer');
		tick(0);
		fixture.detectChanges();
		expect(listRequest).toHaveBeenCalledTimes(1);
		tick(1000);
		fixture.detectChanges();
		expect(listRequest).toHaveBeenCalledTimes(1);
		expect(fixture.componentInstance.selectedId).toBeNull();
		expect(fixture.nativeElement.querySelector('app-cr-detail')).toBeNull();
		expect(fixture.nativeElement.querySelector('.app-selection-empty')).not.toBeNull();
		expect(fixture.nativeElement.querySelectorAll('.cr-list__row').length).toBe(3);
	}));

	it('uses the demo controls to show a delayed failure and successful retry', fakeAsync(() => {
		const fixture = render();
		choose(fixture, '.app-delay', '1000');
		expect(TestBed.inject(CrApiService).latencyMs).toBe(1000);
		const arm = fixture.nativeElement.querySelector('.app-fail-next') as HTMLButtonElement;
		arm.click();
		fixture.detectChanges();
		expect(arm.disabled).toBe(true);
		expect(arm.textContent).toContain('Failure armed');
		selectRequest(fixture, 'CR-2');
		expect(fixture.nativeElement.querySelector('.cr-detail__loading')).not.toBeNull();
		tick(999);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-detail__loading')).not.toBeNull();
		tick(1);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-detail__error').textContent).toContain('Network error');
		expect(arm.disabled).toBe(false);
		expect(arm.textContent).toContain('Fail next response');
		fixture.nativeElement.querySelector('.cr-detail__error button').click();
		fixture.detectChanges();
		tick(1000);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-detail__error')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Replace SKU-B supplier');
		choose(fixture, '.app-delay', '3000');
		expect(TestBed.inject(CrApiService).latencyMs).toBe(3000);
		choose(fixture, '.app-delay', '0');
		expect(TestBed.inject(CrApiService).latencyMs).toBe(0);
	}));
});
