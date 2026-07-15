const BLOCKED_WORDS = [
  'asshole',
  'bastard',
  'bitch',
  'cock',
  'cunt',
  'dick',
  'faggot',
  'fuck',
  'nigger',
  'pussy',
  'retard',
  'shit',
  'slut',
  'whore',
]

const URL_PATTERN = /(?:https?:\/\/|www\.|(?:discord\.gg|discord\.com\/invite|t\.me|wa\.me)\/|\b[a-z0-9-]+\.(?:com|net|org|io|gg|co|me|ly|dev)\b)/i
const CONTROL_PATTERN = `[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]`

function normalizedForModeration(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[4@]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^a-z0-9]+/g, '')
}

export function validateUserContent(value: string, kind: 'name' | 'chat') {
  const maxLength = kind === 'name' ? 32 : 300
  const cleaned = value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
  if (!cleaned) throw new Error(kind === 'name' ? 'Enter your name first' : 'Write a message first')
  if (new RegExp(CONTROL_PATTERN).test(cleaned)) throw new Error('Please remove unsupported characters.')
  if (URL_PATTERN.test(cleaned)) throw new Error('Links are not allowed here.')

  const normalized = normalizedForModeration(cleaned)
  if (BLOCKED_WORDS.some((word) => normalized.includes(word))) {
    throw new Error(kind === 'name' ? 'Please choose an appropriate name.' : 'Please keep chat respectful.')
  }

  return cleaned
}
