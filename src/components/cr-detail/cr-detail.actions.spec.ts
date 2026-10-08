import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { CrApiService } from '../../api/cr-api.service';
import { SessionService } from '../../session/session.service';
import { users } from '../../api/fixtures';
import { ReqUser } from '../../models/cr.models';

describe('CrDetailComponent decisions', () => {
	const latencyMs = 50;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [CrDetailComponent],
			providers: [{ provide: SessionService, useValue: { user: users.approver } }],
		});
		await TestBed.compileComponents();
	});

	function renderLoaded(user: ReqUser = users.approver, id = 'CR-1'): ComponentFixture<CrDetailComponent> {
		TestBed.overrideProvider(SessionService, { useValue: { user } });
		TestBed.inject(CrApiService).latencyMs = latencyMs;
		const fixture = TestBed.createComponent(CrDetailComponent);
		fixture.componentRef.setInput('id', id);
		fixture.detectChanges();
		tick(latencyMs);
		fixture.detectChanges();
		return fixture;
	}

	it('keeps the preview visible, blocks repeated decisions and renders a successful slow approval', fakeAsync(() => {
		const fixture = renderLoaded();
		const component = fixture.componentInstance;
		const api = TestBed.inject(CrApiService);
		const approve = jest.spyOn(api, 'approve');
		const reject = jest.spyOn(api, 'reject');
		const changed = jest.spyOn(component.changed, 'emit');
		component.rejectControl.setValue('A valid rejection reason');
		fixture.detectChanges();
		fixture.nativeElement.querySelector('.cr-actions__approve').click();
		void component.approve();
		void component.reject();
		fixture.detectChanges();

		expect(approve).toHaveBeenCalledTimes(1);
		expect(approve).toHaveBeenCalledWith(users.approver, 'CR-1', expect.any(String));
		expect(reject).not.toHaveBeenCalled();
		expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Add 1 unit of SKU-A');
		expect(fixture.nativeElement.querySelector('.cr-actions__approve').disabled).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__reject-btn').disabled).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__reason').readOnly).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__pending').getAttribute('role')).toBe('status');
		expect(fixture.nativeElement.querySelector('.cr-actions__pending').textContent).toContain('Saving decision');
		tick(latencyMs - 1);
		expect(component.detail?.status).toBe('PENDING_APPROVAL');
		expect(component.submitting).toBe(true);
		expect(changed).not.toHaveBeenCalled();
		tick(1);
		fixture.detectChanges();

		expect(component.submitting).toBe(false);
		expect(fixture.nativeElement.querySelector('.cr-detail__header .cr-status').textContent).toBe('APPROVED');
		expect(fixture.nativeElement.querySelector('.cr-timeline__entry:last-child').textContent).toContain('APPROVE');
		expect(fixture.nativeElement.querySelector('.cr-timeline__entry:last-child').textContent).toContain('mona');
		expect(component.detail?.audit.filter((entry) => entry.action === 'APPROVE')).toEqual([
			{ action: 'APPROVE', byUserId: 'mona', at: approve.mock.calls[0][2], note: undefined },
		]);
		expect(component.rejectControl.value).toBe('');
		expect(changed).toHaveBeenCalledTimes(1);
		expect(fixture.nativeElement.querySelector('.cr-actions__approve').hidden).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__approve').disabled).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__pending')).toBeNull();
	}));

	it('sends the trimmed reason once and renders a successful slow rejection', fakeAsync(() => {
		const fixture = renderLoaded();
		const component = fixture.componentInstance;
		const api = TestBed.inject(CrApiService);
		const approve = jest.spyOn(api, 'approve');
		const reject = jest.spyOn(api, 'reject');
		const changed = jest.spyOn(component.changed, 'emit');
		const textarea = fixture.nativeElement.querySelector('.cr-actions__reason') as HTMLTextAreaElement;
		textarea.value = ' \n Please revise the quantity. \t ';
		textarea.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		fixture.nativeElement.querySelector('.cr-actions__reject-btn').click();
		void component.reject();
		void component.approve();
		fixture.detectChanges();

		expect(reject).toHaveBeenCalledTimes(1);
		expect(reject).toHaveBeenCalledWith(users.approver, 'CR-1', expect.any(String), 'Please revise the quantity.');
		expect(approve).not.toHaveBeenCalled();
		expect(fixture.nativeElement.querySelector('.cr-actions__approve').disabled).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__reject-btn').disabled).toBe(true);
		expect(textarea.readOnly).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-detail__header')).not.toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__pending')).not.toBeNull();
		tick(latencyMs - 1);
		expect(component.detail?.status).toBe('PENDING_APPROVAL');
		expect(component.submitting).toBe(true);
		tick(1);
		fixture.detectChanges();

		expect(component.submitting).toBe(false);
		expect(fixture.nativeElement.querySelector('.cr-detail__header .cr-status').textContent).toBe('REJECTED');
		expect(component.detail?.audit.filter((entry) => entry.action === 'REJECT')).toEqual([
			{ action: 'REJECT', byUserId: 'mona', at: reject.mock.calls[0][2], note: 'Please revise the quantity.' },
		]);
		expect(fixture.nativeElement.querySelector('.cr-timeline__entry:last-child').textContent).toContain('REJECT');
		expect(fixture.nativeElement.querySelector('.cr-timeline__note').textContent).toBe('Please revise the quantity.');
		expect(component.rejectControl.value).toBe('');
		expect(changed).toHaveBeenCalledTimes(1);
		expect(fixture.nativeElement.querySelector('.cr-actions__approve').hidden).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__approve').disabled).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
	}));

	it.each(['', '   ', '\n\t'])('blocks the blank reason %j and shows feedback after a direct rejection attempt', (reason) => {
		fakeAsync(() => {
			const fixture = renderLoaded();
			const component = fixture.componentInstance;
			const reject = jest.spyOn(TestBed.inject(CrApiService), 'reject');
			component.rejectControl.setValue(reason);
			fixture.detectChanges();
			expect(component.rejectControl.invalid).toBe(true);
			expect(fixture.nativeElement.querySelector('.cr-actions__reject-btn').disabled).toBe(true);
			expect(fixture.nativeElement.querySelector('.cr-actions__reason-error')).toBeNull();
			void component.reject();
			fixture.detectChanges();
			expect(reject).not.toHaveBeenCalled();
			expect(component.submitting).toBe(false);
			expect(component.rejectControl.touched).toBe(true);
			expect(fixture.nativeElement.querySelector('.cr-actions__reason-error').textContent).toContain('Please enter a reason.');
		})();
	});

	it('ignores direct decision calls from a viewer', fakeAsync(() => {
		const fixture = renderLoaded(users.viewer);
		const api = TestBed.inject(CrApiService);
		const approve = jest.spyOn(api, 'approve');
		const reject = jest.spyOn(api, 'reject');
		const approveButton = fixture.nativeElement.querySelector('.cr-actions__approve') as HTMLButtonElement;
		expect(approveButton.hidden).toBe(true);
		expect(approveButton.disabled).toBe(true);
		approveButton.click();
		fixture.componentInstance.rejectControl.setValue('A valid reason');
		void fixture.componentInstance.approve();
		void fixture.componentInstance.reject();
		expect(approve).not.toHaveBeenCalled();
		expect(reject).not.toHaveBeenCalled();
		expect(fixture.componentInstance.submitting).toBe(false);
	}));

	it('ignores direct decision calls for a request that is already applied', fakeAsync(() => {
		const fixture = renderLoaded(users.approver, 'CR-2');
		const api = TestBed.inject(CrApiService);
		const approve = jest.spyOn(api, 'approve');
		const reject = jest.spyOn(api, 'reject');
		fixture.componentInstance.rejectControl.setValue('A valid reason');
		void fixture.componentInstance.approve();
		void fixture.componentInstance.reject();
		expect(approve).not.toHaveBeenCalled();
		expect(reject).not.toHaveBeenCalled();
		expect(fixture.componentInstance.detail?.status).toBe('APPLIED');
	}));

	it.each(['idle', 'loading', 'empty', 'error'] as const)('ignores direct decision calls in the %s view state', (status) => {
		fakeAsync(() => {
			const fixture = renderLoaded();
			const component = fixture.componentInstance;
			const api = TestBed.inject(CrApiService);
			const approve = jest.spyOn(api, 'approve');
			const reject = jest.spyOn(api, 'reject');
			component.state = { status, data: null };
			component.rejectControl.setValue('A valid reason');
			void component.approve();
			void component.reject();
			expect(approve).not.toHaveBeenCalled();
			expect(reject).not.toHaveBeenCalled();
			expect(component.submitting).toBe(false);
		})();
	});

	it.each(['approve', 'reject'] as const)(
		'checks the latest status after a failing %s response that already saved the decision',
		(action) => {
			fakeAsync(() => {
				const fixture = renderLoaded();
				const component = fixture.componentInstance;
				const api = TestBed.inject(CrApiService);
				const refresh = jest.spyOn(api, 'getChangeRequest');
				const decision = jest.spyOn(api, action);
				const changed = jest.spyOn(component.changed, 'emit');
				component.rejectControl.setValue('Please revise the quantity.');
				api.failNext = true;
				void component[action]();
				tick(latencyMs);
				fixture.detectChanges();
				expect(refresh).toHaveBeenCalledWith(users.approver, 'CR-1');
				expect(component.submitting).toBe(true);
				expect(component.detail?.status).toBe('PENDING_APPROVAL');
				expect(fixture.nativeElement.querySelector('.cr-actions__approve').disabled).toBe(true);
				expect(fixture.nativeElement.querySelector('.cr-actions__reject-btn').disabled).toBe(true);
				expect(fixture.nativeElement.querySelector('.cr-actions__pending')).not.toBeNull();
				void component.approve();
				void component.reject();
				tick(latencyMs);
				fixture.detectChanges();

				const status = action === 'approve' ? 'APPROVED' : 'REJECTED';
				const auditAction = action === 'approve' ? 'APPROVE' : 'REJECT';
				const label = action === 'approve' ? 'Approval' : 'Rejection';
				expect(decision).toHaveBeenCalledTimes(1);
				expect(component.submitting).toBe(false);
				expect(component.detail?.status).toBe(status);
				expect(component.detail?.audit.filter((entry) => entry.action === auditAction)).toHaveLength(1);
				expect(fixture.nativeElement.querySelector('.cr-detail__header .cr-status').textContent).toBe(status);
				expect(fixture.nativeElement.querySelector('.cr-actions__error').textContent).toContain(
					`${label} response failed: Network error. Showing the latest request status.`,
				);
				expect(fixture.nativeElement.querySelector('.cr-actions__error').getAttribute('role')).toBe('alert');
				expect(fixture.nativeElement.querySelector('.cr-actions__approve').hidden).toBe(true);
				expect(fixture.nativeElement.querySelector('.cr-actions__approve').disabled).toBe(true);
				expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
				expect(changed).toHaveBeenCalledTimes(1);
			})();
		},
	);

	it('shows Retry without decisions when the failed response cannot be verified', fakeAsync(() => {
		const fixture = renderLoaded();
		const component = fixture.componentInstance;
		const api = TestBed.inject(CrApiService);
		const refresh = jest.spyOn(api, 'getChangeRequest').mockRejectedValueOnce(new Error('Refresh unavailable'));
		api.failNext = true;
		void component.approve();
		tick(latencyMs);
		fixture.detectChanges();
		expect(component.submitting).toBe(false);
		expect(component.state.status).toBe('error');
		expect(fixture.nativeElement.querySelector('.cr-detail__error').textContent).toContain("Couldn't verify the decision");
		expect(fixture.nativeElement.querySelector('.cr-detail__header')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__approve')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
		fixture.nativeElement.querySelector('.cr-detail__error button').click();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-detail__loading')).not.toBeNull();
		tick(latencyMs);
		fixture.detectChanges();
		expect(refresh).toHaveBeenCalledTimes(2);
		expect(fixture.nativeElement.querySelector('.cr-detail__error')).toBeNull();
		expect(fixture.nativeElement.querySelector('.cr-detail__header .cr-status').textContent).toBe('APPROVED');
		expect(fixture.nativeElement.querySelector('.cr-actions__approve').hidden).toBe(true);
		expect(fixture.nativeElement.querySelector('.cr-actions__approve').disabled).toBe(true);
	}));

	it('preserves the reason and permits a retry if rejection failed before saving', fakeAsync(() => {
		const fixture = renderLoaded();
		const component = fixture.componentInstance;
		const api = TestBed.inject(CrApiService);
		const reject = jest
			.spyOn(api, 'reject')
			.mockImplementationOnce(
				() => new Promise((_, rejectResponse) => setTimeout(() => rejectResponse(new Error('Network error')), latencyMs)),
			);
		component.rejectControl.setValue('  Please revise the quantity.  ');
		void component.reject();
		tick(latencyMs * 2);
		fixture.detectChanges();
		expect(component.detail?.status).toBe('PENDING_APPROVAL');
		expect(component.detail?.audit.filter((entry) => entry.action === 'REJECT')).toHaveLength(0);
		expect(component.rejectControl.value).toBe('  Please revise the quantity.  ');
		expect(fixture.nativeElement.querySelector('.cr-actions__error').textContent).toContain('Network error');
		expect(fixture.nativeElement.querySelector('.cr-actions__reject-btn').disabled).toBe(false);
		expect(fixture.nativeElement.querySelector('.cr-actions__reason').readOnly).toBe(false);
		fixture.nativeElement.querySelector('.cr-actions__reject-btn').click();
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.cr-actions__error')).toBeNull();
		tick(latencyMs);
		fixture.detectChanges();
		expect(reject).toHaveBeenCalledTimes(2);
		expect(reject).toHaveBeenLastCalledWith(users.approver, 'CR-1', expect.any(String), 'Please revise the quantity.');
		expect(component.detail?.status).toBe('REJECTED');
		expect(component.detail?.audit.filter((entry) => entry.action === 'REJECT')).toHaveLength(1);
		expect(component.rejectControl.value).toBe('');
		expect(fixture.nativeElement.querySelector('.cr-actions__error')).toBeNull();
	}));

	it.each([false, true])('keeps the newer detail when an older decision settles (failure: %s)', (failResponse) => {
		fakeAsync(() => {
			const fixture = renderLoaded();
			const component = fixture.componentInstance;
			const api = TestBed.inject(CrApiService);
			const refresh = jest.spyOn(api, 'getChangeRequest');
			const changed = jest.spyOn(component.changed, 'emit');
			component.rejectControl.setValue('Reason for the old request');
			void component.approve();
			api.latencyMs = 10;
			fixture.componentRef.setInput('id', 'CR-2');
			fixture.detectChanges();
			tick(10);
			fixture.detectChanges();
			expect(component.detail?.id).toBe('CR-2');
			expect(component.rejectControl.value).toBe('');
			api.failNext = failResponse;
			tick(latencyMs - 10);
			fixture.detectChanges();
			expect(component.detail?.id).toBe('CR-2');
			expect(component.detail?.status).toBe('APPLIED');
			expect(component.submitting).toBe(false);
			expect(fixture.nativeElement.querySelector('.cr-detail__header h2').textContent).toContain('Replace SKU-B supplier');
			expect(fixture.nativeElement.querySelector('.cr-actions__error')).toBeNull();
			expect(refresh).toHaveBeenCalledTimes(1);
			expect(refresh).toHaveBeenCalledWith(users.approver, 'CR-2');
			expect(changed).toHaveBeenCalledTimes(1);
		})();
	});

	it('keeps a newer selection when verification of an older failed response settles', fakeAsync(() => {
		const fixture = renderLoaded();
		const component = fixture.componentInstance;
		const api = TestBed.inject(CrApiService);
		const changed = jest.spyOn(component.changed, 'emit');
		api.failNext = true;
		void component.approve();
		tick(latencyMs);
		expect(component.submitting).toBe(true);
		api.latencyMs = 10;
		fixture.componentRef.setInput('id', 'CR-2');
		fixture.detectChanges();
		tick(10);
		expect(component.detail?.id).toBe('CR-2');
		tick(latencyMs - 10);
		fixture.detectChanges();
		expect(component.detail?.id).toBe('CR-2');
		expect(component.detail?.status).toBe('APPLIED');
		expect(fixture.nativeElement.querySelector('.cr-actions__error')).toBeNull();
		expect(changed).toHaveBeenCalledTimes(1);
	}));

	it.each([false, true])('ignores old decision state and events after the acting user changes (failure: %s)', (failResponse) => {
		fakeAsync(() => {
			const fixture = renderLoaded();
			const component = fixture.componentInstance;
			const api = TestBed.inject(CrApiService);
			const refresh = jest.spyOn(api, 'getChangeRequest');
			const changed = jest.spyOn(component.changed, 'emit');
			const state = component.state;
			api.failNext = failResponse;
			void component.approve();
			TestBed.inject(SessionService).user = users.viewer;
			tick(latencyMs);
			fixture.detectChanges();
			expect(component.state).toBe(state);
			expect(component.actionError).toBeUndefined();
			expect(refresh).not.toHaveBeenCalled();
			expect(changed).not.toHaveBeenCalled();
			expect(fixture.nativeElement.querySelector('.cr-actions__approve').hidden).toBe(true);
			expect(fixture.nativeElement.querySelector('.cr-actions__approve').disabled).toBe(true);
			expect(fixture.nativeElement.querySelector('.cr-actions__reject')).toBeNull();
		})();
	});

	it.each([false, true])('ignores old decision state and events after destruction (failure: %s)', (failResponse) => {
		fakeAsync(() => {
			const fixture = renderLoaded();
			const component = fixture.componentInstance;
			const api = TestBed.inject(CrApiService);
			const refresh = jest.spyOn(api, 'getChangeRequest');
			const changed = jest.spyOn(component.changed, 'emit');
			const state = component.state;
			api.failNext = failResponse;
			void component.approve();
			fixture.destroy();
			tick(latencyMs);
			expect(component.state).toBe(state);
			expect(component.actionError).toBeUndefined();
			expect(refresh).not.toHaveBeenCalled();
			expect(changed).not.toHaveBeenCalled();
		})();
	});
});
