import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CrDetailComponent } from './cr-detail.component';
import { SessionService } from '../../session/session.service';
import { users } from '../../api/fixtures';
import { CrStatus, ReqUser } from '../../models/cr.models';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function render(user: ReqUser, id: string): Promise<ComponentFixture<CrDetailComponent>> {
	TestBed.configureTestingModule({
		imports: [CrDetailComponent],
		providers: [{ provide: SessionService, useValue: { user } }],
	});
	await TestBed.compileComponents();
	const fixture = TestBed.createComponent(CrDetailComponent);
	fixture.componentInstance.id = id;
	fixture.detectChanges(); // ngOnInit -> load()
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
});
