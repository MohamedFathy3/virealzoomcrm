import { spawn } from 'node:child_process';

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.includes('?')
    ? `${process.env.DATABASE_URL}&sslaccept=strict`
    : `${process.env.DATABASE_URL}?sslaccept=strict`;
}
const [command, ...args] = process.argv.slice(2);
if (!command) process.exit(1);
const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32', env: process.env });
child.on('error', error => {
  console.error(`Failed to start ${command}:`, error);
  process.exitCode = 1;
});
child.on('exit', code => process.exit(code ?? 1));
