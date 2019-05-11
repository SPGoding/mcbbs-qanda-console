import { Component, OnInit } from '@angular/core'
import { MatDialog } from '@angular/material'
import { AboutDialogComponent } from './about-dialog/about-dialog.component'
import { catchError } from 'rxjs/operators'
import { Users } from '../../../utils/types'

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    public readonly title = 'MCBBS 问答版月度活动管理后台'
    public readonly url = 'http://mqc.spgoding.com'

    public abandonedHeartBBCode = '加载中…'
    public registrationBBCode = '加载中…'

    public constructor(private aboutDialog: MatDialog) { }

    public ngOnInit() {
        this.updateAbandonedHeartBBCode()
        this.updateRegistrationBBCode()
    }

    private updateAbandonedHeartBBCode() {
        const xhr = new XMLHttpRequest()
        xhr.onreadystatechange = () => {
            if (xhr.readyState == 4 && xhr.status == 200) {
                this.abandonedHeartBBCode = xhr.responseText
            }
        };
        xhr.open('GET', `${this.url}/abandoned-heart-bbcode`)
        xhr.send()
    }

    private updateRegistrationBBCode() {
        const xhr = new XMLHttpRequest()
        xhr.onreadystatechange = () => {
            if (xhr.readyState == 4 && xhr.status == 200) {
                this.abandonedHeartBBCode = xhr.responseText
            }
        };
        xhr.open('GET', `${this.url}/registration-bbcode`)
        xhr.send()
    }

    public openAboutDialog() {
        this.aboutDialog.open(AboutDialogComponent, {
            height: '480px',
            width: '720px'
        })
    }
}
