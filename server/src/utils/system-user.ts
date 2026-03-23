import { execFile, spawn } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export async function systemUserExists(username: string): Promise<boolean> {
  const systemUsername = `auroracraft-${username}`
  try {
    await execFileAsync('id', [systemUsername])
    return true
  } catch {
    return false
  }
}

export async function createSystemUser(username: string, password: string): Promise<void> {
  const systemUsername = `auroracraft-${username}`

  const exists = await systemUserExists(username)
  if (exists) {
    console.log(`[SystemUser] User ${systemUsername} already exists, skipping creation`)
    return
  }

  console.log(`[SystemUser] Creating system user: ${systemUsername}`)

  await execFileAsync('adduser', [
    '--disabled-password',
    '--gecos', '',
    systemUsername,
  ])

  try {
    await setSystemUserPassword(systemUsername, password)
  } catch (err) {
    // Rollback: remove the user if password setting failed
    await execFileAsync('userdel', ['-r', systemUsername]).catch(() => {})
    throw err
  }

  console.log(`[SystemUser] System user ${systemUsername} created successfully`)
}

async function setSystemUserPassword(systemUsername: string, password: string): Promise<void> {
  if (password.includes('\n') || password.includes('\r')) {
    throw new Error('Password contains invalid characters (newline)')
  }

  return new Promise<void>((resolve, reject) => {
    const child = spawn('chpasswd', [], { stdio: ['pipe', 'ignore', 'pipe'] })

    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn chpasswd: ${err.message}`))
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`chpasswd exited with code ${code}: ${stderr.trim()}`))
      }
    })

    child.stdin.write(`${systemUsername}:${password}\n`)
    child.stdin.end()
  })
}

export async function changeSystemUserPassword(username: string, newPassword: string): Promise<void> {
  const systemUsername = `auroracraft-${username}`
  const exists = await systemUserExists(username)
  if (!exists) {
    throw new Error(`System user ${systemUsername} does not exist`)
  }
  await setSystemUserPassword(systemUsername, newPassword)
  console.log(`[SystemUser] Password changed for ${systemUsername}`)
}
