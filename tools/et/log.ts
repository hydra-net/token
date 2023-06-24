import { Logger, ILogObj } from "tslog"

export class Log {
    static WithName(name: string, parent?: Logger<ILogObj>): Logger<ILogObj> {
        if (!parent) {
            return new Logger<ILogObj>({ name: name, minLevel: this.Level.Info})
        }
        if (parent.settings.name?.includes(name) || parent.settings.parentNames?.includes(name)) {
            return parent
        }
        return parent.getSubLogger({ name: name })
    }
    static WithLogLevel(level: LogLevel, parent?: Logger<ILogObj>): Logger<ILogObj> {
        if (!parent) {
            return new Logger<ILogObj>({ minLevel: this.Level.Info})
        }
        return parent.getSubLogger({ minLevel: level })
    }

    static Level: Record<string, LogLevel> = {
        Silly: 0,
        Trace: 1,
        Debug: 2,
        Info: 3,
        Warn: 4,
        Error: 5,
        Fatal: 6,
    }
}

export type LogLevel = number