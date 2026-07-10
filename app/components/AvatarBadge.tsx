import Image from 'next/image'

export function AvatarBadge({
  avatar,
  name,
  size = 'md',
}: {
  avatar?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const initial = name.trim().slice(0, 1).toUpperCase() || '?'
  const label = avatar?.startsWith('agent-') ? avatar.replace('agent-', 'A') : initial
  const isImageAvatar = avatar?.startsWith('/avatars/') || avatar?.startsWith('http')

  return (
    <span className={`agent-avatar agent-avatar-${size}`} aria-hidden="true">
      {isImageAvatar && avatar ? (
        <Image src={avatar} alt="" fill sizes="64px" className="avatar-image" unoptimized />
      ) : (
        label
      )}
    </span>
  )
}
