export interface User {
    username: string,
    heartInitial: number,
    heartAbandoned: number,
    heartAbandonedLinks: string[],
    heartPresent: number,
    heartAttained: number,
    banned: boolean
}

export interface Users {
    [uid: number]: User
}