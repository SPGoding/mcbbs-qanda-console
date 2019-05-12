import { Component, Inject } from '@angular/core'
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material'

export interface EditUserInfo {
    uid: string,
    heartInitial: number,
    heartAbandoned: number,
    banned: boolean
}

@Component({
    selector: 'edit-add-user-dialog',
    templateUrl: './edit-user-dialog.component.html',
    styleUrls: ['./edit-user-dialog.component.css']
})
export class EditUserDialogComponent {
    constructor(
        public dialogRef: MatDialogRef<EditUserDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: EditUserInfo) { }

    cancel(): void {
        this.dialogRef.close()
    }
}
