import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CrApiService } from '../../api/cr-api.service';
import { SessionService } from '../../session/session.service';
import { CrDetail, TimelineEntry } from '../../models/cr.models';
import { idle, loading, ViewState } from '../../common/view-state';
import { computeDiff, DiffRow } from '../diff.util';
import { formatMoney } from '../../common/money.util';
import { canApprovePolicy } from '../../common/permissions';

/**
 * Change Request DETAIL page: loads a CR and renders the diff/preview, the approval timeline, and
 * permission-aware Approve/Reject actions.
 */
@Component({
	selector: 'app-cr-detail',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule],
	templateUrl: './cr-detail.component.html',
})
export class CrDetailComponent implements OnChanges, OnDestroy {
	@Input() id!: string;
	@Output() changed = new EventEmitter<void>();

	state: ViewState<CrDetail> = idle();
	submitting = false;
	actionError?: string;
	rejectControl = new FormControl('', {
		nonNullable: true,
		validators: [(control) => (control.value.trim() ? null : { required: true })],
	});
	private loadVersion = 0;
	private destroyed = false;

	constructor(private readonly api: CrApiService, private readonly session: SessionService) {}

	ngOnChanges(): void {
		void this.load();
	}

	async load(): Promise<void> {
		const version = ++this.loadVersion;
		const user = this.session.user;
		this.state = this.id ? loading() : { status: 'empty', data: null };
		this.actionError = undefined;
		this.rejectControl.reset();
		this.submitting = false;
		if (!this.id) return;
		try {
			const detail = await this.api.getChangeRequest(user, this.id);
			if (version !== this.loadVersion || user !== this.session.user) return;
			this.state = { status: 'loaded', data: detail };
		} catch (err) {
			if (version !== this.loadVersion || user !== this.session.user) return;
			this.state = { status: 'error', data: null, error: (err as Error).message };
		}
	}

	ngOnDestroy(): void {
		this.destroyed = true;
		this.loadVersion++;
	}

	get detail(): CrDetail | null {
		return this.state.data;
	}

	get diff(): DiffRow[] {
		return this.detail ? computeDiff(this.detail.baselineLineItems, this.detail.proposedLineItems) : [];
	}

	/** Approval timeline, oldest-first. */
	get timeline(): TimelineEntry[] {
		return [...(this.detail?.audit ?? [])].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
	}

	/** Whether the current user may approve the loaded CR. */
	get canApprove(): boolean {
		return (
			!this.destroyed &&
			this.state.status === 'loaded' &&
			this.detail?.status === 'PENDING_APPROVAL' &&
			this.detail.orgCode === this.session.user.orgCode &&
			canApprovePolicy(this.session.user)
		);
	}

	get canReject(): boolean {
		return this.canApprove;
	}

	fmt(amount: number): string {
		return this.detail ? formatMoney(amount, this.detail.currency) : String(amount);
	}

	async approve(): Promise<void> {
		if (!this.canApprove || this.submitting) return;
		await this.submitDecision('approve');
	}

	async reject(): Promise<void> {
		if (!this.canReject || this.submitting) return;
		this.rejectControl.markAsTouched();
		if (this.rejectControl.invalid) return;
		await this.submitDecision('reject');
	}

	/** Both decisions share the same pending and error handling. */
	private async submitDecision(action: 'approve' | 'reject'): Promise<void> {
		const id = this.detail.id;
		const user = this.session.user;
		const version = this.loadVersion;
		const isCurrent = () => version === this.loadVersion && user === this.session.user;
		const at = new Date().toISOString();
		const reason = this.rejectControl.value.trim();
		this.submitting = true;
		this.actionError = undefined;
		try {
			const updated = action === 'approve' ? await this.api.approve(user, id, at) : await this.api.reject(user, id, at, reason);
			if (!isCurrent()) return;
			this.state = { status: 'loaded', data: updated };
			this.rejectControl.reset();
		} catch (err) {
			if (!isCurrent()) return;
			const label = action === 'approve' ? 'Approval' : 'Rejection';
			this.actionError = `${label} response failed: ${(err as Error).message}.`;
			// The mock can save a decision before its response fails. Verify the outcome before allowing another action.
			try {
				const latest = await this.api.getChangeRequest(user, id);
				if (!isCurrent()) return;
				this.state = { status: 'loaded', data: latest };
				this.actionError += ' Showing the latest request status.';
				if (latest.status !== 'PENDING_APPROVAL') this.rejectControl.reset();
			} catch (refreshError) {
				if (!isCurrent()) return;
				this.state = {
					status: 'error',
					data: null,
					error: `Couldn't verify the decision: ${(refreshError as Error).message}. Retry to check its status before acting again.`,
				};
			}
		} finally {
			if (isCurrent()) this.submitting = false;
			// A completed decision can affect the list even when the user has selected a different request.
			if (!this.destroyed && user === this.session.user) this.changed.emit();
		}
	}
}
