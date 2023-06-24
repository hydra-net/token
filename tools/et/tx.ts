class Hooks<T> {
    before?: () => Promise<void>
    after?: (result?: T) => Promise<T>
    finally?: () => Promise<void>
    error?: (error: any) => Promise<void>
}

export class Transactional<T> {
    hooks?: Hooks<T>

    constructor(init: Partial<Transactional<T>>) {
        Object.assign(this, init);
    }

    async run(this: any, fn: () => Promise<T>): Promise<T> {
        let error = async (error: any): Promise<void> => { throw error }
        if (!!this.hooks?.error) {
            error = this.hooks.error
        }
        if (!!this.hooks?.before) {
            await this.hooks.before.call(this)
        }
        let ret: T = {} as T
        try {
            const result: T = await fn.call(this)
            if (!!this.hooks?.after) {
                ret = await this.hooks.after.call(this, result)
            }
            ret = result
        } catch (error: any) {
            await error(error)
        }
        if (!!this.hooks?.finally) {
            await this.hooks.finally.call(this)
        }
        return ret
    }
}

export function hookedTx<T>(hooks?: Hooks<T>): Transactional<T> { return new Transactional<T>({hooks: hooks}) }