import { Component, Inject } from '@angular/core'
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material'

export interface AddUserInfo {
    uid: string,
    heartInitial?: number
}

@Component({
    selector: 'app-add-user-dialog',
    templateUrl: './add-user-dialog.component.html',
    styleUrls: ['./add-user-dialog.component.css']
})
export class AddUserDialogComponent {

    constructor(
        public dialogRef: MatDialogRef<AddUserDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: AddUserInfo) { }

    cancel(): void {
        this.dialogRef.close()
    }
}
