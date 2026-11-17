/** Commands that would only mutate bridge metadata, not the persistent supervisor. */
export function orcaCommandRejection(command: string, enabled: boolean): string | undefined {
  if (!enabled) return undefined;
  if (['new', 'reset', 'cd', 'ws', 'resume', 'config', 'stop'].includes(command.replace(/^\//, ''))) {
    return '当前使用已绑定的 Orca 主管。此操作需要在 Orca 中完成并核对绑定；桥接层不会创建、重置、切换或终止主管，也不会更改模型、Fast 和权限。';
  }
  return undefined;
}
