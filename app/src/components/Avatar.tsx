import type { Profile } from '../types'

const COLORS = ['bg-primary', 'bg-highlight', 'bg-accent', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500']

type AvatarProfile = Pick<Profile, 'id' | 'name' | 'avatar'> & { photo_url?: string | null }

export default function Avatar({
  profile,
  size = 'h-10 w-10',
}: {
  profile: AvatarProfile
  size?: string
}) {
  if (profile.photo_url) {
    return (
      <img
        src={profile.photo_url}
        alt=""
        aria-hidden="true"
        className={`${size} shrink-0 rounded-full object-cover shadow-sm ring-1 ring-slate-200`}
      />
    )
  }
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
