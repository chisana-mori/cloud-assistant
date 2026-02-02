export function summarizeError(details: string): string {
    const normalized = details.toLowerCase();
    if (normalized.includes('401') || normalized.includes('invalid_api_key')) {
        return '鉴权失败：API Key 无效';
    }
    if (normalized.includes('timeout')) {
        return '请求超时';
    }
    return 'Codex 进程错误';
}
