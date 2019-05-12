import { Component, OnInit } from '@angular/core'
import { MatDialog } from '@angular/material'
import { AboutDialogComponent } from './about-dialog/about-dialog.component'
import { AddUserDialogComponent, AddUserInfo } from './add-user-dialog/add-user-dialog.component'
import * as md5 from 'md5'
import { EditUserDialogComponent, EditUserInfo } from './edit-user-dialog/edit-user-dialog.component';

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

interface UserArrayElement {
    username: string,
    heartInitial: number,
    heartAbandoned: number,
    heartAbandonedLinks: string[],
    heartPresent: number,
    heartAttained: number,
    banned: boolean,
    uid: number
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
    public readonly api = {
        getRankImage: 'api/get-rank-image',
        getAbandonedHeartsBBCode: 'api/get-abandoned-hearts-bbcode',
        getRegistrationBBCode: 'api/get-registration-bbcode',
        getUsers: 'api/get-users',
        login: 'api/login',
        addUser: 'api/add-user',
        editUser: 'api/edit-user',
        delUser: 'api/del-user'
    }

    public readonly title = 'MCBBS 问答版月度活动管理后台'
    public readonly url = '%{serverUrl}%'
    public readonly rankImageBBCode = `[img=554,260]${this.url}/${this.api.getRankImage}[/img]`

    public abandonedHeartBBCode = '加载中…'
    public registrationBBCode = '加载中…'
    public users: UserArrayElement[] = []
    public displayedColumns = ['uid', 'username', 'heartInitial', 'heartAbandoned', 'heartAbandonedLinks', 'heartPresent', 'heartAttained', 'banned', 'operations']

    public password = ''
    public toKeepLogin = false
    public failedToLogin = false
    public isLoggedIn = false

    public constructor(private dialog: MatDialog) { }

    public async ngOnInit() {
        await this.updateAll()
        // Auto login
        const pwd = window.localStorage.getItem('password')
        if (pwd) {
            this.password = pwd
            this.login(true)
        }
    }

    public async updateAll() {
        await this.getAbandonedHeartBBCode()
        await this.getRegistrationBBCode()
        await this.getUsers()
        console.log(this.users)
    }

    public async getAbandonedHeartBBCode() {
        this.abandonedHeartBBCode = await this.request('GET', this.api.getAbandonedHeartsBBCode)
    }

    public async getRegistrationBBCode() {
        this.registrationBBCode = await this.request('GET', this.api.getRegistrationBBCode)
    }

    public openAboutDialog() {
        this.dialog.open(AboutDialogComponent, {
            height: '480px',
            width: '720px'
        })
    }

    public openAddUserDialog() {
        const dialogRef = this.dialog.open(AddUserDialogComponent, {
            width: '360px',
            data: { uid: undefined, heartInitial: undefined }
        })
        dialogRef.afterClosed().subscribe(async (result: AddUserInfo) => {
            if (result && result.uid) {
                if (result.heartInitial !== undefined) {
                    await this.request('POST', this.api.addUser, `password=${this.password}&uid=${result.uid}&heartInitial=${result.heartInitial}`)
                } else {
                    await this.request('POST', this.api.addUser, `password=${this.password}&uid=${result.uid}`)
                }
                await this.updateAll()
            }
        })
    }

    public openEditUserDialog(user: UserArrayElement) {
        const dialogRef = this.dialog.open(EditUserDialogComponent, {
            width: '720px',
            data: {
                uid: user.uid,
                heartInitial: user.heartInitial,
                heartAbandoned: user.heartAbandoned,
                heartAbandonedLinks: user.heartAbandonedLinks.join(','),
                banned: user.banned
            }
        })
        dialogRef.afterClosed().subscribe(async (result: EditUserInfo) => {
            if (result !== undefined && result.uid !== undefined && result.heartInitial !== undefined && result.heartAbandoned !== undefined && result.banned !== undefined) {
                await this.request('POST', this.api.editUser,
                    `password=${this.password}&uid=${result.uid}&heartInitial=${result.heartInitial}&heartAbandoned=${result.heartAbandoned}&heartAbandonedLinks=${result.heartAbandonedLinks}&banned=${result.banned}`
                )
                await this.updateAll()
            }
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
        const users: Users = JSON.parse(await this.request('GET', this.api.getUsers))
        const userArray: UserArrayElement[] = []
        for (const uid in users) {
            userArray.push({ ...users[uid], uid: Number(uid) })
        }
        this.users = userArray
    }

    public async deleteUser(user: UserArrayElement) {
        await this.request('POST', this.api.delUser, `password=${this.password}&uid=${user.uid}`)
    }

    private async request(method: 'GET' | 'POST', api: string, message?: string | FormData) {
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
