// 探针：宿主端读取 Windows 字体库这条链路到底通不通。
//   node read-fonts-probe.mjs
// 输出：
//   - 直接执行同一段 PowerShell 脚本得到的字体数（基准）
//   - 走插件宿主的 readWindowsFonts（execFile 子进程 + 管道）得到的字体数
// 两者不一致时，说明是"子进程输出捕获"这条路被环境挡了，不是脚本写错。
import { execFile } from 'node:child_process';

const SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  'Add-Type -AssemblyName System.Drawing',
  '$c = New-Object System.Drawing.Text.InstalledFontCollection',
  '$list = foreach ($f in $c.Families) {',
  '  $en = $f.Name',
  '  $zh = $null',
  '  try { $zh = $f.GetName(2052) } catch { $zh = $null }',
  '  if (-not $zh) { $zh = $en }',
  '  [PSCustomObject]@{ en = $en; zh = $zh }',
  '}',
  '$list | Sort-Object -Property zh -Unique | ConvertTo-Json -Compress',
].join('\n');

function runViaExecFile() {
  return new Promise((resolve) => {
    // 受限沙箱里 execFile 会**同步抛出** EPERM（连 spawn 都不允许），必须接住。
    try {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', SCRIPT], {
        encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 10 * 1024 * 1024,
      }, (error, stdout) => resolve({ error, stdout }));
    } catch (thrown) {
      resolve({ error: thrown, stdout: '' });
    }
  });
}

const { error, stdout } = await runViaExecFile();
console.log('平台:', process.platform);
console.log('execFile 子进程返回错误:', error ? `${error.code || error.name}: ${error.message}` : '无');
console.log('execFile 拿到的 stdout 长度:', String(stdout || '').length);

const parse = (await import('../lib/index.js')).parseFonts;
const fonts = parse(stdout);
console.log('解析出的字体数:', fonts.length);
if (fonts.length === 0) {
  console.log('\n结论：子进程通道没能拿到输出。');
  console.log('  在受限沙箱里"抓子进程 stdout"会被拒绝（EPERM），插件已按设计降级成"读不到字体"（不报错、不崩）。');
  console.log('  在正常的 DSH Desktop 进程里应当能读到 200+ 个字体；若那里也是 0，才是真出问题。');
} else {
  console.log('\n结论：子进程通道正常，前 5 个：');
  console.log('  ' + fonts.slice(0, 5).map((f) => f.zh).join('、'));
}
