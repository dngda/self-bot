import fs from 'fs/promises'
import fsSync from 'fs'
import chalk from 'chalk'
import { BotConfig, StickerCommand } from '../types.js'

const CONFIG_FILE_PATH = './data/config.json'

/**
 * ConfigManager - Centralized configuration management service
 * Implements singleton pattern with type-safe operations
 */
class ConfigManager {
    private static instance: ConfigManager
    private config: BotConfig
    private saveTimeout: NodeJS.Timeout | null = null
    private readonly SAVE_DEBOUNCE_MS = 500

    private constructor() {
        this.config = this.getDefaultConfig()
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager()
        }
        return ConfigManager.instance
    }

    /**
     * Initialize config from file
     */
    public async initialize(): Promise<void> {
        await this.loadConfig()
    }

    /**
     * Initialize config synchronously (for backward compatibility)
     */
    public initializeSync(): void {
        this.loadConfigSync()
    }

    /**
     * Get default configuration
     */
    private getDefaultConfig(): BotConfig {
        return {
            allowed_chats: [],
            sticker_commands: {},
            norevoke: false,
            norevoke_exceptions: [],
            norevoke_status: false,
            disabled_chats: [],
            autosticker: [],
            oneview: false,
            public: false,
        }
    }

    /**
     * Load configuration from file (async)
     */
    private async loadConfig(): Promise<void> {
        try {
            const fileExists = await fs
                .access(CONFIG_FILE_PATH)
                .then(() => true)
                .catch(() => false)

            if (!fileExists) {
                console.log(
                    chalk.yellow('[CONFIG]'),
                    'Config file not found, using defaults'
                )
                await this.saveConfig()
                return
            }

            const data = await fs.readFile(CONFIG_FILE_PATH, 'utf-8')
            const loadedConfig = JSON.parse(data || '{}')

            this.config = {
                ...this.getDefaultConfig(),
                ...loadedConfig,
            }

            console.log(
                chalk.green('[CONFIG]'),
                'Configuration loaded successfully'
            )
        } catch (error) {
            console.error(
                chalk.red('[CONFIG ERROR]'),
                'Failed to load config:',
                error
            )
            this.config = this.getDefaultConfig()
        }
    }

    /**
     * Load configuration from file (sync - for backward compatibility)
     */
    private loadConfigSync(): void {
        try {
            if (!fsSync.existsSync(CONFIG_FILE_PATH)) {
                console.log(
                    chalk.yellow('[CONFIG]'),
                    'Config file not found, using defaults'
                )
                return
            }

            const data = fsSync.readFileSync(CONFIG_FILE_PATH, 'utf-8')
            const loadedConfig = JSON.parse(data || '{}')

            this.config = {
                ...this.getDefaultConfig(),
                ...loadedConfig,
            }

            console.log(
                chalk.green('[CONFIG]'),
                'Configuration loaded successfully (sync)'
            )
        } catch (error) {
            console.error(
                chalk.red('[CONFIG ERROR]'),
                'Failed to load config:',
                error
            )
            this.config = this.getDefaultConfig()
        }
    }

    /**
     * Save configuration to file with debouncing
     */
    private async saveConfig(): Promise<void> {
        try {
            await fs.writeFile(
                CONFIG_FILE_PATH,
                JSON.stringify(this.config, null, 2),
                'utf-8'
            )
            console.log(chalk.green('[CONFIG]'), 'Configuration saved')
        } catch (error) {
            console.error(
                chalk.red('[CONFIG ERROR]'),
                'Failed to save config:',
                error
            )
            throw error
        }
    }

    /**
     * Schedule config save with debouncing to avoid excessive writes
     */
    private scheduleSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout)
        }

        this.saveTimeout = setTimeout(() => {
            this.saveConfig().catch((error) => {
                console.error(
                    chalk.red('[CONFIG ERROR]'),
                    'Debounced save failed:',
                    error
                )
            })
        }, this.SAVE_DEBOUNCE_MS)
    }

    /**
     * Force immediate save (bypass debouncing)
     */
    public async forceSave(): Promise<void> {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout)
            this.saveTimeout = null
        }
        await this.saveConfig()
    }

    /**
     * Get complete config (immutable)
     */
    public getConfig(): Readonly<BotConfig> {
        return { ...this.config }
    }

    /**
     * Get complete config string (for display purposes)
     */
    public getConfigSummary(): string {
        return `
Public Mode: ${this.config.public ? '✅ Enabled' : '❌ Disabled'}
No Revoke: ${this.config.norevoke ? '✅ Enabled' : '❌ Disabled'}
No Revoke Status: ${this.config.norevoke_status ? '✅ Enabled' : '❌ Disabled'}
Peek OneView: ${this.config.oneview ? '✅ Enabled' : '❌ Disabled'}

Allowed Chats: \n${
            this.config.allowed_chats.length > 0
                ? this.config.allowed_chats.join('\n')
                : 'None'
        }

Disabled Chats: \n${
            this.config.disabled_chats.length > 0
                ? this.config.disabled_chats.join('\n')
                : 'None'
        }

AutoSticker Chats: \n${
            this.config.autosticker.length > 0
                ? this.config.autosticker.join('\n')
                : 'None'
        }

No Revoke Exceptions: \n${
            this.config.norevoke_exceptions.length > 0
                ? this.config.norevoke_exceptions.join('\n')
                : 'None'
        }

Sticker Commands: \n${
            Object.keys(this.config.sticker_commands).length > 0
                ? Object.entries(this.config.sticker_commands)
                      .map(
                          ([sha, cmd]) => `${cmd.cmd} ${cmd.arg} (SHA: ${sha})`
                      )
                      .join('\n')
                : 'None'
        }
        `.trim()
    }

    /**
     * Get specific config value
     */
    public get<K extends keyof BotConfig>(key: K): BotConfig[K] {
        return this.config[key]
    }

    /**
     * Set specific config value
     */
    public set<K extends keyof BotConfig>(key: K, value: BotConfig[K]): void {
        this.config[key] = value
        this.scheduleSave()
    }

    // ============================================================
    // ALLOWED CHATS MANAGEMENT
    // ============================================================

    public isAllowedChat(chatId: string): boolean {
        return this.config.allowed_chats.includes(chatId)
    }

    public addAllowedChat(chatId: string): void {
        if (!this.config.allowed_chats.includes(chatId)) {
            this.config.allowed_chats.push(chatId)
            this.scheduleSave()
        }
    }

    public removeAllowedChat(chatId: string): void {
        this.config.allowed_chats = this.config.allowed_chats.filter(
            (id) => id !== chatId
        )
        this.scheduleSave()
    }

    public getAllowedChats(): readonly string[] {
        return [...this.config.allowed_chats]
    }

    // ============================================================
    // DISABLED CHATS MANAGEMENT
    // ============================================================

    public isDisabledChat(chatId: string): boolean {
        return this.config.disabled_chats.includes(chatId)
    }

    public addDisabledChat(chatId: string): void {
        if (!this.config.disabled_chats.includes(chatId)) {
            this.config.disabled_chats.push(chatId)
            this.scheduleSave()
        }
    }

    public removeDisabledChat(chatId: string): void {
        this.config.disabled_chats = this.config.disabled_chats.filter(
            (id) => id !== chatId
        )
        this.scheduleSave()
    }

    // ============================================================
    // STICKER COMMANDS MANAGEMENT
    // ============================================================

    public getStickerCommand(sha: string): StickerCommand | undefined {
        return this.config.sticker_commands[sha]
    }

    public setStickerCommand(sha: string, command: StickerCommand): void {
        this.config.sticker_commands[sha] = command
        this.scheduleSave()
    }

    public deleteStickerCommand(sha: string): boolean {
        if (sha in this.config.sticker_commands) {
            delete this.config.sticker_commands[sha]
            this.scheduleSave()
            return true
        }
        return false
    }

    public getAllStickerCommands(): Readonly<{
        [key: string]: StickerCommand
    }> {
        return { ...this.config.sticker_commands }
    }

    public hasStickerCommand(sha: string): boolean {
        return sha in this.config.sticker_commands
    }

    // ============================================================
    // AUTOSTICKER MANAGEMENT
    // ============================================================

    public isAutoStickerEnabled(chatId: string): boolean {
        return this.config.autosticker.includes(chatId)
    }

    public enableAutoSticker(chatId: string): void {
        if (!this.config.autosticker.includes(chatId)) {
            this.config.autosticker.push(chatId)
            this.scheduleSave()
        }
    }

    public disableAutoSticker(chatId: string): void {
        this.config.autosticker = this.config.autosticker.filter(
            (id) => id !== chatId
        )
        this.scheduleSave()
    }

    // ============================================================
    // NOREVOKE EXCEPTIONS MANAGEMENT
    // ============================================================

    public isNoRevokeException(chatId: string): boolean {
        return this.config.norevoke_exceptions.includes(chatId)
    }

    public addNoRevokeException(chatId: string): void {
        if (!this.config.norevoke_exceptions.includes(chatId)) {
            this.config.norevoke_exceptions.push(chatId)
            this.scheduleSave()
        }
    }

    public removeNoRevokeException(chatId: string): void {
        this.config.norevoke_exceptions =
            this.config.norevoke_exceptions.filter((id) => id !== chatId)
        this.scheduleSave()
    }

    // ============================================================
    // BOOLEAN FLAGS MANAGEMENT
    // ============================================================

    public isPublic(): boolean {
        return this.config.public
    }

    public setPublic(value: boolean): void {
        this.config.public = value
        this.scheduleSave()
    }

    public isNoRevoke(): boolean {
        return this.config.norevoke
    }

    public setNoRevoke(value: boolean): void {
        this.config.norevoke = value
        this.scheduleSave()
    }

    public isPeekOneView(): boolean {
        return this.config.oneview
    }

    public setPeekOneView(value: boolean): void {
        this.config.oneview = value
        this.scheduleSave()
    }

    public isNoRevokeStatus(): boolean {
        return this.config.norevoke_status
    }

    public setNoRevokeStatus(value: boolean): void {
        this.config.norevoke_status = value
        this.scheduleSave()
    }

    // ============================================================
    // UTILITY METHODS
    // ============================================================

    /**
     * Reset config to defaults
     */
    public async reset(): Promise<void> {
        this.config = this.getDefaultConfig()
        await this.forceSave()
        console.log(chalk.yellow('[CONFIG]'), 'Configuration reset to defaults')
    }

    /**
     * Validate config structure
     */
    public validate(): boolean {
        try {
            const required: (keyof BotConfig)[] = [
                'allowed_chats',
                'sticker_commands',
                'norevoke',
                'norevoke_exceptions',
                'norevoke_status',
                'disabled_chats',
                'autosticker',
                'oneview',
                'public',
            ]

            return required.every((key) => key in this.config)
        } catch {
            return false
        }
    }

    /**
     * Export config as JSON string
     */
    public export(): string {
        return JSON.stringify(this.config, null, 2)
    }

    /**
     * Import config from JSON string
     */
    public async import(jsonString: string): Promise<void> {
        try {
            const importedConfig = JSON.parse(jsonString)
            this.config = {
                ...this.getDefaultConfig(),
                ...importedConfig,
            }
            await this.forceSave()
            console.log(chalk.green('[CONFIG]'), 'Configuration imported')
        } catch (error) {
            console.error(
                chalk.red('[CONFIG ERROR]'),
                'Failed to import config:',
                error
            )
            throw new Error('Invalid config format')
        }
    }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance()

// Export class for testing purposes
export { ConfigManager }
