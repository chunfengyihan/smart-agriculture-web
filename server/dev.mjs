import { spawn } from 'node:child_process'

const isWindows = process.platform === 'win32'

function getNpmDevCommand() {
  const npmExecPath = process.env.npm_execpath
  const npmArgs = ['run', 'dev', '--', '--host', '127.0.0.1']

  if (npmExecPath) {
    return [process.execPath, [npmExecPath, ...npmArgs]]
  }

  if (isWindows) {
    return ['cmd.exe', ['/d', '/s', '/c', 'npm run dev -- --host 127.0.0.1']]
  }

  return ['npm', npmArgs]
}

const commands = [
  [process.execPath, ['server/youren-api.mjs']],
  getNpmDevCommand(),
]

const children = commands.map(([command, args]) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
  })
  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exitCode = code
    }
  })
  return child
})

function stop() {
  for (const child of children) {
    child.kill()
  }
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
