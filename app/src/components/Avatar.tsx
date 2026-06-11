import type { Profile } from '../types'

const COLORS = ['bg-primary', 'bg-highlight', 'bg-accent', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500']

export default function Avatar({
  profile,
  size = 'h-10 w-10',
}: {
  profile: Pick<Profile, 'id' | 'name' | 'avatar'>
  size?: string
}) {
  const color = COLORS[profile.id.charCodeAt(profile.id.length - 1) % COLORS.length]
  const initials = profile.avatar ?? profile.name.slice(0, 2).toUpperCase()
  return (
    <div
      className={`${size} ${color} flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm`}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}
