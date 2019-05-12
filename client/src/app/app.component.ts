import { Component, OnInit } from '@angular/core'
import { MatDialog } from '@angular/material'
import { AboutDialogComponent } from './about-dialog/about-dialog.component'
import * as md5 from 'md5'

interface User {
    username: string,
    heartInitial: number,
    heartAbandoned: number,
    heartAbandonedLinks: string[],
    heartPresent: number,
    heartAttained: number,
    banned: boolean
}

interface Users {
    [uid: number]: User
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    public readonly api = {
        rank: 'api/get-rank-image',
        abandonedHearts: 'api/get-abandoned-hearts-bbcode',
        registration: 'api/get-registration-bbcode',
        users: 'api/get-users',
        login: 'api/login'
    }

    public readonly title = 'MCBBS 问答版月度活动管理后台'
    public readonly url = '%{serverUrl}%'
    public readonly rankImageBBCode = `[img=554,260]${this.url}/${this.api.rank}[/img]`

    public abandonedHeartBBCode = '加载中…'
    public registrationBBCode = '加载中…'
    public users: Users = {}

    public password = ''
    public toKeepLogin = false
    public failedToLogin = false
    public isLoggedIn = false

    public constructor(private aboutDialog: MatDialog) { }

    public ngOnInit() {
        this.updateAbandonedHeartBBCode()
        this.updateRegistrationBBCode()
        // Auto login
        const pwd = window.localStorage.getItem('password')
        if (pwd) {
            this.password = pwd
            this.login(true)
        }
    }

    public async updateAbandonedHeartBBCode() {
        this.abandonedHeartBBCode = await this.request('GET', this.api.abandonedHearts)
    }

    public async updateRegistrationBBCode() {
        this.registrationBBCode = await this.request('GET', this.api.registration)
    }

    public openAboutDialog() {
        this.aboutDialog.open(AboutDialogComponent, {
            height: '480px',
            width: '720px'
        })
    }

    public async login(isEncrypted = false) {
        if (!isEncrypted) {
            this.password = md5(this.password)
        }
        if (this.toKeepLogin) {
            window.localStorage.setItem('password', this.password)
        }

        const response = await this.request('POST', this.api.login, `password=${this.password}`)
        if (response === 'S') {
            this.isLoggedIn = true
        } else {
            this.password = ''
            this.failedToLogin = true
            window.localStorage.clear()
        }
    }

    public async logout() {
        this.isLoggedIn = false
        this.password = ''
        this.failedToLogin = false
        window.localStorage.clear()
    }

    public async getUsers() {
        this.users = JSON.parse(await this.request('GET', this.api.users))
    }

    private async request(method: 'GET' | 'POST', api: string, message?: string) {
        return new Promise<string>((resolve, _) => {
            const xhr = new XMLHttpRequest()
            xhr.onreadystatechange = () => {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    resolve(xhr.responseText)
                }
            }
            xhr.open(method, `${this.url}/${api}`)
            xhr.send(message)
        })
    }
}
